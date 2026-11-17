import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { clearFirestoreCache, firebaseConfigured, getDb, getFirebaseAuth } from './firebase';
import { clearLocalData, replaceRemoteWithLocal, startSync, stopSync, type SyncStatus } from './sync';

type Mode = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  mode: Mode;
  user: User | null;
  sync: SyncStatus | null;
  syncError: string;
  /** La persona eligió usar la app sin cuenta (solo en este navegador). */
  localOnly: boolean;
  chooseLocalOnly: (v: boolean) => void;
  logout: () => Promise<void>;
  /** Tras restaurar una copia: deja la nube igual que este navegador. */
  pushAllToCloud: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  mode: 'disabled', user: null, sync: null, syncError: '', localOnly: true,
  chooseLocalOnly: () => {}, logout: async () => {}, pushAllToCloud: async () => {},
});

const LOCAL_ONLY = 'reuniones.localOnly';
const readLocalOnly = () => { try { return localStorage.getItem(LOCAL_ONLY) === '1'; } catch { return false; } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(firebaseConfigured ? 'loading' : 'disabled');
  const [user, setUser] = useState<User | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncError, setSyncError] = useState('');
  const [localOnly, setLocalOnly] = useState(readLocalOnly);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setMode(u ? 'signedIn' : 'signedOut');
      if (u) {
        startSync(getDb(), u.uid, (s, err) => { setSync(s); setSyncError(err ?? ''); });
      } else {
        stopSync();
        setSync(null);
      }
    });
  }, []);

  const chooseLocalOnly = useCallback((v: boolean) => {
    setLocalOnly(v);
    try { if (v) localStorage.setItem(LOCAL_ONLY, '1'); else localStorage.removeItem(LOCAL_ONLY); } catch { /* */ }
  }, []);

  const logout = useCallback(async () => {
    stopSync();
    await signOut(getFirebaseAuth());
    await clearLocalData();
    await clearFirestoreCache();
    chooseLocalOnly(false);
  }, [chooseLocalOnly]);

  const pushAllToCloud = useCallback(async () => {
    if (user) await replaceRemoteWithLocal(getDb(), user.uid);
  }, [user]);

  return (
    <AuthContext.Provider value={{ mode, user, sync, syncError, localOnly, chooseLocalOnly, logout, pushAllToCloud }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ---------- Pantalla de inicio de sesión ----------

function authMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'El email o la contraseña no son correctos.',
    'auth/wrong-password': 'El email o la contraseña no son correctos.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email. Inicia sesión en lugar de crearla.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/invalid-email': 'Ese email no es válido.',
    'auth/missing-password': 'Escribe la contraseña.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    'auth/network-request-failed': 'No hay conexión a internet.',
    'auth/popup-blocked': 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta página.',
    'auth/operation-not-allowed': 'Este método de inicio de sesión no está activado en Firebase (Authentication → Sign-in method).',
    'auth/admin-restricted-operation': 'En esta app no se pueden crear cuentas nuevas. Entra con la cuenta que ya tienes.',
    'auth/user-disabled': 'Esta cuenta está desactivada.',
    'auth/unauthorized-domain': 'Esta dirección web no está autorizada en Firebase (Authentication → Settings → Authorized domains).',
  };
  return map[code] ?? 'No se pudo iniciar sesión. Vuelve a intentarlo.';
}

export function LoginScreen({ onSkip }: { onSkip?: () => void }) {
  const [view, setView] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(''); setInfo('');
    try { await fn(); } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(authMessage(e));
    } finally { setBusy(false); }
  }

  const google = () => run(() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()));

  function submit(e: FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (view === 'reset') {
      run(async () => { await sendPasswordResetEmail(auth, email.trim()); setInfo('Te hemos enviado un email para cambiar la contraseña.'); });
    } else if (view === 'signup') {
      run(() => createUserWithEmailAndPassword(auth, email.trim(), password));
    } else {
      run(() => signInWithEmailAndPassword(auth, email.trim(), password));
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="hero-emoji" aria-hidden="true">🗂️</div>
        <h1>Reuniones</h1>
        <p className="muted">Inicia sesión para guardar tus reuniones en la nube y verlas desde cualquier dispositivo.</p>

        {view !== 'reset' && (
          <>
            <button className="btn google large full" onClick={google} disabled={busy}>
              <GoogleIcon /> Continuar con Google
            </button>
            <div className="divider"><span>o con tu email</span></div>
          </>
        )}

        <form className="form" onSubmit={submit}>
          <label>
            Email
            <input id="login-email" type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {view !== 'reset' && (
            <label>
              Contraseña
              <input id="login-password" type="password" maxLength={128} autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
          )}
          {error && <p className="notice error">{error}</p>}
          {info && <p className="notice ok">{info}</p>}
          <button className="btn primary large full" type="submit" disabled={busy}>
            {view === 'login' ? 'Iniciar sesión' : view === 'signup' ? 'Crear cuenta' : 'Enviar email'}
          </button>
        </form>

        <div className="login-links">
          {view === 'login' && <>
            <button className="link-btn" onClick={() => setView('signup')}>Crear una cuenta</button>
            <button className="link-btn" onClick={() => setView('reset')}>He olvidado la contraseña</button>
          </>}
          {view !== 'login' && <button className="link-btn" onClick={() => setView('login')}>Ya tengo cuenta</button>}
        </div>

        <p className="muted small">
          Solo se usa tu email para identificarte y guardar tus datos en tu cuenta.{' '}
          <a href="#/privacidad" onClick={(e) => { e.preventDefault(); setShowPrivacy((v) => !v); }} aria-expanded={showPrivacy}>Más información</a>
        </p>
        {showPrivacy && (
          <p className="muted small login-privacy">
            Con cuenta, tus reuniones se guardan en Firebase (Google Cloud) y solo tú puedes leerlas.
            Sin cuenta, se quedan en este navegador. No hay cookies de analítica ni de publicidad.
          </p>
        )}

        {onSkip && (
          <p className="login-skip">
            <button className="link-btn" onClick={onSkip}>Seguir sin cuenta</button>
            <span className="muted small"> · los datos se guardan solo en este navegador</span>
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
