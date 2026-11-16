# Publicar la app en Firebase (con inicio de sesión)

Con Firebase la app tiene su propia dirección web (`https://tu-proyecto.web.app`), se inicia sesión con Google o con email,
y todo se guarda en tu cuenta: lo ves igual desde el ordenador del trabajo, el portátil o el móvil.

El plan gratuito de Firebase (Spark) es de sobra para este uso. No hace falta poner tarjeta.

Tiempo aproximado: 20 minutos la primera vez.

---

## 1. Crear el proyecto de Firebase

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → ponle un nombre, por ejemplo `reuniones-cristina`.
   Firebase le dará un identificador (por ejemplo `reuniones-cristina` o `reuniones-cristina-1a2b3`). Será parte de la dirección web.
3. Google Analytics: puedes desactivarlo, no hace falta.

## 2. Activar el inicio de sesión

1. En el menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** (Sign-in method):
   - **Google** → Habilitar → elige tu email como correo de asistencia → Guardar.
   - **Correo electrónico/contraseña** → Habilitar → Guardar.

## 3. Crear la base de datos

1. **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: una de Europa, por ejemplo **europe-southwest1 (Madrid)**. No se puede cambiar después.
3. Modo: **producción**. Las reglas de seguridad de verdad las subes en el paso 5
   (solo tú podrás leer y escribir tus datos).

## 4. Registrar la app web y copiar su configuración

1. Rueda dentada ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → apartado **Tus apps** → icono **`</>`** (Web).
2. Ponle un apodo, por ejemplo `Reuniones web`. No hace falta marcar Firebase Hosting aquí.
3. Te mostrará un bloque `firebaseConfig` con `apiKey`, `authDomain`, `projectId`, `appId`…
4. En la carpeta del proyecto, copia el archivo `.env.example` como **`.env.local`** y rellénalo con esos valores:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=reuniones-cristina.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=reuniones-cristina
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```

   Estos valores no son secretos (identifican el proyecto), pero `.env.local` no se sube a GitHub por si acaso.

## 5. Publicar desde tu ordenador

Necesitas [Node.js](https://nodejs.org) (versión LTS) instalado.

```bash
# 1. Descargar el proyecto (o descárgalo como ZIP desde GitHub)
git clone https://github.com/CristinaAriasP/App-reuniones.git
cd App-reuniones
git checkout claude/meeting-management-app-p6upip   # hasta que se una a main

# 2. Instalar dependencias
npm install

# 3. (Crea aquí el archivo .env.local del paso 4)

# 4. Iniciar sesión en Firebase y elegir tu proyecto
npx firebase login
npx firebase use --add        # elige tu proyecto y ponle el alias "default"

# 5. Publicar la app y las reglas de seguridad
npm run deploy
```

Al terminar te dirá la dirección: **`https://<tu-proyecto>.web.app`**. Ábrela, inicia sesión y listo.

Cada vez que haya cambios en la app, repite `npm run deploy` para publicar la nueva versión.

Para probarla en tu ordenador antes de publicar: `npm run dev` y abre <http://localhost:5173>.

## 6. Pasar lo que ya tienes en el enlace de Claude

Los datos del enlace de Claude están guardados en ese navegador. Para llevarlos a tu cuenta:

1. En el enlace de Claude: **⚙️ Ajustes y copia → Descargar copia**. Se descarga un archivo `reuniones-copia-AAAA-MM-DD.json`.
2. En tu nueva app de Firebase, inicia sesión → **⚙️ Ajustes y copia → Restaurar desde archivo** → elige ese archivo.

(Si antes usabas la app sin cuenta en el mismo navegador, no hace falta: al iniciar sesión por primera vez, lo que hubiera se sube solo.)

## 7. La IA fuera de Claude

En la versión de Firebase, «Ordenar con IA» usa una clave de API de Anthropic. Créala en <https://console.anthropic.com>
y pégala en **⚙️ Ajustes y copia → Inteligencia artificial**. Se guarda solo en ese navegador.

---

## Cómo funciona por dentro

- **Inicio de sesión:** Firebase Authentication (Google o email y contraseña).
- **Datos:** Firestore, en `users/{tu id}/{projects|meetings|tasks|deliverables|questions|answers}`.
- **Seguridad:** `firestore.rules` solo deja leer y escribir a la persona dueña de cada carpeta `users/{id}`.
- **Sin conexión:** la app sigue funcionando; los cambios se suben cuando vuelve internet.
  El punto de color junto a tu nombre indica el estado: verde (guardado en la nube), naranja (sin conexión), rojo (error).
- **Varios dispositivos:** los cambios aparecen en los demás en unos segundos.
- **Cerrar sesión:** borra los datos de ese navegador (siguen en tu cuenta). Útil en ordenadores compartidos.
- **Sin cuenta:** en la pantalla de inicio puedes elegir «Seguir sin cuenta»; entonces todo se guarda solo en ese navegador, como antes.

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| «Este método de inicio de sesión no está activado» | Paso 2: activa Google y/o Correo electrónico/contraseña. |
| «Esta dirección web no está autorizada» | Authentication → Configuración → Dominios autorizados → añade el dominio donde abres la app. Los de `web.app`, `firebaseapp.com` y `localhost` ya vienen. |
| «Error al sincronizar» (punto rojo) | Comprueba que has hecho `npm run deploy` (sube también las reglas) y que la base de datos de Firestore existe (paso 3). |
| La app sale sin pantalla de inicio de sesión | Falta el archivo `.env.local` (paso 4) al hacer `npm run deploy`. |
