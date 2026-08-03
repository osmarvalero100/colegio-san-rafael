// Pantalla Matrículas — ADMIN/SECRETARIA.
import { api } from './api.js';
import { rol } from './auth.js';
import { grados, anios } from './context.js';
import {
  esc, badgeEstado, screenEls, openModal, closeModal, formValue, toast,
  setOpts, loading, todayISO, revisarFiltroGrado,
} from './utils.js';

let estado = { filtroEstado: '', gradoId: '', search: '' };

export async function render() {
  const { crumbs, actions, body } = screenEls('matriculas');
  crumbs.textContent = `Año lectivo ${new Date().getFullYear()}`;
  actions.innerHTML = '<button class="btn primary" id="btn-nueva-matricula">+ Nueva matrícula</button>';
  actions.querySelector('#btn-nueva-matricula').addEventListener('click', abrirFormMatricula);
  loading(body);

  const listBody = document.createElement('div');
  listBody.className = 'panel';
  body.innerHTML = '';
  body.appendChild(listBody);

  async function cargar() {
    const gs = await grados();
    const query = { limit: 300 };
    if (estado.filtroEstado) query.estado = estado.filtroEstado;
    if (estado.gradoId) query.grado_id = estado.gradoId;
    if (estado.search) query.search = estado.search;
    let mats = [];
    try {
      mats = (await api('/matriculas', { query })).data || [];
    } catch (err) {
      listBody.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      return;
    }
    crumbs.textContent = `${mats.length} matrículas · Año lectivo ${new Date().getFullYear()}`;
    const chipsEstado = ['', 'Activa', 'Pendiente', 'Retirada'].map((e) =>
      `<span class="chip ${estado.filtroEstado === e ? 'active' : ''}" data-estado="${e}">${e === '' ? 'Todas' : e}</span>`).join('');
    const gSel = gs.find((g) => String(g.id) === estado.gradoId);
    listBody.innerHTML = `
      <div class="filters" id="filtros-matriculas-estado">${chipsEstado}</div>
      <div class="filters filters-grado" id="filtros-matriculas">
        <div class="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="m-buscar" placeholder="Buscar por nombre…" value="${esc(estado.search)}">
        </div>
        <div class="grado-wrap">
          <div class="grado-chips">
            <span class="chip ${!estado.gradoId ? 'active' : ''}" data-grado="">Todos</span>
            ${gs.map((g) => `<span class="chip ${estado.gradoId === String(g.id) ? 'active' : ''}" data-grado="${g.id}">${esc(g.grado)}${esc(g.seccion || '')}</span>`).join('')}
          </div>
          <div class="grado-select" id="m-grado-sel">
            <button type="button" class="grado-select-btn" id="m-grado-btn">
              <span>${gSel ? `${esc(gSel.grado)}${esc(gSel.seccion ? ' ' + gSel.seccion : '')}` : 'Todos los grados'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="grado-select-pop">
              <input class="grado-select-search" id="m-grado-search" placeholder="Buscar grado…">
              <div class="grado-select-list" id="m-grado-list"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel-body">
        <table>
          <thead><tr><th>Estudiante</th><th>Grado</th><th>Año</th><th>Fecha matrícula</th><th>Estado</th><th></th></tr></thead>
          <tbody>${mats.map(filaMatricula).join('') || '<tr><td colspan="6"><div class="empty">Sin matrículas.</div></td></tr>'}</tbody>
        </table>
      </div>`;

    listBody.querySelectorAll('.chip[data-estado]').forEach((c) => c.addEventListener('click', () => {
      estado.filtroEstado = c.dataset.estado;
      cargar();
    }));

    listBody.querySelectorAll('.chip[data-grado]').forEach((c) => c.addEventListener('click', () => {
      estado.gradoId = c.dataset.grado === '' ? '' : c.dataset.grado;
      cargar();
    }));

    // select buscable de grados
    const gSelBox = listBody.querySelector('#m-grado-sel');
    const gBtn = listBody.querySelector('#m-grado-btn');
    const gSearch = listBody.querySelector('#m-grado-search');
    const gList = listBody.querySelector('#m-grado-list');
    const buildGradoList = (filtro = '') => {
      const f = filtro.trim().toLowerCase();
      const opts = [['', 'Todos los grados']]
        .concat(gs.map((g) => [String(g.id), `${g.grado}${g.seccion ? ' ' + g.seccion : ''}`]))
        .filter(([, label]) => !f || label.toLowerCase().includes(f));
      gList.innerHTML = opts.map(([id, label]) =>
        `<div class="grado-opt ${(id === '' ? !estado.gradoId : estado.gradoId === id) ? 'active' : ''}" data-grado="${id}">${esc(label)}</div>`).join('') ||
        '<div class="grado-opt empty">Sin resultados</div>';
    };
    buildGradoList();
    gBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !gSelBox.classList.contains('open');
      gSelBox.classList.toggle('open', abrir);
      if (abrir) { gSearch.value = ''; buildGradoList(); gSearch.focus(); }
    });
    gSearch.addEventListener('input', () => buildGradoList(gSearch.value));
    gList.addEventListener('click', (e) => {
      const opt = e.target.closest('.grado-opt[data-grado]');
      if (!opt) return;
      estado.gradoId = opt.dataset.grado === '' ? '' : opt.dataset.grado;
      gSelBox.classList.remove('open');
      cargar();
    });

    listBody.querySelector('#m-buscar').addEventListener('input', (e) => {
      estado.search = e.target.value;
      clearTimeout(estado._t);
      estado._t = setTimeout(cargar, 300);
    });

    revisarFiltroGrado();

    listBody.querySelectorAll('select[data-cambio-estado]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api(`/matriculas/${sel.dataset.matricula}/estado`, { method: 'PATCH', body: { estado: sel.value } });
          toast('Estado de matrícula actualizado');
          cargar();
        } catch (err) {
          toast(err.message, 'error');
          sel.value = sel.dataset.anterior;
        }
      });
    });
  }

  await cargar();
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
  const tutores = (await api('/tutores', { query: { limit: 200 } })).data || [];
  const estudiantes = (await api('/estudiantes', { query: { limit: 500 } })).data || [];
  let tipo = 'existente';
  let estudianteSel = null;
  let tutorSel = null;

  const body = openModal('Nueva matrícula', `
    <div class="form-grid">
      <div class="field full"><label>Estudiante</label>
        <div class="mini-tabs">
          <span class="mini-tab active" data-tipo="existente">Existente</span>
          <span class="mini-tab" data-tipo="nuevo">Nuevo estudiante</span>
        </div>
      </div>

      <div class="field full" id="m-ee">
        <label>Estudiante *</label>
        <div class="grado-select always" id="m-estudiante-sel">
          <button type="button" class="grado-select-btn" id="m-estudiante-btn">
            <span id="m-estudiante-label">Buscar estudiante…</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="grado-select-pop">
            <input class="grado-select-search" id="m-estudiante-search" placeholder="Buscar por nombre o apellido…">
            <div class="grado-select-list" id="m-estudiante-list"></div>
          </div>
        </div>
      </div>

      <div class="field full" id="m-en" style="display:none">
        <div class="form-grid">
          <div class="field"><label>Nombre *</label><input id="m-nombre"></div>
          <div class="field"><label>Apellido *</label><input id="m-apellido"></div>
          <div class="field"><label>Fecha de nacimiento</label><input id="m-nac" type="date"></div>
          <div class="field"><label>Teléfono</label><input id="m-tel"></div>
          <div class="field full"><label>Email</label><input id="m-mail"></div>
          <div class="field full"><label>Dirección</label><input id="m-dir"></div>
          <div class="field full"><label>Tutor</label>
            <div class="grado-select always" id="m-tutor-sel">
              <button type="button" class="grado-select-btn" id="m-tutor-btn">
                <span id="m-tutor-label">— Nuevo tutor —</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="grado-select-pop">
                <input class="grado-select-search" id="m-tutor-search" placeholder="Buscar tutor…">
                <div class="grado-select-list" id="m-tutor-list"></div>
              </div>
            </div>
          </div>
          <div class="field"><label>Tutor nuevo — nombre *</label><input id="m-tutor-nombre"></div>
          <div class="field"><label>Tutor nuevo — teléfono *</label><input id="m-tutor-tel"></div>
        </div>
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

  const ee = body.querySelector('#m-ee');
  const en = body.querySelector('#m-en');
  const cambiarTipo = (t) => {
    tipo = t;
    body.querySelectorAll('.mini-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tipo === t));
    ee.style.display = t === 'existente' ? 'flex' : 'none';
    en.style.display = t === 'nuevo' ? 'block' : 'none';
  };
  body.querySelectorAll('.mini-tab').forEach((tab) => tab.addEventListener('click', () => cambiarTipo(tab.dataset.tipo)));

  // Select buscable de estudiantes existentes
  const sel = body.querySelector('#m-estudiante-sel');
  const btn = body.querySelector('#m-estudiante-btn');
  const sSearch = body.querySelector('#m-estudiante-search');
  const sList = body.querySelector('#m-estudiante-list');
  const sLabel = body.querySelector('#m-estudiante-label');
  const buildEstList = (filtro = '') => {
    const f = filtro.trim().toLowerCase();
    const opts = estudiantes.filter((e) => !f || `${e.nombre} ${e.apellido} ${e.grado_nombre || ''} ${e.seccion || ''}`.toLowerCase().includes(f));
    sList.innerHTML = opts.map((e) => `
      <div class="grado-opt ${estudianteSel && estudianteSel.id === e.id ? 'active' : ''}" data-id="${e.id}">
        ${esc(e.nombre)} ${esc(e.apellido)}${e.grado_nombre ? `<span class="cell-sub" style="color:var(--ink-faint);font-size:11px;"> · ${esc(e.grado_nombre)}${esc(e.seccion || '')}</span>` : ''}
      </div>`).join('') || '<div class="grado-opt empty">Sin resultados</div>';
  };
  buildEstList();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = !sel.classList.contains('open');
    sel.classList.toggle('open', abrir);
    if (abrir) { sSearch.value = ''; buildEstList(); sSearch.focus(); }
  });
  sSearch.addEventListener('input', () => buildEstList(sSearch.value));
  sList.addEventListener('click', (e) => {
    const opt = e.target.closest('.grado-opt[data-id]');
    if (!opt) return;
    estudianteSel = estudiantes.find((es) => String(es.id) === opt.dataset.id);
    sLabel.textContent = estudianteSel ? `${estudianteSel.nombre} ${estudianteSel.apellido}` : 'Buscar estudiante…';
    sel.classList.remove('open');
    buildEstList();
  });

  // Select buscable de tutores
  const tutorSelBox = body.querySelector('#m-tutor-sel');
  const tutorBtn = body.querySelector('#m-tutor-btn');
  const tutorSearch = body.querySelector('#m-tutor-search');
  const tutorList = body.querySelector('#m-tutor-list');
  const tutorLabel = body.querySelector('#m-tutor-label');
  const showNew = () => {
    const nuevo = !tutorSel;
    body.querySelector('#m-tutor-nombre').closest('.field').style.display = nuevo ? 'flex' : 'none';
    body.querySelector('#m-tutor-tel').closest('.field').style.display = nuevo ? 'flex' : 'none';
  };
  const buildTutorList = (filtro = '') => {
    const f = filtro.trim().toLowerCase();
    const opts = [['', '— Nuevo tutor —']]
      .concat(tutores.map((t) => [String(t.id), `${t.nombre}${t.telefono ? ' · ' + t.telefono : ''}`]))
      .filter(([, label]) => !f || label.toLowerCase().includes(f));
    tutorList.innerHTML = opts.map(([id, label]) =>
      `<div class="grado-opt ${(id === '' ? !tutorSel : tutorSel && String(tutorSel.id) === id) ? 'active' : ''}" data-tutor="${id}">${esc(label)}</div>`).join('') ||
      '<div class="grado-opt empty">Sin resultados</div>';
  };
  buildTutorList();
  showNew();
  tutorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = !tutorSelBox.classList.contains('open');
    tutorSelBox.classList.toggle('open', abrir);
    if (abrir) { tutorSearch.value = ''; buildTutorList(); tutorSearch.focus(); }
  });
  tutorSearch.addEventListener('input', () => buildTutorList(tutorSearch.value));
  tutorList.addEventListener('click', (e) => {
    const opt = e.target.closest('.grado-opt[data-tutor]');
    if (!opt) return;
    tutorSel = opt.dataset.tutor === '' ? null : tutores.find((t) => String(t.id) === opt.dataset.tutor);
    tutorLabel.textContent = tutorSel ? tutorSel.nombre : '— Nuevo tutor —';
    tutorSelBox.classList.remove('open');
    buildTutorList();
    showNew();
  });

  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const grado_id = Number(formValue('m-grado'));
    const anio_lectivo_id = Number(formValue('m-anio'));
    if (!grado_id || !anio_lectivo_id) { toast('Completa los campos obligatorios', 'error'); return; }
    let estudiante_id;
    if (tipo === 'existente') {
      if (!estudianteSel) { toast('Selecciona un estudiante', 'error'); return; }
      estudiante_id = estudianteSel.id;
    } else {
      const data = {
        nombre: formValue('m-nombre'), apellido: formValue('m-apellido'),
        fecha_nacimiento: formValue('m-nac') || null, telefono: formValue('m-tel') || null,
        email: formValue('m-mail') || null, direccion: formValue('m-dir') || null,
      };
      if (!data.nombre || !data.apellido) { toast('Nombre y apellido son obligatorios', 'error'); return; }
      const tutorId = tutorSel ? tutorSel.id : null;
      if (tutorId) data.tutor_id = tutorId;
      else data.tutor = { nombre: formValue('m-tutor-nombre'), telefono: formValue('m-tutor-tel') };
      const btn2 = body.querySelector('[data-save]');
      btn2.disabled = true;
      try {
        const creado = await api('/estudiantes', { method: 'POST', body: data });
        estudiante_id = creado.id;
      } catch (err) {
        toast(err.message, 'error');
        btn2.disabled = false;
        return;
      }
    }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await api('/matriculas', { method: 'POST', body: { estudiante_id, grado_id, anio_lectivo_id, fecha_matricula: formValue('m-fecha') || null } });
      toast('Matrícula creada');
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}
