import { useState, type FormEvent } from 'react';
import { db, STATUS_LABEL, type Deliverable, type DeliverableStatus } from '../db';
import { todayISO } from '../utils';
import { Modal } from './Modal';

export function DeliverableForm({ projectId, deliverable, onClose }: {
  projectId: number;
  deliverable?: Deliverable;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(deliverable?.title ?? '');
  const [dueDate, setDueDate] = useState(deliverable?.dueDate ?? todayISO());
  const [status, setStatus] = useState<DeliverableStatus>(deliverable?.status ?? 'pendiente');
  const [notes, setNotes] = useState(deliverable?.notes ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    const data = { title: title.trim(), dueDate, status, notes: notes.trim() };
    if (deliverable) await db.deliverables.update(deliverable.id, data);
    else await db.deliverables.add({ ...data, projectId, createdAt: Date.now() } as Deliverable);
    onClose();
  }

  async function remove() {
    if (deliverable && confirm('¿Borrar esta entrega?')) {
      await db.deliverables.delete(deliverable.id);
      onClose();
    }
  }

  return (
    <Modal title={deliverable ? 'Editar entrega' : 'Nueva entrega'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>
          Qué hay que entregar
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Propuesta de diseño v1" required />
        </label>
        <div className="form-row">
          <label>
            Fecha de entrega
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </label>
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label>
          Notas
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Requisitos, formato, a quién se entrega…" />
        </label>
        <div className="form-actions">
          {deliverable && <button type="button" className="btn danger-ghost" onClick={remove}>Borrar</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
