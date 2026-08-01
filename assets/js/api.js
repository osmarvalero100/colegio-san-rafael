// Wrapper fetch con manejo de token JWT y errores uniformes.
import { API_URL } from './config.js';

let token = localStorage.getItem('token') || null;

export function getToken() { return token; }
export function setToken(t) { token = t; localStorage.setItem('token', t); }
export function clearToken() { token = null; localStorage.removeItem('token'); }

export async function api(path, { method = 'GET', body, query } = {}) {
  let url = API_URL + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += '?' + s;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (err) {
    const e = new Error('No se pudo conectar con el servidor. Verifica que el backend esté en línea.');
    e.code = 'NETWORK';
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    const e = new Error(data.error?.message || 'Sesión expirada');
    e.code = data.error?.code || 'UNAUTHORIZED';
    throw e;
  }
  if (!res.ok) {
    const e = new Error(data.error?.message || 'Error del servidor');
    e.code = data.error?.code;
    e.status = res.status;
    throw e;
  }
  return data;
}
