# Publicar la app en Firebase (con inicio de sesión)

Con Firebase la app tiene su propia dirección web (`https://agenda-de-proyectos.web.app`), se inicia sesión con Google o con email,
y todo se guarda en tu cuenta: lo ves igual desde el ordenador del trabajo, el portátil o el móvil.

El plan gratuito de Firebase (Spark) es de sobra para este uso. No hace falta poner tarjeta.

Tiempo aproximado: 10-15 minutos la primera vez.

---

## Estado: proyecto «agenda-de-proyectos» ya conectado

La app ya está configurada para tu proyecto de Firebase **agenda-de-proyectos**
(archivos `.env.production` y `.firebaserc`). Su dirección será **https://agenda-de-proyectos.web.app**.

Faltan los pasos 1 a 3, que solo puedes hacer tú desde la consola: <https://console.firebase.google.com/project/agenda-de-proyectos>

## 1. Activar el inicio de sesión

1. Menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** (Sign-in method):
   - **Google** → Habilitar → elige tu email como correo de asistencia → Guardar.
   - **Correo electrónico/contraseña** → Habilitar → Guardar.

## 2. Crear la base de datos

1. **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: una de Europa, por ejemplo **europe-southwest1 (Madrid)**. No se puede cambiar después.
3. Modo: **producción**. Las reglas de verdad se suben al publicar (paso 3).

## 3. Publicar la app

Elige una de las dos formas.

### Opción A — Desde tu ordenador (la más directa)

