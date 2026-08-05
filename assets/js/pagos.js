// Pantalla Pagos — recaudación (ADMIN/SECRETARIA) y pagos de hijos (TUTOR).
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos } from './context.js';
import {
  esc, money, badgeEstado, fmtDate, screenEls, toast, loading,
  openModal, closeModal, formValue, setOpts, confirmModal, todayISO, currentMonth, currentYear, downloadCSV, paginacion, clampPage, searchSelect, searchValue,
} from './utils.js';

const sel = { anio: currentYear(), mes: currentMonth(), estado: '', search: '', page: 1, limit: 10 };
const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque'];

export async function render() {
  const r = rol();
  if (r === 'TUTOR') return renderHijos();
  return renderAdmin();
}

// ---------- ADMIN / SECRETARIA ----------
async function renderAdmin() {
  const { crumbs, actions, body } = screenEls('pagos');
  actions.innerHTML = '<button class="btn primary" id="btn-nuevo-cobro">+ Generar cobro</button>' +
    '<button class="btn" id="btn-export-pagos">Exportar</button>';
  actions.querySelector('#btn-nuevo-cobro').addEventListener('click', () => abrirFormCobro());
  actions.querySelector('#btn-export-pagos').addEventListener('click', exportarTodo);

  const buscar = document.createElement('div');
  buscar.className = 'search';
  buscar.style.cssText = 'width:220px;';
  buscar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="p-buscar" placeholder="Buscar por estudiante…" value="' + esc(sel.search) + '">';
  actions.insertBefore(buscar, actions.firstChild);
  buscar.querySelector('#p-buscar').addEventListener('input', (e) => {
    sel.search = e.target.value;
    sel.page = 1;
    clearTimeout(sel._t);
    sel._t = setTimeout(cargar, 300);
  });

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

  const selMes = document.createElement('select');
  selMes.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `<option value="${m}" ${m === sel.mes ? 'selected' : ''}>${new Date(2000, i, 1).toLocaleDateString('es-CO', { month: 'long' })}</option>`;
  }).join('');
  const selAnio = document.createElement('select');
  const anios = [currentYear(), currentYear() - 1, currentYear() - 2];
  selAnio.innerHTML = anios.map((a) => `<option value="${a}" ${a === sel.anio ? 'selected' : ''}>${a}</option>`).join('');
  const selEstado = document.createElement('select');
  selEstado.innerHTML = ['', 'Pagado', 'Pendiente', 'Vencido'].map((e) =>
    `<option value="${e}" ${e === sel.estado ? 'selected' : ''}>${e === '' ? 'Todos los estados' : e}</option>`).join('');
  actions.appendChild(mkPicker('Mes', selMes));
  actions.appendChild(mkPicker('Año', selAnio));
  actions.appendChild(mkPicker('Estado', selEstado));

  async function cargar() {
    loading(body);
    const [res, rows] = await Promise.all([
      api('/pagos/resumen', { query: { anio: sel.anio, mes: sel.mes } }),
      api('/pagos', { query: { anio: sel.anio, mes: sel.mes, estado: sel.estado || undefined, search: sel.search || undefined, page: sel.page, limit: sel.limit } }),
    ]);
    sel._filas = rows.data || [];
    const total = rows.pagination?.total ?? sel._filas.length;
    sel.page = clampPage(sel.page, total, sel.limit);
    const mesLabel = new Date(2000, sel.mes - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
    crumbs.textContent = `Recaudación ${mesLabel} ${sel.anio} · ${res.cantidad} cobros`;
    const stats = [
      { label: 'Recaudado', value: money(res.recaudado), cls: 'up' },
      { label: 'Pendiente', value: money(res.pendiente), cls: 'mid' },
      { label: 'Vencido', value: money(res.vencido), cls: 'down' },
    ];
    const filas = sel._filas.map(filaAdmin).join('') ||
      '<tr><td colspan="7"><div class="empty">Sin cobros en este periodo.</div></td></tr>';
    body.innerHTML = `
      <div class="stat-grid">
        ${stats.map((s) => `<div class="stat"><div class="stat-num ${s.cls}">${s.value}</div><div class="stat-lbl">${s.label}</div></div>`).join('')}
      </div>
      <div class="panel"><div class="panel-body" style="padding-top:0;overflow-x:auto;">
        <table>
          <thead><tr><th>Estudiante</th><th>Concepto</th><th>Periodo</th><th>Monto</th><th>Emisión</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div id="pag-pagos"></div></div>`;
    paginacion(body.querySelector('#pag-pagos'), {
      page: sel.page, limit: sel.limit, total,
      onPage: (p, l) => { sel.page = p; sel.limit = l; cargar(); },
    });
    body.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', () => abrirPagar(Number(b.dataset.pagar))));
    body.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrirFormCobro(Number(b.dataset.editar))));
    body.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', () => eliminarCobro(Number(b.dataset.eliminar))));
  }

  async function exportarTodo() {
    const res = await api('/pagos', { query: { anio: sel.anio, mes: sel.mes, estado: sel.estado || undefined, search: sel.search || undefined, limit: 5000 } });
    downloadCSV(`pagos-${sel.anio}-${String(sel.mes).padStart(2, '0')}.csv`, exportRows(res.data || []));
  }

  selMes.addEventListener('change', () => { sel.mes = Number(selMes.value); sel.page = 1; cargar(); });
  selAnio.addEventListener('change', () => { sel.anio = Number(selAnio.value); sel.page = 1; cargar(); });
  selEstado.addEventListener('change', () => { sel.estado = selEstado.value; sel.page = 1; cargar(); });
  await cargar();
}

