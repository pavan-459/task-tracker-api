import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({ baseURL: API_BASE });

// Attach token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        if (!refresh) throw new Error('no refresh token');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data.data);

export const register = (body) =>
  api.post('/auth/register', body).then(r => r.data.data);

export const logout = () => api.post('/auth/logout');

// Tasks
export const getTasks = (params) =>
  api.get('/tasks', { params }).then(r => ({ tasks: r.data.data, meta: r.data.meta }));

export const createTask = (body) =>
  api.post('/tasks', body).then(r => r.data.data);

export const updateTask = (id, body) =>
  api.patch(`/tasks/${id}`, body).then(r => r.data.data);

export const transitionTask = (id, status) =>
  api.patch(`/tasks/${id}/status`, { status }).then(r => r.data.data);

export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export const getAnalytics = () =>
  api.get('/tasks/analytics').then(r => r.data.data);

// Projects
export const getProjects = () =>
  api.get('/projects').then(r => r.data.data);

export const createProject = (body) =>
  api.post('/projects', body).then(r => r.data.data);

// Users
export const getUsers = () =>
  api.get('/users').then(r => r.data.data);
