import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../db';
import { todayISO } from '../utils';

export function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function download() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reuniones-copia-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: `Copia descargada: ${data.projects.length} proyectos, ${data.meetings.length} reuniones.` });
  }

  async function upload(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Restaurar esta copia reemplazará TODOS los datos actuales. ¿Continuar?')) return;
      await importBackup(data);
      setMsg({ ok: true, text: `Copia restaurada: ${data.projects.length} proyectos, ${data.meetings.length} reuniones.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo leer el archivo.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page narrow">
      <h1>Copia de seguridad</h1>
      <section className="card">
        <p>
          Tus datos se guardan <strong>en este navegador</strong>, en este ordenador. No se envían a ningún servidor.
          Por eso conviene descargar una copia de vez en cuando, y también te sirve para pasar tus datos a otro ordenador.
        </p>
        <div className="actions">
          <button className="btn primary" onClick={download}>⬇ Descargar copia</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Restaurar desde archivo</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        {msg && <p className={msg.ok ? 'notice ok' : 'notice error'}>{msg.text}</p>}
      </section>
    </div>
  );
}
