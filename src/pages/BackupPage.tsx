import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../db';
import { todayISO } from '../utils';
import { useConfirm } from '../components/Confirm';
import { useAuth } from '../auth';
import { QuestionsEditor } from '../components/QuestionsEditor';
import { isInClaudeViewer } from '../ai';

export function BackupPage() {
  const ask = useConfirm();
  const { pushAllToCloud, mode } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function download() {
    const data = await exportBackup();
    const json = JSON.stringify(data, null, 2);
    const filename = `reuniones-copia-${todayISO()}.json`;
    if (isInClaudeViewer()) {
      // Dentro de claude.ai las descargas pasan por el propio visor, que pide confirmación
      type Downloads = { save(r: { filename: string; data: string }): Promise<unknown> };
      const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
      const downloads = (await claude?.use('downloads')) as Downloads | null;
      if (!downloads) { setMsg({ ok: false, text: 'Aquí no se pueden descargar archivos.' }); return; }
      try {
        await downloads.save({ filename, data: json });
      } catch (e) {
        if ((e as { code?: string }).code !== 'declined') setMsg({ ok: false, text: 'No se pudo descargar la copia.' });
        return;
      }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    setMsg({ ok: true, text: `Copia descargada: ${data.projects.length} proyectos, ${data.meetings.length} reuniones.` });
  }

  async function upload(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!(await ask('Restaurar esta copia reemplazará todos los datos actuales.', 'Restaurar'))) return;
      await importBackup(data);
      await pushAllToCloud();
      setMsg({ ok: true, text: `Copia restaurada: ${data.projects.length} proyectos, ${data.meetings.length} reuniones.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo leer el archivo.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page narrow">
      <h1>Ajustes</h1>
      <QuestionsEditor />
      <AISettings />
      <section className="card">
        <h2>Copia de seguridad</h2>
        <p>
          {mode === 'signedIn'
            ? <>Tus datos se guardan en tu cuenta y se sincronizan entre tus dispositivos. Aun así, puedes descargar una copia
              para guardarla tú. Si restauras una copia, tu cuenta pasará a tener exactamente lo que haya en ella.</>
            : <>Tus datos se guardan <strong>en este navegador</strong>, en este ordenador. No se envían a ningún servidor.
              Por eso conviene descargar una copia de vez en cuando, y también te sirve para pasar tus datos a otro ordenador.</>}
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

/** Solo dentro de claude.ai: la IA usa la cuenta de Claude de quien la usa. En Firebase no hay IA. */
function AISettings() {
  if (!isInClaudeViewer()) return null;
  return (
    <section className="card">
      <h2>✨ Inteligencia artificial</h2>
      <p>
        Aquí la IA usa tu propia cuenta de Claude: no tienes que configurar nada.
        La primera vez que pulses «Ordenar con IA» te pedirá permiso.
      </p>
    </section>
  );
}
