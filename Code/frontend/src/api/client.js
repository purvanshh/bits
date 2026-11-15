import axios from 'axios';

const TOKEN_KEY = 'fleet.token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Same-origin: the Vite dev server proxies /api to the gateway (and adds x-api-key).
const client = axios.create({ baseURL: '/', timeout: 20000 });

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid JWT on a protected call → drop the session and go to login.
client.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && tokenStore.get() && !url.includes('/users/login')
      && err.response.data?.error !== 'INVALID_API_KEY' && err.response.data?.error !== 'MISSING_API_KEY') {
      tokenStore.clear();
      window.dispatchEvent(new Event('fleet:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err) => {
  if (err.response) {
    const d = err.response.data || {};
    if (err.response.status === 429) {
      const wait = d.retryAfterSeconds || d.retryAfter;
      return `${d.message || 'Too many requests.'}${wait ? ` Retry in ~${wait}s.` : ''}`;
    }
    return d.message || `Request failed (${err.response.status})`;
  }
  if (err.code === 'ECONNABORTED') return 'The request timed out.';
  return 'Cannot reach the API gateway. Is it running on port 4000?';
};

export default client;
