import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor to handle unauthorized responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Authentication
  auth: {
    login: async (credentials: { email: string; password: string }) => {
      const res = await apiClient.post('/auth/login', credentials);
      return res.data;
    },
    logout: async () => {
      try {
        await apiClient.post('/auth/logout');
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    },
  },

  // Analytics & Dashboard
  analytics: {
    getOverview: async () => {
      const res = await apiClient.get('/analytics/overview');
      return res.data;
    },
    getRevenue: async () => {
      const res = await apiClient.get('/analytics/revenue');
      return res.data;
    },
  },

  // Organizations
  organizations: {
    getAll: async () => {
      const res = await apiClient.get('/organizations');
      return res.data;
    },
    getById: async (id: string) => {
      const res = await apiClient.get(`/organizations/${id}`);
      return res.data;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/organizations', data);
      return res.data;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.patch(`/organizations/${id}`, data);
      return res.data;
    },
    delete: async (id: string) => {
      const res = await apiClient.delete(`/organizations/${id}`);
      return res.data;
    },
  },

  // Plans
  plans: {
    getAll: async () => {
      const res = await apiClient.get('/plans');
      return res.data;
    },
    getById: async (id: string) => {
      const res = await apiClient.get(`/plans/${id}`);
      return res.data;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/plans', data);
      return res.data;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.patch(`/plans/${id}`, data);
      return res.data;
    },
    delete: async (id: string) => {
      const res = await apiClient.delete(`/plans/${id}`);
      return res.data;
    },
  },

  // Subscriptions
  subscriptions: {
    getAll: async () => {
      const res = await apiClient.get('/subscriptions');
      return res.data;
    },
    getById: async (id: string) => {
      const res = await apiClient.get(`/subscriptions/${id}`);
      return res.data;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/subscriptions', data);
      return res.data;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.patch(`/subscriptions/${id}`, data);
      return res.data;
    },
    delete: async (id: string) => {
      const res = await apiClient.delete(`/subscriptions/${id}`);
      return res.data;
    },
  },

  // Audit Logs
  audit: {
    getAll: async () => {
      const res = await apiClient.get('/audit');
      return res.data;
    },
  },

  // System Health
  health: {
    check: async () => {
      const res = await apiClient.get('/health');
      return res.data;
    },
  },

  // Feature Flags
  featureFlags: {
    getAll: async () => {
      const res = await apiClient.get('/settings/feature-flags');
      return res.data;
    },
    update: async (id: string, data: { isEnabled?: boolean; rolloutPercentage?: number }) => {
      const res = await apiClient.patch(`/settings/feature-flags/${id}`, data);
      return res.data;
    },
  },

  // Integrations
  integrations: {
    getAll: async () => {
      const res = await apiClient.get('/settings/integrations');
      return res.data;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.patch(`/settings/integrations/${id}`, data);
      return res.data;
    },
  },

  // Settings
  settings: {
    getAll: async () => {
      const res = await apiClient.get('/settings');
      return res.data;
    },
    upsert: async (key: string, value: any, group?: string) => {
      const res = await apiClient.post('/settings/upsert', { key, value, group });
      return res.data;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.patch(`/settings/${id}`, data);
      return res.data;
    },
  },

  // Customers & Leads
  leads: {
    getAll: async () => {
      const res = await apiClient.get('/leads');
      return res.data;
    },
  },
  customers: {
    getAll: async () => {
      const res = await apiClient.get('/customers');
      return res.data;
    },
  },
  properties: {
    getAll: async () => {
      const res = await apiClient.get('/properties');
      return res.data;
    },
  },
};
