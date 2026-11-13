import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AIError, getOrganizer, isInClaudeViewer, toNotes, type AIMode, type OrganizeContext, type Organized } from '../ai';
import { formatDate } from '../utils';
import { Modal } from './Modal';
import { Notes } from './Notes';

export interface OrganizeApply {
  notes: string;
  title: string | null;
  tasks: { title: string; dueDate: string }[];
}

type Phase = 'input' | 'working' | 'review';

export function OrganizeDialog({ initialText, ctx, currentTitle, onApply, onClose }: {
  initialText: string;
  ctx: OrganizeContext;
  currentTitle: string;
  onApply: (r: OrganizeApply) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(initialText);
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Organized | null>(null);
  const [mode, setMode] = useState<AIMode | 'checking'>('checking');
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [useTitle, setUseTitle] = useState(!currentTitle.trim());
  const [picked, setPicked] = useState<boolean[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const organizer = useRef<Awaited<ReturnType<typeof getOrganizer>>>(null);

  useEffect(() => {
    let alive = true;
    getOrganizer().then((o) => {
      if (!alive) return;
      organizer.current = o;
      setMode(o?.mode ?? null);
    });
    return () => { alive = false; ctl.current?.abort(); };
  }, []);

  async function run() {
    if (!organizer.current || !raw.trim()) return;
    setError('');
    setPhase('working');
    ctl.current = new AbortController();
    try {
      const r = await organizer.current.organize(raw, ctx, { signal: ctl.current.signal });
      setResult(r);
      setPicked(r.tasks.map(() => true));
      setPhase('review');
    } catch (e) {
      setPhase('input');
      if (e instanceof AIError && e.kind === 'cancelled') return;
      setError(e instanceof Error ? e.message : 'No se pudo ordenar el texto.');
    }
  }

  function apply() {
    if (!result) return;
    let notes = toNotes(result);
    if (keepOriginal && raw.trim()) notes += `\n\n## Notas originales\n${raw.trim()}`;
    onApply({
      notes,
      title: useTitle && result.title.trim() ? result.title.trim() : null,
      tasks: result.tasks.filter((_, i) => picked[i]).map((t) => ({
        title: t.owner ? `${t.title} (${t.owner})` : t.title,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : '',
      })),
    });
    onClose();
  }

  const close = () => { ctl.current?.abort(); onClose(); };

  return (
    <Modal title="✨ Ordenar con IA" onClose={close} wide>
      {mode === null && (
        <div className="notice info">
          {isInClaudeViewer()
            ? 'La IA no está disponible en esta vista.'
            : <>Para usar la IA fuera de Claude necesitas una clave de API de Anthropic. <Link to="/ajustes" onClick={close}>Configúrala en Ajustes</Link>.</>}
        </div>
      )}

      {phase !== 'review' && (
        <div className="form">
          <label>
            Pega o escribe tu lluvia de ideas, tal cual salió
            <textarea
              className="brainstorm-input"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={phase === 'working'}
              autoFocus
              placeholder={'ej: hablar con maria presupuesto 18k aprobado\nshopify si\nlogo + grande en movil\nana manda propuesta el viernes\nblog?? confirman sem que viene'}
            />
          </label>
          {error && <p className="notice error">{error}</p>}
          <div className="form-actions">
            <span className="muted small">
              {mode === 'claude' && 'Usa tu cuenta de Claude. Te pedirá permiso la primera vez.'}
              {mode === 'apikey' && 'Usa tu clave de API de Anthropic.'}
            </span>
            <span className="spacer" />
            {phase === 'working' ? (
              <>
                <span className="thinking">Ordenando…</span>
                <button className="btn ghost" onClick={() => ctl.current?.abort()}>Detener</button>
              </>
            ) : (
              <>
                <button className="btn ghost" onClick={close}>Cancelar</button>
                <button className="btn primary" onClick={run} disabled={!raw.trim() || !mode || mode === 'checking'}>Ordenar</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'review' && result && (
        <div className="form">
          <p className="muted small">Revisa el resultado. No se guarda nada hasta que pulses «Usar estas notas».</p>
          {result.title && (
            <label className="check-row">
              <input type="checkbox" checked={useTitle} onChange={(e) => setUseTitle(e.target.checked)} />
              Usar como título: <strong>{result.title}</strong>
            </label>
          )}
          <div className="preview"><Notes text={toNotes({ ...result, tasks: [] })} /></div>

          {result.tasks.length > 0 && (
            <div className="field">
              <span>Crear estas tareas en el proyecto</span>
              <ul className="pick-list">
                {result.tasks.map((t, i) => (
                  <li key={i}>
                    <label className="check-row">
                      <input type="checkbox" checked={picked[i] ?? false}
                        onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                      <span className="grow">{t.title}{t.owner && <span className="muted"> · {t.owner}</span>}</span>
                      {/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) && <span className="badge due-ok">{formatDate(t.dueDate)}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="check-row">
            <input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} />
            Guardar también mi texto original al final de las notas
          </label>

          <div className="form-actions">
            <button className="btn ghost" onClick={() => setPhase('input')}>Volver a editar</button>
            <span className="spacer" />
            <button className="btn ghost" onClick={run}>Ordenar de nuevo</button>
            <button className="btn primary" onClick={apply}>Usar estas notas</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
