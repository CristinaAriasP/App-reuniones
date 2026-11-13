import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Meeting } from '../db';
import { todayISO } from '../utils';
import { Modal } from './Modal';

export function NewMeetingDialog({ projectId, onClose }: { projectId?: number; onClose: () => void }) {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.filter((p) => !p.archived).toArray(), []);
  const [pid, setPid] = useState<number | ''>(projectId ?? '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pid || !date) return;
    const now = Date.now();
    const id = await db.meetings.add({
      projectId: Number(pid), date, title: title.trim(), attendees: '', notes: '', createdAt: now, updatedAt: now,
    } as Meeting);
    onClose();
    navigate(`/reunion/${id}?editar=1`);
  }

  return (
    <Modal title="Nueva reunión" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!projectId && (
          <label>
            Proyecto
            <select value={pid} onChange={(e) => setPid(e.target.value ? Number(e.target.value) : '')} required autoFocus>
              <option value="">Elige un proyecto…</option>
              {projects?.sort((a, b) => (a.company + a.name).localeCompare(b.company + b.name, 'es')).map((p) => (
                <option key={p.id} value={p.id}>{p.company ? `${p.company} — ` : ''}{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Título (opcional)
          <input autoFocus={!!projectId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Kick-off, seguimiento semanal…" />
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={!pid}>Crear y escribir notas</button>
        </div>
      </form>
    </Modal>
  );
}
