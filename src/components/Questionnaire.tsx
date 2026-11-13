import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CHOICE_LABEL, db, isAnswered, saveAnswer, type Answer, type Choice, type Meeting, type Question } from '../db';

/** Preguntas activas, más las archivadas que ya tengan respuesta en esta reunión. */
export function useMeetingQuestionnaire(meetingId: number) {
  return useLiveQuery(async () => {
    const [questions, answers] = await Promise.all([
      db.questions.orderBy('order').toArray(),
      db.answers.where('meetingId').equals(meetingId).toArray(),
    ]);
    const byQ = new Map(answers.map((a) => [a.questionId, a]));
    const visible = questions.filter((q) => !q.archived || isAnswered(byQ.get(q.id)));
    return { questions: visible, byQ };
  }, [meetingId]);
}

export function Questionnaire({ meeting }: { meeting: Meeting }) {
  const data = useMeetingQuestionnaire(meeting.id);
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const answered = data.questions.filter((q) => isAnswered(data.byQ.get(q.id))).length;

  return (
    <section className="card questionnaire">
      <div className="card-head">
        <button className="collapse-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={'chev' + (open ? ' open' : '')}>›</span>
          <h2>Cuestionario</h2>
        </button>
        <span className={'progress-pill' + (answered === data.questions.length && answered > 0 ? ' full' : '')}>
          {answered}/{data.questions.length} respondidas
        </span>
      </div>
      {open && (
        <>
          {data.questions.length === 0 && (
            <p className="empty">No hay preguntas. <Link to="/ajustes">Añádelas en Ajustes</Link>.</p>
          )}
          <ol className="q-list">
            {data.questions.map((q) => (
              <QuestionRow key={q.id} q={q} answer={data.byQ.get(q.id)} meeting={meeting} />
            ))}
          </ol>
          <p className="muted small">Las preguntas son las mismas en todas las reuniones. <Link to="/ajustes">Editar preguntas</Link></p>
        </>
      )}
    </section>
  );
}

function QuestionRow({ q, answer, meeting }: { q: Question; answer?: Answer; meeting: Meeting }) {
  const choice = answer?.choice ?? '';
  const selected = answer?.selected ?? [];
  const [text, setText] = useState(answer?.text ?? '');
  const sent = useRef(answer?.text ?? '');

  // Si el texto cambia desde fuera (p. ej. la IA), se refleja aquí sin pisar lo que se escribe
  useEffect(() => {
    const stored = answer?.text ?? '';
    if (stored !== sent.current) { sent.current = stored; setText(stored); }
  }, [answer?.text]);

  // Guardado del texto con un pequeño retardo
  useEffect(() => {
    if (text === sent.current) return;
    const t = setTimeout(() => { sent.current = text; saveAnswer(meeting, q.id, { text }); }, 500);
    return () => clearTimeout(t);
  }, [text, meeting, q.id]);

  // Si se sale de la página antes de guardar, se guarda igualmente
  const latest = useRef({ text, meeting });
  latest.current = { text, meeting };
  useEffect(() => () => {
    const { text: t, meeting: m } = latest.current;
    if (t !== sent.current) saveAnswer(m, q.id, { text: t });
  }, [q.id]);

  const setChoice = (c: Choice) => saveAnswer(meeting, q.id, { choice: choice === c ? '' : c });
  const toggle = (opt: string) =>
    saveAnswer(meeting, q.id, { selected: selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt] });

  const showOptions = q.options.length > 0 && (q.kind === 'opciones' || (q.kind === 'sino' && choice === 'si'));

  return (
    <li className={'q-item' + (isAnswered(answer) ? ' answered' : '')}>
      <div className="q-text">
        {q.text}
        {q.archived && <span className="badge due-ok">Pregunta retirada</span>}
      </div>

      {q.kind === 'sino' && (
        <div className="segmented small" role="group" aria-label={q.text}>
          {(['si', 'no', 'nose'] as const).map((c) => (
            <button key={c} aria-pressed={choice === c} onClick={() => setChoice(c)}>{CHOICE_LABEL[c]}</button>
          ))}
        </div>
      )}

      {showOptions && (
        <div className="q-options">
          {q.options.map((opt) => (
            <label key={opt} className={'opt-chip' + (selected.includes(opt) ? ' on' : '')}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.kind === 'texto' ? (
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Respuesta…" aria-label={`Respuesta a: ${q.text}`} />
      ) : (
        <input className="q-note" value={text} onChange={(e) => setText(e.target.value)} placeholder="Comentario (opcional)…" aria-label={`Comentario sobre: ${q.text}`} />
      )}
    </li>
  );
}
