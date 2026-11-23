# Revisión de calidad, seguridad, SEO, legal y accesibilidad

Cómo cumple esta app cada regla del proyecto. Es una **herramienta personal y privada** (con inicio de sesión), no una web pública,
y eso hace que algunas reglas no apliquen: se explica en cada caso.

Leyenda: ✅ se cumple · ➖ no aplica (y por qué) · ⚠️ depende de algo externo

## Código

| Regla | Estado | Cómo |
|---|---|---|
| Código limpio, comentado y separado en archivos | ✅ | React + TypeScript: un archivo por página (`src/pages`), por componente (`src/components`) y por responsabilidad (`db.ts`, `sync.ts`, `auth.tsx`, `ai.ts`, `validation.ts`). Estilos en `src/styles.css`, por secciones. El «HTML» está en los componentes (JSX), que es la forma estándar en React. |
| Colores, tipografías y espaciados como variables CSS | ✅ | Todo en `:root` de `styles.css`: colores (con modo claro y oscuro), `--font-*`, `--fs-*`, `--space-*`, `--radius-*`. |
| Fuentes e imágenes en local | ✅ | Se usan las fuentes del sistema (no se descarga ninguna). El icono es `public/favicon.svg`. No se carga la foto de perfil de Google: se muestran las iniciales. |
| Imágenes ligeras, nombres correctos y `alt` | ✅ | Solo hay SVG. Los iconos decorativos (emojis) están ocultos para lectores de pantalla. |
| Textos preparados para traducir | ➖ | La app está solo en español y es para una persona. Si algún día hiciera falta otro idioma, habría que extraer los textos a un archivo de traducciones. |
| Contenido editable sin tocar código | ✅ | Todo el contenido (proyectos, reuniones, preguntas del cuestionario…) se edita desde la propia app. |

## Seguridad

| Regla | Estado | Cómo |
|---|---|---|
| Ningún secreto en el código | ✅ | La configuración de Firebase va en `.env.local` (no se sube a GitHub) y no es secreta. La versión de Firebase no usa ninguna clave de API (no tiene IA). |
| Validar y limpiar entradas, escapar salidas | ✅ | Límites de longitud en todos los campos; las copias de seguridad se validan campo a campo antes de restaurarlas (`validation.ts`); el color de proyecto solo admite `#rrggbb`. React escapa todo lo que se muestra y no se usa `innerHTML`. Las respuestas de la IA se revisan antes de guardarse. |
| Consultas parametrizadas | ➖ / ✅ | No hay SQL. Firestore e IndexedDB se consultan por id y campo, sin construir consultas con texto del usuario, así que no hay inyección posible. |
| Contraseñas cifradas, límite de intentos, permisos en cada petición | ✅ | Lo gestiona Firebase Authentication: guarda las contraseñas con hash (scrypt), limita los intentos fallidos y la app nunca ve las contraseñas. Las reglas de Firestore comprueban en cada lectura y escritura que los datos son de quien pide, y validan su forma. Ver `docs/FIREBASE.md` paso 5 para impedir cuentas nuevas. |
| HTTPS obligatorio y cookies protegidas | ✅ | Firebase Hosting solo sirve por HTTPS y se añade HSTS. La app no crea cookies (la sesión se guarda en el almacenamiento del navegador). |
| Cabeceras de seguridad | ✅ | CSP estricta, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (en `firebase.json`). |
| No mostrar errores internos | ✅ | Los errores se traducen a mensajes claros; el detalle técnico solo va a la consola. Si algo falla de forma inesperada, se muestra «Algo ha fallado» con un botón para recargar. |
| Pocas dependencias y actualizadas | ✅ / ⚠️ | 8 dependencias de la app (React, router, Dexie y su enlace con React, Firebase, la librería de Claude y zod para validar), todas en su última versión y **0 vulnerabilidades** (`npm audit --omit=dev`). La herramienta de publicación `firebase-tools` (solo se usa en tu ordenador para publicar) tiene 14 avisos moderados en librerías suyas sin arreglo publicado todavía; no afectan a la app. Revisar con `npm audit` y `npm outdated` de vez en cuando. |
| Datos de tarjeta | ➖ | No hay pagos. |

## SEO

| Regla | Estado | Cómo |
|---|---|---|
| HTML semántico, un solo `h1` por página | ✅ | Cada pantalla tiene un único `h1`; se usan `main`, `nav`, `aside`, `section`, listas y botones reales. |
| Títulos y descripciones con negocio y localidad | ➖ | Es una herramienta privada, no un negocio que quiera atraer visitas. |
| Sitemap, robots.txt y noindex | ➖ (a propósito) | **La app no debe aparecer en Google**: tiene `noindex` permanente (etiqueta meta y cabecera `X-Robots-Tag`). `robots.txt` no bloquea nada para que los buscadores puedan leer ese `noindex`. No hay sitemap porque no hay páginas públicas. |
| Redirecciones 301 | ➖ | No hay web antigua. |
| hreflang | ➖ | Un solo idioma. |
| Rápida y optimizada para móvil | ✅ | Diseño adaptado a móvil y funciona sin conexión. El código pesa unos 450 KB comprimidos (sobre todo Firebase y la librería de IA), que el navegador guarda en caché tras la primera visita. |
| Textos pensados para búsquedas | ➖ | No es una web pública. |

## Legal

| Regla | Estado | Cómo |
|---|---|---|
| Política de privacidad, aviso legal, cookies, condiciones de venta | ✅ / ➖ | Página **«Privacidad y datos»** (borrador, con huecos por rellenar). No hay aviso legal, banner de cookies ni condiciones de venta porque no es una web pública, no tiene cookies de analítica/publicidad y no vende nada. |
| Textos legales no definitivos | ✅ | La página está marcada como borrador: debe revisarla tu empresa, gestoría o un abogado, sobre todo si guardas datos de clientes. |
| Nada de analítica, vídeos, mapas o redes sin consentimiento | ✅ | No se carga nada de eso. La CSP además lo impediría. |
| Imágenes de menores o personas | ➖ | La app no tiene imágenes de personas. |
| Formularios: qué datos y para qué | ✅ | Inicio de sesión: solo el email, para identificarte (se indica en la propia pantalla). La IA: se avisa de que el texto se envía a Claude (Anthropic) al pulsar «Ordenar». Detalle completo en «Privacidad y datos». |

## Accesibilidad

| Regla | Estado | Cómo |
|---|---|---|
| Contraste WCAG AA | ✅ | Todas las combinaciones de texto y fondo superan 4,5:1, en modo claro y oscuro (comprobado). |
| Navegación completa con teclado | ✅ | Enlace «Saltar al contenido», contorno visible al moverse con Tab, las ventanas retienen el foco, se cierran con Escape y devuelven el foco al botón que las abrió. |
| Enlaces y botones con nombres claros | ✅ | Los botones de icono tienen nombre (p. ej. «Borrar tarea»); los colores tienen nombre («Color Turquesa»); los emojis decorativos están ocultos para lectores de pantalla. |
| Formularios con etiquetas | ✅ | Todos los campos tienen etiqueta visible o `aria-label`. |
