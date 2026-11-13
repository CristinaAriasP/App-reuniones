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

export const db = new Dexie('app-reuniones') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  meetings: EntityTable<Meeting, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  deliverables: EntityTable<Deliverable, 'id'>;
};

db.version(1).stores({
  projects: '++id, company, name, archived',
  meetings: '++id, projectId, date',
  tasks: '++id, projectId, meetingId, dueDate, done',
  deliverables: '++id, projectId, dueDate, status',
});

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  entregado: 'Entregado',
};

export const PROJECT_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#475569',
];

export async function deleteProject(id: number) {
  await db.transaction('rw', [db.projects, db.meetings, db.tasks, db.deliverables], async () => {
    await db.meetings.where('projectId').equals(id).delete();
    await db.tasks.where('projectId').equals(id).delete();
    await db.deliverables.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function deleteMeeting(id: number) {
  await db.transaction('rw', [db.meetings, db.tasks], async () => {
    // Las tareas de la reunión se conservan en el proyecto, solo se desvinculan
    await db.tasks.where('meetingId').equals(id).modify({ meetingId: null });
    await db.meetings.delete(id);
  });
}

// ---- Copia de seguridad ----

export interface Backup {
  app: 'app-reuniones';
  version: 1;
  exportedAt: string;
  projects: Project[];
  meetings: Meeting[];
  tasks: Task[];
  deliverables: Deliverable[];
}

export async function exportBackup(): Promise<Backup> {
  const [projects, meetings, tasks, deliverables] = await Promise.all([
    db.projects.toArray(),
    db.meetings.toArray(),
    db.tasks.toArray(),
    db.deliverables.toArray(),
  ]);
  return { app: 'app-reuniones', version: 1, exportedAt: new Date().toISOString(), projects, meetings, tasks, deliverables };
}

export async function importBackup(data: Backup) {
  if (data?.app !== 'app-reuniones' || !Array.isArray(data.projects)) {
    throw new Error('El archivo no es una copia de seguridad válida de esta app.');
  }
  await db.transaction('rw', [db.projects, db.meetings, db.tasks, db.deliverables], async () => {
    await Promise.all([db.projects.clear(), db.meetings.clear(), db.tasks.clear(), db.deliverables.clear()]);
    await db.projects.bulkAdd(data.projects);
    await db.meetings.bulkAdd(data.meetings ?? []);
    await db.tasks.bulkAdd(data.tasks ?? []);
    await db.deliverables.bulkAdd(data.deliverables ?? []);
  });
}
