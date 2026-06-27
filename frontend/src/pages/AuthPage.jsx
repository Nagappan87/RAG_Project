import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, Lock, Mail, ChevronRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { apiService } from '../utils/api';
import { useAuth } from '../App';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Log in flow
        const data = await apiService.auth.login(username, password);
        login({ username: data.username, id: data.id });
        navigate('/');
      } else {
        // Register flow
        await apiService.auth.register(username, password);
        setRegSuccess(true);
        setIsLogin(true);
        setUsername('');
        setPassword('');
        setError('Registration successful! Please log in.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center bg-[#080711] p-4 overflow-hidden">
      {/* Background glowing mesh circles */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[100px]"></div>

      <div className="w-full max-w-md glass-card p-8 border border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg">
            <KeyRound size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 font-sans tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            {isLogin 
              ? 'Enter credentials to access your RAG chatbots' 
              : 'Sign up to build, index, and query custom chatbots'}
          </p>
        </div>

        {error && (
          <div className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-xs ${
            regSuccess 
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5 pl-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="developer"
                className="w-full glass-input py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5 pl-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full glass-input py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full glass-btn py-3 mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : isLogin ? (
              <>
                Sign In
                <LogIn size={14} />
              </>
            ) : (
              <>
                Register
                <UserPlus size={14} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setRegSuccess(false);
            }}
            className="text-xs text-slate-400 hover:text-indigo-400 hover:underline transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Create one" 
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
