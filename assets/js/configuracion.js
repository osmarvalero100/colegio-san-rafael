// Pantalla Configuración — catálogos del sistema (solo ADMIN).
import { api } from './api.js';
import {
  esc, badgeEstado, money, screenEls, toast, loading, openModal, closeModal, formValue, confirmModal,
} from './utils.js';

let activo = 'grados';

const CATALOGOS = {
  grados: {
    nombre: 'Grados', api: '/grados',
    campos: [
      { k: 'grado', label: 'Grado', tipo: 'text', req: true },
      { k: 'nivel', label: 'Nivel', tipo: 'text' },
      { k: 'seccion', label: 'Sección', tipo: 'text' },
      { k: 'capacidad', label: 'Capacidad', tipo: 'number' },
    ],
    columnas: ['Grado', 'Nivel', 'Sección', 'Capacidad', 'Matriculados'],
    celda: (r) => [esc(r.grado), esc(r.nivel || '—'), esc(r.seccion || '—'),
      r.capacidad ?? '—', `${r.estudiantes_count ?? 0}`],
  },
  materias: {
    nombre: 'Materias', api: '/materias',
    campos: [
      { k: 'nombre', label: 'Nombre', tipo: 'text', req: true },
      { k: 'codigo', label: 'Código', tipo: 'text' },
    ],
    columnas: ['Nombre', 'Código', 'Profesores'],
    celda: (r) => [esc(r.nombre), esc(r.codigo || '—'), `${r.profesores_count ?? 0}`],
  },
  especialidades: {
    nombre: 'Especialidades', api: '/especialidades',
    campos: [{ k: 'nombre', label: 'Nombre', tipo: 'text', req: true }],
    columnas: ['Nombre'],
    celda: (r) => [esc(r.nombre)],
  },
  conceptos_pago: {
    nombre: 'Conceptos de pago', api: '/conceptos-pago',
    campos: [
      { k: 'nombre', label: 'Nombre', tipo: 'text', req: true },
      { k: 'monto_sugerido', label: 'Monto sugerido', tipo: 'number' },
    ],
    columnas: ['Nombre', 'Monto sugerido'],
    celda: (r) => [esc(r.nombre), money(r.monto_sugerido)],
  },
  anios_lectivos: {
    nombre: 'Años lectivos', api: '/anios-lectivos',
    campos: [
      { k: 'anio', label: 'Año', tipo: 'number', req: true },
      { k: 'fecha_inicio', label: 'Inicio', tipo: 'date' },
      { k: 'fecha_fin', label: 'Fin', tipo: 'date' },
      { k: 'estado', label: 'Estado', tipo: 'select', opciones: ['Activo', 'Cerrado'] },
    ],
    columnas: ['Año', 'Inicio', 'Fin', 'Estado', ''],
    celda: (r) => [esc(r.anio), esc((r.fecha_inicio || '').slice(0, 10) || '—'), esc((r.fecha_fin || '').slice(0, 10) || '—'), badgeEstado(r.estado)],
    especial: 'anios',
  },
  periodos_academicos: {
    nombre: 'Periodos académicos', api: '/periodos-academicos',
    campos: [
      { k: 'anio_lectivo_id', label: 'Año lectivo', tipo: 'select', fuente: 'anios' },
      { k: 'numero', label: 'Número', tipo: 'number' },
      { k: 'nombre', label: 'Nombre', tipo: 'text', req: true },
      { k: 'fecha_inicio', label: 'Inicio', tipo: 'date' },
      { k: 'fecha_fin', label: 'Fin', tipo: 'date' },
      { k: 'ponderacion', label: 'Ponderación', tipo: 'number' },
    ],
    columnas: ['Año', 'Número', 'Nombre', 'Inicio', 'Fin', 'Ponderación'],
    celda: (r) => [esc(r.anio ?? ''), esc(r.numero ?? ''), esc(r.nombre), esc((r.fecha_inicio || '').slice(0, 10) || '—'),
      esc((r.fecha_fin || '').slice(0, 10) || '—'), r.ponderacion ?? '—'],
  },
};

export async function render() {
  const { crumbs, actions, body } = screenEls('configuracion');
  crumbs.textContent = 'Catálogos del sistema';
  const tabs = Object.entries(CATALOGOS).map(([key, c]) =>
    `<span class="mini-tab ${activo === key ? 'active' : ''}" data-cat="${key}">${esc(c.nombre)}</span>`).join('');
  actions.innerHTML = `<button class="btn primary" id="btn-nuevo-cat">+ Nuevo</button>`;
  actions.querySelector('#btn-nuevo-cat').addEventListener('click', () => abrirFormCat(activo));
  body.innerHTML = `<div class="panel">
    <div class="filters">${tabs}</div>
    <div class="panel-body" style="padding-top:0;" id="cat-body"></div>
  </div>`;
  body.querySelectorAll('.mini-tab').forEach((t) => t.addEventListener('click', () => {
    activo = t.dataset.cat;
    render();
  }));
  await cargarCat(activo);
}

