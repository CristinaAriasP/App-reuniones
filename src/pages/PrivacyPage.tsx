import { Link } from 'react-router-dom';

/**
 * Información de privacidad y datos.
 * BORRADOR: describe cómo funciona la app técnicamente, pero no es un texto legal definitivo.
 * Debe revisarlo una persona responsable (gestoría, abogado o el responsable de protección de datos de la empresa).
 */
export function PrivacyPage() {
  return (
    <div className="page narrow legal">
      <h1>Privacidad y datos</h1>

      <p className="notice warn" role="note">
        <strong>Borrador.</strong> Este texto explica cómo funciona la app, pero no es un texto legal definitivo.
        Si la usas con datos de tu trabajo o de clientes, revísalo con tu empresa, tu gestoría o un abogado.
        Los huecos entre corchetes [así] están por completar.
      </p>

      <section className="card">
        <h2>Quién es responsable</h2>
        <p>
          Esta es una herramienta de uso personal. Responsable de los datos: <strong>[Nombre y apellidos]</strong>,
          contacto: <strong>[email de contacto]</strong>.
        </p>
      </section>

      <section className="card">
        <h2>Qué datos se guardan y para qué</h2>
        <ul>
          <li><strong>Tu cuenta</strong> (si inicias sesión): email y nombre que da Google o el que escribas. Solo sirven para identificarte y guardar tus datos en tu cuenta.</li>
          <li><strong>Lo que escribes en la app</strong>: proyectos, empresas, reuniones, notas, asistentes, tareas, entregas y respuestas del cuestionario. Solo sirven para que puedas consultarlos y buscarlos.</li>
          <li>
            <strong>Datos de otras personas</strong>: si en las notas o en «Asistentes» escribes nombres u otros datos de clientes o compañeros,
            también se guardan. Escribe solo lo necesario y no guardes datos sensibles (salud, datos bancarios, etc.).
          </li>
        </ul>
        <p>No se recogen datos de navegación, ni se hacen perfiles, ni se usan para publicidad.</p>
      </section>

      <section className="card">
        <h2>Dónde se guardan y quién los recibe</h2>
        <ul>
          <li><strong>Sin cuenta</strong>: solo en este navegador, en este dispositivo.</li>
          <li><strong>Con cuenta</strong>: en Firebase (Google Cloud), en la región elegida al crear el proyecto: <strong>[p. ej. Madrid, europe-southwest1]</strong>. Solo tu cuenta puede leerlos.</li>
          <li>
            <strong>Al usar «Ordenar con IA»</strong> (solo en el enlace de Claude): el texto que pides ordenar, el nombre del proyecto y las preguntas del cuestionario
            se envían a Claude (Anthropic) para procesarlos. Solo cuando pulsas «Ordenar». En la versión de Firebase no hay IA.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Cookies y almacenamiento</h2>
        <p>
          La app no usa cookies de analítica ni de publicidad, ni carga vídeos, mapas o redes sociales.
          Solo usa el almacenamiento del navegador imprescindible para funcionar: tus datos, tu sesión y tus preferencias.
          Por eso no muestra un aviso de cookies. Si algún día se añade analítica o contenido de terceros,
          habrá que pedir consentimiento antes de cargarlo.
        </p>
        <p className="muted small">
          Al iniciar sesión con Google, la ventana de Google puede usar sus propias cookies para identificarte.
        </p>
      </section>

      <section className="card">
        <h2>Cuánto tiempo y cómo borrarlos</h2>
        <p>
          Los datos se guardan hasta que los borras. Puedes borrar cualquier proyecto, reunión o tarea desde la app,
          descargar una copia completa en <Link to="/ajustes">Ajustes</Link> y, para borrar tu cuenta y todos sus datos,
          [indicar el procedimiento: p. ej. escribir a … / borrarla desde la consola de Firebase].
        </p>
      </section>
    </div>
  );
}
