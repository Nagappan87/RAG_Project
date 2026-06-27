import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, Settings, MessageSquare, PlusCircle, User } from 'lucide-react';
import { apiService } from './utils/api';

// Pages
import AuthPage from './pages/AuthPage';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/Settings';

// Contexts
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load and apply dark theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Check auth state on launch
  useEffect(() => {
    const checkAuth = async () => {
      if (apiService.auth.isAuthenticated()) {
        try {
          const res = await apiService.auth.getMe();
          setUser(res.data);
        } catch (e) {
          console.error("Auth verification failed:", e);
          apiService.auth.logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    apiService.auth.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A12] text-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme: () => setDarkMode(!darkMode) }}>
      <AuthContext.Provider value={{ user, login, logout }}>
        <Router>
          <Routes>
            <Route 
              path="/auth" 
              element={user ? <Navigate to="/" replace /> : <AuthPage />} 
            />
            <Route 
              path="/*" 
              element={user ? <MainLayout /> : <Navigate to="/auth" replace />} 
            />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

// Global Application Layout Wrapper
function MainLayout() {
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navItems = [
    { label: 'Create Chatbot', path: '/', icon: PlusCircle },
    { label: 'Analytics', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-800 dark:bg-[#0A0A12] dark:text-slate-100">
      {/* Dynamic background blur mesh elements */}
      {darkMode && (
        <>
          <div className="glow-mesh left-10 top-20 bg-indigo-600/30"></div>
          <div className="glow-mesh right-10 bottom-20 bg-purple-600/30 animate-pulse"></div>
        </>
      )}

      {/* Global Glassmorphic Header */}
      <header className="z-10 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/40 px-6 backdrop-blur-md dark:border-white/10 dark:bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white shadow-lg">
            RAG
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
              RAG Website Chatbot
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Production AI Platform</p>
          </div>
        </div>

        {/* Global Navigation Actions */}
        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10 mx-2"></div>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-white/5 transition-colors"
            title="Toggle Theme"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* User Sign out */}
          <div className="flex items-center gap-2 pl-2">
            <span className="hidden lg:inline text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User size={12} />
              {user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Log Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </nav>
      </header>

      {/* Main Page Content Body */}
      <main className="relative flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat/:projectId" element={<Chat />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
