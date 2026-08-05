// Pantalla Asistencia — toma de asistencia (ADMIN/PROFESOR), lectura
// (SECRETARIA), resumen propio (ESTUDIANTE/TUTOR).
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos } from './context.js';
import {
  esc, avatar, badgeEstado, screenEls, toast, loading, todayISO,
  currentMonth, currentYear, DAYS_SPANISH, paginacion, clampPage, searchSelect,
} from './utils.js';

const ESTADOS = ['Presente', 'Tarde', 'Ausente', 'Justificado'];
const sel = { materiaId: '', gradoId: '', fecha: todayISO(), mes: currentMonth(), anio: currentYear(), search: '', page: 1, limit: 10 };

export async function render() {
  const r = rol();
  if (r === 'ESTUDIANTE') return renderResumenEstudiante(authUser.data.personId, currentMonth(), currentYear());
  if (r === 'TUTOR') return renderHijos();
  if (r === 'SECRETARIA') return renderLectura();
  return renderToma();
}

function estadoSelect(value, editable) {
  const opts = ESTADOS.map((e) => `<option value="${e}" ${e === value ? 'selected' : ''}>${e}</option>`).join('');
  return editable
    ? `<select data-estado style="font-family:Inter;font-size:12px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;color:var(--ink);background:#fff;outline:none;">${opts}</select>`
    : badgeEstado(value);
}

function barEstado(estados, estado, color) {
  const info = estados[estado] || { cantidad: 0, porcentaje: 0 };
  return `<div class="bar-row"><span class="lbl">${estado}</span><div class="bar-track"><div class="bar-fill" style="width:${info.porcentaje}%; background:${color};"></div></div><span class="bar-val">${info.porcentaje}%</span></div>`;
}

