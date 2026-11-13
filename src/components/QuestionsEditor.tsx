import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, KIND_LABEL, type Question, type QuestionKind } from '../db';
import { useConfirm } from './Confirm';

const parseOptions = (s: string) => s.split(',').map((o) => o.trim()).filter(Boolean);

export function QuestionsEditor() {
  const ask = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const all = useLiveQuery(() => db.questions.orderBy('order').toArray(), []);
  if (!all) return null;
  const active = all.filter((q) => !q.archived);
  const archived = all.filter((q) => q.archived);

  async function move(q: Question, dir: -1 | 1) {
    const i = active.indexOf(q);
    const other = active[i + dir];
    if (!other) return;
    await db.transaction('rw', db.questions, async () => {
      await db.questions.update(q.id, { order: other.order });
      await db.questions.update(other.id, { order: q.order });
    });
  }

  async function remove(q: Question) {
    const used = await db.answers.where('questionId').equals(q.id).count();
    if (used > 0) {
      if (await ask(`«${q.text}» ya tiene respuestas en ${used} reunión(es). Dejará de aparecer en las reuniones nuevas, pero esas respuestas se conservan.`, 'Retirar')) {
        await db.questions.update(q.id, { archived: true });
      }
    } else if (await ask(`Se borrará la pregunta «${q.text}».`)) {
      await db.questions.delete(q.id);
    }
  }

  return (
    <section className="card">
      <h2>📋 Preguntas de las reuniones</h2>
      <p className="muted">
        Estas preguntas aparecen en todas las reuniones para que no se olvide preguntar nada.
        Puedes cambiarlas cuando quieras; las respuestas ya dadas se conservan.
      </p>
      <ol className="qe-list">
        {active.map((q, i) => (
          <QuestionEditRow key={q.id} q={q} first={i === 0} last={i === active.length - 1}
            onUp={() => move(q, -1)} onDown={() => move(q, 1)} onRemove={() => remove(q)} />
        ))}
      </ol>
      {active.length === 0 && <p className="empty">No hay preguntas todavía.</p>}

      {adding
        ? <QuestionForm onCancel={() => setAdding(false)} onSave={async (data) => {
            const max = all.reduce((m, q) => Math.max(m, q.order), 0);
            await db.questions.add({ ...data, order: max + 1, archived: false, createdAt: Date.now() } as Question);
            setAdding(false);
          }} />
        : <button className="btn ghost" onClick={() => setAdding(true)}>＋ Añadir pregunta</button>}

      {archived.length > 0 && (
        <div className="archived-q">
          <button className="link-btn" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Ocultar preguntas retiradas' : `Ver preguntas retiradas (${archived.length})`}
          </button>
          {showArchived && (
            <ul className="list">
              {archived.map((q) => (
                <li key={q.id} className="list-row">
                  <span className="grow muted">{q.text}</span>
                  <button className="btn ghost small" onClick={() => db.questions.update(q.id, { archived: false })}>Recuperar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function QuestionEditRow({ q, first, last, onUp, onDown, onRemove }: {
  q: Question; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="qe-item">
        <QuestionForm initial={q} onCancel={() => setEditing(false)} onSave={async (data) => {
          await db.questions.update(q.id, data);
          setEditing(false);
        }} />
      </li>
    );
  }
  return (
    <li className="qe-item">
      <div className="grow">
        <div className="row-title">{q.text}</div>
        <div className="row-sub wrap">
          {KIND_LABEL[q.kind]}{q.options.length > 0 && <> · {q.options.join(', ')}</>}
        </div>
      </div>
      <div className="qe-actions">
        <button className="icon-btn" onClick={onUp} disabled={first} aria-label="Subir" title="Subir">↑</button>
        <button className="icon-btn" onClick={onDown} disabled={last} aria-label="Bajar" title="Bajar">↓</button>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar pregunta" title="Editar">✎</button>
        <button className="icon-btn" onClick={onRemove} aria-label="Quitar pregunta" title="Quitar">🗑</button>
      </div>
    </li>
  );
}

function QuestionForm({ initial, onSave, onCancel }: {
  initial?: Question;
  onSave: (data: { text: string; kind: QuestionKind; options: string[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [kind, setKind] = useState<QuestionKind>(initial?.kind ?? 'sino');
  const [options, setOptions] = useState(initial?.options.join(', ') ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSave({ text: text.trim(), kind, options: kind === 'texto' ? [] : parseOptions(options) });
  }

  return (
    <form className="form qe-form" onSubmit={submit}>
      <label>
        Pregunta
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. ¿Necesita plataforma interna?" required />
      </label>
      <label>
        Tipo de respuesta
        <select value={kind} onChange={(e) => setKind(e.target.value as QuestionKind)}>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {kind !== 'texto' && (
        <label>
          {kind === 'sino' ? 'Opciones que aparecen si la respuesta es «Sí» (separadas por comas, opcional)' : 'Opciones (separadas por comas)'}
          <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Inicio de sesión, Espacio cliente, Panel de administración" />
        </label>
      )}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary">{initial ? 'Guardar' : 'Añadir'}</button>
      </div>
    </form>
  );
}
