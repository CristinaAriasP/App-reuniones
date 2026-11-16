import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence, connectFirestoreEmulator, initializeFirestore,
  persistentLocalCache, persistentMultipleTabManager, terminate, type Firestore,
} from 'firebase/firestore';
import { isInClaudeViewer } from './ai';

/**
 * Configuración del proyecto de Firebase. Se lee de las variables VITE_FIREBASE_*
 * (archivo .env.local). Estos valores no son secretos: identifican el proyecto;
 * lo que protege los datos son las reglas de Firestore (firestore.rules).
 */
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};
const useEmulator = env.VITE_FIREBASE_EMULATOR === '1';

/** Firebase solo se usa si está configurado y no estamos dentro de claude.ai (allí no hay acceso a internet). */
export const firebaseConfigured = !!(config.apiKey && config.projectId) && !isInClaudeViewer();

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let fs: Firestore | undefined;

export function getFirebaseAuth(): Auth {
  if (!app) app = initializeApp(config);
  if (!auth) {
    auth = getAuth(app);
    auth.languageCode = 'es';
    if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

export function getDb(): Firestore {
  getFirebaseAuth();
  if (!fs) {
    fs = initializeFirestore(app!, {
      // Copia local para funcionar sin conexión; los cambios se suben al volver internet
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
    if (useEmulator) connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  }
  return fs;
}

/** Borra la copia local de Firestore de este navegador (al cerrar sesión). */
export async function clearFirestoreCache() {
  if (!fs) return;
  const old = fs;
  fs = undefined;
  try {
    await terminate(old);
    await clearIndexedDbPersistence(old);
  } catch { /* si otra pestaña la usa, se borrará la próxima vez */ }
}