async function cargarCat(key) {
  const cfg = CATALOGOS[key];
  const body = document.getElementById('cat-body');
  loading(body);
  try {
    const res = await api(cfg.api, { query: { limit: 500 } });
    const filas = (res.data || []).map((r) => `<tr>
      <td class="cell-sub id-mono" style="white-space:nowrap;">#${r.id}</td>
      ${cfg.celda(r).map((c) => `<td>${c}</td>`).join('')}
      ${cfg.especial === 'anios'
        ? `<td><button class="btn mini" data-toggle-anio="${r.id}" data-estado="${r.estado}">${r.estado === 'Activo' ? 'Cerrar' : 'Activar'}</button></td>`
        : ''}
      <td><div style="display:flex;gap:6px;justify-content:flex-end;">
        <button class="btn mini" data-editar="${r.id}">Editar</button>
        <button class="btn mini danger" data-eliminar="${r.id}">✕</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="10"><div class="empty">Sin registros.</div></td></tr>';
    const head = `<tr><th>ID</th>${cfg.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}<th></th></tr>`;
    body.innerHTML = `<div style="overflow-x:auto;"><table><thead>${head}</thead><tbody>${filas}</tbody></table></div>`;
    body.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrirFormCat(key, Number(b.dataset.editar))));
    body.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', () => eliminarCat(key, Number(b.dataset.eliminar))));
    body.querySelectorAll('[data-toggle-anio]').forEach((b) => b.addEventListener('click', () => toggleAnio(Number(b.dataset.toggleAnio), b.dataset.estado)));
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

async function aniosCache() {
  const res = await api('/anios-lectivos', { query: { limit: 200 } });
  return res.data || [];
}

function inputHtml(campo, valor, fuentes) {
  const v = valor === null || valor === undefined ? '' : campo.tipo === 'date' ? String(valor).slice(0, 10) : String(valor);
  if (campo.tipo === 'select') {
    const opciones = campo.fuente === 'anios'
      ? (fuentes.anios || []).map((a) => `<option value="${a.id}" ${String(a.id) === v ? 'selected' : ''}>${esc(a.anio)}${a.estado === 'Activo' ? ' (activo)' : ''}</option>`)
      : (campo.opciones || []).map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`);
    return `<select id="cat-${campo.k}"><option value="">— Seleccionar —</option>${opciones.join('')}</select>`;
  }
  return `<input id="cat-${campo.k}" type="${campo.tipo === 'number' ? 'number' : campo.tipo}" ${campo.tipo === 'number' ? 'step="any"' : ''} value="${esc(v)}">`;
}

async function abrirFormCat(key, id) {
  const cfg = CATALOGOS[key];
  const esEdicion = Boolean(id);
  const actual = esEdicion ? await api(`${cfg.api}/${id}`) : null;
  const fuentes = {};
  if (cfg.campos.some((c) => c.fuente)) fuentes.anios = await aniosCache();
  const body = openModal(`${esEdicion ? 'Editar' : 'Nuevo'} · ${cfg.nombre}`, `
    <div class="form-grid">
      ${cfg.campos.map((c) => `<div class="field ${c.tipo === 'select' ? 'full' : ''}">
        <label>${esc(c.label)}${c.req ? ' *' : ''}</label>${inputHtml(c, actual?.[c.k], fuentes)}
      </div>`).join('')}
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>${esEdicion ? 'Guardar cambios' : 'Crear'}</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {};
    for (const c of cfg.campos) {
      const raw = formValue(`cat-${c.k}`);
      if (c.tipo === 'number') data[c.k] = raw === '' ? null : Number(raw);
      else if (c.tipo === 'date') data[c.k] = raw || null;
      else data[c.k] = raw;
    }
    const faltan = cfg.campos.filter((c) => c.req && (data[c.k] === '' || data[c.k] === null || data[c.k] === undefined));
    if (faltan.length) { toast(`Completa: ${faltan.map((c) => c.label).join(', ')}`, 'error'); return; }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      if (esEdicion) await api(`${cfg.api}/${id}`, { method: 'PUT', body: data });
      else await api(cfg.api, { method: 'POST', body: data });
      toast(esEdicion ? 'Registro actualizado' : 'Registro creado');
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

async function toggleAnio(id, estadoActual) {
  const nuevo = estadoActual === 'Activo' ? 'Cerrado' : 'Activo';
  confirmModal('Cambiar estado', `¿Marcar el año lectivo como ${nuevo}? ${nuevo === 'Activo' ? 'Se cerrarán los demás años activos.' : ''}`, async () => {
    await api(`/anios-lectivos/${id}/estado`, { method: 'PATCH', body: { estado: nuevo } });
    toast(`Año lectivo ${nuevo}`);
    render();
  }, 'Confirmar');
}

function eliminarCat(key, id) {
  const cfg = CATALOGOS[key];
  confirmModal(`Eliminar ${cfg.nombre.toLowerCase()}`, '¿Seguro que deseas eliminar este registro?', async () => {
    await api(`${cfg.api}/${id}`, { method: 'DELETE' });
    toast('Registro eliminado');
    render();
  }, 'Eliminar');
}
