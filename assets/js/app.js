// Núcleo del frontend: arranque, sesión, navegación por pestañas,
// menú según rol y polling de notificaciones.
import * as auth from './auth.js';
import { api } from './api.js';
import { esc, initials } from './utils.js';

import { render as renderResumen } from './resumen.js';
import { render as renderEstudiantes } from './estudiantes.js';
import { render as renderMatriculas } from './matriculas.js';
import { render as renderNotas } from './notas.js';
import { render as renderAsistencia } from './asistencia.js';
import { render as renderHorarios } from './horarios.js';
import { render as renderPagos } from './pagos.js';
import { render as renderProfesores } from './profesores.js';
import { render as renderUsuarios } from './usuarios.js';
import { render as renderConfiguracion } from './configuracion.js';
import { render as renderNotificaciones } from './notificaciones.js';

const SCREENS = {
  resumen: renderResumen,
  estudiantes: renderEstudiantes,
  matriculas: renderMatriculas,
  notas: renderNotas,
  asistencia: renderAsistencia,
  horarios: renderHorarios,
  pagos: renderPagos,
  profesores: renderProfesores,
  usuarios: renderUsuarios,
  configuracion: renderConfiguracion,
  notificaciones: renderNotificaciones,
};

// Menú por rol (pestañas en orden). El backend igualmente aplica
// requireRole en cada endpoint — esto es solo navegación.
const MENUS = {
  ADMIN: [['resumen', 'Resumen'], ['estudiantes', 'Estudiantes'], ['matriculas', 'Matrículas'],
    ['notas', 'Notas'], ['asistencia', 'Asistencia'], ['horarios', 'Horarios'], ['pagos', 'Pagos'],
    ['profesores', 'Profesores'], ['usuarios', 'Usuarios y roles'], ['configuracion', 'Configuración'],
    ['notificaciones', 'Notificaciones']],
  SECRETARIA: [['resumen', 'Resumen'], ['estudiantes', 'Estudiantes'], ['matriculas', 'Matrículas'],
    ['pagos', 'Pagos'], ['profesores', 'Profesores'], ['horarios', 'Horarios'], ['notas', 'Notas'],
    ['asistencia', 'Asistencia'], ['notificaciones', 'Notificaciones']],
  PROFESOR: [['resumen', 'Resumen'], ['estudiantes', 'Mis estudiantes'], ['notas', 'Notas'],
    ['asistencia', 'Asistencia'], ['horarios', 'Mi horario'], ['notificaciones', 'Notificaciones']],
  ESTUDIANTE: [['resumen', 'Resumen'], ['estudiantes', 'Mi perfil'], ['notas', 'Mis notas'],
    ['horarios', 'Mi horario'], ['asistencia', 'Mi asistencia'], ['notificaciones', 'Notificaciones']],
  TUTOR: [['resumen', 'Resumen'], ['estudiantes', 'Mis estudiantes'], ['notas', 'Notas'],
    ['horarios', 'Horario'], ['asistencia', 'Asistencia'], ['pagos', 'Pagos'],
    ['notificaciones', 'Notificaciones']],
};

const shell = document.getElementById('shell');
const navtabs = document.getElementById('navtabs');
const dnav = document.getElementById('dnav');
const mdrawer = document.getElementById('mdrawer');
const mbackdrop = document.getElementById('mbackdrop');
const mbottomnav = document.getElementById('mbottomnav');
let current = null;
let notifTimer = null;

// Accesos rápidos de la barra inferior móvil (hasta 4) + "Más" abre el drawer.
const BOTTOMNAVS = {
  ADMIN: ['resumen', 'estudiantes', 'horarios', 'pagos'],
  SECRETARIA: ['resumen', 'estudiantes', 'horarios', 'pagos'],
  PROFESOR: ['resumen', 'estudiantes', 'horarios', 'notas'],
  ESTUDIANTE: ['resumen', 'notas', 'horarios', 'asistencia'],
  TUTOR: ['resumen', 'estudiantes', 'horarios', 'pagos'],
};

const BN_ICONS = {
  resumen: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  estudiantes: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg>',
  horarios: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/></svg>',
  pagos: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2.5" y="6" width="19" height="13" rx="2"/><line x1="2.5" y1="10.5" x2="21.5" y2="10.5"/></svg>',
  notas: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  asistencia: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
};

const BN_LABELS = {
  resumen: 'Resumen', estudiantes: 'Estudiantes', horarios: 'Horario',
  pagos: 'Pagos', notas: 'Notas', asistencia: 'Asistencia',
};

function showLogin() {
  shell.style.display = 'none';
  document.getElementById('login').classList.add('active');
}

function showShell(u) {
  document.getElementById('login').classList.remove('active');
  shell.style.display = 'flex';
  const [nombre, apellido] = (u.personaNombre || u.username).split(' ');
  const ini = initials(nombre, apellido);
  const nombreCompleto = u.personaNombre || u.username;
  document.getElementById('user-av').textContent = ini;
  document.getElementById('user-name').textContent = nombreCompleto;
  document.getElementById('user-role').textContent = u.rolNombre;
  document.getElementById('mtop-av').textContent = ini;
  document.getElementById('drawer-av').textContent = ini;
  document.getElementById('drawer-name').textContent = nombreCompleto;
  document.getElementById('drawer-role').textContent = u.rolNombre;
  buildMenu(u.rolCodigo);
  buildDrawer(u.rolCodigo);
  buildBottomNav(u.rolCodigo);
  go('resumen');
  startNotifPolling();
}

