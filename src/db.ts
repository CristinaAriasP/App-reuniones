import Dexie, { type EntityTable } from 'dexie';

export interface Project {
  id: number;
  name: string;
  company: string;
  color: string;
  description: string;
  archived: boolean;
  createdAt: number;
}

export interface Meeting {
  id: number;
  projectId: number;
  date: string; // YYYY-MM-DD
  title: string;
  attendees: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: number;
  projectId: number;
  meetingId: number | null;
  title: string;
  dueDate: string; // YYYY-MM-DD o ''
  done: 0 | 1;
  createdAt: number;
}

export type DeliverableStatus = 'pendiente' | 'en_curso' | 'entregado';

export interface Deliverable {
  id: number;
  projectId: number;
  title: string;
  dueDate: string; // YYYY-MM-DD
  status: DeliverableStatus;
  notes: string;
  createdAt: number;
}

/** Pregunta de la plantilla que se responde en cada reunión. */
export type QuestionKind = 'sino' | 'unica' | 'opciones' | 'texto';

export interface Question {
  id: number;
  text: string;
  kind: QuestionKind;
  /** sino: opciones que se despliegan si la respuesta es «Sí». unica/opciones: lista para elegir. */
  options: string[];
  /** Si tiene valor, es una subpregunta que solo aparece cuando esa pregunta se responde «Sí». */
  parentId?: number | null;
  order: number;
  archived: boolean;
  createdAt: number;
}

export type Choice = '' | 'si' | 'no' | 'nose';

export interface Answer {
  id: number;
  meetingId: number;
  questionId: number;
  projectId: number;
  choice: Choice;
  selected: string[];
  text: string;
  updatedAt: number;
}

export const CHOICE_LABEL: Record<Exclude<Choice, ''>, string> = { si: 'Sí', no: 'No', nose: 'Por confirmar' };

export const KIND_LABEL: Record<QuestionKind, string> = {
  sino: 'Sí / No (con opciones si es «Sí»)',
  unica: 'Una sola opción',
  opciones: 'Varias opciones para marcar',
  texto: 'Respuesta libre',
};

export const db = new Dexie('app-reuniones') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  meetings: EntityTable<Meeting, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  deliverables: EntityTable<Deliverable, 'id'>;
  questions: EntityTable<Question, 'id'>;
  answers: EntityTable<Answer, 'id'>;
};

db.version(1).stores({
  projects: '++id, company, name, archived',
  meetings: '++id, projectId, date',
  tasks: '++id, projectId, meetingId, dueDate, done',
  deliverables: '++id, projectId, dueDate, status',
});

const DEFAULT_QUESTIONS: Omit<Question, 'id'>[] = [
  { text: '¿Necesita plataforma interna?', kind: 'sino', options: ['Inicio de sesión', 'Espacio cliente'], order: 1, archived: false, createdAt: 0 },
];

db.version(2).stores({
  questions: '++id, order',
  answers: '++id, meetingId, questionId, projectId, &[meetingId+questionId]',
}).upgrade(async (tx) => {
  await tx.table('questions').bulkAdd(DEFAULT_QUESTIONS);
});

// Preguntas añadidas más tarde a la plantilla por defecto
const QUESTIONS_V3: Omit<Question, 'id' | 'order'>[] = [
  { text: '¿La web va a tener newsletter?', kind: 'sino', options: [], archived: false, createdAt: 0 },
  { text: '¿La web va a tener apartado de blog o noticias?', kind: 'sino', options: ['Blog', 'Noticias'], archived: false, createdAt: 0 },
];

async function addMissingQuestions(table: Dexie.Table<Question, number>, list: Omit<Question, 'id' | 'order'>[]) {
  const existing = await table.toArray();
  const texts = new Set(existing.map((q) => q.text.trim().toLowerCase()));
  let order = existing.reduce((m, q) => Math.max(m, q.order), 0);
  for (const q of list) {
    if (!texts.has(q.text.toLowerCase())) await table.add({ ...q, order: ++order } as Question);
  }
}

db.version(3).stores({}).upgrade(async (tx) => {
  await addMissingQuestions(tx.table('questions'), QUESTIONS_V3);
});

const INTEGRADA = ['Integrada en la web', 'Externa (la web redirige)'];

/** v4: tienda online y plataformas con inicio de sesión, cada una con su subpregunta «¿dentro o fuera?». */
async function applyV4(table: Dexie.Table<Question, number>) {
  const all = await table.toArray();
  const find = (t: string) => all.find((q) => q.text.trim().toLowerCase() === t.toLowerCase());
  let order = all.reduce((m, q) => Math.max(m, q.order), 0);

  // La antigua «plataforma interna» pasa a ser «plataforma con inicio de sesión» (puede ser interna o externa)
  const platform = find('¿Necesita plataforma interna?') ?? find('¿Necesita una plataforma con inicio de sesión?');
  if (platform) {
    if (platform.text === '¿Necesita plataforma interna?') {
      const options = [...platform.options];
      for (const o of ['Espacio cliente', 'Plataforma de aprendizaje']) if (!options.includes(o)) options.push(o);
      await table.update(platform.id, { text: '¿Necesita una plataforma con inicio de sesión?', options });
    }
    if (!find('¿La plataforma va dentro de la web o es externa?')) {
      await table.add({ text: '¿La plataforma va dentro de la web o es externa?', kind: 'unica', options: INTEGRADA,
        parentId: platform.id, order: ++order, archived: false, createdAt: 0 } as Question);
    }
  }
  if (!find('¿La web va a tener tienda online?')) {
    const shopId = await table.add({ text: '¿La web va a tener tienda online?', kind: 'sino', options: [],
      parentId: null, order: ++order, archived: false, createdAt: 0 } as unknown as Question);
    await table.add({ text: '¿La tienda va dentro de la web o es externa?', kind: 'unica', options: INTEGRADA,
      parentId: shopId as number, order: ++order, archived: false, createdAt: 0 } as Question);
  }
}

