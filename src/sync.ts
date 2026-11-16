import {
  collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import Dexie from 'dexie';
import { applyFromRemote, db, seedDefaultQuestions, setSyncTarget, TABLES, UNIQUE_ID_MIN, uniqueId, type TableName } from './db';

/**
 * Sincronización entre la base de datos del navegador (Dexie) y Firestore.
 *
 * - Los datos de cada persona están en users/{uid}/{tabla}/{id}.
 * - Cada cambio local se sube al momento (db.ts avisa con unos «ganchos»).
 * - Los cambios de otros dispositivos llegan en tiempo real y se aplican aquí.
 * - La primera vez que se inicia sesión en un navegador, lo que ya hubiera en él se sube a la cuenta.
 */

export type SyncStatus = 'syncing' | 'ok' | 'offline' | 'error';

const MARKER = 'reuniones.syncedUid';
const getMarker = () => { try { return localStorage.getItem(MARKER); } catch { return null; } };
const setMarker = (v: string | null) => {
  try { if (v) localStorage.setItem(MARKER, v); else localStorage.removeItem(MARKER); } catch { /* sin almacenamiento */ }
};

type Row = { id: number } & Record<string, unknown>;
const plain = (o: unknown) => JSON.parse(JSON.stringify(o)) as Row;
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

let unsubs: Unsubscribe[] = [];

/** Referencias entre tablas, para poder cambiar ids sin romper nada. */
const REFS: Partial<Record<TableName, Partial<Record<string, TableName>>>> = {
  meetings: { projectId: 'projects' },
  tasks: { projectId: 'projects', meetingId: 'meetings' },
  deliverables: { projectId: 'projects' },
  answers: { projectId: 'projects', meetingId: 'meetings', questionId: 'questions' },
  questions: { parentId: 'questions' },
};

/**
 * Los datos creados antes de la sincronización tienen ids pequeños (1, 2, 3…), que podrían
 * coincidir con los de otro dispositivo. Antes de subirlos se les da un id único.
 */
async function rekeyLegacyIds() {
  await applyFromRemote(async () => {
    const maps = new Map<TableName, Map<number, number>>();
    const rows = new Map<TableName, Row[]>();
    for (const t of TABLES) {
      const list = (await db.table(t).toArray()) as Row[];
      rows.set(t, list);
      const m = new Map<number, number>();
      for (const r of list) if (r.id < UNIQUE_ID_MIN) m.set(r.id, uniqueId());
      maps.set(t, m);
    }
    if ([...maps.values()].every((m) => m.size === 0)) return;
    for (const t of TABLES) {
      const refs = REFS[t] ?? {};
      const idMap = maps.get(t)!;
      const changed: Row[] = [];
      const oldIds: number[] = [];
      for (const r of rows.get(t)!) {
        let dirty = false;
        const copy: Row = { ...r };
        if (idMap.has(r.id)) { copy.id = idMap.get(r.id)!; oldIds.push(r.id); dirty = true; }
        for (const [field, target] of Object.entries(refs)) {
          const v = r[field];
          const nv = typeof v === 'number' ? maps.get(target!)!.get(v) : undefined;
          if (nv != null) { copy[field] = nv; dirty = true; }
        }
        if (dirty) changed.push(copy);
      }
      if (oldIds.length) await db.table(t).bulkDelete(oldIds);
      if (changed.length) await db.table(t).bulkPut(changed);
    }
  });
}

/**
 * Si la cuenta ya tiene preguntas con el mismo texto que las de este navegador,
 * se usan las de la cuenta (para no duplicar la plantilla) y se reasignan las respuestas.
 */
async function mergeQuestionTemplates(remoteQuestions: Map<number, Row>) {
  const byText = new Map<string, number>();
  for (const q of remoteQuestions.values()) byText.set(norm(q.text), q.id);
  const local = (await db.questions.toArray()) as unknown as Row[];
  const remap = new Map<number, number>();
  for (const q of local) {
    if (remoteQuestions.has(q.id)) continue;
    const rid = byText.get(norm(q.text));
    if (rid != null) remap.set(q.id, rid);
  }
  if (!remap.size) return;
  await applyFromRemote(async () => {
    for (const a of await db.answers.toArray()) {
      const nq = remap.get(a.questionId);
      if (nq == null) continue;
      const clash = await db.answers.where('[meetingId+questionId]').equals([a.meetingId, nq]).first();
      if (clash) await db.answers.delete(a.id);
      else await db.answers.update(a.id, { questionId: nq });
    }
    for (const q of await db.questions.toArray()) {
      const np = q.parentId != null ? remap.get(q.parentId) : undefined;
      if (np != null) await db.questions.update(q.id, { parentId: np });
    }
    await db.questions.bulkDelete([...remap.keys()]);
  });
}

async function uploadRows(fs: Firestore, uid: string, rows: { table: TableName; row: Row }[]) {
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(fs);
    for (const { table, row } of rows.slice(i, i + 400)) batch.set(doc(fs, 'users', uid, table, String(row.id)), plain(row));
    await batch.commit();
  }
}

/** Aplica un documento que llega de la nube. */
async function putRemote(table: TableName, row: Row, losers: { table: TableName; id: number }[]) {
  if (table === 'answers') {
    // Solo puede haber una respuesta por reunión y pregunta: si dos dispositivos respondieron a la vez, gana la de la nube
    const clash = await db.answers.where('[meetingId+questionId]').equals([row.meetingId as number, row.questionId as number]).first();
    if (clash && clash.id !== row.id) {
      await db.answers.delete(clash.id);
      losers.push({ table, id: clash.id });
    }
  }
  await db.table(table).put(row);
}

