// Pantalla Resumen — dashboard según rol.
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos } from './context.js';
import {
  esc, money, fmtTime, avatar, screenEls, DAYS_SPANISH,
  currentMonth, currentYear, fmtDateTime, notifIcon, loading,
} from './utils.js';

const HOY_INDEX = new Date().getDay(); // 0=Dom..6=Sáb
const HOY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][HOY_INDEX];
const HOY_LABEL = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function stat(html, cls) {
  return `<div class="stat ${cls || ''}">${html}</div>`;
}

function cardStats(html) {
  return `<div class="grid-stats">${html}</div>`;
}

function panel(title, hint, bodyHtml, headExtra = '') {
  return `<div class="panel">
    <div class="panel-head"><div><h3>${esc(title)}</h3><div class="hint">${esc(hint || '')}</div></div>${headExtra}</div>
    <div class="panel-body" style="padding-top:${bodyHtml.startsWith('<table') ? '0' : '14'}px;">${bodyHtml}</div>
  </div>`;
}

function table(headHtml, rowsHtml) {
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function clasesHoyTable(rows) {
  if (!rows.length) return '<div class="empty">No hay clases programadas hoy.</div>';
  return table(
    '<th>Hora</th><th>Materia</th><th>Grado</th><th>Docente</th><th>Aula</th>',
    rows.map((h) => `<tr>
      <td class="mono">${fmtTime(h.hora_inicio)}–${fmtTime(h.hora_fin)}</td>
      <td class="cell-name" data-label="Materia">${esc(h.materia_nombre)}</td>
      <td data-label="Grado">${esc(h.grado)} ${esc(h.seccion || '')}</td>
      <td data-label="Docente">${esc(h.profesor_nombre || '')} ${esc(h.profesor_apellido || '')}</td>
      <td class="mono" data-label="Aula">${esc(h.aula || '—')}</td></tr>`).join('')
  );
}

async function adminResumen(body) {
  const [est, prof, resumen, notifs] = await Promise.all([
    api('/estudiantes?limit=1'),
    api('/profesores?limit=1'),
    api('/pagos/resumen', { query: { anio: currentYear(), mes: currentMonth() } }),
    api('/notificaciones', { query: { leida: 'false', limit: 6 } }),
  ]);
  const p = resumen;
  body.innerHTML =
    cardStats(
      stat(`<span class="tag">Estudiantes activos</span><div class="big">${esc(est.pagination.total)}</div><div class="delta up">Año lectivo ${currentYear()}</div>`, 's1') +
      stat(`<span class="tag">Docentes</span><div class="big">${esc(prof.pagination.total)}</div><div class="delta up">Activos</div>`, 's2') +
      stat(`<span class="tag">Recaudado ${currentMonth()}/${currentYear()}</span><div class="big small">${money(p.recaudado)}</div><div class="delta up">${p.cantidad} pagos</div>`, 's3') +
      stat(`<span class="tag">Pagos vencidos</span><div class="big">${p.vencido_cantidad || 0}</div><div class="delta down">${money(p.vencido)} en mora</div>`, 's4')
    );

  const [horarios] = await Promise.all([
    api('/horarios', { query: { dia: HOY, limit: 200 } }),
  ]);
  const pendiente = (p.pendiente_cantidad || 0);

  const alertas = [];
  try {
    const vencidos = (await api('/pagos', { query: { estado: 'Vencido', limit: 4 } })).data || [];
    vencidos.forEach((v) => alertas.push(
      `<div class="kv" style="border:none;padding:0;"><span class="badge red"><span class="d"></span>Pago vencido</span><span class="v">${esc(v.estudiante_nombre)} ${esc(v.estudiante_apellido)} · ${money(v.monto)}</span></div>`));
  } catch (e) { /* sin permisos */ }

  (notifs.data || []).forEach((n) => alertas.push(
    `<div class="kv" style="border:none;padding:0;"><span class="badge mustard"><span class="d"></span>${esc(n.tipo_codigo)}</span><span class="v">${esc(n.titulo)}</span></div>`));
  if (!alertas.length) alertas.push('<div class="empty">Sin alertas pendientes.</div>');

  body.innerHTML += `<div class="two-col">
    ${panel('Clases de hoy', HOY_LABEL, clasesHoyTable(horarios.data || []),
      '<button class="btn ghost" data-go="horarios">Ver horario completo →</button>')}
    ${panel('Alertas', 'Requieren seguimiento', alertas.join(''))}
  </div>`;
}

async function profesorResumen(body) {
  const [materias, estudiantes, horario, notifCount] = await Promise.all([
    api('/profesores/me/materias'),
    api('/profesores/me/estudiantes'),
    api('/profesores/me/horario'),
    api('/notificaciones/no-leidas/count'),
  ]);
  const hoy = horario.filter((h) => h.dia === HOY);
  const materiasUnicas = [...new Set(materias.map((m) => m.nombre))].length;
  body.innerHTML =
    cardStats(
      stat(`<span class="tag">Mis materias</span><div class="big">${esc(materiasUnicas)}</div><div class="delta up">${materias.length} grupos</div>`, 's1') +
      stat(`<span class="tag">Mis estudiantes</span><div class="big">${esc(estudiantes.length)}</div><div class="delta up">En mis grados</div>`, 's2') +
      stat(`<span class="tag">Clases de hoy</span><div class="big">${esc(hoy.length)}</div><div class="delta up">${HOY_LABEL}</div>`, 's3') +
      stat(`<span class="tag">Notificaciones</span><div class="big">${esc(notifCount.no_leidas)}</div><div class="delta down">${notifCount.no_leidas ? 'Sin leer' : 'Al día'}</div>`, 's4')
    );

  body.innerHTML += `<div class="two-col">
    ${panel('Clases de hoy', HOY_LABEL, clasesHoyTable(hoy),
      '<button class="btn ghost" data-go="horarios">Mi horario →</button>')}
    ${panel('Mis materias', 'Grupos donde dicto clase',
      table('<th>Materia</th><th>Grado</th>',
        materias.map((m) => `<tr data-go="notas"><td class="cell-name">${esc(m.nombre)}</td><td data-label="Grado">${esc(m.grado)} ${esc(m.seccion || '')}</td></tr>`).join('') || '<tr><td colspan="2"><div class="empty">Sin materias asignadas.</div></td></tr>'))}
  </div>`;
}

async function estudianteResumen(body) {
  const id = authUser.data.personId;
  const [ficha, promedio, asist, notifCount] = await Promise.all([
    api(`/estudiantes/${id}/ficha`),
    api(`/notas/promedio/estudiante/${id}`),
    api(`/asistencias/estudiante/${id}`),
    api('/notificaciones/no-leidas/count'),
  ]);
  const pres = asist.estados.Presente?.porcentaje ?? 0;
  body.innerHTML =
    cardStats(
      stat(`<span class="tag">Promedio general</span><div class="big mono">${promedio.promedio_general ?? '—'}</div><div class="delta ${(promedio.promedio_general ?? 0) >= 3 ? 'up' : 'down'}">Escala 1.0 – 5.0</div>`, 's1') +
      stat(`<span class="tag">Materias</span><div class="big">${esc((promedio.materias || []).length)}</div><div class="delta up">Con registro</div>`, 's2') +
      stat(`<span class="tag">Asistencia</span><div class="big">${pres}%</div><div class="delta up">Presente</div>`, 's3') +
      stat(`<span class="tag">Notificaciones</span><div class="big">${esc(notifCount.no_leidas)}</div><div class="delta down">${notifCount.no_leidas ? 'Sin leer' : 'Al día'}</div>`, 's4')
    );

  const bars = (promedio.materias || []).map((m) => {
    const pct = Math.round((Number(m.promedio) / 5) * 100);
    const cls = Number(m.promedio) >= 3 ? 'var(--teal)' : 'var(--red)';
    return `<div class="bar-row"><span class="lbl">${esc(m.materia_nombre)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cls};"></div></div>
      <span class="bar-val">${m.promedio}</span></div>`;
  }).join('') || '<div class="empty">Aún no hay notas registradas.</div>';

  const notifs = (await api('/notificaciones', { query: { leida: 'false', limit: 5 } })).data || [];
  const notifHtml = notifs.map((n) =>
    `<div class="notif-item" data-go="notificaciones">
      <div class="n-icon ${notifIcon(n.tipo_codigo)}">${esc(n.tipo_codigo === 'PAGO_VENCIDO' ? 'P' : n.tipo_codigo === 'NOTA_BAJA' ? 'N' : n.tipo_codigo === 'INASISTENCIA' ? 'A' : 'i')}</div>
      <div style="min-width:0;"><div class="n-title">${esc(n.titulo)}</div><div class="n-msg">${esc(n.mensaje || '')}</div><div class="n-meta">${fmtDateTime(n.fecha_creacion)}</div></div>
    </div>`).join('') || '<div class="empty">Sin notificaciones nuevas.</div>';

  body.innerHTML += `<div class="two-col">
    ${panel('Promedio por materia', `${esc(ficha.matricula?.grado)} ${esc(ficha.matricula?.seccion || '')}`, bars)}
    ${panel('Notificaciones recientes', '', notifHtml)}
  </div>`;
}

async function tutorResumen(body) {
  const hijos = await loadHijos();
  const notifCount = await api('/notificaciones/no-leidas/count');
  if (!hijos.length) {
    body.innerHTML = '<div class="empty"><div class="e-icon">👨‍👩‍👧</div>No tienes estudiantes a cargo.</div>';
    return;
  }
  const hijo = ctx.selectedChildId ? hijos.find((h) => h.id === ctx.selectedChildId) : null;
  let stats = '';
  let panelBody = '';
  if (hijo) {
    const pagos = (await api('/pagos', { query: { estudiante_id: hijo.id, limit: 100 } })).data || [];
    const pendientes = pagos.filter((p) => p.estado === 'Pendiente');
    const vencidos = pagos.filter((p) => p.estado === 'Vencido');
    stats = cardStats(
      stat(`<span class="tag">Estudiantes a cargo</span><div class="big">${esc(hijos.length)}</div><div class="delta up">Cuenta tutor</div>`, 's1') +
      stat(`<span class="tag">Pagos pendientes</span><div class="big small">${money(pendientes.reduce((s, p) => s + Number(p.monto), 0))}</div><div class="delta down">${pendientes.length} cuentas</div>`, 's2') +
      stat(`<span class="tag">Pagos vencidos</span><div class="big">${vencidos.length}</div><div class="delta down">${money(vencidos.reduce((s, p) => s + Number(p.monto), 0))} en mora</div>`, 's3') +
      stat(`<span class="tag">Notificaciones</span><div class="big">${esc(notifCount.no_leidas)}</div><div class="delta down">${notifCount.no_leidas ? 'Sin leer' : 'Al día'}</div>`, 's4')
    );
    const rows = pagos.slice(0, 5).map((p) => `<tr data-go="pagos">
      <td class="cell-name">${esc(p.concepto_nombre)}</td>
      <td class="mono" data-label="Monto">${money(p.monto)}</td>
      <td class="mono" data-label="Vence">${esc(p.fecha_vencimiento || '—')}</td>
      <td data-label="Estado">${badgeEstadoLocal(p.estado)}</td></tr>`).join('');
    panelBody = panel('Pagos recientes', `${esc(hijo.nombre)} ${esc(hijo.apellido)}`,
      table('<th>Concepto</th><th>Monto</th><th>Vence</th><th>Estado</th>', rows || '<tr><td colspan="4"><div class="empty">Sin pagos.</div></td></tr>'));
  } else {
    stats = cardStats(stat(`<span class="tag">Estudiantes a cargo</span><div class="big">${esc(hijos.length)}</div><div class="delta up">Selecciona un estudiante</div>`, 's1'));
  }
  const hijosHtml = hijos.map((h) =>
    `<div class="kv" style="border:none;padding:0;cursor:pointer;" data-hijo="${h.id}">
      <span class="cell-name">${avatar(h.nombre, h.apellido)} ${esc(h.nombre)} ${esc(h.apellido)}</span>
      <span class="v">${esc(h.grado || '')} ${esc(h.seccion || '')}</span></div>`).join('');
  body.innerHTML = stats + `<div class="two-col">
    ${panel('Mis estudiantes', 'Haz clic para ver su perfil', hijosHtml)}
    ${panelBody || '<div class="panel"><div class="empty">Selecciona un estudiante para ver sus pagos.</div></div>'}
  </div>`;
}

function badgeEstadoLocal(estado) {
  const map = { Pagado: 'green', Pendiente: 'mustard', Vencido: 'red' };
  return `<span class="badge ${map[estado] || 'gray'}"><span class="d"></span>${esc(estado)}</span>`;
}

export async function render() {
  const { crumbs, actions, body } = screenEls('resumen');
  const r = rol();
  crumbs.textContent = `Año lectivo ${currentYear()} · ${HOY_LABEL}`;
  actions.innerHTML = '<button class="btn" data-reload>↻ Actualizar</button>';
  actions.querySelector('[data-reload]').addEventListener('click', render);
  loading(body, 'Cargando indicadores…');
  try {
    if (r === 'ADMIN' || r === 'SECRETARIA') await adminResumen(body);
    else if (r === 'PROFESOR') await profesorResumen(body);
    else if (r === 'ESTUDIANTE') await estudianteResumen(body);
    else if (r === 'TUTOR') await tutorResumen(body);
    else body.innerHTML = '<div class="empty">Rol sin vista definida.</div>';
  } catch (err) {
    body.innerHTML = `<div class="empty">No se pudieron cargar los indicadores.<br><span style="font-size:11.5px;">${esc(err.message)}</span></div>`;
  }
  body.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => window.__app.go(el.dataset.go));
  });
  body.querySelectorAll('[data-hijo]').forEach((el) => {
    el.addEventListener('click', () => {
      ctx.selectedChildId = Number(el.dataset.hijo);
      window.__app.go('estudiantes');
    });
  });
}
