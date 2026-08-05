// Pantalla Notificaciones — bandeja para todos los roles.
import { api } from './api.js';
import { esc, fmtDateTime, notifIcon, screenEls, toast, loading, paginacion, clampPage } from './utils.js';

let filtro = ''; // '' | 'no-leidas'
const pag = { page: 1, limit: 10 };

export async function render() {
  const { crumbs, actions, body } = screenEls('notificaciones');
  crumbs.textContent = 'Bandeja de notificaciones';
  actions.innerHTML = '<button class="btn" id="btn-marcar-todas">Marcar todas como leídas</button>';
  actions.querySelector('#btn-marcar-todas').addEventListener('click', async () => {
    try {
      await api('/notificaciones/leer-todas', { method: 'PATCH' });
      toast('Todas marcadas como leídas');
      window.dispatchEvent(new CustomEvent('notif:updated'));
      render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  function renderLista(notifs) {
    const chips = [['', 'Todas'], ['no-leidas', 'No leídas']].map(([v, label]) =>
      `<span class="chip ${filtro === v ? 'active' : ''}" data-f="${v}">${label}</span>`).join('');
    const total = notifs.length;
    pag.page = clampPage(pag.page, total, pag.limit);
    const paginados = notifs.slice((pag.page - 1) * pag.limit, pag.page * pag.limit);
    const items = paginados.map((n) => {
      const color = notifIcon(n.tipo_codigo);
      const unread = !n.leida;
      return `<div class="notif-item ${unread ? 'unread' : ''}" data-id="${n.id}" data-leida="${n.leida ? 1 : 0}">
        <div class="notif-icon" style="background:${unread ? 'var(--primary)' : 'var(--ink-faint)'}"></div>
        <div class="notif-content">
          <div class="notif-title">${esc(n.titulo)}${unread ? '<span class="badge red" style="margin-left:8px;"><span class="d"></span>Nueva</span>' : ''}</div>
          <div class="notif-msg">${esc(n.mensaje || '')}</div>
          <div class="cell-sub">${esc(n.tipo_descripcion || n.tipo_codigo)} · ${fmtDateTime(n.fecha_creacion)}</div>
        </div>
      </div>`;
    }).join('') || '<div class="empty">No hay notificaciones.</div>';
    body.innerHTML = `<div class="panel">
      <div class="filters">${chips}</div>
      <div class="panel-body" style="padding-top:0;">${items}</div>
      <div id="pag-notificaciones"></div>
    </div>`;
    paginacion(body.querySelector('#pag-notificaciones'), {
      page: pag.page, limit: pag.limit, total,
      onPage: (p, l) => { pag.page = p; pag.limit = l; renderLista(notifs); },
    });
    body.querySelectorAll('.chip[data-f]').forEach((c) => c.addEventListener('click', () => {
      filtro = c.dataset.f;
      pag.page = 1;
      render();
    }));
    body.querySelectorAll('.notif-item[data-id]').forEach((el) => {
      el.addEventListener('click', async () => {
        if (Number(el.dataset.leida)) return;
        try {
          await api(`/notificaciones/${el.dataset.id}/leer`, { method: 'PATCH' });
          el.classList.remove('unread');
          el.dataset.leida = '1';
          const badge = el.querySelector('.badge');
          if (badge) badge.remove();
          el.querySelector('.notif-icon').style.background = 'var(--ink-faint)';
          window.dispatchEvent(new CustomEvent('notif:updated'));
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  loading(body);
  try {
    const query = { limit: 200 };
    if (filtro === 'no-leidas') query.leida = 'false';
    const res = await api('/notificaciones', { query });
    renderLista(res.data || []);
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}
