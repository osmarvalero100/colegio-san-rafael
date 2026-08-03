// Utilidades compartidas (esc, formato, badges, modal, toast).

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '$' + Number(n).toLocaleString('es-CO');
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

export function initials(a, b) {
  return ((a || '?').charAt(0) + (b || '?').charAt(0)).toUpperCase();
}

export function avatar(a, b) {
  return `<div class="avatar">${esc(initials(a, b))}</div>`;
}

export function gradeClass(n) {
  const v = Number(n);
  if (n === null || n === undefined || isNaN(v)) return 'g-mid';
  if (v >= 4) return 'g-high';
  if (v >= 3) return 'g-mid';
  return 'g-low';
}

export function gradePill(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '<span class="cell-sub">—</span>';
  return `<span class="grade-pill ${gradeClass(n)}">${Number(n).toFixed(1)}</span>`;
}

export function badgeEstado(estado) {
  const map = {
    'Activa': 'green', 'Pagado': 'green', 'Presente': 'green',
    'Pendiente': 'mustard', 'Tarde': 'mustard', 'Justificado': 'blue',
    'Retirada': 'gray', 'Vencido': 'red', 'Ausente': 'red',
    'Activo': 'green', 'Cerrado': 'gray', 'No pagado': 'red',
  };
  const cls = map[estado] || 'gray';
  return `<span class="badge ${cls}"><span class="d"></span>${esc(estado || '—')}</span>`;
}

export function toast(msg, type = 'ok') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'err' : type === 'warn' ? 'warn' : 'ok'}`;
  el.innerHTML = `<span>${type === 'error' ? '✕' : type === 'warn' ? '⚠' : '✓'}</span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 350); }, 3800);
}

export function openModal(title, bodyHtml) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="overlay" id="modal-overlay">
      <div class="modal">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="btn ghost" type="button" data-close>✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>`;
  const overlay = root.querySelector('.overlay');
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', closeOnEsc);
  return root.querySelector('.modal-body');
}

function closeOnEsc(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  document.removeEventListener('keydown', closeOnEsc);
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

export function confirmModal(title, message, onOk, okLabel = 'Confirmar') {
  const body = openModal(title, `
    <div style="font-size:13.5px; color:var(--ink-soft); line-height:1.6;">${esc(message)}</div>
    <div class="form-actions">
      <button class="btn" type="button" data-cancel>Cancelar</button>
      <button class="btn primary" type="button" data-ok>${esc(okLabel)}</button>
    </div>`);
  body.querySelector('[data-cancel]').addEventListener('click', closeModal);
  body.querySelector('[data-ok]').addEventListener('click', async () => {
    const btn = body.querySelector('[data-ok]');
    btn.disabled = true;
    try { await onOk(); closeModal(); } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  });
}

export function formValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

export function screenEls(id) {
  return {
    root: document.getElementById(id),
    title: document.getElementById('t-' + id),
    crumbs: document.getElementById('c-' + id),
    actions: document.getElementById('a-' + id),
    body: document.getElementById('b-' + id),
  };
}

export function setOpts(select, items, { value = (x) => x.id, label = (x) => x.nombre, empty = '— Seleccionar —' } = {}) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${esc(empty)}</option>` +
    items.map((x) => `<option value="${esc(value(x))}">${esc(label(x))}</option>`).join('');
  if (current) select.value = current;
  return select;
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function currentMonth() { return new Date().getMonth() + 1; }
export function currentYear() { return new Date().getFullYear(); }

export function loading(el, text = 'Cargando…') {
  if (el) el.innerHTML = `<div class="empty"><span class="spin"></span><div style="margin-top:10px;">${esc(text)}</div></div>`;
}

export function emptyState(el, icon, text) {
  el.innerHTML = `<div class="empty"><div class="e-icon">${icon}</div>${esc(text)}</div>`;
}

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const DAYS_SPANISH = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export function notifIcon(tipo) {
  const map = { PAGO_VENCIDO: 'red', PAGO_PROXIMO: 'mustard', NOTA_BAJA: 'red', INASISTENCIA: 'mustard', MATRICULA: 'blue', GENERAL: 'gray' };
  return map[tipo] || 'gray';
}

// ---------- Filtros de grados responsivos (chips -> select buscable) ----------
export function chipsDesbordan(filtros) {
  const chips = filtros.querySelector('.grado-chips');
  const search = filtros.querySelector('.search');
  if (!chips) return false;
  const prev = chips.style.cssText;
  chips.style.cssText = 'position:absolute; visibility:hidden; display:flex; flex-wrap:nowrap; white-space:nowrap; width:max-content;';
  const ancho = chips.scrollWidth;
  chips.style.cssText = prev;
  const inline = filtros.querySelector('.chips-inline');
  const ocupado = (search ? search.offsetWidth : 0) + (inline ? inline.offsetWidth : 0) + 48;
  return ancho > filtros.clientWidth - ocupado;
}

export function revisarFiltroGrado() {
  document.querySelectorAll('.filters-grado').forEach((f) => {
    f.classList.toggle('overflow', window.innerWidth > 768 && chipsDesbordan(f));
  });
}

window.addEventListener('resize', () => { clearTimeout(revisarFiltroGrado._t); revisarFiltroGrado._t = setTimeout(revisarFiltroGrado, 150); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('.grado-select')) {
    document.querySelectorAll('.grado-select.open').forEach((el) => el.classList.remove('open'));
  }
});
