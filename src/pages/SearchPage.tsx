import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { answerText, db, STATUS_LABEL } from '../db';
import { formatDate, highlight, matchesAll, searchTerms, snippet } from '../utils';

type Kind = 'todo' | 'reuniones' | 'tareas' | 'entregas';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [kind, setKind] = useState<Kind>('todo');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => setInput(q), [q]);

  // Actualiza la URL mientras se escribe (con pequeño retardo)
  useEffect(() => {
    const t = setTimeout(() => {
      if (input !== q) setParams(input ? { q: input } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [input, q, setParams]);

  const all = useLiveQuery(async () => {
    const [projects, meetings, tasks, deliverables, questions, answers] = await Promise.all([
      db.projects.toArray(), db.meetings.toArray(), db.tasks.toArray(), db.deliverables.toArray(),
      db.questions.toArray(), db.answers.toArray(),
    ]);
    // Texto del cuestionario de cada reunión, para poder buscar también en las respuestas
    const qText = new Map(questions.map((q) => [q.id, q.text]));
    const answersByMeeting = new Map<number, string>();
    for (const a of answers) {
      const t = answerText(a);
      if (!t) continue;
      answersByMeeting.set(a.meetingId, (answersByMeeting.get(a.meetingId) ?? '') + `\n${qText.get(a.questionId) ?? ''} ${t}`);
    }
    return { projects, meetings, tasks, deliverables, answersByMeeting };
  }, []);

  if (!all) return null;
  const terms = searchTerms(q);
  const projectById = new Map(all.projects.map((p) => [p.id, p]));
  const meetingById = new Map(all.meetings.map((m) => [m.id, m]));
  const ctx = (pid: number) => { const p = projectById.get(pid); return p ? `${p.company} ${p.name}` : ''; };
  const inProject = (pid: number) => projectId === '' || pid === projectId;
  const inRange = (d: string) => (!from || (d && d >= from)) && (!to || (d && d <= to));
  const hasFilter = terms.length > 0 || projectId !== '' || from || to;

  const meetings = !hasFilter ? [] : all.meetings
    .filter((m) => inProject(m.projectId) && inRange(m.date) && matchesAll(`${m.title} ${m.attendees} ${m.notes} ${ctx(m.projectId)} ${all.answersByMeeting.get(m.id) ?? ''}`, terms))
    .sort((a, b) => b.date.localeCompare(a.date));
  const tasks = !hasFilter ? [] : all.tasks
    .filter((t) => inProject(t.projectId) && inRange(t.dueDate || (t.meetingId ? meetingById.get(t.meetingId)?.date ?? '' : '')) && matchesAll(`${t.title} ${ctx(t.projectId)}`, terms))
    .sort((a, b) => a.done - b.done || (b.dueDate || '').localeCompare(a.dueDate || ''));
  const deliverables = !hasFilter ? [] : all.deliverables
    .filter((d) => inProject(d.projectId) && inRange(d.dueDate) && matchesAll(`${d.title} ${d.notes} ${ctx(d.projectId)}`, terms))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  const show = (k: Kind) => kind === 'todo' || kind === k;
  const total = (show('reuniones') ? meetings.length : 0) + (show('tareas') ? tasks.length : 0) + (show('entregas') ? deliverables.length : 0);

  const ProjectTag = ({ pid }: { pid: number }) => {
    const p = projectById.get(pid);
    return p ? <span className="chip" style={{ '--c': p.color } as React.CSSProperties}>{p.company ? `${p.company} · ` : ''}{p.name}</span> : null;
  };

  return (
    <div className="page">
      <h1>Búsqueda</h1>
      <div className="search-box">
        <input
          type="search"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Palabras clave: presupuesto, Ana, diseño…"
          aria-label="Buscar"
        />
      </div>
      <div className="filters">
        <div className="segmented" role="group" aria-label="Tipo">
          {(['todo', 'reuniones', 'tareas', 'entregas'] as Kind[]).map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'todo' ? 'Todo' : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} aria-label="Proyecto">
          <option value="">Todos los proyectos</option>
          {all.projects.sort((a, b) => (a.company + a.name).localeCompare(b.company + b.name, 'es')).map((p) => (
            <option key={p.id} value={p.id}>{p.company ? `${p.company} — ` : ''}{p.name}</option>
          ))}
        </select>
        <label className="inline-label">Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline-label">Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(projectId !== '' || from || to) && (
          <button className="link-btn" onClick={() => { setProjectId(''); setFrom(''); setTo(''); }}>Quitar filtros</button>
        )}
      </div>

      {!hasFilter ? (
        <p className="empty">Escribe una palabra clave o elige un proyecto o unas fechas. La búsqueda no distingue mayúsculas ni tildes.</p>
      ) : (
        <p className="muted">{total} resultado{total === 1 ? '' : 's'}</p>
      )}

      {show('reuniones') && meetings.length > 0 && (
        <section className="results">
          <h2>Reuniones <span className="count">{meetings.length}</span></h2>
          {meetings.map((m) => (
            <Link key={m.id} to={`/reunion/${m.id}${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="result">
              <div className="result-head">
                <span className="row-title">{highlight(m.title || 'Reunión', terms)}</span>
                <span className="muted small">{formatDate(m.date)}</span>
              </div>
              <ProjectTag pid={m.projectId} />
              {m.attendees && <div className="row-sub">👥 {highlight(m.attendees, terms)}</div>}
              {m.notes && <p className="excerpt">{highlight(snippet(m.notes, terms), terms)}</p>}
              {terms.length > 0 && !matchesAll(`${m.title} ${m.attendees} ${m.notes}`, terms) && all.answersByMeeting.get(m.id) && (
                <p className="excerpt">📋 {highlight(snippet(all.answersByMeeting.get(m.id)!, terms), terms)}</p>
              )}
            </Link>
          ))}
        </section>
      )}

      {show('tareas') && tasks.length > 0 && (
        <section className="results">
          <h2>Tareas <span className="count">{tasks.length}</span></h2>
          {tasks.map((t) => {
            const m = t.meetingId ? meetingById.get(t.meetingId) : undefined;
            return (
              <Link key={t.id} to={m ? `/reunion/${m.id}` : `/proyecto/${t.projectId}?tab=tareas`} className={'result' + (t.done ? ' done' : '')}>
                <div className="result-head">
                  <span className="row-title">{t.done ? '☑' : '☐'} {highlight(t.title, terms)}</span>
                  {t.dueDate && <span className="muted small">Límite: {formatDate(t.dueDate)}</span>}
                </div>
                <ProjectTag pid={t.projectId} />
                {m && <div className="row-sub">De la reunión: {m.title || 'Reunión'} ({formatDate(m.date)})</div>}
              </Link>
            );
          })}
        </section>
      )}

      {show('entregas') && deliverables.length > 0 && (
        <section className="results">
          <h2>Entregas <span className="count">{deliverables.length}</span></h2>
          {deliverables.map((d) => (
            <Link key={d.id} to={`/proyecto/${d.projectId}?tab=entregas`} className="result">
              <div className="result-head">
                <span className="row-title">{highlight(d.title, terms)}</span>
                <span className="muted small">{formatDate(d.dueDate)} · {STATUS_LABEL[d.status]}</span>
              </div>
              <ProjectTag pid={d.projectId} />
              {d.notes && <p className="excerpt">{highlight(snippet(d.notes, terms), terms)}</p>}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
