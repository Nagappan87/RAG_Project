import axios from 'axios';

const api = axios.create({
  baseURL: '', // Handled by Vite server proxy configuration in dev
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

// Request Interceptor: Attach JWT Token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rag_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Redirect to Login on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Session expired or token invalid. Logging out.");
      localStorage.removeItem('rag_token');
      localStorage.removeItem('rag_username');
      if (window.location.hash !== '#/auth') {
        window.location.href = '/#/auth';
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Authentication
  auth: {
    register: (username, password) => 
      api.post('/api/auth/register', { username, password }),
    login: async (username, password) => {
      const response = await api.post('/api/auth/login', { username, password });
      const { access_token } = response.data;
      localStorage.setItem('rag_token', access_token);
      localStorage.setItem('rag_username', username);
      return response.data;
    },
    logout: () => {
      localStorage.removeItem('rag_token');
      localStorage.removeItem('rag_username');
    },
    getMe: () => api.get('/api/auth/me'),
    isAuthenticated: () => !!localStorage.getItem('rag_token'),
    getUsername: () => localStorage.getItem('rag_username') || '',
  },

  // Projects / Chatbots
  projects: {
    list: () => api.get('/api/projects'),
    create: (name, url = null, crawlDepth = 1, maxPages = 20) => 
      api.post('/api/projects', { name, url, crawl_depth: crawlDepth, max_pages: maxPages }),
    get: (id) => api.get(`/api/projects/${id}`),
    delete: (id) => api.delete(`/api/projects/${id}`),
    getStatus: (id) => api.get(`/api/projects/${id}/status`),
    getPages: (id) => api.get(`/api/projects/${id}/pages`),
    appendUrl: (projectId, url, crawlDepth = 1, maxPages = 20) => 
      api.post(`/api/projects/${projectId}/crawl`, { url, crawl_depth: crawlDepth, max_pages: maxPages }),
    uploadFile: (projectId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/api/projects/${projectId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  },

  // Chat sessions
  sessions: {
    list: (projectId) => api.get(`/api/projects/${projectId}/sessions`),
    create: (projectId) => api.post(`/api/projects/${projectId}/sessions`),
    getMessages: (sessionId) => api.get(`/api/sessions/${sessionId}/messages`),
    ask: (sessionId, query, categoryFilter = null) => 
      api.post(`/api/sessions/${sessionId}/ask`, { query, category_filter: categoryFilter }),
  },

  // System Settings
  settings: {
    get: () => api.get('/api/settings'),
    update: (data) => api.post('/api/settings', data),
  },

  // Admin dashboard metrics
  dashboard: {
    getStats: () => api.get('/api/dashboard/stats'),
  },

  // Export URLs
  exports: {
    getExportLink: (sessionId, format) => {
      const token = localStorage.getItem('rag_token');
      return `/api/sessions/${sessionId}/export?format=${format}&token=${encodeURIComponent(token)}`;
    }
  }
};
