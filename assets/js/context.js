// Estado compartido entre pantallas (hijos del tutor, catálogos comunes).
import { api } from './api.js';
import { rol } from './auth.js';

export const ctx = {
  selectedChildId: null,
  hijos: null,
  catalogs: {},
};

export async function loadHijos(force = false) {
  if (rol() !== 'TUTOR') return [];
  if (!force && ctx.hijos) return ctx.hijos;
  ctx.hijos = await api('/tutores/me/estudiantes');
  ctx.hijos = Array.isArray(ctx.hijos) ? ctx.hijos : [];
  if (ctx.hijos.length === 1) ctx.selectedChildId = ctx.hijos[0].id;
  else if (!ctx.hijos.some((h) => h.id === ctx.selectedChildId)) ctx.selectedChildId = null;
  return ctx.hijos;
}

export function selectedChild() {
  if (!ctx.hijos) return null;
  return ctx.hijos.find((h) => h.id === ctx.selectedChildId) || null;
}

export async function getCatalog(key, fetcher) {
  if (ctx.catalogs[key]) return ctx.catalogs[key];
  ctx.catalogs[key] = await fetcher();
  return ctx.catalogs[key];
}

export async function grados() {
  return getCatalog('grados', async () => (await api('/grados?limit=100')).data || []);
}

export async function materias() {
  return getCatalog('materias', async () => (await api('/materias?limit=100')).data || []);
}

export async function anios() {
  return getCatalog('anios', async () => (await api('/anios-lectivos?limit=50')).data || []);
}

export async function periodos() {
  return getCatalog('periodos', async () => (await api('/periodos-academicos?limit=50')).data || []);
}

export function invalidateCatalogs() {
  ctx.catalogs = {};
}
