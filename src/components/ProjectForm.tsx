import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PROJECT_COLORS, type Project } from '../db';
import { Modal } from './Modal';

export function ProjectForm({ project, onClose, onSaved }: {
  project?: Project;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [company, setCompany] = useState(project?.company ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const companies = useLiveQuery(() => db.projects.orderBy('company').uniqueKeys(), []) as string[] | undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const data = { name: name.trim(), company: company.trim(), description: description.trim(), color };
    let id: number;
    if (project) {
      await db.projects.update(project.id, data);
      id = project.id;
    } else {
      id = (await db.projects.add({ ...data, archived: false, createdAt: Date.now() } as Project)) as number;
    }
    onSaved?.(id);
    onClose();
  }

  return (
    <Modal title={project ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>
          Nombre del proyecto
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Rediseño web" required />
        </label>
        <label>
          Empresa / cliente
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. Acme S.L." list="companies" />
          <datalist id="companies">
            {companies?.filter(Boolean).map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>
          Descripción
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexto, objetivos, contactos…" />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {PROJECT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={'swatch' + (c === color ? ' selected' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary">{project ? 'Guardar' : 'Crear proyecto'}</button>
        </div>
      </form>
    </Modal>
  );
}
