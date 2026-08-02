// Pantalla Horarios — grilla semanal. Editable para ADMIN/SECRETARIA,
// solo lectura para PROFESOR/ESTUDIANTE/TUTOR.
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos, grados } from './context.js';
import {
  esc, screenEls, openModal, closeModal, formValue, toast, confirmModal, loading, fmtTime,
} from './utils.js';

const ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
let selGradoId = '';

export async function render() {
  const r = rol();
  if (r === 'ADMIN' || r === 'SECRETARIA') return renderEditable();
  if (r === 'PROFESOR') return renderPropio();
  if (r === 'ESTUDIANTE') return renderPorEstudiante(authUser.data.personId);
  if (r === 'TUTOR') return renderHijos();
}

function colorMateria(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('matem')) return 'c-mat';
  if (n.includes('lengua') || n.includes('castell')) return 'c-len';
  if (n.includes('ciencias')) return 'c-cie';
  if (n.includes('ingl')) return 'c-ing';
  if (n.includes('educación') || n.includes('física')) return 'c-edf';
  if (n.includes('arte')) return 'c-art';
  if (n.includes('social')) return 'c-soc';
  if (n.includes('tecnolog')) return 'c-tec';
  return 'c-mat';
}

function buildGrid(rows, editable) {
  if (!rows.length) return '<div class="empty">Sin bloques de clase en este horario.</div>';
  const dias = ORDEN_DIAS.filter((d) => rows.some((r) => r.dia === d));
  const horas = [...new Set(rows.map((r) => r.hora_inicio.slice(0, 5)))].sort();
  const matriz = {};
  rows.forEach((r) => {
    const key = `${r.hora_inicio.slice(0, 5)}|${r.dia}`;
    matriz[key] = r;
  });
  let html = '<div class="hcell"></div>' + dias.map((d) => `<div class="hcell">${esc(d)}</div>`).join('');
  horas.forEach((h) => {
    html += `<div class="tcell">${h}</div>`;
    dias.forEach((d) => {
      const r = matriz[`${h}|${d}`];
      if (r) {
        html += `<div class="slot ${colorMateria(r.materia_nombre)} ${editable ? 'editable' : ''}" data-horario="${r.id}">
          <b>${esc(r.materia_nombre || '')}</b>
          <span>${esc(r.profesor_nombre || '')} ${esc(r.profesor_apellido || '')}</span>
          <span class="aula">${esc(r.aula || '')}</span>
        </div>`;
      } else {
        html += '<div class="slot empty"></div>';
      }
    });
  });
  return `<div class="schedule">${html}</div>`;
}

// ---------- Vista móvil: selector de día + timeline vertical ----------
const DIAS_CORTOS = { Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom' };

function diaHoyCorto() {
  const i = new Date().getDay();
  return i === 0 ? 'Dom' : i === 6 ? 'Sáb' : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][i - 1];
}

function timelineHtml(rows, corto, editable) {
  const diaLargo = Object.keys(DIAS_CORTOS).find((k) => DIAS_CORTOS[k] === corto);
  const horas = [...new Set(rows.map((r) => r.hora_inicio.slice(0, 5)))].sort();
  const mapa = {};
  rows.filter((r) => r.dia === diaLargo).forEach((r) => { mapa[r.hora_inicio.slice(0, 5)] = r; });
  return horas.map((h) => {
    const r = mapa[h];
    if (!r) return `<div class="tslot"><div class="thour">${h}</div><div class="tcard empty"></div></div>`;
    return `<div class="tslot"><div class="thour">${h}</div>
      <div class="tcard ${colorMateria(r.materia_nombre)} ${editable ? 'editable' : ''}" data-horario="${r.id}">
        <b>${esc(r.materia_nombre || '')}</b>
        <span>${esc(r.profesor_nombre || '')} ${esc(r.profesor_apellido || '')}${r.aula ? ` · ${esc(r.aula)}` : ''}</span>
      </div></div>`;
  }).join('');
}

