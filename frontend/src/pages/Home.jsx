import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, HardDrive, ArrowRight, Layers, FileUp, Loader2, Play, Trash2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiService } from '../utils/api';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(20);
  
  // File upload state
  const [uploadProject, setUploadProject] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });

  // Append URL state
  const [appendProject, setAppendProject] = useState('');
  const [appendUrlVal, setAppendUrlVal] = useState('');
  const [appendDepth, setAppendDepth] = useState(1);
  const [appendMaxPages, setAppendMaxPages] = useState(20);


  // Crawling progress tracking state
  const [crawlingProjectId, setCrawlingProjectId] = useState(null);
  const [crawlStatus, setCrawlStatus] = useState(null);
  const [crawlError, setCrawlError] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);

  const navigate = useNavigate();

  // Load existing projects
  const loadProjects = async () => {
    try {
      const res = await apiService.projects.list();
      setProjects(res.data);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Poll crawling status if active
  useEffect(() => {
    let intervalId;
    if (isCrawling && crawlingProjectId) {
      intervalId = setInterval(async () => {
        try {
          const res = await apiService.projects.getStatus(crawlingProjectId);
          setCrawlStatus(res.data);
          
          if (res.data.status === 'completed') {
            setIsCrawling(false);
            loadProjects();
          } else if (res.data.status === 'failed') {
            setIsCrawling(false);
            setCrawlError(res.data.error_message || "Indexing crawled pages failed.");
            loadProjects();
          }
        } catch (e) {
          console.error("Error fetching crawl status:", e);
        }
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [isCrawling, crawlingProjectId]);

  // Crawling trigger
  const handleStartCrawl = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    
    setCrawlError('');
    setCrawlStatus(null);
    setIsCrawling(true);

    try {
      const res = await apiService.projects.create(name, url, depth, maxPages);
      const newProjectId = res.data.project_id;
      setCrawlingProjectId(newProjectId);
      
      // Initialize starting UI state
      setCrawlStatus({
        status: 'pending',
        pages_crawled: 0,
        chunks_created: 0,
        current_url: url,
        estimated_remaining_seconds: 15
      });
    } catch (err) {
      console.error(err);
      setIsCrawling(false);
      setCrawlError(err.response?.data?.detail || "Failed to initialize crawling session.");
    }
  };

  // Upload handler (supports multiple files)
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadProject || files.length === 0) return;
    
    setUploadLoading(true);
    setUploadMsg({ type: '', text: '' });

    let successCount = 0;
    let totalChunks = 0;
    let errors = [];

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      setUploadMsg({ 
        type: 'info', 
        text: `Processing file ${i + 1} of ${files.length}: ${currentFile.name}...` 
      });
      try {
        const res = await apiService.projects.uploadFile(uploadProject, currentFile);
        if (res.data.success) {
          successCount++;
          totalChunks += res.data.chunks_created;
        } else {
          errors.push(`${currentFile.name}: ${res.data.error || "Parsing failed."}`);
        }
      } catch (err) {
        errors.push(`${currentFile.name}: ${err.response?.data?.detail || "Upload failed."}`);
      }
    }

    if (successCount === files.length) {
      setUploadMsg({ 
        type: 'success', 
        text: `Successfully uploaded and split all ${files.length} document(s) into ${totalChunks} chunks!` 
      });
      setFiles([]);
      document.getElementById('file-input').value = '';
      loadProjects();
    } else {
      setUploadMsg({ 
        type: 'error', 
        text: `Indexed ${successCount}/${files.length} documents. Errors: ${errors.join('; ')}` 
      });
      loadProjects();
    }
    setUploadLoading(false);
  };

  // Append URL handler
  const handleAppendUrl = async (e) => {
    e.preventDefault();
    if (!appendProject || !appendUrlVal) return;
    
    setCrawlError('');
    setCrawlStatus(null);
    setCrawlingProjectId(Number(appendProject));
    setIsCrawling(true);

    try {
      const res = await apiService.projects.appendUrl(appendProject, appendUrlVal, appendDepth, appendMaxPages);
      setAppendUrlVal('');
      
      setCrawlStatus({
        status: 'pending',
        pages_crawled: 0,
        chunks_created: 0,
        current_url: appendUrlVal,
        estimated_remaining_seconds: 15
      });
    } catch (err) {
      console.error(err);
      setIsCrawling(false);
      setCrawlError(err.response?.data?.detail || "Failed to initialize indexing crawl.");
    }
  };


  const handleDeleteProject = async (id) => {
    if (!confirm("Are you sure you want to delete this chatbot and all of its indexes? This cannot be undone.")) return;
    try {
      await apiService.projects.delete(id);
      loadProjects();
      if (crawlingProjectId === id) {
        setIsCrawling(false);
        setCrawlingProjectId(null);
        setCrawlStatus(null);
      }
    } catch (e) {
      console.error("Failed to delete chatbot:", e);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-5xl">
        
        {/* Title Landing Headers */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
            RAG Powered Website Chatbot
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500 dark:text-slate-400 sm:text-lg md:mt-4">
            Ask questions from any website using AI. Scrape, chunk, and index URLs or documents locally.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* LEFT/MID: Configuration Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Indexing Generator */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-indigo-500" size={18} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Configure Web Scraper</h3>
              </div>

              <form onSubmit={handleStartCrawl} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Chatbot Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="My Documentation Chatbot"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isCrawling}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isCrawling}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Crawl Depth: <span className="font-mono text-indigo-400">{depth}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={depth}
                      onChange={(e) => setDepth(Number(e.target.value))}
                      disabled={isCrawling}
                      className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 mt-1 px-1">
                      <span>1 (Root only)</span>
                      <span>2</span>
                      <span>3 (Deep crawl)</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Maximum Crawl Pages
                    </label>
                    <select
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      disabled={isCrawling}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                    >
                      <option value={10}>10 Pages</option>
                      <option value={20}>20 Pages</option>
                      <option value={50}>50 Pages</option>
                      <option value={100}>100 Pages</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCrawling || !name || !url}
                  className="w-full glass-btn py-2.5 mt-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
                >
                  {isCrawling ? (
                    <>
                      Crawling Core Online
                      <Loader2 className="animate-spin" size={14} />
                    </>
                  ) : (
                    <>
                      Start Crawling
                      <Play size={12} />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* LIVE CRAWLING STATUS CONSOLE */}
            {(isCrawling || crawlStatus || crawlError) && (
              <div className="glass-card p-6 border-indigo-500/20 bg-indigo-950/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-2">
                  {isCrawling && <Loader2 className="animate-spin" size={12} />}
                  Scraping Engine Output
                </h4>

                {crawlError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 border border-red-500/20 bg-red-500/5 p-3 rounded-lg">
                    <AlertTriangle size={14} />
                    <span>Error: {crawlError}</span>
                  </div>
                )}

                {crawlStatus && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-xl font-bold font-mono text-slate-700 dark:text-white">{crawlStatus.pages_crawled}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">Pages Crawled</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="text-xl font-bold font-mono text-slate-700 dark:text-white">{crawlStatus.chunks_created}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">Chunks Created</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-lg border border-white/5 col-span-2 md:col-span-2">
                        <div className="text-xl font-bold font-mono text-indigo-400">
                          {crawlStatus.status === 'completed' 
                            ? 'Finished' 
                            : crawlStatus.status === 'failed' 
                              ? 'Failed'
                              : `${crawlStatus.estimated_remaining_seconds}s`}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">Est. Time Remaining</div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span className="truncate max-w-[80%]">Current: <span className="font-mono text-indigo-400">{crawlStatus.current_url || 'Waiting...'}</span></span>
                        <span>{crawlStatus.status === 'completed' ? '100%' : 'Indexing...'}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            crawlStatus.status === 'completed'
                              ? 'bg-emerald-500 w-full'
                              : crawlStatus.status === 'failed'
                                ? 'bg-red-500 w-full'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse'
                          }`}
                          style={{ 
                            width: crawlStatus.status === 'completed' 
                              ? '100%' 
                              : crawlStatus.status === 'failed'
                                ? '100%'
                                : `${Math.min(95, (crawlStatus.pages_crawled / maxPages) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>

                    {crawlStatus.status === 'completed' && (
                      <button
                        onClick={() => navigate(`/chat/${crawlingProjectId}`)}
                        className="w-full glass-btn bg-emerald-600 hover:bg-emerald-500 border-none py-2 text-xs flex items-center justify-center gap-2"
                      >
                        Launch AI Chatbot
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Combined Knowledge Base File Dropzone */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileUp className="text-purple-500" size={18} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Append Files (Combined Knowledge)</h3>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Target Chatbot Base
                    </label>
                    <select
                      required
                      value={uploadProject}
                      onChange={(e) => setUploadProject(e.target.value)}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                    >
                      <option value="">Select a chatbot...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Choose Document(s) (PDF, DOCX, TXT, MD)
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      required
                      multiple
                      accept=".pdf,.docx,.doc,.txt,.md"
                      onChange={(e) => setFiles(Array.from(e.target.files))}
                      className="w-full glass-input px-3 py-1.5 text-xs text-slate-400 focus:outline-none border-dashed"
                    />
                  </div>
                </div>

                {uploadMsg.text && (
                  <div className={`text-xs px-3 py-2 rounded-md ${
                    uploadMsg.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : uploadMsg.type === 'info'
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {uploadMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadLoading || !uploadProject || files.length === 0}
                  className="w-full glass-btn-secondary py-2 flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  {uploadLoading ? (
                    <>
                      Extracting & Chunking Document(s)
                      <Loader2 className="animate-spin" size={14} />
                    </>
                  ) : (
                    <>
                      Upload and Index Document(s)
                      <FileUp size={12} />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Append URL or YouTube video to existing project */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-indigo-500" size={18} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Append URL / YouTube Video</h3>
              </div>

              <form onSubmit={handleAppendUrl} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Target Chatbot Base
                    </label>
                    <select
                      required
                      value={appendProject}
                      onChange={(e) => setAppendProject(e.target.value)}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                    >
                      <option value="">Select a chatbot...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Website or YouTube URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://example.com or https://youtube.com/watch?v=..."
                      value={appendUrlVal}
                      onChange={(e) => setAppendUrlVal(e.target.value)}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Crawl Depth: <span className="font-mono text-indigo-400">{appendDepth}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={appendDepth}
                      onChange={(e) => setAppendDepth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Maximum Crawl Pages
                    </label>
                    <select
                      value={appendMaxPages}
                      onChange={(e) => setAppendMaxPages(Number(e.target.value))}
                      className="w-full glass-input px-3 py-2 text-xs focus:outline-none bg-slate-100 dark:bg-[#0c0a1a]"
                    >
                      <option value={10}>10 Pages</option>
                      <option value={20}>20 Pages</option>
                      <option value={50}>50 Pages</option>
                      <option value={100}>100 Pages</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCrawling || !appendProject || !appendUrlVal}
                  className="w-full glass-btn py-2.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
                >
                  {isCrawling && crawlingProjectId === Number(appendProject) ? (
                    <>
                      Crawling & Indexing Source...
                      <Loader2 className="animate-spin" size={14} />
                    </>
                  ) : (
                    <>
                      Append Source URL
                      <Play size={12} />
                    </>
                  )}
                </button>
              </form>
            </div>


          </div>

          {/* RIGHT: Chatbots List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1 pl-1">
              <HardDrive className="text-indigo-400" size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Chatbots</h3>
            </div>

            {projects.length === 0 ? (
              <div className="glass-card p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                No active chatbots index found. Create one by setting a name and URL above!
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className="glass-card glass-card-hover p-4 border border-white/5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold truncate max-w-[80%] text-slate-700 dark:text-slate-100">{project.name}</h4>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-md transition-colors"
                          title="Delete Chatbot Index"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-1 bg-slate-100 dark:bg-black/20 px-2 py-0.5 rounded font-mono select-all">
                        {project.url || 'Document Index Only'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 border-t border-slate-200/30 dark:border-white/5 pt-2">
                      <div className="flex gap-3">
                        <span>Pages: <strong className="text-slate-700 dark:text-slate-300">{project.indexed_pages_count}</strong></span>
                        <span>Chunks: <strong className="text-indigo-400">{project.chunks_count}</strong></span>
                      </div>
                      
                      <button
                        onClick={() => navigate(`/chat/${project.id}`)}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        Enter Chat
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
