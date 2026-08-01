// Autenticación: login, restauración de sesión y logout.
import { api, setToken, clearToken, getToken } from './api.js';

export const user = {
  data: null, // { id, username, rolId, rolCodigo, rolNombre, personType, personId, personaNombre }
};

export async function login(username, password) {
  const result = await api('/auth/login', { method: 'POST', body: { username, password } });
  setToken(result.token);
  user.data = result.user;
  return user.data;
}

export async function restore() {
  if (!getToken()) return null;
  try {
    user.data = await api('/auth/me');
    return user.data;
  } catch (err) {
    user.data = null;
    return null;
  }
}

export function logout() {
  clearToken();
  user.data = null;
}

export function rol() {
  return user.data ? user.data.rolCodigo : null;
}
