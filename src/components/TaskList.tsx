import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { db, type Meeting, type Project, type Task } from '../db';
import { formatDate, relativeDue } from '../utils';

export function DueBadge({ date, done }: { date: string; done?: boolean }) {
  if (!date) return null;
  const r = relativeDue(date);
  return <span className={`badge due-${done ? 'ok' : r.tone}`} title={formatDate(date)}>{done ? formatDate(date) : r.text}</span>;
}

export function TaskQuickAdd({ projectId, meetingId = null }: { projectId: number; meetingId?: number | null }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await db.tasks.add({ projectId, meetingId, title: title.trim(), dueDate, done: 0, createdAt: Date.now() } as Task);
    setTitle('');
    setDueDate('');
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Añadir tarea…" aria-label="Nueva tarea" />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Fecha límite" />
      <button className="btn primary" type="submit" disabled={!title.trim()}>Añadir</button>
    </form>
  );
}

export function TaskItem({ task, project, meeting, showProject }: {
  task: Task;
  project?: Project;
  meeting?: Meeting;
  showProject?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await db.tasks.update(task.id, { title: title.trim(), dueDate });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="task editing">
        <form className="quick-add" onSubmit={save}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button className="btn primary" type="submit">Guardar</button>
          <button className="btn ghost" type="button" onClick={() => setEditing(false)}>Cancelar</button>
        </form>
      </li>
    );
  }

  return (
    <li className={'task' + (task.done ? ' done' : '')}>
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => db.tasks.update(task.id, { done: task.done ? 0 : 1 })}
        aria-label={task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
      />
      <div className="task-body">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {showProject && project && (
            <Link to={`/proyecto/${project.id}`} className="chip" style={{ '--c': project.color } as React.CSSProperties}>{project.name}</Link>
          )}
          {meeting && <Link to={`/reunion/${meeting.id}`} className="muted-link">De: {meeting.title || 'Reunión'} · {formatDate(meeting.date)}</Link>}
        </span>
      </div>
      <DueBadge date={task.dueDate} done={!!task.done} />
      <div className="row-actions">
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar tarea" title="Editar">✎</button>
        <button className="icon-btn" onClick={() => db.tasks.delete(task.id)} aria-label="Borrar tarea" title="Borrar">🗑</button>
      </div>
    </li>
  );
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done - b.done;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt - a.createdAt;
  });
}
