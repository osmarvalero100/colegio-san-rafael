// Pantalla Estudiantes — CRUD para ADMIN/SECRETARIA, "Mis estudiantes"
// para PROFESOR, perfil propio para ESTUDIANTE e hijos para TUTOR.
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos, grados } from './context.js';
import {
  esc, money, avatar, initials, gradePill, badgeEstado, screenEls, openModal, closeModal,
  formValue, toast, confirmModal, setOpts, loading, todayISO, revisarFiltroGrado, paginacion, clampPage, searchSelect, searchValue,
} from './utils.js';

let estado = { search: '', gradoId: '', selectedId: null, page: 1, limit: 10 };

export async function render() {
  const r = rol();
  if (r === 'ADMIN' || r === 'SECRETARIA') return renderGestion();
  if (r === 'PROFESOR') return renderMisEstudiantes();
  if (r === 'ESTUDIANTE') return renderPerfil();
  if (r === 'TUTOR') return renderHijos();
}

// ---------- ADMIN / SECRETARIA ----------
async function renderGestion() {
  const { crumbs, actions, body } = screenEls('estudiantes');
  crumbs.textContent = 'Gestión completa · listado y ficha';
  actions.innerHTML = '<button class="btn primary" id="btn-nuevo-estudiante">+ Matricular estudiante</button>';
  actions.querySelector('#btn-nuevo-estudiante').addEventListener('click', () => abrirFormEstudiante());

  const listBody = document.createElement('div');
  listBody.className = 'panel';
  body.innerHTML = '';
  body.appendChild(listBody);

  async function cargar() {
    const query = { page: estado.page, limit: estado.limit };
    if (estado.search) query.search = estado.search;
    if (estado.gradoId) query.grado_id = estado.gradoId;
    let res;
    try {
      res = await api('/estudiantes', { query });
    } catch (err) {
      listBody.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      return;
    }
    const est = res.data || [];
    const total = res.pagination?.total ?? est.length;
    estado.page = clampPage(estado.page, total, estado.limit);
    crumbs.textContent = `${total} estudiantes`;
    const gs = await grados();
    const gSel = gs.find((g) => String(g.id) === estado.gradoId);
    listBody.innerHTML = `
      <div class="filters filters-grado" id="filtros-estudiantes">
        <div class="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="f-buscar" placeholder="Buscar por nombre…" value="${esc(estado.search)}">
        </div>
        <div class="grado-wrap">
          <div class="grado-chips" id="grado-chips">
            <span class="chip ${!estado.gradoId ? 'active' : ''}" data-grado="">Todos</span>
            ${gs.map((g) => `<span class="chip ${estado.gradoId === String(g.id) ? 'active' : ''}" data-grado="${g.id}">${esc(g.grado)}${esc(g.seccion || '')}</span>`).join('')}
          </div>
          <div class="grado-select" id="grado-select">
            <button type="button" class="grado-select-btn" id="grado-select-btn">
              <span>${gSel ? `${esc(gSel.grado)}${esc(gSel.seccion ? ' ' + gSel.seccion : '')}` : 'Todos los grados'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="grado-select-pop" id="grado-select-pop">
              <input class="grado-select-search" id="grado-select-search" placeholder="Buscar grado…">
              <div class="grado-select-list" id="grado-select-list"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel-body" style="padding-top:10px;">
        <table>
          <thead><tr><th>Estudiante</th><th>Grado</th><th>Tutor</th><th>Contacto</th><th>Estado</th><th></th></tr></thead>
          <tbody id="tbl-estudiantes">${est.map(filaEstudiante).join('') || filaVacia()}</tbody>
        </table>
      </div>
      <div id="pag-estudiantes"></div>`;

    // chips de grado
    listBody.querySelectorAll('.chip[data-grado]').forEach((c) => c.addEventListener('click', () => {
      estado.gradoId = c.dataset.grado === '' ? '' : c.dataset.grado;
      estado.page = 1;
      cargar();
    }));

    // select buscable de grados
    const gradoSelect = listBody.querySelector('#grado-select');
    const gradoBtn = listBody.querySelector('#grado-select-btn');
    const gradoSearch = listBody.querySelector('#grado-select-search');
    const gradoList = listBody.querySelector('#grado-select-list');
    const buildGradoList = (filtro = '') => {
      const f = filtro.trim().toLowerCase();
      const opts = [['', 'Todos los grados']]
        .concat(gs.map((g) => [String(g.id), `${g.grado}${g.seccion ? ' ' + g.seccion : ''}`]))
        .filter(([, label]) => !f || label.toLowerCase().includes(f));
      gradoList.innerHTML = opts.map(([id, label]) =>
        `<div class="grado-opt ${(id === '' ? !estado.gradoId : estado.gradoId === id) ? 'active' : ''}" data-grado="${id}">${esc(label)}</div>`).join('') ||
        '<div class="grado-opt empty">Sin resultados</div>';
    };
    buildGradoList();
    gradoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !gradoSelect.classList.contains('open');
      gradoSelect.classList.toggle('open', abrir);
      if (abrir) { gradoSearch.value = ''; buildGradoList(); gradoSearch.focus(); }
    });
    gradoSearch.addEventListener('input', () => buildGradoList(gradoSearch.value));
    gradoList.addEventListener('click', (e) => {
      const opt = e.target.closest('.grado-opt[data-grado]');
      if (!opt) return;
      estado.gradoId = opt.dataset.grado === '' ? '' : opt.dataset.grado;
      estado.page = 1;
      gradoSelect.classList.remove('open');
      cargar();
    });

    paginacion(listBody.querySelector('#pag-estudiantes'), {
      page: estado.page, limit: estado.limit, total,
      onPage: (p, l) => { estado.page = p; estado.limit = l; cargar(); },
    });

    revisarFiltroGrado();
    listBody.querySelector('#f-buscar').addEventListener('input', (e) => {
      estado.search = e.target.value;
      estado.page = 1;
      clearTimeout(estado._t);
      estado._t = setTimeout(cargar, 300);
    });

    listBody.querySelectorAll('#tbl-estudiantes tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.icon-btn')) return;
        estado.selectedId = Number(tr.dataset.id);
        renderFicha();
      });
    });
    listBody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', async () => {
      const est = await api(`/estudiantes/${b.dataset.edit}`);
      abrirFormEstudiante(est);
    }));
    listBody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      confirmModal('Eliminar estudiante', 'Se eliminará el estudiante y sus registros asociados. Esta acción no se puede deshacer.',
        async () => { await api(`/estudiantes/${b.dataset.del}`, { method: 'DELETE' }); toast('Estudiante eliminado'); estado.selectedId = null; render(); }, 'Eliminar');
    }));
  }

  await cargar();
  if (!estado.selectedId && document.querySelector('#tbl-estudiantes tr[data-id]')) {
    estado.selectedId = Number(document.querySelector('#tbl-estudiantes tr[data-id]').dataset.id);
  }
  renderFicha();
}

