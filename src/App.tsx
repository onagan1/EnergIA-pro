import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { Settings, Users, Calculator, FileText, Zap, LogOut } from 'lucide-react';
import { Simulator } from './pages/Simulator';
import { Suppliers } from './pages/Suppliers';
import { AdminConfig } from './pages/AdminConfig';
import { ImportPDFs } from './pages/ImportPDFs';
import { Login } from './pages/Login';

function Sidebar() {
  const location = useLocation();
  const { state } = useAppContext();
  
  const navItems = [
    { name: 'Nova Simulação', path: '/', icon: Calculator },
    { name: 'Comercializadores', path: '/suppliers', icon: Zap },
    { name: 'Importar PDFs', path: '/import-pdf', icon: FileText },
    { name: 'Configurações Brand', path: '/admin', icon: Settings },
  ];

  return (
    <div className="w-[220px] bg-[#1e293b] text-white p-5 border-r border-slate-200 flex-col min-h-screen hidden md:flex shrink-0">
      <div className="text-2xl font-extrabold text-[#3b82f6] mb-10 flex items-center gap-2.5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span style={{ color: state.branding.primaryColor }}>
          {state.branding.companyName || 'EnergIA'}
        </span>
      </div>
      
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`p-3 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                active ? 'bg-[#3b82f6] text-white' : 'hover:bg-white/5'
              }`}
              style={active ? { backgroundColor: state.branding.primaryColor } : {}}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto text-xs opacity-60">
        © 2024 Energeia WhiteLabel
      </div>
    </div>
  );
}

function Layout() {
  const { state } = useAppContext();
  const { signOut, user } = useAuth();
  
  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            <div>
              <span className="font-bold text-slate-500 tracking-wide uppercase text-sm">SIMULAÇÃO #882</span>
              <span className="mx-3 text-slate-300">|</span>
              <span className="text-sm font-medium">{state.clientData.name || 'Cliente'}</span>
            </div>
            <div className="flex items-center gap-3 hidden md:flex">
                <span className="text-sm text-slate-500 mr-2">{user?.email}</span>
                <Link to="/" className="bg-white border border-slate-300 px-4 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors">
                  Editar Perfil
                </Link>
                <button className="bg-[#3b82f6] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-600 transition-colors">
                  Exportar Proposta PDF
                </button>
                <button 
                  onClick={signOut}
                  className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Terminar Sessão"
                >
                  <LogOut className="h-5 w-5" />
                </button>
            </div>
            {/* Mobile Header elements */}
            <div className="md:hidden flex items-center gap-2">
               <Zap className="h-6 w-6 text-[#3b82f6]" />
               <span className="font-semibold text-slate-800">EnergIA</span>
             </div>
         </header>
         {/* Main Content */}
         <main className="flex-1 overflow-auto p-6 md:p-6 pb-20">
           <Routes>
             <Route path="/" element={<Simulator />} />
             <Route path="/suppliers" element={<Suppliers />} />
             <Route path="/import-pdf" element={<ImportPDFs />} />
             <Route path="/admin" element={<AdminConfig />} />
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
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
