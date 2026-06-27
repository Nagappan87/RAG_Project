import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Bot, User, HelpCircle, Layers, FileText, Trash2, Plus, 
  MessageSquare, Mic, MicOff, Volume2, VolumeX, Download, 
  ChevronRight, ArrowLeft, Globe, Filter, Star, BookOpen, AlertCircle
} from 'lucide-react';
import { apiService } from '../utils/api';

export default function Chat() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // Project state
  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // Chat feed state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState(''); // FAQ, blog, documentation, tables, ''

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  
  // UI toggles
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPagesList, setShowPagesList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load project meta, sessions, and indexed page URLs
  const loadProjectData = async () => {
    try {
      const projRes = await apiService.projects.get(projectId);
      setProject(projRes.data);

      const pagesRes = await apiService.projects.getPages(projectId);
      setPages(pagesRes.data);

      const sessRes = await apiService.sessions.list(projectId);
      setSessions(sessRes.data);

      if (sessRes.data.length > 0) {
        // Load latest session by default
        selectSession(sessRes.data[0].id);
      } else {
        // Create a default first session if empty
        handleCreateSession();
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to load chatbot data. Make sure it exists.");
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  // Handle Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      rec.onerror = (e) => {
        console.error("Speech Recognition Error:", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const res = await apiService.sessions.getMessages(sessionId);
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async () => {
    try {
      const res = await apiService.sessions.create(projectId);
      const newSessionId = res.data.session_id;
      setSessions(prev => [res.data, ...prev]);
      setActiveSessionId(newSessionId);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || !activeSessionId || loading) return;

    if (!textToSend) setInput('');
    setLoading(true);
    
    // Optimistic update of local user message
    setMessages(prev => [...prev, { role: 'user', content: query }]);

    try {
      const res = await apiService.sessions.ask(activeSessionId, query, searchFilter || null);
      
      // Add assistant response to feed
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.data.answer,
        sources: res.data.sources,
        confidence: res.data.confidence,
        response_time: res.data.response_time
      }]);

      // Read Aloud if Voice Output is enabled
      if (ttsEnabled) {
        speakText(res.data.answer);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err.response?.data?.detail || "Could not retrieve answer. Check settings/API keys."}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Text-To-Speech reader
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel active speak
      // Strip markdown syntax/symbols for voice reading
      const cleanText = text.replace(/[\*\#\`\_]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Mic Listen switch
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome/Edge.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm("Are you sure you want to delete this entire chatbot index? This cannot be undone.")) return;
    try {
      await apiService.projects.delete(projectId);
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  const suggestedQuestions = [
    "What is this website about?",
    "Summarize all services.",
    "Who is the founder?",
    "What products are available?",
    "What pricing plans exist?"
  ];

  const searchFilters = [
    { value: '', label: 'All Content', icon: Layers },
    { value: 'faq', label: 'Only FAQs', icon: HelpCircle },
    { value: 'blog', label: 'Only Blogs', icon: FileText },
    { value: 'documentation', label: 'Only Docs', icon: BookOpen },
    { value: 'tables', label: 'Only Tables', icon: Filter },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">
      
      {/* SIDEBAR */}
      {sidebarOpen && project && (
        <aside className="z-10 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white/50 backdrop-blur-md dark:border-white/10 dark:bg-black/20 h-full">
          
          {/* Active Chatbot Profile Info */}
          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 mb-3 transition-colors"
            >
              <ArrowLeft size={10} /> Back to dashboard
            </button>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{project.name}</h3>
            <p className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
              <Globe size={10} /> {project.url || 'Combined File Index'}
            </p>
            
            <div className="grid grid-cols-2 gap-2 mt-4 text-center text-[10px]">
              <button 
                onClick={() => setShowPagesList(!showPagesList)}
                className="bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-lg py-1.5 hover:bg-indigo-600/10 transition-colors"
              >
                <div className="font-bold font-mono text-indigo-400">{project.indexed_pages_count}</div>
                <div className="text-slate-500 uppercase tracking-wider text-[8px]">Pages Indexed</div>
              </button>
              <div className="bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-lg py-1.5">
                <div className="font-bold font-mono text-indigo-400">{project.chunks_count}</div>
                <div className="text-slate-500 uppercase tracking-wider text-[8px]">Total Chunks</div>
              </div>
            </div>
          </div>

          {/* PAGES INDEX SUB-LIST VIEW */}
          {showPagesList && (
            <div className="flex-1 overflow-y-auto bg-slate-100/50 dark:bg-black/10 p-3 border-b border-slate-200 dark:border-white/10 max-h-48">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Indexed Source Files</div>
              {pages.length === 0 ? (
                <div className="text-[10px] text-slate-400 pl-1">No pages crawled yet.</div>
              ) : (
                <div className="space-y-1">
                  {pages.map((p, idx) => (
                    <div key={idx} className="text-[9px] truncate bg-white/30 dark:bg-white/5 p-1 rounded hover:text-indigo-400">
                      <span className="font-semibold text-indigo-400 mr-1">{idx+1}.</span>
                      <a href={(p.url && p.url.startsWith('upload://')) ? '#' : (p.url || '#')} target="_blank" rel="noopener noreferrer">
                        {p.title || p.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CHAT SESSION HISTORY */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex justify-between items-center pl-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conversations</span>
              <button 
                onClick={handleCreateSession}
                className="p-1 hover:bg-slate-200 dark:hover:bg-white/5 text-indigo-400 rounded-md transition-colors"
                title="New Chat Session"
              >
                <Plus size={14} />
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">No chat sessions found.</div>
            ) : (
              <div className="space-y-1">
                {sessions.map((sess) => (
                  <button
                    key={sess.id}
                    onClick={() => selectSession(sess.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-xs transition-colors truncate ${
                      activeSessionId === sess.id
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare size={12} className="shrink-0" />
                    <span className="truncate">{sess.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DELETE ACTION */}
          <div className="p-4 border-t border-slate-200 dark:border-white/10">
            <button
              onClick={handleDeleteProject}
              className="w-full border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={13} />
              Delete Chatbot Index
            </button>
          </div>
        </aside>
      )}

      {/* CHAT CORE WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/20 dark:bg-black/10 relative h-full">
        
        {/* Toggle Sidebar Header Area */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-white/10 bg-white/30 dark:bg-black/10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <ChevronRight size={14} className={`transform transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            {sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          </button>

          {/* Export Transcript actions */}
          {activeSessionId && messages.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-medium">Export:</span>
              {['json', 'csv', 'markdown', 'pdf'].map((fmt) => (
                <a
                  key={fmt}
                  href={apiService.exports.getExportLink(activeSessionId, fmt)}
                  download
                  className="px-2 py-1 rounded text-[10px] uppercase font-bold border border-slate-200 dark:border-white/5 hover:bg-indigo-600 hover:text-white transition-colors bg-white/10"
                >
                  {fmt}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* MESSAGES PORT */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          
          {errorMsg && (
            <div className="max-w-2xl mx-auto flex items-center gap-3 border border-red-500/30 bg-red-500/10 text-red-400 px-4 py-3 rounded-lg text-xs">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {messages.length === 0 ? (
            /* Suggested questions grid if conversation is empty */
            <div className="max-w-2xl mx-auto text-center mt-8">
              <Bot className="h-12 w-12 text-indigo-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-100">Ask website AI Chatbot</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-8">
                Welcome to your workspace. Start asking questions directly, or click one of the suggested prompts below:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="glass-card text-left p-3.5 hover:bg-indigo-600/15 border-slate-200/50 dark:border-white/5 hover:border-indigo-500/20 text-xs text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center justify-between"
                  >
                    <span>{q}</span>
                    <Plus size={12} className="text-indigo-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active message bubbles feed */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div key={idx} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    
                    {/* Bot avatar (left) */}
                    {!isUser && (
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow">
                        <Bot size={16} />
                      </div>
                    )}

                    {/* Content Text Bubble */}
                    <div className="max-w-[85%] flex flex-col gap-1">
                      <div 
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none'
                            : 'bg-white/40 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 backdrop-blur-sm rounded-tl-none text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {/* Render simple text, support markdown spacing */}
                        <div className="whitespace-pre-line">{m.content}</div>
                      </div>

                      {/* Source Citations for Assistant bubble */}
                      {!isUser && m.sources && m.sources.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider pl-1">Sources Cited:</div>
                          <div className="flex flex-wrap gap-2">
                            {m.sources.map((s, sIdx) => (
                              <a
                                key={sIdx}
                                href={(s.url && s.url.startsWith('upload://')) ? '#' : (s.url || '#')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white/50 dark:bg-white/5 hover:bg-indigo-600/10 border border-slate-200 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-indigo-400 font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <Globe size={10} />
                                <span className="truncate max-w-[120px]">{s.title || 'Page'}</span>
                                <span className="bg-indigo-600/10 text-indigo-400 text-[8px] px-1 rounded">{(s.score * 100).toFixed(0)}% Match</span>
                              </a>
                            ))}
                          </div>
                          {m.confidence !== undefined && (
                            <div className="flex gap-4 pl-1 text-[8px] uppercase tracking-wider text-slate-500">
                              <span>Confidence Score: <strong className="text-emerald-400 font-mono">{m.confidence}</strong></span>
                              <span>Response Time: <strong className="text-indigo-400 font-mono">{m.response_time}s</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User avatar (right) */}
                    {isUser && (
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-200 border border-slate-300 dark:border-white/5 shadow">
                        <User size={16} />
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Bot Loading skeleton animation */}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white/40 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 backdrop-blur-sm rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1 py-1.5 px-1">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

        </div>

        {/* INPUT INTERACTION CONTROL PANEL */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-white/30 dark:bg-black/10">
          <div className="max-w-3xl mx-auto space-y-3">
            
            {/* Search Filter Controls & Voice controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              
              {/* Category filters */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">RAG Filter:</span>
                {searchFilters.map((f) => {
                  const Icon = f.icon;
                  const isSelected = searchFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setSearchFilter(f.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                          : 'bg-white/5 border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon size={10} />
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Speech Controls */}
              <div className="flex items-center gap-2 bg-white/5 border border-slate-200/50 dark:border-white/5 p-1 rounded-lg">
                <button
                  onClick={toggleListening}
                  className={`p-1.5 rounded-md transition-colors ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                  title={isListening ? "Stop listening" : "Start Voice Input (Speech to Text)"}
                >
                  {isListening ? <MicOff size={12} /> : <Mic size={12} />}
                </button>

                <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/10"></div>

                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`p-1.5 rounded-md transition-colors ${
                    ttsEnabled 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                  title={ttsEnabled ? "Disable Read Aloud" : "Enable Read Aloud (Text to Speech)"}
                >
                  {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                </button>
              </div>

            </div>

            {/* Main Text Input box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || !activeSessionId}
                placeholder={
                  activeSessionId 
                    ? isListening 
                      ? "Listening to voice input..." 
                      : "Ask questions from website knowledge index..." 
                    : "Create a session in the history sidebar to begin..."
                }
                className="w-full glass-input py-3.5 pl-4 pr-12 text-xs focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !activeSessionId}
                className="absolute right-2 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors shadow-md"
              >
                <Send size={14} />
              </button>
            </form>

          </div>
        </div>

      </div>

    </div>
  );
}
