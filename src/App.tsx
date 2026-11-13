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

export default function App() {
  return (
    <HashRouter>
      <ConfirmProvider>
        <Layout />
      </ConfirmProvider>
    </HashRouter>
  );
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
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menú">☰</button>
        <span className="brand">🗂️ Reuniones</span>
      </header>
      <Sidebar />
      <div className="scrim" onClick={() => setMenuOpen(false)} />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/proyecto/:id" element={<ProjectPage />} />
          <Route path="/reunion/:id" element={<MeetingPage />} />
          <Route path="/buscar" element={<SearchPage />} />
          <Route path="/copia" element={<BackupPage />} />
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
      <div className="brand desktop-only">🗂️ Reuniones</div>
      <form onSubmit={search} className="sidebar-search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en todo…" aria-label="Buscar" />
      </form>
      <nav className="nav">
        <NavLink to="/" end>🏠 Inicio</NavLink>
        <NavLink to="/buscar">🔎 Búsqueda</NavLink>
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
                <span className="dot" style={{ background: p.color }} />
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

      <nav className="nav sidebar-bottom">
        <NavLink to="/copia">💾 Copia de seguridad</NavLink>
      </nav>

      {creating && (
        <ProjectForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/proyecto/${id}`)} />
      )}
    </aside>
  );
}
