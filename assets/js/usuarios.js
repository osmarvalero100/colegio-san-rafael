// Pantalla Usuarios y roles — gestión de cuentas (solo ADMIN).
import { api } from './api.js';
import {
  esc, avatar, screenEls, toast, loading, openModal, closeModal, formValue, confirmModal,
} from './utils.js';

let selRol = '';

export async function render() {
  const { crumbs, actions, body } = screenEls('usuarios');
  actions.innerHTML = '<button class="btn primary" id="btn-nuevo-usuario">+ Nuevo usuario</button>';
  actions.querySelector('#btn-nuevo-usuario').addEventListener('click', () => abrirFormUsuario());
  loading(body);
  try {
    const query = { limit: 300 };
    if (selRol) query.rol_id = selRol;
    const { data: usuarios } = await api('/usuarios', { query });
    crumbs.textContent = `${usuarios.length} cuentas de usuario`;
    const chips = ['', 'ADMIN', 'SECRETARIA', 'PROFESOR', 'ESTUDIANTE', 'TUTOR'].map((r) =>
      `<span class="chip ${selRol === r ? 'active' : ''}" data-rol="${r}">${r === '' ? 'Todos' : r}</span>`).join('');
    const filas = usuarios.map(filaUsuario).join('') ||
      '<tr><td colspan="5"><div class="empty">Sin usuarios registrados.</div></td></tr>';
    body.innerHTML = `<div class="panel">
      <div class="filters">${chips}</div>
      <div class="panel-body" style="padding-top:0;">
        <table>
          <thead><tr><th>Usuario</th><th>Vinculado a</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
    body.querySelectorAll('.chip[data-rol]').forEach((c) => c.addEventListener('click', () => {
      selRol = c.dataset.rol;
      render();
    }));
    body.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrirFormUsuario(Number(b.dataset.editar))));
    body.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', () => eliminarUsuario(Number(b.dataset.eliminar))));
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function filaUsuario(u) {
  const esAdmin = u.rolCodigo === 'ADMIN' || u.rolCodigo === 'SECRETARIA';
  const [n, a] = (u.persona_nombre || '? ?').split(' ');
  return `<tr>
    <td class="row-flex">${avatar(n, a)}<div><div class="cell-name mono">${esc(u.username)}</div><div class="cell-sub id-mono">#${u.id}</div></div></td>
    <td>${esc(u.persona_nombre || '—')}</td>
    <td>${esAdmin ? `<span class="badge purple"><span class="d"></span>${esc(u.rolNombre)}</span>` : `<span class="badge blue"><span class="d"></span>${esc(u.rolNombre)}</span>`}</td>
    <td><span class="badge green"><span class="d"></span>Activo</span></td>
    <td><div style="display:flex;gap:6px;justify-content:flex-end;">
      <button class="btn mini" data-editar="${u.id}">Editar</button>
      <button class="btn mini danger" data-eliminar="${u.id}">✕</button>
    </div></td>
  </tr>`;
}

async function abrirFormUsuario(id) {
  const esEdicion = Boolean(id);
  const u = esEdicion ? await api(`/usuarios/${id}`) : null;
  const rolesData = await api('/roles');
  const roles = Array.isArray(rolesData) ? rolesData : rolesData.data || [];
  const [profesores, estudiantes, tutores] = await Promise.all([
    api('/profesores', { query: { limit: 500 } }),
    api('/estudiantes', { query: { limit: 500 } }),
    api('/tutores', { query: { limit: 500 } }),
  ]);
  const profList = profesores.data || [];
  const estList = estudiantes.data || [];
  const tutList = tutores.data || [];

  const esAdminRol = (rolId) => {
    const r = roles.find((x) => x.id === Number(rolId));
    return r && (r.codigo === 'ADMIN' || r.codigo === 'SECRETARIA');
  };
  const rolActual = u ? roles.find((x) => x.id === u.rol_id) : null;

  const body = openModal(esEdicion ? `Editar usuario · ${u.username}` : 'Nuevo usuario', `
    <div class="form-grid">
      <div class="field"><label>Username *</label><input id="u-username" value="${esc(u?.username || '')}"></div>
      <div class="field"><label>Rol *</label>
        <select id="u-rol">${roles.map((r) =>
          `<option value="${r.id}" ${u && u.rol_id === r.id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select>
      </div>
      <div class="field full"><label>${esEdicion ? 'Nueva contraseña' : 'Contraseña *'}${esEdicion ? ' (dejar vacío para no cambiar)' : ''}</label>
        <input id="u-password" type="password" autocomplete="new-password" placeholder="${esEdicion ? '••••••' : 'Mínimo 6 caracteres'}"></div>
      <div class="field full" id="u-link-wrap">
        ${esEdicion && rolActual ? selectorPersona(u, rolActual) : selectorPersona(null, roles.find((r) => r.id === Number(roles[0]?.id)))}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>${esEdicion ? 'Guardar cambios' : 'Crear usuario'}</button>
    </div>`);

  const linkWrap = body.querySelector('#u-link-wrap');
  const rolEl = body.querySelector('#u-rol');

  function selectorPersona(usuario, rolObj) {
    if (!rolObj) return '<span class="cell-sub">Selecciona un rol.</span>';
    const codigo = rolObj.codigo;
    const linkId = usuario && codigo === 'PROFESOR' ? usuario.profesor_id
      : usuario && codigo === 'ESTUDIANTE' ? usuario.estudiante_id
      : usuario && codigo === 'TUTOR' ? usuario.tutor_id
      : usuario && (codigo === 'ADMIN' || codigo === 'SECRETARIA') ? usuario.personal_administrativo_id : null;
    if (codigo === 'ADMIN' || codigo === 'SECRETARIA') {
      return `<div>
        <div style="font-size:12px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Persona del área administrativa</div>
        ${esEdicion ? `<div class="cell-sub" style="margin-bottom:8px;">Vinculado a: ${esc(u?.persona_nombre || '')} · #${linkId || ''}</div>` : ''}
        <div class="form-grid">
          <div class="field"><label>Nombres *</label><input id="pa-nombre" value="${esc(usuario?.persona_nombre?.split(' ')[0] || '')}"></div>
          <div class="field"><label>Apellidos *</label><input id="pa-apellido" value="${esc((usuario?.persona_nombre || '').split(' ').slice(1).join(' '))}"></div>
          <div class="field"><label>Email</label><input id="pa-email"></div>
          <div class="field"><label>Teléfono</label><input id="pa-telefono"></div>
          <div class="field full"><label>Cargo</label><input id="pa-cargo"></div>
        </div>
      </div>`;
    }
    const list = codigo === 'PROFESOR' ? profList : codigo === 'ESTUDIANTE' ? estList : tutList;
    const nombreCompleto = (x) => `${x.nombre || ''}${x.apellido ? ' ' + x.apellido : ''}`;
    const opt = (x) => codigo === 'ESTUDIANTE'
      ? `<option value="${x.id}" ${linkId === x.id ? 'selected' : ''}>${esc(nombreCompleto(x))}${x.grado_nombre ? ` · ${esc(x.grado_nombre)}${esc(x.seccion || '')}` : ''}</option>`
      : `<option value="${x.id}" ${linkId === x.id ? 'selected' : ''}>${esc(nombreCompleto(x))}</option>`;
    return `<div>
      <div style="font-size:12px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${esEdicion ? 'Cambiar persona vinculada' : 'Vincular a'} (${codigo === 'PROFESOR' ? 'docente' : codigo === 'ESTUDIANTE' ? 'estudiante' : 'tutor'})</div>
      <div class="field"><label>Persona *</label>
        <select id="u-link">${list.map(opt).join('') || '<option value="">Sin opciones — crea primero la persona</option>'}</select>
      </div>
    </div>`;
  }

  rolEl.addEventListener('change', () => {
    const rolObj = roles.find((r) => r.id === Number(rolEl.value));
    linkWrap.innerHTML = '';
    const cont = document.createElement('div');
    cont.innerHTML = selectorPersona(null, rolObj);
    linkWrap.appendChild(cont.firstElementChild || cont);
  });

  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const username = formValue('u-username');
    const password = formValue('u-password');
    const rolObj = roles.find((r) => r.id === Number(formValue('u-rol')));
    if (!username || (!esEdicion && !password) || !rolObj) { toast('Completa username, contraseña y rol', 'error'); return; }
    if (!esEdicion && password.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }

    const data = { username, rol_id: rolObj.id };
    if (password) data.password = password;
    if (!esEdicion) {
      if (rolObj.codigo === 'ADMIN' || rolObj.codigo === 'SECRETARIA') {
        const nombre = formValue('pa-nombre');
        const apellido = formValue('pa-apellido');
        if (!nombre || !apellido) { toast('Completa nombre y apellido de la persona administrativa', 'error'); return; }
        data.persona = {
          nombre, apellido,
          email: formValue('pa-email') || null,
          telefono: formValue('pa-telefono') || null,
          cargo: formValue('pa-cargo') || null,
        };
      } else {
        const link = Number(formValue('u-link'));
        if (!link) { toast('Selecciona la persona a vincular', 'error'); return; }
        if (rolObj.codigo === 'PROFESOR') data.profesor_id = link;
        else if (rolObj.codigo === 'ESTUDIANTE') data.estudiante_id = link;
        else data.tutor_id = link;
      }
    }

    const btn = body.querySelector('[data-save]');
    btn.disabled = true;
    try {
      if (esEdicion) {
        await api(`/usuarios/${id}`, { method: 'PUT', body: data });
        toast('Usuario actualizado');
      } else {
        await api('/usuarios', { method: 'POST', body: data });
        toast('Usuario creado');
      }
      closeModal();
      render();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

function eliminarUsuario(id) {
  confirmModal('Eliminar usuario', '¿Seguro que deseas eliminar esta cuenta de usuario?', async () => {
    await api(`/usuarios/${id}`, { method: 'DELETE' });
    toast('Usuario eliminado');
    render();
  }, 'Eliminar');
}
