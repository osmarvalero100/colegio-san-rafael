// Pantalla Profesores — listado, ficha y asignación de materias (ADMIN/SECRETARIA).
import { api } from './api.js';
import { rol } from './auth.js';
import {
  esc, avatar, screenEls, toast, loading, openModal, closeModal, formValue, confirmModal, revisarFiltroGrado, paginacion, clampPage, searchSelect, searchValue,
} from './utils.js';

let estado = { search: '', materiaId: '', page: 1, limit: 10 };

export async function render() {
  const { crumbs, actions, body } = screenEls('profesores');
  actions.innerHTML = '<button class="btn primary" id="btn-nuevo-prof">+ Nuevo profesor</button>';
  actions.querySelector('#btn-nuevo-prof').addEventListener('click', () => abrirFormProfesor());
  loading(body);

  const listBody = document.createElement('div');
  listBody.className = 'panel';
  body.innerHTML = '';
  body.appendChild(listBody);

  async function cargar() {
    const mats = (await api('/materias', { query: { limit: 300 } })).data || [];
    const query = { page: estado.page, limit: estado.limit };
    if (estado.search) query.search = estado.search;
    if (estado.materiaId) query.materia_id = estado.materiaId;
    let res;
    try {
      res = await api('/profesores', { query });
    } catch (err) {
      listBody.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      return;
    }
    const profes = res.data || [];
    const total = res.pagination?.total ?? profes.length;
    estado.page = clampPage(estado.page, total, estado.limit);
    crumbs.textContent = `${total} docentes`;
    const mSel = mats.find((m) => String(m.id) === estado.materiaId);
    const filas = profes.map(filaProfesor).join('') ||
      '<tr><td colspan="5"><div class="empty">Sin profesores registrados.</div></td></tr>';
    listBody.innerHTML = `
      <div class="filters filters-grado" id="filtros-profesores">
        <div class="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="pr-buscar" placeholder="Buscar por nombre o email…" value="${esc(estado.search)}">
        </div>
        <div class="grado-wrap">
          <div class="grado-chips">
            <span class="chip ${!estado.materiaId ? 'active' : ''}" data-materia="">Todas</span>
            ${mats.map((m) => `<span class="chip ${estado.materiaId === String(m.id) ? 'active' : ''}" data-materia="${m.id}">${esc(m.nombre)}</span>`).join('')}
          </div>
          <div class="grado-select" id="pr-materia-sel">
            <button type="button" class="grado-select-btn" id="pr-materia-btn">
              <span>${mSel ? esc(mSel.nombre) : 'Todas las materias'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="grado-select-pop">
              <input class="grado-select-search" id="pr-materia-search" placeholder="Buscar materia…">
              <div class="grado-select-list" id="pr-materia-list"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel-body" style="padding-top:0;">
        <table>
          <thead><tr><th>Docente</th><th>Especialidad</th><th>Contacto</th><th>Materias</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div id="pag-profesores"></div>`;

    listBody.querySelectorAll('.chip[data-materia]').forEach((c) => c.addEventListener('click', () => {
      estado.materiaId = c.dataset.materia === '' ? '' : c.dataset.materia;
      estado.page = 1;
      cargar();
    }));

    const mSelBox = listBody.querySelector('#pr-materia-sel');
    const mBtn = listBody.querySelector('#pr-materia-btn');
    const mSearch = listBody.querySelector('#pr-materia-search');
    const mList = listBody.querySelector('#pr-materia-list');
    const mBtnLabel = mBtn.querySelector('span');
    const buildList = (filtro = '') => {
      const f = filtro.trim().toLowerCase();
      const opts = [['', 'Todas las materias']]
        .concat(mats.map((m) => [String(m.id), m.nombre]))
        .filter(([, label]) => !f || label.toLowerCase().includes(f));
      mList.innerHTML = opts.map(([id, label]) =>
        `<div class="grado-opt ${(id === '' ? !estado.materiaId : estado.materiaId === id) ? 'active' : ''}" data-materia="${id}">${esc(label)}</div>`).join('') ||
        '<div class="grado-opt empty">Sin resultados</div>';
    };
    buildList();
    mBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !mSelBox.classList.contains('open');
      mSelBox.classList.toggle('open', abrir);
      if (abrir) { mSearch.value = ''; buildList(); mSearch.focus(); }
    });
    mSearch.addEventListener('input', () => buildList(mSearch.value));
    mList.addEventListener('click', (e) => {
      const opt = e.target.closest('.grado-opt[data-materia]');
      if (!opt) return;
      estado.materiaId = opt.dataset.materia === '' ? '' : opt.dataset.materia;
      estado.page = 1;
      const m = mats.find((x) => String(x.id) === estado.materiaId);
      mBtnLabel.textContent = m ? m.nombre : 'Todas las materias';
      mSelBox.classList.remove('open');
      cargar();
    });

    listBody.querySelector('#pr-buscar').addEventListener('input', (e) => {
      estado.search = e.target.value;
      estado.page = 1;
      clearTimeout(estado._t);
      estado._t = setTimeout(cargar, 300);
    });

    paginacion(listBody.querySelector('#pag-profesores'), {
      page: estado.page, limit: estado.limit, total,
      onPage: (p, l) => { estado.page = p; estado.limit = l; cargar(); },
    });

    revisarFiltroGrado();

    listBody.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => abrirDetalle(Number(b.dataset.ver))));
    listBody.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrirFormProfesor(Number(b.dataset.editar))));
    if (rol() === 'ADMIN') {
      listBody.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', () => eliminarProfesor(Number(b.dataset.eliminar))));
    }
  }

  await cargar();
}

