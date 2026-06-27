import React, { useState, useEffect } from 'react';
import { Settings, Key, Eye, EyeOff, Save, CheckCircle2, Sliders, AlertTriangle, Loader2 } from 'lucide-react';
import { apiService } from '../utils/api';

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [grokModel, setGrokModel] = useState('grok-beta');
  
  // Mask configurations loaded from server
  const [openaiMasked, setOpenaiMasked] = useState('');
  const [geminiMasked, setGeminiMasked] = useState('');
  const [grokMasked, setGrokMasked] = useState('');
  
  // Show key states
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showGrok, setShowGrok] = useState(false);

  // Parameter states
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [topK, setTopK] = useState(5);
  const [temperature, setTemperature] = useState(0.2);
  const [maxDepth, setMaxDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(20);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await apiService.settings.get();
      const d = res.data;
      
      setOpenaiMasked(d.openai_api_key_masked || '');
      setGeminiMasked(d.gemini_api_key_masked || '');
      setGrokMasked(d.grok_api_key_masked || '');
      
      // Initialize inputs to masked values
      setOpenaiKey(d.openai_api_key_masked || '');
      setGeminiKey(d.gemini_api_key_masked || '');
      setGrokKey(d.grok_api_key_masked || '');
      setGrokModel(d.grok_model || 'grok-beta');
      
      setChunkSize(d.chunk_size);
      setChunkOverlap(d.chunk_overlap);
      setTopK(d.top_k);
      setTemperature(d.temperature);
      setMaxDepth(d.max_crawl_depth);
      setMaxPages(d.max_pages);
    } catch (e) {
      console.error(e);
      setMsg({ type: 'error', text: 'Failed to load system settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });

    try {
      await apiService.settings.update({
        openai_api_key: openaiKey,
        gemini_api_key: geminiKey,
        grok_api_key: grokKey,
        grok_model: grokModel,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        top_k: topK,
        temperature: temperature,
        max_crawl_depth: maxDepth,
        max_pages: maxPages
      });
      
      setMsg({ type: 'success', text: 'Settings updated successfully!' });
      // Reload to get fresh masked keys
      await loadSettings();
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update configurations.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={24} />
          <p className="text-xs text-slate-400">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        
        {/* Header Title */}
        <div className="flex items-center gap-2 mb-2">
          <Settings className="text-indigo-500" size={20} />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">API Keys & Model Parameters</h2>
        </div>

        {msg.text && (
          <div className={`flex items-center gap-3 border px-4 py-3 rounded-lg text-xs ${
            msg.type === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/25 bg-red-500/10 text-red-400'
          }`}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* API Key Management card */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Key size={14} className="text-indigo-400" />
              API Key Management
            </h3>

            {/* OpenAI API Key */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 pl-0.5">
                OpenAI API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showOpenai ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full glass-input py-2 pl-3 pr-10 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-3 text-slate-500 hover:text-indigo-400"
                >
                  {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[9px] text-slate-500 mt-1 pl-0.5">
                Used to trigger OpenAI GPT models for generating RAG answers.
              </p>
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 pl-0.5">
                Gemini API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showGemini ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full glass-input py-2 pl-3 pr-10 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowGemini(!showGemini)}
                  className="absolute right-3 text-slate-500 hover:text-indigo-400"
                >
                  {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[9px] text-slate-500 mt-1 pl-0.5">
                Used to trigger Gemini model instances for generating RAG responses.
              </p>
            </div>

            {/* Grok API Key */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 pl-0.5">
                Grok (xAI) API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showGrok ? "text" : "password"}
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="xai-..."
                  className="w-full glass-input py-2 pl-3 pr-10 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowGrok(!showGrok)}
                  className="absolute right-3 text-slate-500 hover:text-indigo-400"
                >
                  {showGrok ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[9px] text-slate-500 mt-1 pl-0.5">
                Used to trigger Grok models via the xAI API endpoint.
              </p>
            </div>

            {/* Grok Model Selection */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 pl-0.5">
                Grok Model Name
              </label>
              <input
                type="text"
                value={grokModel}
                onChange={(e) => setGrokModel(e.target.value)}
                placeholder="grok-beta"
                className="w-full glass-input py-2 px-3 text-xs focus:outline-none"
              />
              <p className="text-[9px] text-slate-500 mt-1 pl-0.5">
                Model identifier to query (e.g. <code className="text-indigo-400">grok-beta</code>, <code className="text-indigo-400">grok-2</code>, or <code className="text-indigo-400">grok-2-1212</code>).
              </p>
            </div>
            
            <div className="text-[9px] border-t border-slate-200/30 dark:border-white/5 pt-3 text-slate-400">
              <span className="font-semibold text-indigo-400">Tip:</span> System automatically runs offline embedding indexing locally. API Keys are only required when the LLM is queried inside the Chat tab.
            </div>
          </div>

          {/* RAG pipeline parameters card */}
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Sliders size={14} className="text-purple-400" />
              Model Parameters & Chunking
            </h3>

            {/* Chunk Size */}
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
                <span>Chunk Size</span>
                <span className="font-mono text-indigo-400">{chunkSize} characters</span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Chunk Overlap */}
            <div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
                <span>Chunk Overlap</span>
                <span className="font-mono text-indigo-400">{chunkOverlap} characters</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Grid for parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Temperature */}
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
                  <span>Temperature</span>
                  <span className="font-mono text-indigo-400">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Top K */}
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
                  <span>Top K Matches</span>
                  <span className="font-mono text-indigo-400">{topK} chunks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

            </div>

            {/* Grid for crawl defaults */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200/30 dark:border-white/5 pt-4">
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Default Crawl Depth
                </label>
                <select
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full glass-input px-3 py-1.5 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                >
                  <option value={1}>1 level (Root URLs only)</option>
                  <option value={2}>2 levels</option>
                  <option value={3}>3 levels</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Default Max Crawl Pages
                </label>
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full glass-input px-3 py-1.5 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                >
                  <option value={10}>10 pages</option>
                  <option value={20}>20 pages</option>
                  <option value={50}>50 pages</option>
                  <option value={100}>100 pages</option>
                </select>
              </div>

            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full glass-btn py-3 mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>
                Save Configurations
                <Save size={12} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