function filaAdmin(p) {
  const puedePagar = p.estado === 'Pendiente' || p.estado === 'Vencido';
  const acc = [];
  if (puedePagar) acc.push(`<button class="btn mini primary" data-pagar="${p.id}">Pagar</button>`);
  acc.push(`<button class="btn mini" data-editar="${p.id}">Editar</button>`);
  if (rol() === 'ADMIN') acc.push(`<button class="btn mini danger" data-eliminar="${p.id}">✕</button>`);
  return `<tr>
    <td><div class="cell-name">${esc(p.estudiante_nombre)} ${esc(p.estudiante_apellido)}</div>
      <div class="cell-sub">${esc(p.grado || '')} ${esc(p.seccion || '')}${p.tutor_nombre ? ` · Tutor: ${esc(p.tutor_nombre)}` : ''}</div></td>
    <td data-label="Concepto">${esc(p.concepto_nombre)}<div class="cell-sub id-mono">#${p.id}</div></td>
    <td class="mono" data-label="Periodo">${esc(p.periodo_referencia || '—')}</td>
    <td class="mono" data-label="Monto">${money(p.monto)}</td>
    <td class="mono" data-label="Emisión">${fmtDate(p.fecha_emision)}</td>
    <td class="mono" data-label="Vence">${fmtDate(p.fecha_vencimiento)}</td>
    <td data-label="Estado">${badgeEstado(p.estado)}</td>
    <td data-label=""><div style="display:flex;gap:6px;justify-content:flex-end;">${acc.join('')}</div></td>
  </tr>`;
}

function exportRows(filas) {
  return [['Estudiante', 'Concepto', 'Periodo', 'Monto', 'Emision', 'Vence', 'Estado']].concat(
    filas.map((p) => [p.estudiante_nombre + ' ' + p.estudiante_apellido, p.concepto_nombre,
      p.periodo_referencia || '', p.monto, (p.fecha_emision || '').slice(0, 10),
      (p.fecha_vencimiento || '').slice(0, 10), p.estado])
  );
}