export async function startSync(fs: Firestore, uid: string, onStatus: (s: SyncStatus, error?: string) => void) {
  stopSync();
  onStatus('syncing');
  // Abrir la base de datos antes de activar la subida: si es nueva, crea la plantilla de preguntas
  // por defecto, y esa no debe subirse tal cual (se fusiona más abajo con la de la cuenta)
  await db.open();
  const pushError = (e: unknown) => { console.error(e); onStatus('error', 'No se pudo guardar un cambio en la nube.'); };

  // Cada cambio local se sube a la nube
  setSyncTarget({
    push: (table, obj) => { setDoc(doc(fs, 'users', uid, table, String(obj.id)), plain(obj)).catch(pushError); },
    remove: (table, id) => { deleteDoc(doc(fs, 'users', uid, table, String(id))).catch(pushError); },
  });

  try {
    const marker = getMarker();
    if (marker && marker !== uid) {
      // En este navegador había otra cuenta: se empieza de cero
      await applyFromRemote(async () => { for (const t of TABLES) await db.table(t).clear(); });
    }
    const firstTimeHere = marker !== uid;
    if (firstTimeHere) await rekeyLegacyIds();

    const remote = new Map<TableName, Map<number, Row>>();
    for (const t of TABLES) {
      const snap = await getDocs(collection(fs, 'users', uid, t));
      remote.set(t, new Map(snap.docs.map((d) => { const r = d.data() as Row; return [r.id, r]; })));
    }

    if (firstTimeHere) {
      // Subir a la cuenta lo que hubiera en este navegador
      await mergeQuestionTemplates(remote.get('questions')!);
      const toUpload: { table: TableName; row: Row }[] = [];
      for (const t of TABLES) {
        for (const row of (await db.table(t).toArray()) as Row[]) {
          if (!remote.get(t)!.has(row.id)) toUpload.push({ table: t, row });
        }
      }
      await uploadRows(fs, uid, toUpload);
    }

    // Traer lo de la cuenta. Si este navegador ya estaba sincronizado, lo que no esté en la nube se borró en otro sitio.
    const losers: { table: TableName; id: number }[] = [];
    await applyFromRemote(async () => {
      for (const t of TABLES) {
        if (!firstTimeHere) {
          const localIds = (await db.table(t).toCollection().primaryKeys()) as number[];
          const gone = localIds.filter((id) => !remote.get(t)!.has(id));
          if (gone.length) await db.table(t).bulkDelete(gone);
        }
        for (const row of remote.get(t)!.values()) await putRemote(t, row, losers);
      }
    });
    for (const l of losers) deleteDoc(doc(fs, 'users', uid, l.table, String(l.id))).catch(pushError);
    setMarker(uid);

    // Cambios en tiempo real desde otros dispositivos
    for (const t of TABLES) {
      unsubs.push(onSnapshot(collection(fs, 'users', uid, t), { includeMetadataChanges: true }, (snap) => {
        onStatus(snap.metadata.fromCache ? 'offline' : 'ok');
        // Los cambios hechos en este navegador ya están aplicados: solo interesan los de fuera
        const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);
        if (!changes.length) return;
        const losers2: { table: TableName; id: number }[] = [];
        applyFromRemote(async () => {
          for (const c of changes) {
            const row = c.doc.data() as Row;
            if (c.type === 'removed') await db.table(t).delete(Number(c.doc.id));
            else await putRemote(t, row, losers2);
          }
        }).then(() => {
          for (const l of losers2) deleteDoc(doc(fs, 'users', uid, l.table, String(l.id))).catch(pushError);
        }).catch((e) => { console.error(e); onStatus('error', 'No se pudo aplicar un cambio de la nube.'); });
      }, (e) => { console.error(e); onStatus('error', 'Se perdió la conexión con la nube. Recarga la página.'); }));
    }
  } catch (e) {
    console.error(e);
    onStatus('error', e instanceof Dexie.DexieError ? 'Error en los datos de este navegador.' : 'No se pudo sincronizar con la nube.');
  }
}

export function stopSync() {
  setSyncTarget(null);
  for (const u of unsubs) u();
  unsubs = [];
}

/** Al cerrar sesión: se borran los datos de este navegador (siguen en la cuenta). */
export async function clearLocalData() {
  stopSync();
  await applyFromRemote(async () => { for (const t of TABLES) await db.table(t).clear(); });
  setMarker(null);
  await seedDefaultQuestions();
}

/** Tras restaurar una copia de seguridad: la nube pasa a tener exactamente lo mismo que este navegador. */
export async function replaceRemoteWithLocal(fs: Firestore, uid: string) {
  for (const t of TABLES) {
    const local = (await db.table(t).toArray()) as Row[];
    const localIds = new Set(local.map((r) => r.id));
    const snap = await getDocs(collection(fs, 'users', uid, t));
    const stale = snap.docs.filter((d) => !localIds.has(Number(d.id)));
    for (let i = 0; i < stale.length; i += 400) {
      const batch = writeBatch(fs);
      for (const d of stale.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    await uploadRows(fs, uid, local.map((row) => ({ table: t, row })));
  }
}
