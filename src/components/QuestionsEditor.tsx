import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, KIND_LABEL, questionTree, type Question, type QuestionKind } from '../db';
import { useConfirm } from './Confirm';

const parseOptions = (s: string) => s.split(',').map((o) => o.trim()).filter(Boolean);

type FormData = { text: string; kind: QuestionKind; options: string[]; parentId: number | null };

export function QuestionsEditor() {
  const ask = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState<{ parentId: number | null } | null>(null);
  const all = useLiveQuery(() => db.questions.orderBy('order').toArray(), []);
  if (!all) return null;
  const active = all.filter((q) => !q.archived);
  const archived = all.filter((q) => q.archived);
  const tree = questionTree(active);
  // Solo una pregunta Sí/No principal puede tener subpreguntas
  const parents = tree.map((n) => n.q).filter((q) => q.kind === 'sino');

  async function move(q: Question, siblings: Question[], dir: -1 | 1) {
    const other = siblings[siblings.indexOf(q) + dir];
    if (!other) return;
    await db.transaction('rw', db.questions, async () => {
      await db.questions.update(q.id, { order: other.order });
      await db.questions.update(other.id, { order: q.order });
    });
  }

  /** Borra la pregunta, o la retira si ya tiene respuestas (para no perderlas). */
  async function removeOne(q: Question) {
    const used = await db.answers.where('questionId').equals(q.id).count();
    if (used > 0) await db.questions.update(q.id, { archived: true });
    else await db.questions.delete(q.id);
  }

  async function remove(q: Question, children: Question[]) {
    const used = await db.answers.where('questionId').anyOf([q.id, ...children.map((c) => c.id)]).count();
    const subs = children.length ? ` y sus ${children.length} subpregunta(s)` : '';
    const msg = used > 0
      ? `«${q.text}»${subs} dejará(n) de aparecer en las reuniones nuevas. Las respuestas ya dadas se conservan.`
      : `Se borrará «${q.text}»${subs}.`;
    if (await ask(msg, used > 0 ? 'Retirar' : 'Borrar')) {
      for (const c of children) await removeOne(c);
      await removeOne(q);
    }
  }

  async function add(data: FormData) {
    const max = all!.reduce((m, q) => Math.max(m, q.order), 0);
    await db.questions.add({ ...data, order: max + 1, archived: false, createdAt: Date.now() } as Question);
    setAdding(null);
  }

  return (
    <section className="card">
      <h2>📋 Preguntas de las reuniones</h2>
      <p className="muted">
        Estas preguntas aparecen en todas las reuniones para que no se olvide preguntar nada.
        Una pregunta de Sí / No puede tener <strong>subpreguntas</strong>, que solo aparecen si se responde «Sí».
        Puedes cambiarlas cuando quieras; las respuestas ya dadas se conservan.
      </p>
      <ol className="qe-list">
        {tree.map((n, i) => (
          <li key={n.q.id} className="qe-node">
            <QuestionEditRow q={n.q} parents={parents} first={i === 0} last={i === tree.length - 1}
              onUp={() => move(n.q, tree.map((x) => x.q), -1)} onDown={() => move(n.q, tree.map((x) => x.q), 1)}
              onRemove={() => remove(n.q, n.children)} canHaveParent={n.children.length === 0} />
            {(n.children.length > 0 || adding?.parentId === n.q.id) && (
              <ul className="qe-sub">
                {n.children.map((c, j) => (
                  <li key={c.id}>
                    <QuestionEditRow q={c} parents={parents} first={j === 0} last={j === n.children.length - 1}
                      onUp={() => move(c, n.children, -1)} onDown={() => move(c, n.children, 1)}
                      onRemove={() => remove(c, [])} canHaveParent />
                  </li>
                ))}
                {adding?.parentId === n.q.id && (
                  <li><QuestionForm parents={parents} initialParent={n.q.id} canHaveParent onCancel={() => setAdding(null)} onSave={add} /></li>
                )}
              </ul>
            )}
            {n.q.kind === 'sino' && adding?.parentId !== n.q.id && (
              <button className="link-btn small add-sub" onClick={() => setAdding({ parentId: n.q.id })}>＋ Añadir subpregunta</button>
            )}
          </li>
        ))}
      </ol>
      {active.length === 0 && <p className="empty">No hay preguntas todavía.</p>}

      {adding?.parentId === null
        ? <QuestionForm parents={parents} initialParent={null} canHaveParent onCancel={() => setAdding(null)} onSave={add} />
        : <button className="btn ghost" onClick={() => setAdding({ parentId: null })}>＋ Añadir pregunta</button>}

      {archived.length > 0 && (
        <div className="archived-q">
          <button className="link-btn" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Ocultar preguntas retiradas' : `Ver preguntas retiradas (${archived.length})`}
          </button>
          {showArchived && (
            <ul className="list">
              {archived.map((q) => (
                <li key={q.id} className="list-row">
                  <span className="grow muted">{q.text}</span>
                  <button className="btn ghost small" onClick={() => db.questions.update(q.id, { archived: false })}>Recuperar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function QuestionEditRow({ q, parents, first, last, onUp, onDown, onRemove, canHaveParent }: {
  q: Question; parents: Question[]; first: boolean; last: boolean;
  onUp: () => void; onDown: () => void; onRemove: () => void; canHaveParent: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <QuestionForm initial={q} parents={parents.filter((p) => p.id !== q.id)} initialParent={q.parentId ?? null}
        canHaveParent={canHaveParent} onCancel={() => setEditing(false)}
        onSave={async (data) => { await db.questions.update(q.id, data); setEditing(false); }} />
    );
  }
  return (
    <div className="qe-item">
      <div className="grow">
        <div className="row-title">{q.parentId ? <span className="sub-mark" aria-hidden="true">↳ </span> : null}{q.text}</div>
        <div className="row-sub wrap">
          {KIND_LABEL[q.kind]}{q.options.length > 0 && <> · {q.options.join(', ')}</>}
        </div>
      </div>
      <div className="qe-actions">
        <button className="icon-btn" onClick={onUp} disabled={first} aria-label="Subir" title="Subir">↑</button>
        <button className="icon-btn" onClick={onDown} disabled={last} aria-label="Bajar" title="Bajar">↓</button>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar pregunta" title="Editar">✎</button>
        <button className="icon-btn" onClick={onRemove} aria-label="Quitar pregunta" title="Quitar">🗑</button>
      </div>
    </div>
  );
}

function QuestionForm({ initial, parents, initialParent, canHaveParent, onSave, onCancel }: {
  initial?: Question;
  parents: Question[];
  initialParent: number | null;
  canHaveParent: boolean;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [kind, setKind] = useState<QuestionKind>(initial?.kind ?? (initialParent ? 'unica' : 'sino'));
  const [options, setOptions] = useState(initial?.options.join(', ') ?? '');
  const [parentId, setParentId] = useState<number | null>(initialParent);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSave({ text: text.trim(), kind, options: kind === 'texto' ? [] : parseOptions(options), parentId });
  }

  const optionsLabel = kind === 'sino'
    ? 'Opciones que aparecen si la respuesta es «Sí» (separadas por comas, opcional)'
    : 'Opciones (separadas por comas)';

  return (
    <form className="form qe-form" onSubmit={submit}>
      <label>
        Pregunta
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. ¿La tienda va dentro de la web o es externa?" required />
      </label>
      <div className="form-row">
        <label>
          Tipo de respuesta
          <select value={kind} onChange={(e) => setKind(e.target.value as QuestionKind)} disabled={!!initial && !canHaveParent}
            title={initial && !canHaveParent ? 'Tiene subpreguntas: tiene que ser de Sí / No' : undefined}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {canHaveParent && (
          <label>
            Mostrar
            <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Siempre (pregunta principal)</option>
              {parents.map((p) => <option key={p.id} value={p.id}>Solo si es «Sí» en: {p.text}</option>)}
            </select>
          </label>
        )}
      </div>
      {kind !== 'texto' && (
        <label>
          {optionsLabel}
          <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Integrada en la web, Externa (la web redirige)" />
        </label>
      )}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary">{initial ? 'Guardar' : 'Añadir'}</button>
      </div>
    </form>
  );
}