function buildMobileHorario(rows, editable) {
  if (!rows.length) return '<div class="empty">Sin bloques de clase en este horario.</div>';
  const short = ORDEN_DIAS.filter((d) => rows.some((r) => r.dia === d)).map((d) => DIAS_CORTOS[d] || d);
  const inicial = short.includes(diaHoyCorto()) ? diaHoyCorto() : short[0];
  return `<div class="daypicker" data-mpick>${short.map((s) =>
    `<div class="daychip ${s === inicial ? 'active' : ''}" data-d="${s}">${s}</div>`).join('')}</div>
    <div class="timeline" data-mtimeline>${timelineHtml(rows, inicial, editable)}</div>`;
}

function eliminarBloque(id) {
  confirmModal('Eliminar bloque', '¿Eliminar este bloque de clase del horario?',
    async () => { await api(`/horarios/${id}`, { method: 'DELETE' }); toast('Bloque eliminado'); render(); }, 'Eliminar');
}

function initMobileHorario(body, rows, editable) {
  const picker = body.querySelector('[data-mpick]');
  const timeline = body.querySelector('[data-mtimeline]');
  if (!picker || !timeline) return;
  picker.querySelectorAll('.daychip').forEach((c) => {
    c.addEventListener('click', () => {
      picker.querySelectorAll('.daychip').forEach((x) => x.classList.toggle('active', x === c));
      timeline.innerHTML = timelineHtml(rows, c.dataset.d, editable);
      if (editable) {
        timeline.querySelectorAll('[data-horario]').forEach((s) => s.addEventListener('click', () => eliminarBloque(s.dataset.horario)));
      }
    });
  });
}

function renderGrid(body, rows, editable) {
  body.innerHTML = `
    <div class="panel hor-grid-panel"><div class="panel-body" style="padding-top:16px;">${buildGrid(rows, editable)}</div></div>
    <div class="panel hor-mobile-panel"><div class="panel-body" style="padding-top:16px;">${buildMobileHorario(rows, editable)}</div></div>`;
  if (editable) {
    body.querySelectorAll('[data-horario]').forEach((s) => s.addEventListener('click', () => eliminarBloque(s.dataset.horario)));
  }
  initMobileHorario(body, rows, editable);
}

