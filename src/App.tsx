import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
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

function Header() {
  const navigate = useNavigate();
  const { state, resetSimulation, saveSimulation, loadSimulation, deleteSimulation, listSimulations } =
    useAppContext();
  const { signOut, user } = useAuth();
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

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-[#3b82f6]">
          <Zap className="h-7 w-7" style={{ color: state.branding.primaryColor }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">
            <span style={{ color: state.branding.primaryColor }}>
              {state.branding.companyName || 'EnergIA'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
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

        {/* Menu */}
        <Dropdown
          width="w-72"
          trigger={() => (
            <button className={pillBtn} title="Menu">
              <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Menu</span>
            </button>
          )}
        >
          {(close) => (
            <div className="space-y-0.5">
              <p className={menuLabel}>Navegação</p>
              <button className={menuItem} onClick={() => { navigate('/'); close(); }}>
                <Calculator className="h-4 w-4 text-slate-500" /> Nova Simulação
              </button>
              <button className={menuItem} onClick={() => { navigate('/suppliers'); close(); }}>
                <Zap className="h-4 w-4 text-slate-500" /> Comercializadores
              </button>
              <button className={menuItem} onClick={() => { navigate('/import-pdf'); close(); }}>
                <FileText className="h-4 w-4 text-slate-500" /> Importar PDFs
              </button>

              <div className="h-px bg-slate-100 my-1.5" />
              <p className={menuLabel}>Administração</p>
              <button className={menuItem} onClick={() => { navigate('/users'); close(); }}>
                <UsersIcon className="h-4 w-4 text-slate-500" /> Utilizadores
              </button>
              <button className={menuItem} onClick={() => { navigate('/campaigns'); close(); }}>
                <Upload className="h-4 w-4 text-slate-500" /> Upload Campanhas
              </button>
              <button className={menuItem} onClick={() => { navigate('/profiles'); close(); }}>
                <Percent className="h-4 w-4 text-slate-500" /> Perfis &amp; Comissões
              </button>
              <div className="[&_button]:!w-full [&_button]:!justify-start [&_button]:!h-auto [&_button]:!py-2 [&_button]:!px-2.5 [&_button]:!border-0 [&_button]:!rounded-lg [&_button]:hover:!bg-slate-100">
                <MarketDataUpdateButton />
                <InclusionsUpdateButton />
              </div>

              <div className="h-px bg-slate-100 my-1.5" />
              <p className={menuLabel}>Configurações</p>
              <button className={menuItem} onClick={() => { navigate('/admin'); close(); }}>
                <Palette className="h-4 w-4 text-slate-500" /> Branding PDF
              </button>
              <button className={menuItem} onClick={() => { close(); signOut(); }}>
                <LogOut className="h-4 w-4 text-slate-500" /> Sair
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}

function Layout() {
  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Header />
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