function filaVacia() {
  return '<tr><td colspan="6"><div class="empty">Sin resultados.</div></td></tr>';
}

function filaEstudiante(e) {
  const grado = `${e.grado_nombre || ''}${e.seccion ? ' ' + e.seccion : ''}`;
  return `<tr data-id="${e.id}">
    <td class="row-flex">${avatar(e.nombre, e.apellido)}<div><div class="cell-name">${esc(e.nombre)} ${esc(e.apellido)}</div><div class="cell-sub id-mono">#${e.id}</div></div></td>
    <td data-label="Grado">${esc(grado) || '—'}</td>
    <td data-label="Tutor">${esc(e.tutor_nombre || '—')}</td>
    <td class="mono" data-label="Contacto">${esc(e.telefono || '—')}</td>
    <td data-label="Estado">${badgeEstado(e.matricula_estado || 'Sin matrícula')}</td>
    <td data-label=""><div class="row-actions">
      <button class="icon-btn" title="Editar" data-edit="${e.id}">✎</button>
      ${rol() === 'ADMIN' ? `<button class="icon-btn danger" title="Eliminar" data-del="${e.id}">✕</button>` : ''}
    </div></td>
  </tr>`;
}

async function renderFicha() {
  const body = document.getElementById('b-estudiantes');
  let panel = body.querySelector('#ficha-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ficha-panel';
    body.appendChild(panel);
  }
  if (!estado.selectedId) { panel.innerHTML = ''; return; }
  panel.innerHTML = '<div class="empty"><span class="spin"></span></div>';
  try {
    const f = await api(`/estudiantes/${estado.selectedId}/ficha`);
    const mat = f.matricula || {};
    const grado = `${mat.grado || ''}${mat.seccion ? ' ' + mat.seccion : ''}${mat.nivel ? ' · ' + mat.nivel : ''}`;
    const bars = (f.promedios || []).map((m) => {
      const pct = Math.round((Number(m.promedio) / 5) * 100);
      const cls = Number(m.promedio) >= 3 ? 'var(--teal)' : 'var(--red)';
      return `<div class="bar-row"><span class="lbl">${esc(m.materia_nombre)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cls};"></div></div><span class="bar-val">${m.promedio}</span></div>`;
    }).join('') || '<div class="empty">Sin notas registradas.</div>';

    panel.innerHTML = `
      <div class="carnet">
        <div class="hole"></div>
        <div class="carnet-top">
          <div class="carnet-photo">${esc(initials(f.nombre, f.apellido))}</div>
          <div>
            <div class="carnet-name">${esc(f.nombre)} ${esc(f.apellido)}</div>
            <div class="carnet-grado">${esc(grado)}</div>
            <div class="carnet-id mono">EST-2026-${String(f.id).padStart(4, '0')}</div>
          </div>
        </div>
        <div class="carnet-barcode"></div>
        <div class="carnet-foot"><span>Vigencia ${new Date().getFullYear()}</span><span>Colegio San Rafael</span></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h3>Ficha</h3><div class="hint">${badgeEstado(mat.estado || 'Sin matrícula')}</div></div></div>
        <div class="panel-body">
          <div class="ficha-section" style="margin-top:14px;">
            <h4>Datos de contacto</h4>
            <div class="kv-list">
              <div class="kv"><span class="k">Tutor</span><span class="v">${esc(f.tutor_nombre || '—')}</span></div>
              <div class="kv"><span class="k">Teléfono tutor</span><span class="v mono">${esc(f.tutor_telefono || '—')}</span></div>
              <div class="kv"><span class="k">Teléfono estudiante</span><span class="v mono">${esc(f.telefono || '—')}</span></div>
              <div class="kv"><span class="k">Correo</span><span class="v mono">${esc(f.email || '—')}</span></div>
              <div class="kv"><span class="k">Dirección</span><span class="v">${esc(f.direccion || '—')}</span></div>
            </div>
          </div>
          <div class="ficha-section">
            <h4>Promedio por materia</h4>
            ${bars}
          </div>
        </div>
      </div>`;
  } catch (err) {
    panel.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

async function abrirFormEstudiante(est) {
  const esEdicion = !!est;
  const tutores = (await api('/tutores?limit=200')).data || [];
  const gs = await grados();
  const tutorInicial = esEdicion && est.tutor_id ? tutores.find((t) => t.id === est.tutor_id) || null : null;
  const body = openModal(esEdicion ? 'Editar estudiante' : 'Matricular estudiante', `
    <div class="form-grid">
      <div class="field"><label>Nombre *</label><input id="f-nombre" value="${esc(est?.nombre || '')}"></div>
      <div class="field"><label>Apellido *</label><input id="f-apellido" value="${esc(est?.apellido || '')}"></div>
      <div class="field"><label>Fecha de nacimiento</label><input id="f-nac" type="date" value="${esc(est?.fecha_nacimiento || '')}"></div>
      <div class="field"><label>Teléfono</label><input id="f-tel" value="${esc(est?.telefono || '')}"></div>
      <div class="field full"><label>Email</label><input id="f-mail" value="${esc(est?.email || '')}"></div>
      <div class="field full"><label>Dirección</label><input id="f-dir" value="${esc(est?.direccion || '')}"></div>
      <div class="field full"><label>Tutor</label>
        <div id="f-tutor-sel"></div>
      </div>
      <div class="field" id="f-nuevo-tutor">
        <label>Tutor nuevo — nombre *</label><input id="f-tutor-nombre">
      </div>
      <div class="field" id="f-nuevo-tutor-tel">
        <label>Tutor nuevo — teléfono *</label><input id="f-tutor-tel">
      </div>
      ${esEdicion ? '' : `
      <div class="field"><label>Grado (matrícula)</label>
        <div id="f-grado"></div>
      </div>
      <div class="field"><label>Fecha de matrícula</label><input id="f-matfecha" type="date" value="${todayISO()}"></div>`}
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>${esEdicion ? 'Guardar cambios' : 'Matricular'}</button>
    </div>`);

  let tutorSel = tutorInicial;
  const showNew = () => {
    body.querySelector('#f-nuevo-tutor').style.display = tutorSel ? 'none' : 'flex';
    body.querySelector('#f-nuevo-tutor-tel').style.display = tutorSel ? 'none' : 'flex';
  };
  showNew();
  searchSelect({
    el: body.querySelector('#f-tutor-sel'),
    options: tutores.map((t) => [t.id, `${t.nombre}${t.telefono ? ' · ' + t.telefono : ''}`]),
    placeholder: '— Nuevo tutor —', searchPlaceholder: 'Buscar tutor…', allowEmpty: true,
    initial: tutorInicial ? String(tutorInicial.id) : '',
    onSelect: (v) => { tutorSel = v ? tutores.find((t) => String(t.id) === String(v)) || null : null; showNew(); },
  });

  searchSelect({
    el: body.querySelector('#f-grado'),
    options: gs.map((g) => [g.id, `${g.grado}${g.seccion ? ' ' + g.seccion : ''}`]),
    placeholder: '— Sin matrícula —', searchPlaceholder: 'Buscar grado…', allowEmpty: true,
  });

  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const data = {
      nombre: formValue('f-nombre'), apellido: formValue('f-apellido'),
      fecha_nacimiento: formValue('f-nac') || null, telefono: formValue('f-tel') || null,
      email: formValue('f-mail') || null, direccion: formValue('f-dir') || null,
    };
    if (!data.nombre || !data.apellido) { toast('Nombre y apellido son obligatorios', 'error'); return; }
    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      let guardado;
      if (esEdicion) {
        data.tutor_id = tutorSel ? Number(tutorSel.id) : est.tutor_id;
        guardado = await api(`/estudiantes/${est.id}`, { method: 'PUT', body: data });
      } else {
        const tutorId = tutorSel ? Number(tutorSel.id) : null;
        if (!tutorId) {
          data.tutor = { nombre: formValue('f-tutor-nombre'), telefono: formValue('f-tutor-tel') };
        } else {
          data.tutor_id = tutorId;
        }
        guardado = await api('/estudiantes', { method: 'POST', body: data });
        const gradoId = searchValue('f-grado');
        if (gradoId) {
          await api('/matriculas', { method: 'POST', body: { estudiante_id: guardado.id, grado_id: Number(gradoId), fecha_matricula: formValue('f-matfecha') || null } });
        }
      }
      toast(esEdicion ? 'Estudiante actualizado' : 'Estudiante matriculado');
      closeModal();
      estado.selectedId = guardado.id;
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

// ---------- PROFESOR: mis estudiantes ----------
async function renderMisEstudiantes() {
  const { crumbs, actions, body } = screenEls('estudiantes');
  crumbs.textContent = 'Solo estudiantes de tus grados';
  actions.innerHTML = '';
  loading(body);
  try {
    const est = await api('/profesores/me/estudiantes');
    if (!est.length) {
      crumbs.textContent = '0 estudiantes en tus clases';
      body.innerHTML = '<div class="empty">Sin estudiantes en tus clases.</div>';
      return;
    }
    const grados = [...new Map(est.map((e) => [e.grado + (e.seccion || ''), e])).values()]
      .map((e) => ({ match: `${e.grado}${e.seccion || ''}`, label: `${e.grado}${e.seccion ? ' ' + e.seccion : ''}` }));
    const estado = { search: '', grado: '', page: 1, limit: 10 };

    const listBody = document.createElement('div');
    listBody.className = 'panel';
    body.innerHTML = '';
    body.appendChild(listBody);

    function renderTabla() {
      const s = estado.search.trim().toLowerCase();
      const filtrados = est.filter((e) => {
        if (estado.grado && `${e.grado}${e.seccion || ''}` !== estado.grado) return false;
        if (s && !`${e.nombre} ${e.apellido} ${e.grado}`.toLowerCase().includes(s)) return false;
        return true;
      });
      const total = filtrados.length;
      estado.page = clampPage(estado.page, total, estado.limit);
      const paginados = filtrados.slice((estado.page - 1) * estado.limit, estado.page * estado.limit);
      const gSel = grados.find((g) => g.match === estado.grado);
      listBody.innerHTML = `
        <div class="filters filters-grado" id="filtros-prof-est">
          <div class="search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input id="pe-buscar" placeholder="Buscar estudiante…" value="${esc(estado.search)}">
          </div>
          <div class="grado-wrap">
            <div class="grado-chips" id="pe-chips">
              <span class="chip ${!estado.grado ? 'active' : ''}" data-grado="">Todos</span>
              ${grados.map((g) => `<span class="chip ${estado.grado === g.match ? 'active' : ''}" data-grado="${esc(g.match)}">${esc(g.label)}</span>`).join('')}
            </div>
            <div class="grado-select" id="pe-select">
              <button type="button" class="grado-select-btn" id="pe-select-btn">
                <span>${gSel ? esc(gSel.label) : 'Todos los grados'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="grado-select-pop">
                <input class="grado-select-search" id="pe-select-search" placeholder="Buscar grado…">
                <div class="grado-select-list" id="pe-select-list"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="panel-body" style="padding-top:10px;">
          <table>
            <thead><tr><th>Estudiante</th><th>Grado</th><th>Matrícula</th><th>Contacto</th></tr></thead>
            <tbody>${paginados.map((e) => `<tr>
              <td class="row-flex">${avatar(e.nombre, e.apellido)}<div><div class="cell-name">${esc(e.nombre)} ${esc(e.apellido)}</div><div class="cell-sub id-mono">#${e.id}</div></div></td>
              <td data-label="Grado">${esc(e.grado)} ${esc(e.seccion || '')}</td>
              <td data-label="Matrícula">${badgeEstado(e.matricula_estado)}</td>
              <td class="mono" data-label="Contacto">${esc(e.email || e.telefono || '—')}</td>
            </tr>`).join('') || '<tr><td colspan="4"><div class="empty">Sin resultados.</div></td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="pag-prof-est"></div>`;

      listBody.querySelectorAll('.chip[data-grado]').forEach((c) => c.addEventListener('click', () => {
        estado.grado = c.dataset.grado;
        estado.page = 1;
        renderTabla();
      }));

      const selBox = listBody.querySelector('#pe-select');
      const selBtn = listBody.querySelector('#pe-select-btn');
      const selSearch = listBody.querySelector('#pe-select-search');
      const selList = listBody.querySelector('#pe-select-list');
      const buildList = (filtro = '') => {
        const f = filtro.trim().toLowerCase();
        const opts = [['', 'Todos los grados']]
          .concat(grados.map((g) => [g.match, g.label]))
          .filter(([, label]) => !f || label.toLowerCase().includes(f));
        selList.innerHTML = opts.map(([match, label]) =>
          `<div class="grado-opt ${(match === '' ? !estado.grado : estado.grado === match) ? 'active' : ''}" data-grado="${esc(match)}">${esc(label)}</div>`).join('') ||
          '<div class="grado-opt empty">Sin resultados</div>';
      };
      buildList();
      selBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = !selBox.classList.contains('open');
        selBox.classList.toggle('open', abrir);
        if (abrir) { selSearch.value = ''; buildList(); selSearch.focus(); }
      });
      selSearch.addEventListener('input', () => buildList(selSearch.value));
      selList.addEventListener('click', (e) => {
        const opt = e.target.closest('.grado-opt[data-grado]');
        if (!opt) return;
        estado.grado = opt.dataset.grado;
        estado.page = 1;
        selBox.classList.remove('open');
        renderTabla();
      });

      paginacion(listBody.querySelector('#pag-prof-est'), {
        page: estado.page, limit: estado.limit, total,
        onPage: (p, l) => { estado.page = p; estado.limit = l; renderTabla(); },
      });

      revisarFiltroGrado();
      listBody.querySelector('#pe-buscar').addEventListener('input', (e) => {
        estado.search = e.target.value;
        estado.page = 1;
        clearTimeout(estado._t);
        estado._t = setTimeout(renderTabla, 300);
      });
    }

    crumbs.textContent = `${est.length} estudiantes en tus clases`;
    renderTabla();
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ---------- ESTUDIANTE: perfil propio ----------
async function renderPerfil() {
  const { crumbs, actions, body } = screenEls('estudiantes');
  crumbs.textContent = 'Tu carné y rendimiento';
  actions.innerHTML = '';
  loading(body);
  const id = authUser.data.personId;
  try {
    const f = await api(`/estudiantes/${id}/ficha`);
    const mat = f.matricula || {};
    const grado = `${mat.grado || ''}${mat.seccion ? ' ' + mat.seccion : ''}${mat.nivel ? ' · ' + mat.nivel : ''}`;
    const bars = (f.promedios || []).map((m) => {
      const pct = Math.round((Number(m.promedio) / 5) * 100);
      const cls = Number(m.promedio) >= 3 ? 'var(--teal)' : 'var(--red)';
      return `<div class="bar-row"><span class="lbl">${esc(m.materia_nombre)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cls};"></div></div><span class="bar-val">${m.promedio}</span></div>`;
    }).join('') || '<div class="empty">Sin notas registradas.</div>';
    body.innerHTML = `<div class="two-col even">
      <div>
        <div class="carnet">
          <div class="hole"></div>
          <div class="carnet-top">
            <div class="carnet-photo">${esc(initials(f.nombre, f.apellido))}</div>
            <div>
              <div class="carnet-name">${esc(f.nombre)} ${esc(f.apellido)}</div>
              <div class="carnet-grado">${esc(grado)}</div>
              <div class="carnet-id mono">EST-2026-${String(f.id).padStart(4, '0')}</div>
            </div>
          </div>
          <div class="carnet-barcode"></div>
          <div class="carnet-foot"><span>Vigencia ${new Date().getFullYear()}</span><span>Colegio San Rafael</span></div>
        </div>
        <div class="panel"><div class="panel-body">
          <div class="ficha-section" style="margin-top:14px;">
            <h4>Datos de contacto</h4>
            <div class="kv-list">
              <div class="kv"><span class="k">Correo</span><span class="v mono">${esc(f.email || '—')}</span></div>
              <div class="kv"><span class="k">Teléfono</span><span class="v mono">${esc(f.telefono || '—')}</span></div>
            </div>
          </div>
        </div></div>
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Promedio por materia</h3><div class="hint">Año lectivo ${new Date().getFullYear()}</div></div></div><div class="panel-body">${bars}</div></div>
    </div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ---------- TUTOR: hijos ----------
async function renderHijos() {
  const { crumbs, actions, body } = screenEls('estudiantes');
  const hijos = await loadHijos();
  if (!hijos.length) {
    crumbs.textContent = 'Sin estudiantes a cargo';
    actions.innerHTML = '';
    body.innerHTML = '<div class="empty">No tienes estudiantes registrados a tu cargo.</div>';
    return;
  }
  actions.innerHTML = `<div class="student-picker">
    <span style="font-size:12px;color:var(--ink-faint);font-weight:600;">Estudiante:</span>
    <div id="sel-hijo"></div>
  </div>`;
  if (!ctx.selectedChildId || !hijos.some((h) => h.id === ctx.selectedChildId)) ctx.selectedChildId = Number(hijos[0].id);
  searchSelect({
    el: actions.querySelector('#sel-hijo'),
    options: hijos.map((h) => [h.id, `${h.nombre} ${h.apellido}${h.grado ? ` · ${h.grado}${h.seccion || ''}` : ''}`]),
    initial: ctx.selectedChildId,
    placeholder: 'Seleccionar estudiante…', searchPlaceholder: 'Buscar estudiante…',
    onSelect: (v) => { ctx.selectedChildId = Number(v); renderHijos(); },
  });

  loading(body);
  const id = ctx.selectedChildId;
  try {
    const f = await api(`/estudiantes/${id}/ficha`);
    const mat = f.matricula || {};
    const grado = `${mat.grado || ''}${mat.seccion ? ' ' + mat.seccion : ''}${mat.nivel ? ' · ' + mat.nivel : ''}`;
    const bars = (f.promedios || []).map((m) => {
      const pct = Math.round((Number(m.promedio) / 5) * 100);
      const cls = Number(m.promedio) >= 3 ? 'var(--teal)' : 'var(--red)';
      return `<div class="bar-row"><span class="lbl">${esc(m.materia_nombre)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cls};"></div></div><span class="bar-val">${m.promedio}</span></div>`;
    }).join('') || '<div class="empty">Sin notas registradas.</div>';
    crumbs.textContent = `Perfil de ${f.nombre} ${f.apellido}`;
    body.innerHTML = `<div class="two-col even">
      <div>
        <div class="carnet">
          <div class="hole"></div>
          <div class="carnet-top">
            <div class="carnet-photo">${esc(initials(f.nombre, f.apellido))}</div>
            <div>
              <div class="carnet-name">${esc(f.nombre)} ${esc(f.apellido)}</div>
              <div class="carnet-grado">${esc(grado)}</div>
              <div class="carnet-id mono">EST-2026-${String(f.id).padStart(4, '0')}</div>
            </div>
          </div>
          <div class="carnet-barcode"></div>
          <div class="carnet-foot"><span>Vigencia ${new Date().getFullYear()}</span><span>Colegio San Rafael</span></div>
        </div>
        <div class="panel"><div class="panel-body">
          <div class="ficha-section" style="margin-top:14px;">
            <h4>Información</h4>
            <div class="kv-list">
              <div class="kv"><span class="k">Matrícula</span><span class="v">${badgeEstado(mat.estado || 'Sin matrícula')}</span></div>
              <div class="kv"><span class="k">Correo</span><span class="v mono">${esc(f.email || '—')}</span></div>
            </div>
          </div>
        </div></div>
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Promedio por materia</h3><div class="hint">Año lectivo ${new Date().getFullYear()}</div></div></div><div class="panel-body">${bars}</div></div>
    </div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}