function filaProfesor(p) {
  const admin = rol() === 'ADMIN';
  return `<tr>
    <td class="row-flex">${avatar(p.nombre, p.apellido)}<div><div class="cell-name">${esc(p.nombre)} ${esc(p.apellido)}</div><div class="cell-sub id-mono">#${p.id}</div></div></td>
    <td data-label="Especialidad">${esc(p.especialidad)}</td>
    <td data-label="Contacto"><div class="cell-sub">${esc(p.email || '—')}</div><div class="cell-sub mono">${esc(p.telefono || '')}</div></td>
    <td data-label="Materias">${Number(p.materias_asignadas) > 0 ? `<span class="badge blue"><span class="d"></span>${p.materias_asignadas} materias</span>` : '<span class="cell-sub">Sin asignar</span>'}</td>
    <td data-label=""><div style="display:flex;gap:6px;justify-content:flex-end;">
      <button class="btn mini" data-ver="${p.id}">Ver</button>
      <button class="btn mini" data-editar="${p.id}">Editar</button>
      ${admin ? `<button class="btn mini danger" data-eliminar="${p.id}">✕</button>` : ''}
    </div></td>
  </tr>`;
}

async function abrirDetalle(id) {
  const p = await api(`/profesores/${id}`);
  const materias = (p.materias || []).map((m) =>
    `<span class="chip active">${esc(m.nombre)}</span>`).join('') || '<span class="cell-sub">Sin materias asignadas</span>';
  const body = openModal(`Profesor · ${p.nombre} ${p.apellido}`, `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px;">
      ${avatar(p.nombre, p.apellido)}
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--ink);">${esc(p.nombre)} ${esc(p.apellido)}</div>
        <div class="cell-sub">${esc(p.especialidad)} · #${p.id}</div>
      </div>
    </div>
    <div class="form-grid" style="grid-template-columns:1fr 1fr;">
      <div class="field"><label>Email</label><input disabled value="${esc(p.email || '')}"></div>
      <div class="field"><label>Teléfono</label><input disabled value="${esc(p.telefono || '')}"></div>
    </div>
    <div style="margin-top:14px;">
      <div style="font-size:12px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Materias asignadas</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${materias}</div>
      <div style="margin-top:14px;">
        <button class="btn primary" id="d-asignar" style="width:100%;">Asignar materias</button>
      </div>
    </div>`);
  body.querySelector('#d-asignar')?.addEventListener('click', () => { closeModal(); abrirAsignarMaterias(id); });
}

async function abrirFormProfesor(id) {
  const esEdicion = Boolean(id);
  const p = esEdicion ? await api(`/profesores/${id}`) : null;
  const esp = (await api('/especialidades', { query: { limit: 200 } })).data || [];
  const body = openModal(esEdicion ? 'Editar profesor' : 'Nuevo profesor', `
    <div class="form-grid">
      <div class="field"><label>Nombres *</label><input id="pr-nombre" value="${esc(p?.nombre || '')}"></div>
      <div class="field"><label>Apellidos *</label><input id="pr-apellido" value="${esc(p?.apellido || '')}"></div>
      <div class="field full"><label>Especialidad *</label><div id="pr-especialidad"></div></div>
      <div class="field"><label>Email</label><input id="pr-email" type="email" value="${esc(p?.email || '')}"></div>
      <div class="field"><label>Teléfono</label><input id="pr-telefono" value="${esc(p?.telefono || '')}"></div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>${esEdicion ? 'Guardar cambios' : 'Crear profesor'}</button>
    </div>`);
  searchSelect({
    el: body.querySelector('#pr-especialidad'),
    options: esp.map((e) => [e.id, e.nombre]),
    initial: p?.especialidad_id || '',
    placeholder: 'Seleccionar especialidad…', searchPlaceholder: 'Buscar especialidad…',
  });
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {
      nombre: formValue('pr-nombre'),
      apellido: formValue('pr-apellido'),
      especialidad_id: Number(searchValue('pr-especialidad')),
      email: formValue('pr-email') || null,
      telefono: formValue('pr-telefono') || null,
    };
    if (!data.nombre || !data.apellido || !data.especialidad_id) { toast('Completa nombres, apellidos y especialidad', 'error'); return; }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      if (esEdicion) {
        await api(`/profesores/${id}`, { method: 'PUT', body: data });
        toast('Profesor actualizado');
      } else {
        await api('/profesores', { method: 'POST', body: data });
        toast('Profesor creado');
      }
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

async function abrirAsignarMaterias(id) {
  const p = await api(`/profesores/${id}`);
  const materias = (await api('/materias', { query: { limit: 300 } })).data || [];
  const actuales = new Set((p.materias || []).map((m) => m.id));
  const body = openModal(`Asignar materias · ${p.nombre} ${p.apellido}`, `
    <div class="field"><label>Selecciona las materias que dicta el docente</label>
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;">
        ${materias.map((m) => `
          <label style="display:flex;gap:10px;align-items:center;font-size:13px;cursor:pointer;">
            <input type="checkbox" value="${m.id}" ${actuales.has(m.id) ? 'checked' : ''} style="accent-color:var(--primary);">
            <span>${esc(m.nombre)}</span><span class="cell-sub mono">${esc(m.codigo || '')}</span>
          </label>`).join('') || '<span class="cell-sub">No hay materias creadas.</span>'}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Guardar asignación</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const materia_ids = [...body.querySelectorAll('input[type="checkbox"]:checked')].map((c) => Number(c.value));
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await api(`/profesores/${id}/materias`, { method: 'PUT', body: { materia_ids } });
      toast('Asignación guardada');
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

function eliminarProfesor(id) {
  confirmModal('Eliminar profesor', '¿Seguro que deseas eliminar este profesor?', async () => {
    await api(`/profesores/${id}`, { method: 'DELETE' });
    toast('Profesor eliminado');
    render();
  }, 'Eliminar');
}
