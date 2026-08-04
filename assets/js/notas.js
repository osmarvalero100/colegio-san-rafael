// Pantalla Notas — planilla editable (ADMIN/PROFESOR), lectura (SECRETARIA),
// promedio por materia (ESTUDIANTE/TUTOR).
import { api } from './api.js';
import { rol, user as authUser } from './auth.js';
import { ctx, loadHijos, grados, periodos } from './context.js';
import {
  esc, avatar, gradePill, gradeClass, screenEls, openModal, toast, loading,
  setOpts, downloadCSV, fmtDate,
} from './utils.js';

const sel = { materiaId: '', gradoId: '', periodoId: '', search: '' };

export async function render() {
  const r = rol();
  if (r === 'ESTUDIANTE') return renderPromedios(authUser.data.personId);
  if (r === 'TUTOR') return renderHijosPromedios();
  return renderPlanilla();
}

// ---------- Planilla (ADMIN / PROFESOR editable, SECRETARIA lectura) ----------
async function renderPlanilla() {
  const r = rol();
  const editable = r === 'ADMIN' || r === 'PROFESOR';
  const { crumbs, actions, body } = screenEls('notas');
  crumbs.textContent = `Escala 1.0 – 5.0 · Aprobación 3.0`;

  const gs = await grados();
  const per = await periodos();
  let materias;
  if (r === 'PROFESOR') {
    materias = await api('/profesores/me/materias');
  } else {
    materias = (await api('/materias?limit=100')).data || [];
  }
  if (!per.length) { body.innerHTML = '<div class="empty">No hay periodos académicos definidos.</div>'; return; }

  const hoy = new Date().toISOString().slice(0, 10);
  const periodoActual = per.find((p) => p.fecha_inicio <= hoy && p.fecha_fin >= hoy) || per[0];
  if (!sel.periodoId) sel.periodoId = String(periodoActual.id);
  if (!sel.gradoId && gs.length) sel.gradoId = String(gs[0].id);
  if (!sel.materiaId && materias.length) sel.materiaId = String(materias[0].id);

  const selMateria = document.createElement('select');
  selMateria.id = 'notas-materia';
  selMateria.innerHTML = materias.map((m) =>
    `<option value="${m.id}" ${String(m.id) === sel.materiaId ? 'selected' : ''}>${esc(m.nombre)}${m.grado ? ` · ${esc(m.grado)}${esc(m.seccion || '')}` : ''}</option>`).join('');

  const selGrado = document.createElement('select');
  selGrado.id = 'notas-grado';
  if (r === 'PROFESOR') {
    // el grado viene de la materia elegida
    selGrado.disabled = true;
    const m = materias.find((x) => String(x.id) === sel.materiaId);
    selGrado.innerHTML = `<option>${m ? `${esc(m.grado)} ${esc(m.seccion || '')}` : '—'}</option>`;
    sel.gradoId = m ? String(m.grado_id) : '';
  } else {
    selGrado.innerHTML = gs.map((g) =>
      `<option value="${g.id}" ${String(g.id) === sel.gradoId ? 'selected' : ''}>${esc(g.grado)} ${esc(g.seccion || '')}</option>`).join('');
  }

  const selPeriodo = document.createElement('select');
  selPeriodo.id = 'notas-periodo';
  selPeriodo.innerHTML = per.map((p) =>
    `<option value="${p.id}" ${String(p.id) === sel.periodoId ? 'selected' : ''}>${esc(p.nombre)} · ${esc(p.anio)}</option>`).join('');

  const mkPicker = (label, el) => {
    const wrap = document.createElement('div');
    wrap.className = 'search';
    wrap.style.width = 'auto';
    wrap.style.padding = '0 10px';
    wrap.style.gap = '6px';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink-faint);';
    lbl.textContent = label;
    el.style.cssText = 'border:none;outline:none;font-family:Inter;font-size:13px;background:transparent;color:var(--ink);padding:8px 2px;';
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  };

  actions.innerHTML = '';
  const buscar = document.createElement('div');
  buscar.className = 'search';
  buscar.style.cssText = 'width:220px;';
  buscar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8993B3" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="notas-buscar" placeholder="Buscar estudiante…" value="' + esc(sel.search) + '">';
  actions.appendChild(buscar);
  buscar.querySelector('#notas-buscar').addEventListener('input', (e) => {
    sel.search = e.target.value;
    clearTimeout(sel._t);
    sel._t = setTimeout(cargar, 300);
  });
  actions.appendChild(mkPicker('Materia', selMateria));
  actions.appendChild(mkPicker('Grado', selGrado));
  actions.appendChild(mkPicker('Periodo', selPeriodo));
  if (editable) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Exportar planilla (CSV)';
    btn.addEventListener('click', exportarCSV);
    actions.appendChild(btn);
  }

  selMateria.addEventListener('change', () => {
    sel.materiaId = selMateria.value;
    if (r === 'PROFESOR') {
      const m = materias.find((x) => String(x.id) === sel.materiaId);
      selGrado.innerHTML = `<option>${m ? `${esc(m.grado)} ${esc(m.seccion || '')}` : '—'}</option>`;
      sel.gradoId = m ? String(m.grado_id) : '';
    }
    cargar();
  });
  selGrado.addEventListener('change', () => { sel.gradoId = selGrado.value; cargar(); });
  selPeriodo.addEventListener('change', () => { sel.periodoId = selPeriodo.value; cargar(); });

  async function cargar() {
    if (!sel.gradoId || !sel.materiaId || !sel.periodoId) {
      body.innerHTML = '<div class="empty">Selecciona materia, grado y periodo.</div>';
      return;
    }
    loading(body, 'Cargando planilla…');
    try {
      const res = await api('/notas/planilla', { query: { grado_id: sel.gradoId, materia_id: sel.materiaId, periodo_id: sel.periodoId, search: sel.search || undefined } });
      const materia = materias.find((m) => String(m.id) === sel.materiaId);
      crumbs.textContent = `Planilla ${materia ? materia.nombre : ''} · ${res.periodo.nombre} · Escala 1.0 – 5.0`;
      const filas = res.data || [];
      body.innerHTML = `<div class="panel">
        <div class="panel-head"><div><h3>${esc(materia?.nombre || 'Materia')} — ${esc(res.periodo.nombre)}</h3><div class="hint">Ponderación ${res.periodo.ponderacion ?? '—'}% · ${filas.length} estudiantes</div></div></div>
        <div class="panel-body" style="padding-top:0;overflow-x:auto;">
          <table>
            <thead><tr><th>Estudiante</th><th>Notas registradas</th><th>Promedio</th>
              ${editable ? '<th>Nueva nota (1.0–5.0)</th><th>%</th><th></th>' : ''}</tr></thead>
            <tbody>${filas.map((f) => filaPlanilla(f, editable)).join('') || '<tr><td colspan="6"><div class="empty">Sin estudiantes matriculados en este grado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

      if (editable) {
        body.querySelectorAll('[data-guardar-nota]').forEach((b) => b.addEventListener('click', guardarNota));
        body.querySelectorAll('[data-eliminar-nota]').forEach((b) => b.addEventListener('click', eliminarNota));
        body.querySelectorAll('.grade-input').forEach((inp) => inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const row = e.target.closest('tr');
            const btn = row.querySelector('[data-guardar-nota]');
            if (btn) btn.click();
          }
        }));
      }
    } catch (err) {
      body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  function filaPlanilla(f, ed) {
    const chips = (f.notas || []).map((n) =>
      `<span class="grade-pill ${gradeClass(n.nota)}" style="margin-right:4px;">${Number(n.nota).toFixed(1)}${n.porcentaje ? ` · ${n.porcentaje}%` : ''}</span>` +
      (ed ? `<span class="icon-btn danger" title="Quitar nota" data-eliminar-nota="${n.id}" style="width:18px;height:18px;font-size:10px;margin-right:6px;">✕</span>` : '')
    ).join('') || '<span class="cell-sub">Sin notas</span>';

    const celdas = ed ? `
      <td data-label="Nueva nota"><input class="grade-input" data-nota value="" type="number" min="1" max="5" step="0.1" placeholder="0.0"></td>
      <td data-label="%"><input class="grade-input" data-porcentaje value="" type="number" min="0" max="100" step="1" placeholder="0"></td>
      <td data-label=""><button class="btn" data-guardar-nota="${f.estudiante.id}">Guardar</button></td>` : '';
    return `<tr>
      <td class="row-flex">${avatar(f.estudiante.nombre, f.estudiante.apellido)}<div><div class="cell-name">${esc(f.estudiante.nombre)} ${esc(f.estudiante.apellido)}</div><div class="cell-sub id-mono">#${f.estudiante.id}</div></div></td>
      <td data-label="Notas">${chips}</td>
      <td data-label="Promedio">${gradePill(f.promedio)}</td>
      ${celdas}
    </tr>`;
  }

  async function guardarNota(e) {
    const btn = e.currentTarget;
    const tr = btn.closest('tr');
    const estudianteId = Number(btn.dataset.guardarNota);
    const nota = Number(tr.querySelector('[data-nota]').value);
    const porcentaje = Number(tr.querySelector('[data-porcentaje]').value) || null;
    if (!nota || isNaN(nota) || nota < 1 || nota > 5) { toast('La nota debe estar entre 1.0 y 5.0', 'error'); return; }
    btn.disabled = true;
    try {
      await api('/notas', { method: 'POST', body: { estudiante_id: estudianteId, materia_id: Number(sel.materiaId), periodo_id: Number(sel.periodoId), nota, porcentaje, observaciones: null } });
      toast('Nota guardada');
      cargar();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }

  async function eliminarNota(e) {
    const id = e.currentTarget.dataset.eliminarNota;
    try {
      await api(`/notas/${id}`, { method: 'DELETE' });
      toast('Nota eliminada');
      cargar();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function exportarCSV() {
    const filas = [['Estudiante', 'Notas', 'Promedio']];
    const filasDom = body.querySelectorAll('#b-notas tr');
    filasDom.forEach((tr) => {
      const celdas = tr.querySelectorAll('td');
      if (celdas.length < 3) return;
      const nombre = celdas[0].querySelector('.cell-name')?.textContent || '';
      filas.push([nombre, celdas[1].textContent.trim().replace(/\s+/g, ' '), celdas[2].textContent.trim()]);
    });
    downloadCSV(`planilla-${sel.materiaId}-p${sel.periodoId}.csv`, filas);
  }

  await cargar();
}

// ---------- Promedios por materia (ESTUDIANTE / TUTOR) ----------
async function renderPromedios(estudianteId) {
  const { crumbs, actions, body } = screenEls('notas');
  crumbs.textContent = 'Promedio por materia · Escala 1.0 – 5.0';
  actions.innerHTML = '';
  loading(body);
  try {
    const res = await api(`/notas/promedio/estudiante/${estudianteId}`);
    const bars = (res.materias || []).map((m) => {
      const pct = Math.round((Number(m.promedio) / 5) * 100);
      const cls = Number(m.promedio) >= 3 ? 'var(--teal)' : 'var(--red)';
      return `<div class="bar-row"><span class="lbl">${esc(m.materia_nombre)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cls};"></div></div><span class="bar-val">${m.promedio}</span></div>`;
    }).join('') || '<div class="empty">Sin notas registradas.</div>';
    const general = res.promedio_general;
    body.innerHTML = `<div class="grid-stats cols-3">
      <div class="stat s1"><span class="tag">Promedio general</span><div class="big mono">${general ?? '—'}</div><div class="delta ${(general ?? 0) >= 3 ? 'up' : 'down'}">Aprobación ≥ 3.0</div></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h3>Promedio por materia</h3><div class="hint">Ponderado por periodo</div></div></div><div class="panel-body">${bars}</div></div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

async function renderHijosPromedios() {
  const hijos = await loadHijos();
  const { crumbs, actions, body } = screenEls('notas');
  if (!hijos.length) {
    actions.innerHTML = '';
    crumbs.textContent = 'Sin estudiantes a cargo';
    body.innerHTML = '<div class="empty">No tienes estudiantes a tu cargo.</div>';
    return;
  }
  actions.innerHTML = `<div class="student-picker">
    <span style="font-size:12px;color:var(--ink-faint);font-weight:600;">Estudiante:</span>
    <select id="sel-hijo">${hijos.map((h) => `<option value="${h.id}" ${h.id === ctx.selectedChildId ? 'selected' : ''}>${esc(h.nombre)} ${esc(h.apellido)}</option>`).join('')}</select>
  </div>`;
  const selEl = actions.querySelector('#sel-hijo');
  if (!ctx.selectedChildId || !hijos.some((h) => h.id === ctx.selectedChildId)) ctx.selectedChildId = Number(selEl.value);
  else selEl.value = ctx.selectedChildId;
  selEl.addEventListener('change', () => { ctx.selectedChildId = Number(selEl.value); renderPromedios(ctx.selectedChildId); });
  await renderPromedios(ctx.selectedChildId);
}
