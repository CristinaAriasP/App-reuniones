import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteProject, STATUS_LABEL, type Deliverable } from '../db';
import { ProjectForm } from '../components/ProjectForm';
import { ProjectAnswers } from '../components/ProjectAnswers';
import { useConfirm } from '../components/Confirm';
import { NewMeetingDialog } from '../components/NewMeeting';
import { DeliverableForm } from '../components/DeliverableForm';
import { DueBadge, TaskItem, TaskQuickAdd, sortTasks } from '../components/TaskList';
import { formatDate, highlight, matchesAll, monthLabel, searchTerms, snippet } from '../utils';

type Tab = 'reuniones' | 'cuestionario' | 'tareas' | 'entregas';

export function ProjectPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'reuniones';
  const [editing, setEditing] = useState(false);
  const [newMeeting, setNewMeeting] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState<Deliverable | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [showDone, setShowDone] = useState(false);
  const ask = useConfirm();

  const data = useLiveQuery(async () => {
    const project = await db.projects.get(id);
    if (!project) return { project: null };
    const [meetings, tasks, deliverables] = await Promise.all([
      db.meetings.where('projectId').equals(id).toArray(),
      db.tasks.where('projectId').equals(id).toArray(),
      db.deliverables.where('projectId').equals(id).toArray(),
    ]);
    return { project, meetings, tasks, deliverables };
  }, [id]);

  if (!data) return null;
  const { project } = data;
  if (!project) {
    return <div className="page"><p className="empty">Este proyecto no existe. <Link to="/">Volver al inicio</Link></p></div>;
  }
  const meetings = data.meetings!.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const tasks = sortTasks(data.tasks!);
  const deliverables = data.deliverables!.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const pendingCount = tasks.filter((t) => !t.done).length;
  const openDeliverables = deliverables.filter((d) => d.status !== 'entregado').length;

  const terms = searchTerms(filter);
  const filteredMeetings = terms.length
    ? meetings.filter((m) => matchesAll(`${m.title} ${m.attendees} ${m.notes} ${formatDate(m.date)}`, terms))
    : meetings;
  const byMonth = new Map<string, typeof meetings>();
  for (const m of filteredMeetings) {
    const k = m.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(m);
  }

  function setTab(t: Tab) {
    setParams(t === 'reuniones' ? {} : { tab: t }, { replace: true });
  }

  async function remove() {
    if (await ask(`Se borrará el proyecto "${project!.name}" con todas sus reuniones, tareas y entregas. No se puede deshacer.`)) {
      await deleteProject(id);
      navigate('/');
    }
  }

  return (
    <div className="page">
      <div className="project-head" style={{ '--c': project.color } as React.CSSProperties}>
        <div>
          {project.company && <p className="eyebrow">{project.company}</p>}
          <h1>
            {project.name}
            {project.archived && <span className="badge due-ok">Archivado</span>}
          </h1>
          {project.description && <p className="description">{project.description}</p>}
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setEditing(true)}>Editar</button>
          <button className="btn ghost" onClick={() => db.projects.update(id, { archived: !project.archived })}>
            {project.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          <button className="btn danger-ghost" onClick={remove}>Borrar</button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'reuniones'} onClick={() => setTab('reuniones')}>
          Reuniones <span className="count">{meetings.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'cuestionario'} onClick={() => setTab('cuestionario')}>
          Cuestionario
        </button>
        <button role="tab" aria-selected={tab === 'tareas'} onClick={() => setTab('tareas')}>
          Tareas <span className="count">{pendingCount}</span>
        </button>
        <button role="tab" aria-selected={tab === 'entregas'} onClick={() => setTab('entregas')}>
          Entregas <span className="count">{openDeliverables}</span>
        </button>
      </div>

      {tab === 'reuniones' && (
        <section>
          <div className="toolbar">
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar reuniones de este proyecto…" />
            <button className="btn primary" onClick={() => setNewMeeting(true)}>＋ Nueva reunión</button>
          </div>
          {meetings.length === 0 && <p className="empty">Todavía no hay reuniones en este proyecto.</p>}
          {meetings.length > 0 && filteredMeetings.length === 0 && <p className="empty">Ninguna reunión coincide con “{filter}”.</p>}
          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month} className="month-group">
              <h3 className="month-label">{monthLabel(month + '-01')}</h3>
              <div className="meeting-cards">
                {list.map((m) => {
                  const mTasks = tasks.filter((t) => t.meetingId === m.id);
                  return (
                    <Link key={m.id} to={`/reunion/${m.id}`} className="meeting-card">
                      <div className="date-pill">
                        <strong>{formatDate(m.date, { day: 'numeric' })}</strong>
                        <span>{formatDate(m.date, { weekday: 'short' })}</span>
                      </div>
                      <div className="grow">
                        <div className="row-title">{highlight(m.title || 'Reunión', terms)}</div>
                        {m.attendees && <div className="row-sub">👥 {highlight(m.attendees, terms)}</div>}
                        {m.notes && <p className="excerpt">{highlight(snippet(m.notes, terms, 110), terms)}</p>}
                        {mTasks.length > 0 && (
                          <div className="row-sub">✓ {mTasks.filter((t) => t.done).length}/{mTasks.length} tareas</div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'tareas' && (
        <section className="card">
          <TaskQuickAdd projectId={id} />
          <ul className="tasks">
            {tasks.filter((t) => showDone || !t.done).map((t) => (
              <TaskItem key={t.id} task={t} meeting={t.meetingId ? meetingById.get(t.meetingId) : undefined} />
            ))}
          </ul>
          {tasks.length === 0 && <p className="empty">Sin tareas. Añádelas aquí o desde las notas de una reunión.</p>}
          {tasks.some((t) => t.done) && (
            <button className="link-btn" onClick={() => setShowDone((s) => !s)}>
              {showDone ? 'Ocultar completadas' : `Mostrar completadas (${tasks.filter((t) => t.done).length})`}
            </button>
          )}
        </section>
      )}

      {tab === 'cuestionario' && <ProjectAnswers projectId={id} />}

      {tab === 'entregas' && (
        <section>
          <div className="toolbar end">
            <button className="btn primary" onClick={() => setDeliverableForm('new')}>＋ Nueva entrega</button>
          </div>
          {deliverables.length === 0 ? (
            <p className="empty">No hay entregas definidas. Apunta aquí las fechas clave del proyecto.</p>
          ) : (
            <ol className="timeline">
              {deliverables.map((d) => (
                <li key={d.id} className={`timeline-item status-${d.status}`}>
                  <button className="timeline-card" onClick={() => setDeliverableForm(d)}>
                    <div className="timeline-date">{formatDate(d.dueDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="row-title">{d.title}</div>
                    {d.notes && <p className="excerpt">{d.notes}</p>}
                    <div className="timeline-meta">
                      <span className={`badge status ${d.status}`}>{STATUS_LABEL[d.status]}</span>
                      {d.status !== 'entregado' && <DueBadge date={d.dueDate} />}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
      {newMeeting && <NewMeetingDialog projectId={id} onClose={() => setNewMeeting(false)} />}
      {deliverableForm && (
        <DeliverableForm
          projectId={id}
          deliverable={deliverableForm === 'new' ? undefined : deliverableForm}
          onClose={() => setDeliverableForm(null)}
        />
      )}
    </div>
  );
}
