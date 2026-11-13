import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, STATUS_LABEL } from '../db';
import { loadSampleData } from '../sample';
import { NewMeetingDialog } from '../components/NewMeeting';
import { ProjectForm } from '../components/ProjectForm';
import { DueBadge, TaskItem, sortTasks } from '../components/TaskList';
import { formatDate, formatLongDate, snippet, todayISO, toISO } from '../utils';

export function Dashboard() {
  const [newMeeting, setNewMeeting] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const navigate = useNavigate();
  const goToProject = (id: number) => navigate(`/proyecto/${id}`);

  const data = useLiveQuery(async () => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const [projects, meetings, tasks, deliverables] = await Promise.all([
      db.projects.toArray(),
      db.meetings.orderBy('date').reverse().limit(6).toArray(),
      db.tasks.where('done').equals(0).toArray(),
      db.deliverables.where('dueDate').belowOrEqual(toISO(horizon)).filter((d) => d.status !== 'entregado').toArray(),
    ]);
    const meetingIds = [...new Set(tasks.map((t) => t.meetingId).filter((x): x is number => x != null))];
    const taskMeetings = await db.meetings.bulkGet(meetingIds);
    return { projects, meetings, tasks, deliverables, taskMeetings: taskMeetings.filter(Boolean) };
  }, []);

  if (!data) return null;
  const projectById = new Map(data.projects.map((p) => [p.id, p]));
  const meetingById = new Map(data.taskMeetings.map((m) => [m!.id, m!]));
  const activeProjects = data.projects.filter((p) => !p.archived);
  const pendingTasks = sortTasks(data.tasks).slice(0, 12);
  const overdue = data.tasks.filter((t) => t.dueDate && t.dueDate < todayISO()).length;
  const deliverables = data.deliverables.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (data.projects.length === 0) {
    return (
      <div className="empty-hero">
        <div className="hero-emoji">🗂️</div>
        <h1>Todas tus reuniones, en un solo sitio</h1>
        <p>
          Crea un proyecto por cada cliente o iniciativa. Dentro podrás guardar las notas de cada reunión,
          las tareas que salgan de ellas y las fechas de entrega. Después podrás buscarlo todo por palabras clave.
        </p>
        <div className="actions center">
          <button className="btn primary large" onClick={() => setNewProject(true)}>Crear mi primer proyecto</button>
          <button className="btn ghost large" onClick={() => loadSampleData()}>Ver con datos de ejemplo</button>
        </div>
        {newProject && <ProjectForm onClose={() => setNewProject(false)} onSaved={goToProject} />}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{formatLongDate(todayISO())}</p>
          <h1>Inicio</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setNewProject(true)}>Nuevo proyecto</button>
          <button className="btn primary" onClick={() => setNewMeeting(true)}>＋ Nueva reunión</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><strong>{activeProjects.length}</strong><span>proyectos activos</span></div>
        <div className="stat"><strong>{data.tasks.length}</strong><span>tareas pendientes</span></div>
        <div className={'stat' + (overdue ? ' warn' : '')}><strong>{overdue}</strong><span>tareas vencidas</span></div>
        <div className="stat"><strong>{deliverables.length}</strong><span>entregas en 30 días</span></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Próximas entregas</h2>
          {deliverables.length === 0 ? (
            <p className="empty">No hay entregas pendientes en los próximos 30 días.</p>
          ) : (
            <ul className="list">
              {deliverables.map((d) => {
                const p = projectById.get(d.projectId);
                return (
                  <li key={d.id} className="list-row">
                    <span className="dot" style={{ background: p?.color }} />
                    <div className="grow">
                      <Link to={`/proyecto/${d.projectId}?tab=entregas`} className="row-title">{d.title}</Link>
                      <div className="row-sub">{p?.name} · {STATUS_LABEL[d.status]}</div>
                    </div>
                    <DueBadge date={d.dueDate} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Últimas reuniones</h2>
          {data.meetings.length === 0 ? (
            <p className="empty">Aún no hay reuniones. <button className="link-btn" onClick={() => setNewMeeting(true)}>Crea la primera</button></p>
          ) : (
            <ul className="list">
              {data.meetings.map((m) => {
                const p = projectById.get(m.projectId);
                return (
                  <li key={m.id} className="list-row">
                    <div className="date-pill">
                      <strong>{formatDate(m.date, { day: 'numeric' })}</strong>
                      <span>{formatDate(m.date, { month: 'short' })}</span>
                    </div>
                    <div className="grow">
                      <Link to={`/reunion/${m.id}`} className="row-title">{m.title || 'Reunión'}</Link>
                      <div className="row-sub">
                        <span className="dot small" style={{ background: p?.color }} /> {p?.name}
                        {m.notes && <> · {snippet(m.notes, [], 50)}</>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Tareas pendientes</h2>
        {pendingTasks.length === 0 ? (
          <p className="empty">¡Nada pendiente! 🎉</p>
        ) : (
          <ul className="tasks">
            {pendingTasks.map((t) => (
              <TaskItem key={t.id} task={t} project={projectById.get(t.projectId)} meeting={t.meetingId ? meetingById.get(t.meetingId) : undefined} showProject />
            ))}
          </ul>
        )}
        {data.tasks.length > pendingTasks.length && (
          <p className="muted small">Y {data.tasks.length - pendingTasks.length} más. Míralas dentro de cada proyecto.</p>
        )}
      </section>

      {newMeeting && <NewMeetingDialog onClose={() => setNewMeeting(false)} />}
      {newProject && <ProjectForm onClose={() => setNewProject(false)} onSaved={goToProject} />}
    </div>
  );
}