// ---------- ADMIN / SECRETARIA ----------
async function renderEditable() {
  const { crumbs, actions, body } = screenEls('horarios');
  actions.innerHTML = '<button class="btn primary" id="btn-nuevo-bloque">+ Nuevo bloque</button>';
  actions.querySelector('#btn-nuevo-bloque').addEventListener('click', abrirFormBloque);
  const gs = await grados();
  const selGrado = document.createElement('select');
  selGrado.id = 'horario-grado';
  if (!selGradoId && gs.length) selGradoId = String(gs[0].id);
  selGrado.innerHTML = gs.map((g) => `<option value="${g.id}" ${String(g.id) === selGradoId ? 'selected' : ''}>Grado ${esc(g.grado)} ${esc(g.seccion || '')}</option>`).join('');
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
  actions.insertBefore(mkPicker('Grado', selGrado), actions.firstChild);
  selGrado.addEventListener('change', () => { selGradoId = selGrado.value; cargar(); });
  crumbs.textContent = 'Semana de clases por grado · clic en un bloque para eliminarlo';

  async function cargar() {
    if (!selGradoId) { body.innerHTML = '<div class="empty">Selecciona un grado.</div>'; return; }
    loading(body, 'Cargando horario…');
    try {
      const { data: rows } = await api('/horarios', { query: { grado_id: selGradoId, limit: 300 } });
      const g = gs.find((x) => String(x.id) === selGradoId);
      crumbs.textContent = `Grado ${g ? `${g.grado} ${g.seccion || ''}` : ''} · Semana de clases`;
      renderGrid(body, rows, true);
    } catch (err) {
      body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }
  await cargar();
}

async function abrirFormBloque() {
  const gs = await grados();
  const materias = (await api('/materias?limit=100')).data || [];
  const profesores = (await api('/profesores?limit=200')).data || [];
  const body = openModal('Nuevo bloque de clase', `
    <div class="form-grid">
      <div class="field full"><label>Materia *</label><select id="h-materia">${materias.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></div>
      <div class="field full"><label>Profesor *</label><select id="h-profesor">${profesores.map((p) => `<option value="${p.id}">${esc(p.nombre)} ${esc(p.apellido)}</option>`).join('')}</select></div>
      <div class="field"><label>Grado *</label><select id="h-grado">${gs.map((g) => `<option value="${g.id}" ${String(g.id) === selGradoId ? 'selected' : ''}>${esc(g.grado)} ${esc(g.seccion || '')}</option>`).join('')}</select></div>
      <div class="field"><label>Día *</label><select id="h-dia">${ORDEN_DIAS.map((d) => `<option value="${d}">${d}</option>`).join('')}</select></div>
      <div class="field"><label>Hora inicio *</label><input id="h-inicio" type="time" value="07:00"></div>
      <div class="field"><label>Hora fin *</label><input id="h-fin" type="time" value="08:00"></div>
      <div class="field"><label>Aula</label><input id="h-aula" placeholder="Aula 12"></div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Crear bloque</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {
      materia_id: Number(formValue('h-materia')),
      profesor_id: Number(formValue('h-profesor')),
      grado_id: Number(formValue('h-grado')),
      anio_lectivo_id: (await api('/anios-lectivos?limit=5')).data.find((a) => a.estado === 'Activo')?.id,
      dia: formValue('h-dia'),
      hora_inicio: formValue('h-inicio'),
      hora_fin: formValue('h-fin'),
      aula: formValue('h-aula') || null,
    };
    if (!data.materia_id || !data.profesor_id || !data.grado_id || !data.dia || !data.hora_inicio || !data.hora_fin) {
      toast('Completa los campos obligatorios', 'error'); return;
    }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await api('/horarios', { method: 'POST', body: data });
      toast('Bloque creado');
      closeModal();
      selGradoId = String(data.grado_id);
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

// ---------- PROFESOR: horario propio ----------
async function renderPropio() {
  const { crumbs, actions, body } = screenEls('horarios');
  crumbs.textContent = 'Tu horario de clases';
  actions.innerHTML = '';
  loading(body);
  try {
    const rows = await api('/profesores/me/horario');
    renderGrid(body, rows, false);
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ---------- ESTUDIANTE / TUTOR ----------
async function renderPorEstudiante(id) {
  const { crumbs, actions, body } = screenEls('horarios');
  crumbs.textContent = 'Tu horario de clases';
  actions.innerHTML = '';
  loading(body);
  try {
    const ficha = await api(`/estudiantes/${id}/ficha`);
    const gradoId = ficha.matricula?.grado_id;
    if (!gradoId) { body.innerHTML = '<div class="empty">Sin matrícula activa para mostrar horario.</div>'; return; }
    const query = rol() === 'TUTOR' ? { estudiante_id: id, limit: 300 } : { grado_id: gradoId, limit: 300 };
    const { data: rows } = await api('/horarios', { query });
    crumbs.textContent = `${ficha.matricula.grado} ${ficha.matricula.seccion || ''} · Horario semanal`;
    renderGrid(body, rows, false);
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

async function renderHijos() {
  const hijos = await loadHijos();
  const { crumbs, actions, body } = screenEls('horarios');
  if (!hijos.length) {
    actions.innerHTML = '';
    crumbs.textContent = 'Sin estudiantes a cargo';
    body.innerHTML = '<div class="empty">No tienes estudiantes a tu cargo.</div>';
    return;
  }
  actions.innerHTML = `<div class="student-picker">
    <span style="font-size:12px;color:var(--ink-faint);font-weight:600;">Estudiante:</span>
    <select id="sel-hijo">${hijos.map((h) => `<option value="${h.id}" ${h.id === ctx.selectedChildId ? 'selected' : ''}>${esc(h.nombre)} ${esc(h.apellido)}</option>`).join('')}</select>
  </div>`;
  const selEl = actions.querySelector('#sel-hijo');
  if (!ctx.selectedChildId || !hijos.some((h) => h.id === ctx.selectedChildId)) ctx.selectedChildId = Number(selEl.value);
  else selEl.value = ctx.selectedChildId;
  selEl.addEventListener('change', () => { ctx.selectedChildId = Number(selEl.value); renderPorEstudiante(ctx.selectedChildId); });
  await renderPorEstudiante(ctx.selectedChildId);
}
