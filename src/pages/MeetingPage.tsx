import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteMeeting, type Meeting } from '../db';
import { Notes } from '../components/Notes';
import { useConfirm } from '../components/Confirm';
import { TaskItem, TaskQuickAdd, sortTasks } from '../components/TaskList';
import { formatLongDate, searchTerms } from '../utils';

export function MeetingPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editing = params.get('editar') === '1';
  const ask = useConfirm();
  const terms = searchTerms(params.get('q') ?? '');

  const data = useLiveQuery(async () => {
    const meeting = await db.meetings.get(id);
    if (!meeting) return { meeting: null };
    const [project, tasks, projects] = await Promise.all([
      db.projects.get(meeting.projectId),
      db.tasks.where('meetingId').equals(id).toArray(),
      db.projects.toArray(),
    ]);
    return { meeting, project, tasks, projects };
  }, [id]);

  if (!data) return null;
  const { meeting, project } = data;
  if (!meeting) {
    return <div className="page"><p className="empty">Esta reunión no existe. <Link to="/">Volver al inicio</Link></p></div>;
  }

  async function remove() {
    if (await ask('Se borrará esta reunión. Sus tareas se mantendrán en el proyecto.')) {
      await deleteMeeting(id);
      navigate(`/proyecto/${meeting!.projectId}`);
    }
  }

  return (
    <div className="page narrow">
      <nav className="breadcrumb">
        {project && (
          <Link to={`/proyecto/${project.id}`}>
            <span className="dot" style={{ background: project.color }} />
            {project.company ? `${project.company} / ` : ''}{project.name}
          </Link>
        )}
      </nav>

      {editing ? (
        <MeetingEditor key={meeting.id} meeting={meeting} projects={data.projects!} onDone={() => setParams({}, { replace: true })} />
      ) : (
        <>
          <div className="page-head">
            <div>
              <p className="eyebrow">{formatLongDate(meeting.date)}</p>
              <h1>{meeting.title || 'Reunión'}</h1>
              {meeting.attendees && <p className="attendees">👥 {meeting.attendees}</p>}
            </div>
            <div className="actions">
              <button className="btn primary" onClick={() => setParams({ editar: '1' }, { replace: true })}>Editar</button>
              <button className="btn danger-ghost" onClick={remove}>Borrar</button>
            </div>
          </div>
          <section className="card">
            {meeting.notes.trim()
              ? <Notes text={meeting.notes} terms={terms} />
              : <p className="empty">Sin notas. <button className="link-btn" onClick={() => setParams({ editar: '1' })}>Escribir notas</button></p>}
          </section>
        </>
      )}

      <section className="card">
        <h2>Tareas de esta reunión</h2>
        <TaskQuickAdd projectId={meeting.projectId} meetingId={meeting.id} />
        <ul className="tasks">
          {sortTasks(data.tasks!).map((t) => <TaskItem key={t.id} task={t} />)}
        </ul>
        {data.tasks!.length === 0 && <p className="muted small">Las tareas que añadas aquí también aparecerán en el proyecto y en el inicio.</p>}
      </section>
    </div>
  );
}

function MeetingEditor({ meeting, projects, onDone }: {
  meeting: Meeting;
  projects: { id: number; name: string; company: string }[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: meeting.title, date: meeting.date, attendees: meeting.attendees, notes: meeting.notes, projectId: meeting.projectId,
  });
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const first = useRef(true);
  const latest = useRef(form);
  latest.current = form;

  // Autoguardado: se guarda solo 600 ms después de dejar de escribir
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    const t = setTimeout(async () => {
      await db.meetings.update(meeting.id, { ...form, updatedAt: Date.now() });
      setStatus('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [form, meeting.id]);

  async function finish() {
    await db.meetings.update(meeting.id, { ...latest.current, updatedAt: Date.now() });
    onDone();
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="card editor">
      <div className="editor-head">
        <input className="title-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Título de la reunión" autoFocus={!form.title} />
        <span className="save-status">{status === 'saving' ? 'Guardando…' : 'Guardado ✓'}</span>
      </div>
      <div className="form-row three">
        <label>
          Fecha
          <input type="date" value={form.date} onChange={(e) => e.target.value && set('date', e.target.value)} />
        </label>
        <label>
          Proyecto
          <select value={form.projectId} onChange={(e) => set('projectId', Number(e.target.value))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.company ? `${p.company} — ` : ''}{p.name}</option>)}
          </select>
        </label>
        <label>
          Asistentes
          <input value={form.attendees} onChange={(e) => set('attendees', e.target.value)} placeholder="Ana, Luis, cliente…" />
        </label>
      </div>
      <label className="notes-label">
        Notas
        <textarea
          className="notes-input"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          autoFocus={!!form.title}
          placeholder={'Escribe aquí lo que se habla en la reunión.\n\n# Temas\n- Punto tratado\n- **Decisión importante**\n\n[ ] Algo pendiente'}
        />
      </label>
      <div className="form-actions">
        <span className="muted small">Formato: # título · - viñeta · **negrita** · [ ] casilla</span>
        <span className="spacer" />
        <button className="btn primary" onClick={finish}>Hecho</button>
      </div>
    </section>
  );
}
