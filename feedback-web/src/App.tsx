import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Gravar from './pages/Gravar';
import Acervo from './pages/Acervo';
import Pessoas from './pages/Pessoas';
import Revisoes from './pages/Revisoes';
import Revisar from './pages/Revisar';
import Meus from './pages/Meus';
import Perfil from './pages/Perfil';
import { AuthProvider, useAuth, Login, SemAcesso } from './auth';
import './App.css';

const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
  </svg>
);
const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M18 20a6 6 0 0 0-3-5" />
  </svg>
);
const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /><path d="m9 13 2 2 4-4" />
  </svg>
);
const IconStetho = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 17a6 6 0 0 0 6-6" /><circle cx="18" cy="9" r="2" /><path d="M10 17v1a4 4 0 0 0 8 0v-2" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const NAV = [
  { to: '/', end: true, label: 'Gravar', Icon: IconMic },
  { to: '/acervo', label: 'Acervo', Icon: IconFolder },
  { to: '/pessoas', label: 'Pessoas', Icon: IconUsers },
  { to: '/revisoes', label: 'Revisões', Icon: IconClipboard },
  { to: '/meus', label: 'Meus', Icon: IconStetho },
];

function Shell() {
  const { signOut, session } = useAuth();
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav" aria-label="Navegação principal">
          <div className="nav-brand">
            <span className="nav-brand-mark"><IconStetho /></span>
            <span className="nav-brand-text">Feedback SCUT</span>
          </div>
          <div className="nav-links">
            {NAV.map(({ to, end, label, Icon }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                aria-label={label}>
                <span className="nav-icon"><Icon /></span>
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
          <button className="nav-item nav-logout" onClick={signOut} title={session?.user?.email ?? ''} aria-label="Sair">
            <span className="nav-icon"><IconLogout /></span>
            <span className="nav-label">Sair</span>
          </button>
        </nav>
        <main className="main">
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Gravar />} />
              <Route path="/acervo" element={<Acervo />} />
              <Route path="/pessoas" element={<Pessoas />} />
              <Route path="/perfil/:nome" element={<Perfil />} />
              <Route path="/revisoes" element={<Revisoes />} />
              <Route path="/revisar/:id" element={<Revisar />} />
              <Route path="/ver/:id" element={<Navigate to="/revisar/:id" replace />} />
              <Route path="/meus" element={<Meus />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Gate() {
  const { loading, session, temAcesso } = useAuth();
  if (loading) return <div className="login-wrap"><div className="login-card"><div className="login-brand">Feedback SCUT</div><p className="login-sub">Carregando…</p></div></div>;
  if (!session) return <Login />;
  if (!temAcesso) return <SemAcesso />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
