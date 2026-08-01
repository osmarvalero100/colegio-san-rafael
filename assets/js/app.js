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
let current = null;
let notifTimer = null;

function showLogin() {
  shell.style.display = 'none';
  document.getElementById('login').classList.add('active');
}

function showShell(u) {
  document.getElementById('login').classList.remove('active');
  shell.style.display = 'flex';
  const [nombre, apellido] = (u.personaNombre || u.username).split(' ');
  document.getElementById('user-av').textContent = initials(nombre, apellido);
  document.getElementById('user-name').textContent = u.personaNombre || u.username;
  document.getElementById('user-role').textContent = u.rolNombre;
  buildMenu(u.rolCodigo);
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

export function go(id) {
  if (!SCREENS[id]) id = 'resumen';
  current = id;
  navtabs.querySelectorAll('.navtab').forEach((t) => t.classList.toggle('active', t.dataset.screen === id));
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
    if (!tab) return;
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
document.getElementById('logout-btn').addEventListener('click', () => {
  auth.logout();
  if (notifTimer) clearInterval(notifTimer);
  showLogin();
});

// --- Arranque ---
(async function boot() {
  const u = await auth.restore();
  if (u) {
    showShell(u);
  } else {
    showLogin();
  }
})();