// ---------- Toma de asistencia (ADMIN / PROFESOR) ----------
async function renderToma() {
  const r = rol();
  const editable = true;
  const { crumbs, actions, body } = screenEls('asistencia');

  let materias;
  let estudiantesCache = [];
  let estudiantes = [];
  let existentesMap = {};
  if (r === 'PROFESOR') {
    materias = await api('/profesores/me/materias');
    estudiantesCache = await api('/profesores/me/estudiantes');
  } else {
    materias = (await api('/materias?limit=100')).data || [];
  }

  const selMateria = document.createElement('select');
  selMateria.innerHTML = materias.map((m) =>
    `<option value="${m.id}" ${String(m.id) === sel.materiaId ? 'selected' : ''}>${esc(m.nombre)}${m.grado ? ` · ${esc(m.grado)}${esc(m.seccion || '')}` : ''}</option>`).join('');
  const selFecha = document.createElement('input');
  selFecha.type = 'date';
  selFecha.value = sel.fecha;
  const guardar = document.createElement('button');
  guardar.className = 'btn primary';
  guardar.textContent = 'Guardar asistencia';

  const mkPicker = (label, el) => {
    const wrap = document.createElement('div');
    wrap.className = 'search';
    wrap.style.cssText = 'width:auto;padding:0 10px;gap:6px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-faint);';
    lbl.textContent = label;
    el.style.cssText = 'border:none;outline:none;font-family:Inter;font-size:13px;background:transparent;color:var(--ink);padding:8px 2px;';
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  };
  actions.innerHTML = '';
  const buscar = document.createElement('div');
  buscar.className = 'search';
  buscar.style.cssText = 'width:220px;';
  buscar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="asistencia-buscar" placeholder="Buscar estudiante…" value="' + esc(sel.search) + '">';
  actions.appendChild(buscar);
  buscar.querySelector('#asistencia-buscar').addEventListener('input', (e) => {
    sel.search = e.target.value;
    sel.page = 1;
    aplicarPaginacion();
  });
  actions.appendChild(mkPicker('Materia', selMateria));
  actions.appendChild(mkPicker('Fecha', selFecha));
  actions.appendChild(guardar);

  function materiaActual() {
    return materias.find((m) => String(m.id) === sel.materiaId) || materias[0];
  }

  function estudiantesFiltrados() {
    const s = sel.search.trim().toLowerCase();
    return s
      ? estudiantes.filter((e) => `${e.nombre} ${e.apellido}`.toLowerCase().includes(s) || String(e.id).includes(s))
      : estudiantes;
  }

  function aplicarPaginacion() {
    const tbody = body.querySelector('tbody');
    if (tbody) tbody.innerHTML = renderTabla();
    renderPaginacion();
  }

  function renderPaginacion() {
    const cont = body.querySelector('#pag-asistencia');
    if (!cont) return;
    const total = estudiantesFiltrados().length;
    paginacion(cont, {
      page: sel.page, limit: sel.limit, total,
      onPage: (p, l) => { sel.page = p; sel.limit = l; aplicarPaginacion(); },
    });
  }

  async function cargar() {
    const m = materiaActual();
    if (!m) { body.innerHTML = '<div class="empty">No tienes materias asignadas.</div>'; return; }
    sel.materiaId = String(m.id);
    const gradoId = String(m.grado_id || '');
    const anioMes = new Date(sel.fecha);
    const mes = anioMes.getMonth() + 1;
    const anio = anioMes.getFullYear();

    if (r === 'PROFESOR') {
      estudiantes = estudiantesCache.filter((e) => `${e.grado}${e.seccion || ''}` === `${m.grado}${m.seccion || ''}`);
    } else {
      const res = await api('/estudiantes', { query: { grado_id: gradoId, limit: 300 } });
      estudiantes = res.data || [];
    }
    if (!estudiantes.length) { body.innerHTML = '<div class="empty">No hay estudiantes en este grupo.</div>'; return; }

    loading(body, 'Cargando registro…');
    let existentes = [];
    try {
      const res = await api('/asistencias', { query: { materia_id: sel.materiaId, grado_id: gradoId, fecha: sel.fecha, limit: 300 } });
      existentes = res.data || [];
    } catch (err) { /* sin registros previos */ }

    existentesMap = {};
    existentes.forEach((a) => { existentesMap[a.estudiante_id] = a; });

    const filas = renderTabla();

    // resumen mensual
    let resumen = null;
    try {
      resumen = await api('/asistencias/resumen-mensual', { query: { grado_id: gradoId, materia_id: sel.materiaId, anio, mes } });
    } catch (err) { /* */ }

    const fechaLabel = new Date(sel.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    crumbs.textContent = `${m.nombre} · ${m.grado || ''} ${m.seccion || ''} · ${fechaLabel}`;

    const resumenHtml = resumen
      ? `<div class="panel"><div class="panel-head"><div><h3>Resumen del mes</h3><div class="hint">${m.nombre} · ${resumen.mes}/${resumen.anio}</div></div></div>
         <div class="panel-body" style="padding-top:14px;">
           ${barEstado(resumen.estados, 'Presente', 'var(--teal)')}
           ${barEstado(resumen.estados, 'Tarde', 'var(--mustard)')}
           ${barEstado(resumen.estados, 'Ausente', 'var(--red)')}
           ${barEstado(resumen.estados, 'Justificado', 'var(--ink-faint)')}
         </div></div>`
      : '';

    body.innerHTML = `<div class="two-col">
      <div class="panel"><div class="panel-body" style="padding-top:0;overflow-x:auto;">
        <table>
          <thead><tr><th>Estudiante</th><th>Estado</th><th>Observación</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div id="pag-asistencia"></div></div>
      ${resumenHtml}
    </div>`;
    renderPaginacion();
  }

  function renderTabla() {
    const filtrados = estudiantesFiltrados();
    const total = filtrados.length;
    sel.page = clampPage(sel.page, total, sel.limit);
    const paginados = filtrados.slice((sel.page - 1) * sel.limit, sel.page * sel.limit);
    if (!paginados.length) return '<tr><td colspan="3"><div class="empty">Sin estudiantes que coincidan.</div></td></tr>';
    return paginados.map((e) => {
      const prev = existentesMap[e.id];
      return `<tr data-eid="${e.id}">
        <td class="row-flex">${avatar(e.nombre, e.apellido)}<div><div class="cell-name">${esc(e.nombre)} ${esc(e.apellido)}</div><div class="cell-sub id-mono">#${e.id}</div></div></td>
        <td data-label="Estado">${estadoSelect(prev?.estado || 'Presente', editable)}</td>
        <td data-label="Observación"><input data-obs value="${esc(prev?.observaciones || '')}" placeholder="—" style="width:100%;max-width:220px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;font-family:Inter;font-size:12.5px;color:var(--ink);outline:none;"></td>
      </tr>`;
    }).join('');
  }

  selMateria.addEventListener('change', () => { sel.materiaId = selMateria.value; sel.page = 1; cargar(); });
  selFecha.addEventListener('change', () => { sel.fecha = selFecha.value; sel.page = 1; cargar(); });
  guardar.addEventListener('click', async () => {
    const m = materiaActual();
    const registros = [];
    estudiantes.forEach((e) => {
      const tr = body.querySelector(`tbody tr[data-eid="${e.id}"]`);
      const prev = existentesMap[e.id];
      registros.push({
        estudiante_id: e.id,
        estado: tr ? tr.querySelector('[data-estado]').value : (prev?.estado || 'Presente'),
        observaciones: tr ? (tr.querySelector('[data-obs]').value || null) : (prev?.observaciones || null),
      });
    });
    if (!registros.length) { toast('Sin registros para guardar', 'warn'); return; }
    guardar.disabled = true;
    try {
      const res = await api('/asistencias', { method: 'POST', body: { materia_id: Number(sel.materiaId), fecha: sel.fecha, registros } });
      toast(`Asistencia guardada (${res.guardados.length} registros)`);
      cargar();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      guardar.disabled = false;
    }
  });

  await cargar();
}

// ---------- Lectura (SECRETARIA) ----------
async function renderLectura() {
  const { crumbs, actions, body } = screenEls('asistencia');
  const materias = (await api('/materias?limit=100')).data || [];
  const selMateria = document.createElement('select');
  selMateria.innerHTML = materias.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('');
  const selMes = document.createElement('select');
  selMes.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `<option value="${m}" ${m === sel.mes ? 'selected' : ''}>${new Date(2000, i, 1).toLocaleDateString('es-CO', { month: 'long' })}</option>`;
  }).join('');
  const mkPicker = (label, el) => {
    const wrap = document.createElement('div');
    wrap.className = 'search';
    wrap.style.cssText = 'width:auto;padding:0 10px;gap:6px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-faint);';
    lbl.textContent = label;
    el.style.cssText = 'border:none;outline:none;font-family:Inter;font-size:13px;background:transparent;color:var(--ink);padding:8px 2px;';
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  };
  actions.innerHTML = '';
  const buscar = document.createElement('div');
  buscar.className = 'search';
  buscar.style.cssText = 'width:220px;';
  buscar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="asistencia-buscar" placeholder="Buscar estudiante…" value="' + esc(sel.search) + '">';
  actions.appendChild(buscar);
  buscar.querySelector('#asistencia-buscar').addEventListener('input', (e) => {
    sel.search = e.target.value;
    sel.page = 1;
    aplicarPaginacion();
  });
  actions.appendChild(mkPicker('Materia', selMateria));
  actions.appendChild(mkPicker('Mes', selMes));

  let registros = [];

  function registrosFiltrados() {
    const s = sel.search.trim().toLowerCase();
    return s
      ? registros.filter((a) => `${a.estudiante_nombre} ${a.estudiante_apellido}`.toLowerCase().includes(s))
      : registros;
  }

  function aplicarPaginacion() {
    const tbody = body.querySelector('tbody');
    if (tbody) tbody.innerHTML = renderFilas();
    renderPaginacion();
  }

  function renderPaginacion() {
    const cont = body.querySelector('#pag-asistencia');
    if (!cont) return;
    const total = registrosFiltrados().length;
    paginacion(cont, {
      page: sel.page, limit: sel.limit, total,
      onPage: (p, l) => { sel.page = p; sel.limit = l; aplicarPaginacion(); },
    });
  }

  function renderFilas() {
    const filtrados = registrosFiltrados();
    const total = filtrados.length;
    sel.page = clampPage(sel.page, total, sel.limit);
    const paginados = filtrados.slice((sel.page - 1) * sel.limit, sel.page * sel.limit);
    return paginados.map((a) => `<tr>
        <td class="row-flex">${avatar(a.estudiante_nombre, a.estudiante_apellido)}<div><div class="cell-name">${esc(a.estudiante_nombre)} ${esc(a.estudiante_apellido)}</div></div></td>
        <td class="mono" data-label="Fecha">${esc((a.fecha || '').slice(0, 10))}</td>
        <td data-label="Estado">${badgeEstado(a.estado)}</td>
        <td class="cell-sub" data-label="Observación">${esc(a.observaciones || '—')}</td>
      </tr>`).join('') || '<tr><td colspan="4"><div class="empty">Sin registros que coincidan.</div></td></tr>';
  }

  async function cargar() {
    const materiaId = selMateria.value;
    if (!materiaId) { body.innerHTML = '<div class="empty">Selecciona una materia.</div>'; return; }
    loading(body, 'Consultando…');
    try {
      const res = await api('/asistencias', { query: { materia_id: materiaId, mes: sel.mes, anio: sel.anio, limit: 400 } });
      registros = res.data || [];
      const filas = renderFilas();
      crumbs.textContent = `Consulta por materia y mes · ${materias.find((m) => String(m.id) === materiaId)?.nombre || ''}`;
      body.innerHTML = `<div class="panel"><div class="panel-body" style="padding-top:0;overflow-x:auto;">
        <table><thead><tr><th>Estudiante</th><th>Fecha</th><th>Estado</th><th>Observación</th></tr></thead><tbody>${filas}</tbody></table>
      </div>
      <div id="pag-asistencia"></div></div>`;
      renderPaginacion();
    } catch (err) {
      body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
  selMateria.addEventListener('change', () => { sel.page = 1; cargar(); });
  selMes.addEventListener('change', () => { sel.mes = Number(selMes.value); sel.page = 1; cargar(); });
  await cargar();
}

// ---------- Resumen propio (ESTUDIANTE) ----------
async function renderResumenEstudiante(id, mes, anio, keepActions = false) {
  const { crumbs, actions, body } = screenEls('asistencia');
  crumbs.textContent = `Tu asistencia · ${mes}/${anio}`;
  if (!keepActions) actions.innerHTML = '';
  loading(body);
  try {
    const [res, hist] = await Promise.all([
      api(`/asistencias/estudiante/${id}`, { query: { mes, anio } }),
      api('/asistencias', { query: { limit: 20 } }),
    ]);
    const filas = (hist.data || []).map((a) => `<tr>
      <td class="cell-name">${esc(a.materia_nombre)}</td>
      <td class="mono" data-label="Fecha">${esc((a.fecha || '').slice(0, 10))}</td>
      <td data-label="Estado">${badgeEstado(a.estado)}</td>
      <td class="cell-sub" data-label="Obs.">${esc(a.observaciones || '—')}</td>
    </tr>`).join('') || '<tr><td colspan="4"><div class="empty">Sin registros.</div></td></tr>';
    body.innerHTML = `<div class="two-col even">
      <div class="panel"><div class="panel-head"><div><h3>Resumen del mes</h3><div class="hint">${mes}/${anio} · ${res.total} registros</div></div></div>
        <div class="panel-body" style="padding-top:14px;">
          ${barEstado(res.estados, 'Presente', 'var(--teal)')}
          ${barEstado(res.estados, 'Tarde', 'var(--mustard)')}
          ${barEstado(res.estados, 'Ausente', 'var(--red)')}
          ${barEstado(res.estados, 'Justificado', 'var(--ink-faint)')}
        </div></div>
      <div class="panel"><div class="panel-head"><div><h3>Historial reciente</h3></div></div>
        <div class="panel-body" style="padding-top:0;"><table><thead><tr><th>Materia</th><th>Fecha</th><th>Estado</th><th>Obs.</th></tr></thead><tbody>${filas}</tbody></table></div></div>
    </div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ---------- Hijos (TUTOR) ----------
async function renderHijos() {
  const hijos = await loadHijos();
  const { crumbs, actions, body } = screenEls('asistencia');
  if (!hijos.length) {
    actions.innerHTML = '';
    crumbs.textContent = 'Sin estudiantes a cargo';
    body.innerHTML = '<div class="empty">No tienes estudiantes a tu cargo.</div>';
    return;
  }
  actions.innerHTML = `<div class="student-picker">
    <span style="font-size:12px;color:var(--ink-faint);font-weight:600;">Estudiante:</span>
    <div id="sel-hijo"></div>
  </div>`;
  if (!ctx.selectedChildId || !hijos.some((h) => h.id === ctx.selectedChildId)) ctx.selectedChildId = Number(hijos[0].id);
  searchSelect({
    el: actions.querySelector('#sel-hijo'),
    options: hijos.map((h) => [h.id, `${h.nombre} ${h.apellido}`]),
    initial: ctx.selectedChildId,
    placeholder: 'Seleccionar estudiante…', searchPlaceholder: 'Buscar estudiante…',
    onSelect: (v) => { ctx.selectedChildId = Number(v); renderResumenEstudiante(ctx.selectedChildId, sel.mes, sel.anio, true); },
  });
  await renderResumenEstudiante(ctx.selectedChildId, sel.mes, sel.anio, true);
}
