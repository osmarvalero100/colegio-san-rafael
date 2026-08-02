// Pantalla Matrículas — ADMIN/SECRETARIA.
import { api } from './api.js';
import { rol } from './auth.js';
import { grados, anios } from './context.js';
import {
  esc, badgeEstado, screenEls, openModal, closeModal, formValue, toast,
  setOpts, loading, todayISO,
} from './utils.js';

let estado = '';

export async function render() {
  const { crumbs, actions, body } = screenEls('matriculas');
  crumbs.textContent = `Año lectivo ${new Date().getFullYear()}`;
  actions.innerHTML = '<button class="btn primary" id="btn-nueva-matricula">+ Nueva matrícula</button>';
  actions.querySelector('#btn-nueva-matricula').addEventListener('click', abrirFormMatricula);
  loading(body);
  try {
    const query = { limit: 300 };
    if (estado) query.estado = estado;
    const { data: mats } = await api('/matriculas', { query });
    crumbs.textContent = `${mats.length} matrículas · Año lectivo ${new Date().getFullYear()}`;
    const chips = ['', 'Activa', 'Pendiente', 'Retirada'].map((e) =>
      `<span class="chip ${estado === e ? 'active' : ''}" data-estado="${e}">${e === '' ? 'Todas' : e}</span>`).join('');
    body.innerHTML = `<div class="panel">
      <div class="filters">${chips}</div>
      <div class="panel-body">
        <table>
          <thead><tr><th>Estudiante</th><th>Grado</th><th>Año</th><th>Fecha matrícula</th><th>Estado</th><th></th></tr></thead>
          <tbody>${mats.map(filaMatricula).join('') || '<tr><td colspan="6"><div class="empty">Sin matrículas.</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
    body.querySelectorAll('.chip[data-estado]').forEach((c) => c.addEventListener('click', () => {
      estado = c.dataset.estado;
      render();
    }));
    body.querySelectorAll('select[data-cambio-estado]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api(`/matriculas/${sel.dataset.matricula}`, { method: 'PATCH', body: { estado: sel.value } });
          toast('Estado de matrícula actualizado');
          render();
        } catch (err) {
          toast(err.message, 'error');
          sel.value = sel.dataset.anterior;
        }
      });
    });
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function filaMatricula(m) {
  const admin = rol() === 'ADMIN';
  const opciones = { Pendiente: ['Activa', ...(admin ? ['Retirada'] : [])], Activa: ['Retirada'], Retirada: [] }[m.estado] || [];
  const select = opciones.length
    ? `<select data-cambio-estado data-matricula="${m.id}" data-anterior="${m.estado}" style="font-family:Inter;font-size:12px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;color:var(--ink);background:#fff;outline:none;">
        ${[m.estado, ...opciones].map((o) => `<option value="${o}">${o}</option>`).join('')}
      </select>`
    : badgeEstado(m.estado);
  return `<tr>
    <td class="row-flex">${avatarInitials(m)}<div><div class="cell-name">${esc(m.estudiante_nombre)} ${esc(m.estudiante_apellido)}</div><div class="cell-sub id-mono">#${m.id}</div></div></td>
    <td data-label="Grado">${esc(m.grado)} ${esc(m.seccion || '')}</td>
    <td class="mono" data-label="Año">${esc(m.anio)}</td>
    <td class="mono" data-label="Fecha matrícula">${esc((m.fecha_matricula || '').slice(0, 10))}</td>
    <td data-label="Estado">${select}</td>
    <td data-label=""></td>
  </tr>`;
}

function avatarInitials(m) {
  const a = (m.estudiante_nombre || '?').charAt(0) + (m.estudiante_apellido || '?').charAt(0);
  return `<div class="avatar">${esc(a.toUpperCase())}</div>`;
}

async function abrirFormMatricula() {
  const gs = await grados();
  const an = await anios();
  const estudiantes = (await api('/estudiantes', { query: { limit: 500 } })).data || [];
  const body = openModal('Nueva matrícula', `
    <div class="form-grid">
      <div class="field full"><label>Estudiante *</label>
        <select id="m-estudiante">${estudiantes.map((e) => `<option value="${e.id}">${esc(e.nombre)} ${esc(e.apellido)}${e.grado_nombre ? ` · ${esc(e.grado_nombre)}${esc(e.seccion || '')}` : ''}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Grado *</label>
        <select id="m-grado">${gs.map((g) => `<option value="${g.id}">${esc(g.grado)} ${esc(g.seccion || '')}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Año lectivo *</label>
        <select id="m-anio">${an.map((a) => `<option value="${a.id}" ${a.estado === 'Activo' ? 'selected' : ''}>${esc(a.anio)}${a.estado === 'Activo' ? ' (activo)' : ''}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Fecha de matrícula</label><input id="m-fecha" type="date" value="${todayISO()}"></div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Crear matrícula</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {
      estudiante_id: Number(formValue('m-estudiante')),
      grado_id: Number(formValue('m-grado')),
      anio_lectivo_id: Number(formValue('m-anio')),
      fecha_matricula: formValue('m-fecha') || null,
    };
    if (!data.estudiante_id || !data.grado_id || !data.anio_lectivo_id) { toast('Completa los campos obligatorios', 'error'); return; }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await api('/matriculas', { method: 'POST', body: data });
      toast('Matrícula creada');
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}