// ---------- TUTOR ----------
async function renderHijos() {
  const hijos = await loadHijos();
  const { crumbs, actions, body } = screenEls('pagos');
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
    onSelect: (v) => { ctx.selectedChildId = Number(v); cargarTabla(); },
  });
  async function cargarTabla() {
    loading(body);
    try {
      const res = await api('/pagos', { query: { estudiante_id: ctx.selectedChildId, page: sel.page, limit: sel.limit } });
      const filas = (res.data || []).map(filaTutor).join('') ||
        '<tr><td colspan="6"><div class="empty">Sin cobros registrados.</div></td></tr>';
      const total = res.pagination?.total ?? (res.data || []).length;
      sel.page = clampPage(sel.page, total, sel.limit);
      crumbs.textContent = `Pagos de ${hijos.find((h) => h.id === ctx.selectedChildId)?.nombre || ''} · ${total} cobros`;
      body.innerHTML = `<div class="panel"><div class="panel-body" style="padding-top:0;overflow-x:auto;">
        <table><thead><tr><th>Concepto</th><th>Periodo</th><th>Monto</th><th>Emisión</th><th>Vence</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table>
      </div>
      <div id="pag-pagos-tutor"></div></div>`;
      paginacion(body.querySelector('#pag-pagos-tutor'), {
        page: sel.page, limit: sel.limit, total,
        onPage: (p, l) => { sel.page = p; sel.limit = l; cargarTabla(); },
      });
    } catch (err) {
      body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
  await cargarTabla();
}

function filaTutor(p) {
  return `<tr>
    <td>${esc(p.concepto_nombre)}<div class="cell-sub id-mono">#${p.id}</div></td>
    <td class="mono" data-label="Periodo">${esc(p.periodo_referencia || '—')}</td>
    <td class="mono" data-label="Monto">${money(p.monto)}</td>
    <td class="mono" data-label="Emisión">${fmtDate(p.fecha_emision)}</td>
    <td class="mono" data-label="Vence">${fmtDate(p.fecha_vencimiento)}</td>
    <td data-label="Estado">${badgeEstado(p.estado)}</td>
  </tr>`;
}

// ---------- Acciones ----------
async function abrirFormCobro(id) {
  const esEdicion = Boolean(id);
  const pago = esEdicion ? (await api(`/pagos/${id}`)) : null;
  const [conceptos, estudiantes] = await Promise.all([
    api('/conceptos-pago', { query: { limit: 200 } }),
    api('/estudiantes', { query: { limit: 500 } }),
  ]);
  const conceptosList = conceptos.data || [];
  const estudiantesList = estudiantes.data || [];
  const body = openModal(esEdicion ? 'Editar cobro' : 'Generar cobro', `
    <div class="form-grid">
      <div class="field full"><label>Estudiante *</label><div id="p-estudiante"></div></div>
      <div class="field"><label>Concepto *</label><div id="p-concepto"></div></div>
      <div class="field"><label>Monto *</label><input id="p-monto" type="number" min="0" step="0.01" value="${pago ? pago.monto : ''}"></div>
      <div class="field"><label>Periodo de referencia</label><input id="p-periodo" placeholder="Ej: Marzo 2026" value="${esc(pago?.periodo_referencia || '')}"></div>
      <div class="field"><label>Fecha de emisión</label><input id="p-emision" type="date" value="${pago ? (pago.fecha_emision || '').slice(0, 10) : todayISO()}"></div>
      <div class="field"><label>Fecha de vencimiento</label><input id="p-vencimiento" type="date" value="${pago ? (pago.fecha_vencimiento || '').slice(0, 10) : ''}"></div>
      ${esEdicion ? `<div class="field"><label>Método de pago</label><select id="p-metodo">${['', ...METODOS].map((m) => `<option value="${m}" ${pago?.metodo_pago === m ? 'selected' : ''}>${m || '— Sin registrar —'}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>${esEdicion ? 'Guardar cambios' : 'Crear cobro'}</button>
    </div>`);

  searchSelect({
    el: body.querySelector('#p-estudiante'),
    options: estudiantesList.map((e) => [e.id, `${e.nombre} ${e.apellido}${e.grado_nombre ? ` · ${e.grado_nombre}${e.seccion || ''}` : ''}`]),
    initial: pago?.estudiante_id || (estudiantesList[0] ? String(estudiantesList[0].id) : ''),
    placeholder: 'Seleccionar estudiante…', searchPlaceholder: 'Buscar por nombre o apellido…',
  });
  searchSelect({
    el: body.querySelector('#p-concepto'),
    options: conceptosList.map((c) => [c.id, c.nombre]),
    initial: pago?.concepto_id || (conceptosList[0] ? String(conceptosList[0].id) : ''),
    placeholder: 'Seleccionar concepto…', searchPlaceholder: 'Buscar concepto…',
    onSelect: (v) => {
      if (montoTocado) return;
      const c = conceptosList.find((x) => String(x.id) === v);
      montoEl.value = (c && c.monto_sugerido != null && c.monto_sugerido !== '') ? c.monto_sugerido : '';
    },
  });
  const conceptoEl = body.querySelector('#p-concepto');
  const montoEl = body.querySelector('#p-monto');
  let montoTocado = Boolean(pago);
  montoEl.addEventListener('input', () => { montoTocado = true; });
  if (!pago && conceptoEl._searchSelect.value) {
    const c = conceptosList.find((x) => String(x.id) === conceptoEl._searchSelect.value);
    if (c && c.monto_sugerido != null && c.monto_sugerido !== '') montoEl.value = c.monto_sugerido;
  }

  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {
      estudiante_id: Number(searchValue('p-estudiante')),
      concepto_id: Number(searchValue('p-concepto')),
      monto: formValue('p-monto') ? Number(formValue('p-monto')) : undefined,
      periodo_referencia: formValue('p-periodo') || null,
      fecha_emision: formValue('p-emision') || null,
      fecha_vencimiento: formValue('p-vencimiento') || null,
    };
    if (!data.estudiante_id || !data.concepto_id || !data.monto) { toast('Completa estudiante, concepto y monto', 'error'); return; }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      if (esEdicion) {
        data.metodo_pago = formValue('p-metodo') || null;
        await api(`/pagos/${id}`, { method: 'PUT', body: data });
        toast('Cobro actualizado');
      } else {
        await api('/pagos', { method: 'POST', body: data });
        toast('Cobro generado');
      }
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

async function abrirPagar(id) {
  const body = openModal('Registrar pago', `
    <div class="form-grid">
      <div class="field"><label>Método de pago *</label>
        <select id="pg-metodo">${METODOS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha de pago</label><input id="pg-fecha" type="date" value="${todayISO()}"></div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Registrar pago</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = { metodo_pago: formValue('pg-metodo'), fecha_pago: formValue('pg-fecha') || null };
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await api(`/pagos/${id}/pagar`, { method: 'POST', body: data });
      toast('Pago registrado');
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

function eliminarCobro(id) {
  confirmModal('Eliminar cobro', '¿Seguro que deseas eliminar este cobro? Esta acción no se puede deshacer.', async () => {
    await api(`/pagos/${id}`, { method: 'DELETE' });
    toast('Cobro eliminado');
    render();
  }, 'Eliminar');
}
