import { useState, type FormEvent } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Project } from './db';
import { ProjectForm } from './components/ProjectForm';
import { ConfirmProvider } from './components/Confirm';
import { Dashboard } from './pages/Dashboard';
import { ProjectPage } from './pages/ProjectPage';
import { MeetingPage } from './pages/MeetingPage';
import { SearchPage } from './pages/SearchPage';
import { BackupPage } from './pages/BackupPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AuthProvider, LoginScreen, useAuth } from './auth';
import { useConfirm } from './components/Confirm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { safeColor } from './validation';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ConfirmProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ConfirmProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

/** Si la app está conectada a Firebase, pide iniciar sesión (o seguir sin cuenta) antes de entrar. */
function Gate() {
  const { mode, localOnly, chooseLocalOnly } = useAuth();
  if (mode === 'loading') return <div className="splash"><span className="thinking">Cargando…</span></div>;
  if (mode === 'signedOut' && !localOnly) return <LoginScreen onSkip={() => chooseLocalOnly(true)} />;
  return <Layout />;
}

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <div className={'layout' + (menuOpen ? ' menu-open' : '')}>
      <a className="skip-link" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Saltar al contenido
      </a>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menú" aria-expanded={menuOpen}>☰</button>
        <span className="brand"><span aria-hidden="true">🗂️</span> Reuniones</span>
      </header>
      <Sidebar />
      <div className="scrim" onClick={() => setMenuOpen(false)} />
      <main className="main" id="contenido" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/proyecto/:id" element={<ProjectPage />} />
          <Route path="/reunion/:id" element={<MeetingPage />} />
          <Route path="/buscar" element={<SearchPage />} />
          <Route path="/ajustes" element={<BackupPage />} />
          <Route path="/copia" element={<BackupPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const projects = useLiveQuery(() => db.projects.toArray(), []);

  const visible = (projects ?? []).filter((p) => showArchived || !p.archived);
  const archivedCount = (projects ?? []).filter((p) => p.archived).length;
  const groups = new Map<string, Project[]>();
  for (const p of visible) {
    const key = p.company || 'Sin empresa';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a === 'Sin empresa' ? 1 : b === 'Sin empresa' ? -1 : a.localeCompare(b, 'es'),
  );

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(`/buscar?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <aside className="sidebar">
      <div className="brand desktop-only"><span aria-hidden="true">🗂️</span> Reuniones</div>
      <form onSubmit={search} className="sidebar-search">
        <input type="search" maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en todo…" aria-label="Buscar" />
      </form>
      <nav className="nav">
        <NavLink to="/" end><span aria-hidden="true">🏠</span> Inicio</NavLink>
        <NavLink to="/buscar"><span aria-hidden="true">🔎</span> Búsqueda</NavLink>
      </nav>

      <div className="sidebar-section">
        <span>Proyectos</span>
        <button className="icon-btn" onClick={() => setCreating(true)} title="Nuevo proyecto" aria-label="Nuevo proyecto">＋</button>
      </div>
      <div className="project-tree">
        {projects && visible.length === 0 && (
          <button className="btn ghost small full" onClick={() => setCreating(true)}>Crea tu primer proyecto</button>
        )}
        {sortedGroups.map(([company, list]) => (
          <div key={company} className="company-group">
            <div className="company-name">{company}</div>
            {list.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((p) => (
              <NavLink key={p.id} to={`/proyecto/${p.id}`} className={p.archived ? 'archived' : ''}>
                <span className="dot" style={{ background: safeColor(p.color) }} />
                {p.name}
              </NavLink>
            ))}
          </div>
        ))}
        {archivedCount > 0 && (
          <button className="link-btn" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
          </button>
        )}
      </div>

      <AccountBox />
      <nav className="nav sidebar-bottom">
        <NavLink to="/ajustes"><span aria-hidden="true">⚙️</span> Ajustes y copia</NavLink>
        <NavLink to="/privacidad">Privacidad y datos</NavLink>
      </nav>

      {creating && (
        <ProjectForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/proyecto/${id}`)} />
      )}
    </aside>
  );
}

const SYNC_LABEL = { syncing: 'Sincronizando…', ok: 'Guardado en la nube', offline: 'Sin conexión: se subirá al volver', error: 'Error al sincronizar' };

function AccountBox() {
  const { mode, user, sync, syncError, chooseLocalOnly, logout } = useAuth();
  const ask = useConfirm();
  if (mode === 'disabled') return null;
  if (mode === 'signedOut') {
    return (
      <div className="account-box">
        <p className="muted small">Tus datos solo están en este navegador.</p>
        <button className="btn primary small full" onClick={() => chooseLocalOnly(false)}>Iniciar sesión</button>
      </div>
    );
  }
  if (mode !== 'signedIn' || !user) return null;
  return (
    <div className="account-box">
      <div className="account-user">
        {/* Iniciales en lugar de la foto de Google: así no se carga nada de servidores externos */}
        <span className="avatar initials" aria-hidden="true">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
        <div className="grow">
          <div className="account-name">{user.displayName || user.email}</div>
          <div className={`sync-state ${sync ?? 'syncing'}`} title={syncError || undefined}>
            <span className="sync-dot" /> {sync ? SYNC_LABEL[sync] : SYNC_LABEL.syncing}
          </div>
        </div>
      </div>
      <button className="link-btn small" onClick={async () => {
        if (await ask('Se cerrará la sesión y se borrarán los datos de este navegador. Seguirán guardados en tu cuenta.', 'Cerrar sesión')) await logout();
      }}>Cerrar sesión</button>
    </div>
  );
}
