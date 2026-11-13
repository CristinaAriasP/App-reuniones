import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../db';
import { todayISO } from '../utils';
import { useConfirm } from '../components/Confirm';
import { getApiKey, isInClaudeViewer, setApiKey } from '../ai';

export function BackupPage() {
  const ask = useConfirm();
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
      if (!(await ask('Restaurar esta copia reemplazará todos los datos actuales.', 'Restaurar'))) return;
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
      <h1>Ajustes</h1>
      <AISettings />
      <section className="card">
        <h2>Copia de seguridad</h2>
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

function AISettings() {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(!!getApiKey());
  const [show, setShow] = useState(false);

  if (isInClaudeViewer()) {
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

  function save() {
    setApiKey(key.trim());
    setSaved(!!key.trim());
  }

  return (
    <section className="card">
      <h2>✨ Inteligencia artificial</h2>
      <p>
        Para usar «Ordenar con IA» fuera de Claude, pega aquí una clave de API de Anthropic.
        Se guarda solo en este navegador y se envía únicamente a Anthropic, junto con el texto que pidas ordenar.
        Puedes crear una clave en console.anthropic.com. Cada uso tiene un pequeño coste en tu cuenta de Anthropic.
      </p>
      <div className="key-row">
        <input
          id="api-key"
          type={show ? 'text' : 'password'}
          value={key}
          onChange={(e) => { setKey(e.target.value); setSaved(false); }}
          placeholder="sk-ant-…"
          aria-label="Clave de API de Anthropic"
          autoComplete="off"
        />
        <button className="btn ghost" onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button>
        <button className="btn primary" onClick={save} disabled={saved && key === getApiKey()}>Guardar</button>
      </div>
      {saved && getApiKey() && (
        <p className="notice ok">
          Clave guardada. Ya puedes usar «Ordenar con IA».{' '}
          <button className="link-btn" onClick={() => { setApiKey(''); setKey(''); setSaved(false); }}>Borrar clave</button>
        </p>
      )}
    </section>
  );
}