function buildMenu(rolCodigo) {
  const items = MENUS[rolCodigo] || MENUS.ESTUDIANTE;
  navtabs.innerHTML = items.map(([id, label]) =>
    `<a class="navtab" data-screen="${id}" data-label="${esc(label)}"><span class="dot"></span><span class="tab-label">${esc(label)}</span></a>`
  ).join('');
  navtabs.querySelectorAll('.navtab').forEach((t) => {
    t.addEventListener('click', () => go(t.dataset.screen));
  });
}

function buildDrawer(rolCodigo) {
  const items = MENUS[rolCodigo] || MENUS.ESTUDIANTE;
  dnav.innerHTML = items.map(([id, label]) =>
    `<a class="dtab" data-screen="${id}"><span class="dot"></span><span>${esc(label)}</span></a>`
  ).join('');
  dnav.querySelectorAll('.dtab').forEach((t) => {
    t.addEventListener('click', () => { go(t.dataset.screen); closeDrawer(); });
  });
}

function buildBottomNav(rolCodigo) {
  const quick = BOTTOMNAVS[rolCodigo] || BOTTOMNAVS.ESTUDIANTE;
  const items = quick.map((id) =>
    `<a class="bnitem" data-screen="${id}">${BN_ICONS[id] || ''}<span>${esc(BN_LABELS[id] || id)}</span></a>`
  ).join('');
  mbottomnav.innerHTML = items +
    `<button class="bnitem" id="mas-btn" aria-label="Más opciones">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
      <span>Más</span>
      <span class="badge-count" id="mas-badge" style="display:none;"></span>
    </button>`;
  mbottomnav.querySelectorAll('.bnitem[data-screen]').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.screen));
  });
  mbottomnav.querySelector('#mas-btn').addEventListener('click', openDrawer);
}

function openDrawer() {
  mdrawer.classList.add('open');
  mbackdrop.classList.add('open');
}

function closeDrawer() {
  mdrawer.classList.remove('open');
  mbackdrop.classList.remove('open');
}

export function go(id) {
  if (!SCREENS[id]) id = 'resumen';
  current = id;
  navtabs.querySelectorAll('.navtab').forEach((t) => t.classList.toggle('active', t.dataset.screen === id));
  dnav.querySelectorAll('.dtab').forEach((t) => t.classList.toggle('active', t.dataset.screen === id));
  mbottomnav.querySelectorAll('.bnitem[data-screen]').forEach((b) => b.classList.toggle('active', b.dataset.screen === id));
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  const fn = SCREENS[id];
  if (fn) {
    Promise.resolve(fn()).catch((err) => {
      console.error('[screen]', id, err);
    });
  }
}

export function currentScreen() { return current; }

window.__app = { go, currentScreen, refreshNotifBadge };

// --- Notificaciones (polling 45s) ---
export async function refreshNotifBadge() {
  if (!auth.user.data) return;
  try {
    const { no_leidas } = await api('/notificaciones/no-leidas/count');
    const tab = navtabs.querySelector('[data-screen="notificaciones"]');
    if (tab) {
      let pill = tab.querySelector('.pill-count');
      if (no_leidas > 0) {
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 'pill-count';
          tab.appendChild(pill);
        }
        pill.textContent = no_leidas > 99 ? '99+' : no_leidas;
      } else if (pill) {
        pill.remove();
      }
    }
    const dTab = dnav.querySelector('[data-screen="notificaciones"]');
    if (dTab) {
      let pill = dTab.querySelector('.badge-count');
      if (no_leidas > 0) {
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 'badge-count';
          dTab.appendChild(pill);
        }
        pill.textContent = no_leidas > 99 ? '99+' : no_leidas;
      } else if (pill) {
        pill.remove();
      }
    }
    const masBadge = document.getElementById('mas-badge');
    if (masBadge) {
      masBadge.style.display = no_leidas > 0 ? 'inline-flex' : 'none';
      masBadge.textContent = no_leidas > 99 ? '99+' : no_leidas;
    }
  } catch (err) { /* sin sesión o red caída: ignorar */ }
}

function startNotifPolling() {
  if (notifTimer) clearInterval(notifTimer);
  refreshNotifBadge();
  notifTimer = setInterval(refreshNotifBadge, 45000);
}

window.addEventListener('notif:updated', refreshNotifBadge);
window.addEventListener('auth:expired', () => {
  if (notifTimer) clearInterval(notifTimer);
  showLogin();
});

// --- Login ---
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!username || !password) {
    loginError.textContent = 'Ingresa usuario y contraseña.';
    loginError.style.display = 'block';
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrando…';
  loginError.style.display = 'none';
  try {
    const u = await auth.login(username, password);
    showShell(u);
    document.getElementById('login-pass').value = '';
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';
  }
}

loginBtn.addEventListener('click', doLogin);
['login-user', 'login-pass'].forEach((id) => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
});
function doLogout() {
  auth.logout();
  if (notifTimer) clearInterval(notifTimer);
  closeDrawer();
  showLogin();
}

document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('drawer-logout').addEventListener('click', doLogout);
document.getElementById('menu-btn').addEventListener('click', openDrawer);
mbackdrop.addEventListener('click', closeDrawer);

// --- Arranque ---
(async function boot() {
  const u = await auth.restore();
  if (u) {
    showShell(u);
  } else {
    showLogin();
  }
})();
