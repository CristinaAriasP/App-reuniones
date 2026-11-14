import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CHOICE_LABEL, db, isAnswered, questionTree, type Answer, type Meeting, type Question } from '../db';
import { formatDate } from '../utils';

/** Resumen del cuestionario de un proyecto: la última respuesta a cada pregunta. */
export function ProjectAnswers({ projectId }: { projectId: number }) {
  const data = useLiveQuery(async () => {
    const [questions, answers, meetings] = await Promise.all([
      db.questions.orderBy('order').toArray(),
      db.answers.where('projectId').equals(projectId).toArray(),
      db.meetings.where('projectId').equals(projectId).toArray(),
    ]);
    return { questions, answers, meetings };
  }, [projectId]);
  if (!data) return null;

  const meetingById = new Map(data.meetings.map((m) => [m.id, m]));
  const history = new Map<number, { a: Answer; m: Meeting }[]>();
  for (const a of data.answers) {
    const m = meetingById.get(a.meetingId);
    if (!m || !isAnswered(a)) continue;
    if (!history.has(a.questionId)) history.set(a.questionId, []);
    history.get(a.questionId)!.push({ a, m });
  }
  for (const list of history.values()) list.sort((x, y) => y.m.date.localeCompare(x.m.date) || y.a.updatedAt - x.a.updatedAt);

  const questions = data.questions.filter((q) => !q.archived || history.has(q.id));
  const tree = questionTree(questions);
  // Las subpreguntas solo cuentan si la última respuesta a su pregunta principal es «Sí»
  const lastChoice = (id: number) => history.get(id)?.[0]?.a.choice;
  const pending = tree.reduce((n, t) => n + (history.has(t.q.id) ? 0 : 1)
    + (lastChoice(t.q.id) === 'si' ? t.children.filter((c) => !history.has(c.id)).length : 0), 0);

  if (data.meetings.length === 0) {
    return <p className="empty">Cuando tengas reuniones en este proyecto, aquí verás un resumen de las respuestas del cuestionario.</p>;
  }

  return (
    <section className="card">
      <p className="muted small">
        Última respuesta de cada pregunta en las reuniones de este proyecto.
        {pending > 0 && <> Quedan <strong>{pending}</strong> sin responder.</>}
      </p>
      <ul className="answers-summary">
        {tree.map(({ q, children }) => {
          const subs = children.filter((c) => lastChoice(q.id) === 'si' || history.has(c.id));
          return (
            <AnswerItem key={q.id} q={q} list={history.get(q.id) ?? []}>
              {subs.length > 0 && (
                <ul className="answers-sub">
                  {subs.map((c) => <AnswerItem key={c.id} q={c} list={history.get(c.id) ?? []} />)}
                </ul>
              )}
            </AnswerItem>
          );
        })}
      </ul>
    </section>
  );
}

function AnswerItem({ q, list, children }: { q: Question; list: { a: Answer; m: Meeting }[]; children?: React.ReactNode }) {
          const last = list[0];
          return (
            <li className={last ? '' : 'unanswered'}>
              <div className="q-text">{q.text}</div>
              {last ? (
                <>
                  <div className="answer-line">
                    {last.a.choice && <span className={`badge choice-${last.a.choice}`}>{CHOICE_LABEL[last.a.choice]}</span>}
                    {last.a.selected.map((s) => <span key={s} className="opt-chip on static">{s}</span>)}
                    {last.a.text && <span>{last.a.text}</span>}
                  </div>
                  <div className="row-sub">
                    <Link to={`/reunion/${last.m.id}`} className="muted-link">{last.m.title || 'Reunión'} · {formatDate(last.m.date)}</Link>
                    {list.length > 1 && <> · respondida en {list.length} reuniones</>}
                  </div>
                </>
              ) : (
                <div className="row-sub">Sin responder todavía</div>
              )}
              {children}
            </li>
          );
}
