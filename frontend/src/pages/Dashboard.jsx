import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, LineChart, Line 
} from 'recharts';
import { 
  Globe, FileText, Layers, MessageSquare, Clock, ShieldCheck, 
  TrendingUp, Award, HelpCircle, Loader2, AlertCircle 
} from 'lucide-react';
import { apiService } from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.dashboard.getStats();
      setStats(res.data);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch analytics statistics. Ensure you are logged in.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={24} />
          <p className="text-xs text-slate-400">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-6 border-red-500/20 text-center">
          <AlertCircle className="text-red-500 mx-auto mb-3" size={32} />
          <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
          <button 
            onClick={loadStats}
            className="glass-btn-secondary px-4 py-2 mt-4 text-xs font-semibold"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Pre-process chart data for safety
  const queriesData = stats?.queries_per_day || [];
  const responseData = stats?.recent_response_times?.map((r, idx) => ({
    name: `Q${idx+1}`,
    time: r.response_time,
    query: r.query.length > 20 ? `${r.query.slice(0, 20)}...` : r.query
  })) || [];

  const cards = [
    { label: 'Total Chatbots', value: stats?.total_websites || 0, icon: Globe, color: 'text-indigo-400' },
    { label: 'Pages Indexed', value: stats?.total_pages || 0, icon: FileText, color: 'text-emerald-400' },
    { label: 'Total Chunks', value: stats?.total_chunks || 0, icon: Layers, color: 'text-purple-400' },
    { label: 'Queries Handled', value: stats?.total_questions || 0, icon: MessageSquare, color: 'text-amber-400' },
    { label: 'Avg Latency', value: `${stats?.avg_response_time || 0}s`, icon: Clock, color: 'text-rose-400' },
    { label: 'Vector Size', value: `${stats?.vector_size_kb || 0} KB`, icon: ShieldCheck, color: 'text-sky-400' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Admin Metrics Dashboard</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time insights on scraper output, RAG latency, and query distributions.
          </p>
        </div>

        {/* STATS CARDS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map((c, idx) => {
            const Icon = c.icon;
            return (
              <div key={idx} className="glass-card p-4 border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate max-w-[80%]">{c.label}</span>
                  <Icon size={14} className={c.color} />
                </div>
                <div className="text-xl font-extrabold font-mono text-slate-800 dark:text-slate-100">{c.value}</div>
              </div>
            );
          })}
        </div>

        {/* CHARTS CONTAINER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Query Volume Area Chart */}
          <div className="glass-card p-5 border border-white/5 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-indigo-400" />
              Queries per Day (Last 7 Days)
            </h3>
            <div className="h-64 w-full">
              {queriesData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">No query stats log found.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={queriesData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ background: '#121226', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorQueries)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* RAG Response Latency Line Chart */}
          <div className="glass-card p-5 border border-white/5 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
              <Clock size={12} className="text-rose-400" />
              Response Time Trend (Sec)
            </h3>
            <div className="h-64 w-full">
              {responseData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">No recent query timings found.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip 
                      contentStyle={{ background: '#121226', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                      labelFormatter={(label, items) => items[0]?.payload?.query || label}
                    />
                    <Line type="monotone" dataKey="time" name="Seconds" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* MOST ASKED QUESTIONS ROW */}
        <div className="glass-card p-5 border border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <Award size={12} className="text-amber-400" />
            Most Asked Questions Top List
          </h3>

          {!stats?.most_asked || stats.most_asked.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-6">No queries have been indexed yet. Start chatting to populate.</div>
          ) : (
            <div className="space-y-3">
              {stats.most_asked.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/5 border border-slate-200/20 dark:border-white/5 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-400 text-xs font-bold">{idx+1}</span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate max-w-[280px] md:max-w-xl">{item.query}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase">Frequency:</span>
                    <strong className="text-indigo-400 font-mono text-xs">{item.count}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
