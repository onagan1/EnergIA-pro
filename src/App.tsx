import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ToastProvider } from './hooks/use-toast';
import {
  Settings, Users as UsersIcon, Calculator, FileText, Zap, LogOut,
  RefreshCw, Trash2, FolderOpen, Save, Palette, Upload, Percent, Layers,
} from 'lucide-react';
import { Simulator } from './pages/Simulator';
import { Suppliers } from './pages/Suppliers';
import { AdminConfig } from './pages/AdminConfig';
import { ImportPDFs } from './pages/ImportPDFs';
import { Users } from './pages/Users';
import { Campaigns } from './pages/Campaigns';
import { Profiles } from './pages/Profiles';
import { Login } from './pages/Login';
import {
  ERCUpdateButton,
  MFRRUpdateButton,
  MarketDataUpdateButton,
  InclusionsUpdateButton,
} from './components/market/MarketDataButtons';

// Lightweight dropdown that closes on outside click
function Dropdown({
  trigger,
  children,
  align = 'end',
  width = 'w-64',
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={`absolute z-50 mt-2 ${width} rounded-xl border border-slate-200 bg-white shadow-xl p-2 ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const iconBtn =
  'inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors';
const pillBtn =
  'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors';
const menuItem =
  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors text-left';
const menuLabel = 'text-xs font-semibold text-slate-400 px-2.5 pt-2 pb-1';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAppContext();
  const { signOut, user } = useAuth();

  const currentPath = location.pathname;

  const linkClass = (path: string) => {
    const isActive = currentPath === path;
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
      isActive
        ? 'text-white shadow-md'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
    }`;
  };

  const activeStyle = (path: string) => {
    const isActive = currentPath === path;
    return isActive ? { backgroundColor: state.branding.primaryColor } : {};
  };

  return (
    <aside className="w-64 bg-[#0f172a] text-white flex flex-col h-full shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 shrink-0">
        <Zap className="h-6 w-6" style={{ color: state.branding.primaryColor }} />
        <span className="font-bold text-lg tracking-tight truncate" style={{ color: state.branding.primaryColor }}>
          {state.branding.companyName || 'EnergIA Pro'}
        </span>
      </div>

      {/* Sidebar Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-7">
        {/* Navegação */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-4 mb-2">Navegação</p>
          <button className={linkClass('/')} style={activeStyle('/')} onClick={() => navigate('/')}>
            <Calculator className="h-4.5 w-4.5" /> Nova Simulação
          </button>
          <button className={linkClass('/suppliers')} style={activeStyle('/suppliers')} onClick={() => navigate('/suppliers')}>
            <Zap className="h-4.5 w-4.5" /> Comercializadores
          </button>
          <button className={linkClass('/import-pdf')} style={activeStyle('/import-pdf')} onClick={() => navigate('/import-pdf')}>
            <FileText className="h-4.5 w-4.5" /> Importar PDFs
          </button>
        </div>

        {/* Administração */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-4 mb-2">Administração</p>
          <button className={linkClass('/users')} style={activeStyle('/users')} onClick={() => navigate('/users')}>
            <UsersIcon className="h-4.5 w-4.5" /> Utilizadores
          </button>
          <button className={linkClass('/campaigns')} style={activeStyle('/campaigns')} onClick={() => navigate('/campaigns')}>
            <Upload className="h-4.5 w-4.5" /> Upload Campanhas
          </button>
          <button className={linkClass('/profiles')} style={activeStyle('/profiles')} onClick={() => navigate('/profiles')}>
            <Percent className="h-4.5 w-4.5" /> Perfis &amp; Comissões
          </button>

          <div className="px-1.5 pt-2 space-y-2">
            <div className="[&_button]:!w-full [&_button]:!justify-start [&_button]:!h-9 [&_button]:!px-3 [&_button]:!border-[#1e293b] [&_button]:hover:!bg-slate-800/50 [&_button]:hover:!text-white [&_button]:!text-slate-400 [&_button]:!rounded-xl [&_button]:!transition-all">
              <MarketDataUpdateButton />
              <InclusionsUpdateButton />
            </div>
          </div>
        </div>

        {/* Configurações */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-4 mb-2">Configurações</p>
          <button className={linkClass('/admin')} style={activeStyle('/admin')} onClick={() => navigate('/admin')}>
            <Settings className="h-4.5 w-4.5" /> Configurações Brand
          </button>
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 shrink-0">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-400 truncate px-2" title={user?.email}>{user?.email}</p>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, resetSimulation, saveSimulation, loadSimulation, deleteSimulation, listSimulations } =
    useAppContext();
  const [sims, setSims] = useState(listSimulations());

  const refreshSims = () => setSims(listSimulations());

  const handleSave = () => {
    const name = window.prompt('Nome da simulação a guardar:', state.clientData.name || 'Simulação');
    if (name && name.trim()) {
      saveSimulation(name.trim());
      refreshSims();
    }
  };

  const handleClear = () => {
    if (window.confirm('Limpar os dados da simulação em curso? As simulações guardadas não são afetadas.')) {
      resetSimulation();
    }
  };

  // Dynamic breadcrumb / title based on active path
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>SIMULAÇÃO #{state.clientData.nif || '882'}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Cliente</span>
          </div>
        );
      case '/suppliers':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>CONFIGURAÇÕES</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Comercializadores</span>
          </div>
        );
      case '/import-pdf':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>DADOS</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Importar PDFs</span>
          </div>
        );
      case '/users':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>ADMIN</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Utilizadores</span>
          </div>
        );
      case '/campaigns':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>ADMIN</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Upload Campanhas</span>
          </div>
        );
      case '/profiles':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>ADMIN</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Perfis &amp; Comissões</span>
          </div>
        );
      case '/admin':
        return (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>ADMIN</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-800">Branding PDF</span>
          </div>
        );
      default:
        return <div className="text-sm font-semibold text-slate-800">Painel</div>;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center min-w-0">
        {getHeaderTitle()}
      </div>

      <div className="flex items-center gap-2">
        <button className={iconBtn} title="Atualizar aplicação" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
        </button>
        <button className={iconBtn} title="Limpar dados" onClick={handleClear}>
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Carregar */}
        <Dropdown
          trigger={() => (
            <button className={pillBtn} title="Carregar simulação">
              <FolderOpen className="h-4 w-4" /> <span className="hidden sm:inline">Carregar</span>
            </button>
          )}
        >
          {(close) =>
            sims.length === 0 ? (
              <p className="text-sm text-slate-400 px-2.5 py-3 text-center">Sem simulações guardadas.</p>
            ) : (
              <div className="space-y-0.5 max-h-80 overflow-auto">
                <p className={menuLabel}>Simulações guardadas</p>
                {sims.map((s) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <button
                      className={menuItem}
                      onClick={() => {
                        loadSimulation(s.name);
                        close();
                        navigate('/');
                      }}
                    >
                      <Save className="h-4 w-4 text-slate-400" />
                      <span className="flex-1 truncate">{s.name}</span>
                    </button>
                    <button
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100"
                      title="Eliminar"
                      onClick={() => {
                        deleteSimulation(s.name);
                        refreshSims();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          }
        </Dropdown>

        {/* Guardar */}
        <button className={pillBtn} title="Guardar simulação" onClick={handleSave}>
          <Save className="h-4 w-4" /> <span className="hidden sm:inline">Guardar</span>
        </button>
      </div>
    </header>
  );
}

function Layout() {
  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6 pb-20">
          <Routes>
            <Route path="/" element={<Simulator />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/import-pdf" element={<ImportPDFs />} />
            <Route path="/admin" element={<AdminConfig />} />
            <Route path="/users" element={<Users />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/profiles" element={<Profiles />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Zap className="h-8 w-8 text-blue-600 animate-pulse" />
          <p className="text-slate-500 font-medium">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  );
}