Necesitas [Node.js](https://nodejs.org) (versión LTS). En una terminal:

```bash
git clone https://github.com/CristinaAriasP/App-reuniones.git
cd App-reuniones
git checkout claude/meeting-management-app-p6upip   # hasta que se una a main
npm install
npx firebase login      # se abre el navegador: entra con tu cuenta de Google
npm run deploy          # publica la app y las reglas de seguridad
```

### Opción B — Automática desde GitHub (sin instalar nada)

GitHub publica la app sola cada vez que hay cambios. Se configura una vez (haz antes los pasos 1 y 2):

1. **Crear una cuenta de servicio** (una «llave» solo para publicar):
   <https://console.cloud.google.com/iam-admin/serviceaccounts?project=agenda-de-proyectos>
   → **Crear cuenta de servicio** → nombre `github-publicar` → **Crear y continuar** → añade estos roles:
   *Administrador de Firebase Hosting*, *Administrador de reglas de Firebase*, *Visualizador de claves de API*,
   *Visualizador de Cloud Run* y *Consumidor de Service Usage* → **Listo**.
2. Entra en la cuenta creada → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo.
3. En GitHub: repositorio → **Settings → Secrets and variables → Actions → New repository secret**.
   Nombre: `FIREBASE_SERVICE_ACCOUNT`. Valor: pega **todo** el contenido del archivo JSON. Guardar.
4. Borra el archivo JSON de tu ordenador: es una llave y ya está guardada (cifrada) en GitHub.
5. **Lanza la primera publicación:** en GitHub, pestaña **Actions** → «Publicar en Firebase» → **Run workflow**.
   (O avisa a Claude: cualquier cambio que suba a la rama también la publica.) Tarda 1-2 minutos;
   cuando salga el tic verde, la app ya está en https://agenda-de-proyectos.web.app.
   A partir de ahí, cada cambio que se suba se publica solo.

Si la publicación falla por permisos, copia el mensaje de error de la pestaña Actions y revisamos los roles.

---

Al terminar, abre **https://agenda-de-proyectos.web.app**, crea tu cuenta (o entra con Google)
y sigue con el paso 5 para que nadie más pueda registrarse.

Para probar la app en tu ordenador sin publicarla: `npm run dev` y abre <http://localhost:5173>.

## 4. Pasar lo que ya tienes en el enlace de Claude

Los datos del enlace de Claude están guardados en ese navegador. Para llevarlos a tu cuenta:

1. En el enlace de Claude: **⚙️ Ajustes y copia → Descargar copia**. Se descarga un archivo `reuniones-copia-AAAA-MM-DD.json`.
2. En tu nueva app de Firebase, inicia sesión → **⚙️ Ajustes y copia → Restaurar desde archivo** → elige ese archivo.

(Si antes usabas la app sin cuenta en el mismo navegador, no hace falta: al iniciar sesión por primera vez, lo que hubiera se sube solo.)

## 5. Que solo puedas entrar tú (importante)

La app es para ti sola. Una vez creada tu cuenta, cierra la puerta a cuentas nuevas:

1. **Authentication → Configuración → Acciones del usuario** → desmarca **Habilitar la creación (registro)** → Guardar.
2. En esa misma pantalla, comprueba que está activada la **Protección contra la enumeración de correos electrónicos**
   (viene activada en los proyectos nuevos). Evita que alguien averigüe qué emails tienen cuenta.
3. **Compruébalo:** abre la app en una ventana privada del navegador e intenta crear una cuenta con otro email
   (o entrar con otra cuenta de Google). Debe salir «En esta app no se pueden crear cuentas nuevas».
   Si no sale, revisa el paso 1.

Aunque alguien consiguiera crear una cuenta, no podría ver tus datos: las reglas de Firestore solo dejan a cada cuenta acceder a lo suyo.
Este paso evita además que alguien use tu proyecto para guardar sus propias cosas.

Firebase ya limita los intentos de inicio de sesión fallidos («Demasiados intentos. Espera unos minutos») y guarda las contraseñas cifradas;
la app nunca ve ni guarda tu contraseña.

## 6. La IA fuera de Claude

En la versión de Firebase, «Ordenar con IA» usa una clave de API de Anthropic. Créala en <https://console.anthropic.com>
y pégala en **⚙️ Ajustes y copia → Inteligencia artificial**. Se guarda solo en ese navegador.

---

## Cómo funciona por dentro

- **Inicio de sesión:** Firebase Authentication (Google o email y contraseña).
- **Datos:** Firestore, en `users/{tu id}/{projects|meetings|tasks|deliverables|questions|answers}`.
- **Seguridad:** `firestore.rules` solo deja leer y escribir a la persona dueña de cada carpeta `users/{id}`,
  y comprueba cada dato que se guarda (campos permitidos, tipo y tamaño máximo).
- **Cabeceras de seguridad** (en `firebase.json`): HTTPS obligatorio (HSTS), política de contenido (CSP) que solo permite
  cargar código de la propia app y hablar con Firebase y Anthropic, prohibición de mostrar la app dentro de otras webs
  y aviso a los buscadores para que no la indexen (es privada).
- **Sin conexión:** la app sigue funcionando; los cambios se suben cuando vuelve internet.
  El punto de color junto a tu nombre indica el estado: verde (guardado en la nube), naranja (sin conexión), rojo (error).
- **Varios dispositivos:** los cambios aparecen en los demás en unos segundos.
- **Cerrar sesión:** borra los datos de ese navegador (siguen en tu cuenta). Útil en ordenadores compartidos.
- **Sin cuenta:** en la pantalla de inicio puedes elegir «Seguir sin cuenta»; entonces todo se guarda solo en ese navegador, como antes.

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| «Este método de inicio de sesión no está activado» | Paso 1: activa Google y/o Correo electrónico/contraseña. |
| «Esta dirección web no está autorizada» | Authentication → Configuración → Dominios autorizados → añade el dominio donde abres la app. Los de `web.app`, `firebaseapp.com` y `localhost` ya vienen. |
| «Error al sincronizar» (punto rojo) | Comprueba que has hecho `npm run deploy` (sube también las reglas) y que la base de datos de Firestore existe (paso 2). |
| «El inicio de sesión aún no está activado en Firebase» | Paso 1: Authentication → Comenzar, y activa los métodos de acceso. |