db.version(4).stores({}).upgrade(async (tx) => {
  await applyV4(tx.table('questions'));
});

db.on('populate', async (tx) => {
  await tx.table('questions').bulkAdd(DEFAULT_QUESTIONS);
  await addMissingQuestions(tx.table('questions'), QUESTIONS_V3);
  await applyV4(tx.table('questions'));
});

export interface QuestionNode { q: Question; children: Question[] }

/**
 * Agrupa las preguntas (ya ordenadas) en principales y subpreguntas.
 * Una subpregunta cuya pregunta principal ya no existe se muestra como principal.
 */
export function questionTree(questions: Question[]): QuestionNode[] {
  const ids = new Set(questions.map((q) => q.id));
  const top = questions.filter((q) => !q.parentId || !ids.has(q.parentId));
  return top.map((q) => ({ q, children: questions.filter((c) => c.parentId === q.id) }));
}

/** Una respuesta cuenta como contestada si tiene algo. */
export function isAnswered(a: Answer | undefined): boolean {
  return !!a && (a.choice !== '' || a.selected.length > 0 || a.text.trim() !== '');
}

export async function saveAnswer(meeting: { id: number; projectId: number }, questionId: number, patch: Partial<Pick<Answer, 'choice' | 'selected' | 'text'>>) {
  await db.transaction('rw', db.answers, async () => {
    const existing = await db.answers.where('[meetingId+questionId]').equals([meeting.id, questionId]).first();
    if (existing) {
      await db.answers.update(existing.id, { ...patch, projectId: meeting.projectId, updatedAt: Date.now() });
    } else {
      await db.answers.add({
        meetingId: meeting.id, questionId, projectId: meeting.projectId,
        choice: '', selected: [], text: '', ...patch, updatedAt: Date.now(),
      } as Answer);
    }
  });
}

/** Texto legible de una respuesta (para búsquedas y resúmenes). */
export function answerText(a: Answer): string {
  return [a.choice ? CHOICE_LABEL[a.choice] : '', a.selected.join(', '), a.text].filter(Boolean).join(' · ');
}

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  entregado: 'Entregado',
};

export const PROJECT_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#475569',
];

export async function deleteProject(id: number) {
  await db.transaction('rw', [db.projects, db.meetings, db.tasks, db.deliverables, db.answers], async () => {
    await db.answers.where('projectId').equals(id).delete();
    await db.meetings.where('projectId').equals(id).delete();
    await db.tasks.where('projectId').equals(id).delete();
    await db.deliverables.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function deleteMeeting(id: number) {
  await db.transaction('rw', [db.meetings, db.tasks, db.answers], async () => {
    await db.answers.where('meetingId').equals(id).delete();
    // Las tareas de la reunión se conservan en el proyecto, solo se desvinculan
    await db.tasks.where('meetingId').equals(id).modify({ meetingId: null });
    await db.meetings.delete(id);
  });
}

// ---- Copia de seguridad ----

export interface Backup {
  app: 'app-reuniones';
  version: 1 | 2;
  exportedAt: string;
  questions?: Question[];
  answers?: Answer[];
  projects: Project[];
  meetings: Meeting[];
  tasks: Task[];
  deliverables: Deliverable[];
}

export async function exportBackup(): Promise<Backup> {
  const [projects, meetings, tasks, deliverables, questions, answers] = await Promise.all([
    db.projects.toArray(),
    db.meetings.toArray(),
    db.tasks.toArray(),
    db.deliverables.toArray(),
    db.questions.toArray(),
    db.answers.toArray(),
  ]);
  return { app: 'app-reuniones', version: 2, exportedAt: new Date().toISOString(), projects, meetings, tasks, deliverables, questions, answers };
}

export async function importBackup(data: Backup) {
  if (data?.app !== 'app-reuniones' || !Array.isArray(data.projects)) {
    throw new Error('El archivo no es una copia de seguridad válida de esta app.');
  }
  await db.transaction('rw', [db.projects, db.meetings, db.tasks, db.deliverables, db.questions, db.answers], async () => {
    await Promise.all([db.projects.clear(), db.meetings.clear(), db.tasks.clear(), db.deliverables.clear(), db.answers.clear()]);
    // Las copias antiguas no traen preguntas: se conserva la plantilla actual
    if (data.questions) {
      await db.questions.clear();
      await db.questions.bulkAdd(data.questions);
    }
    await db.answers.bulkAdd(data.answers ?? []);
    await db.projects.bulkAdd(data.projects);
    await db.meetings.bulkAdd(data.meetings ?? []);
    await db.tasks.bulkAdd(data.tasks ?? []);
    await db.deliverables.bulkAdd(data.deliverables ?? []);
  });
}
