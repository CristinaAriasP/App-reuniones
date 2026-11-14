import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CHOICE_LABEL, db, isAnswered, questionTree, saveAnswer, type Answer, type Choice, type Meeting, type Question, type QuestionNode } from '../db';

/**
 * Preguntas de una reunión: las activas, más las retiradas que ya tengan respuesta.
 * `questions` son todas las que se pueden responder (también subpreguntas, para la IA);
 * `tree` agrupa las subpreguntas bajo su pregunta principal;
 * `shown` son las que se ven ahora (las subpreguntas solo si la principal es «Sí»).
 */
export function useMeetingQuestionnaire(meetingId: number) {
  return useLiveQuery(async () => {
    const [all, answers] = await Promise.all([
      db.questions.orderBy('order').toArray(),
      db.answers.where('meetingId').equals(meetingId).toArray(),
    ]);
    const byQ = new Map(answers.map((a) => [a.questionId, a]));
    const questions = all.filter((q) => !q.archived || isAnswered(byQ.get(q.id)));
    const tree = questionTree(questions);
    const shown: Question[] = [];
    for (const n of tree) {
      shown.push(n.q);
      if (byQ.get(n.q.id)?.choice === 'si') shown.push(...n.children);
    }
    return { questions, tree, shown, byQ };
  }, [meetingId]);
}

export function Questionnaire({ meeting }: { meeting: Meeting }) {
  const data = useMeetingQuestionnaire(meeting.id);
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const answered = data.shown.filter((q) => isAnswered(data.byQ.get(q.id))).length;
  const total = data.shown.length;

  return (
    <section className="card questionnaire">
      <div className="card-head">
        <button className="collapse-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={'chev' + (open ? ' open' : '')}>›</span>
          <h2>Cuestionario</h2>
        </button>
        <span className={'progress-pill' + (answered === total && answered > 0 ? ' full' : '')}>
          {answered}/{total} respondidas
        </span>
      </div>
      {open && (
        <>
          {data.questions.length === 0 && (
            <p className="empty">No hay preguntas. <Link to="/ajustes">Añádelas en Ajustes</Link>.</p>
          )}
          <ol className="q-list">
            {data.tree.map((n) => (
              <QuestionRow key={n.q.id} node={n} byQ={data.byQ} meeting={meeting} />
            ))}
          </ol>
          <p className="muted small">Las preguntas son las mismas en todas las reuniones. <Link to="/ajustes">Editar preguntas</Link></p>
        </>
      )}
    </section>
  );
}

function QuestionRow({ node, byQ, meeting }: { node: QuestionNode; byQ: Map<number, Answer>; meeting: Meeting }) {
  const answer = byQ.get(node.q.id);
  const open = answer?.choice === 'si' && node.children.length > 0;
  return (
    <li className={'q-item' + (isAnswered(answer) ? ' answered' : '')}>
      <QuestionBody q={node.q} answer={answer} meeting={meeting} />
      {open && (
        <ul className="q-sub">
          {node.children.map((c) => (
            <li key={c.id} className={'q-item sub' + (isAnswered(byQ.get(c.id)) ? ' answered' : '')}>
              <QuestionBody q={c} answer={byQ.get(c.id)} meeting={meeting} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function QuestionBody({ q, answer, meeting }: { q: Question; answer?: Answer; meeting: Meeting }) {
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
  const toggle = (opt: string) => {
    const on = selected.includes(opt);
    // «Una sola opción»: elegir una sustituye a la anterior
    const next = q.kind === 'unica' ? (on ? [] : [opt]) : on ? selected.filter((s) => s !== opt) : [...selected, opt];
    saveAnswer(meeting, q.id, { selected: next });
  };

  const showOptions = q.kind === 'opciones' || q.kind === 'unica' || (q.kind === 'sino' && choice === 'si');
  // Opciones guardadas que ya no están en la lista (por si se cambió la pregunta): se muestran igual
  const options = [...q.options, ...selected.filter((s) => !q.options.includes(s))];

  return (
    <>
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

      {showOptions && options.length > 0 && (
        <div className={'q-options' + (q.kind === 'unica' ? ' single' : '')} role={q.kind === 'unica' ? 'radiogroup' : undefined} aria-label={q.text}>
          {options.map((opt) => (
            <label key={opt} className={'opt-chip' + (selected.includes(opt) ? ' on' : '')}>
              <input type={q.kind === 'unica' ? 'radio' : 'checkbox'} name={`q${q.id}`} checked={selected.includes(opt)}
                onChange={() => toggle(opt)} onClick={(e) => q.kind === 'unica' && selected.includes(opt) && (e.preventDefault(), toggle(opt))} />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.kind === 'texto' ? (
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Respuesta…" aria-label={`Respuesta a: ${q.text}`} />
      ) : (
        <input className="q-note" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={q.kind === 'unica' ? 'Comentario (p. ej. qué plataforma: Shopify, Moodle…)' : 'Comentario (opcional)…'}
          aria-label={`Comentario sobre: ${q.text}`} />
      )}
    </>
  );
}
