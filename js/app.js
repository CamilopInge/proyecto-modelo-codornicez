// Lógica, estado en memoria y vistas del prototipo EvalCodorniz
/* ============ Utilidades y reglas de la norma ============ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('en-CA');
const fmt = x => x == null || isNaN(x) ? '—' : Number(x).toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: x % 1 ? 2 : 0 });
let seq = 100; const nid = p => p + (++seq);
const nivelDe = x => NIVELES.find(l => x >= l.min);
const totalAves = f => (+f.inv.dia || 0) + (+f.inv.levante || 0) + (+f.inv.prod || 0);
const pesosPara = t => t >= 200 ? { MBA: 60, MBR: 25, MBG: 15 } : { MBA: 70, MBR: 30, MBG: 0 };          // Tabla 1 (200 exactas = ≥200)
const muestreoPara = t => t >= 200 ? { corrales: 2, puntos: 9 } : { corrales: 1, puntos: 5 };        // Tabla 3, 10 aves por punto
function aplica(ind, f) {
  const t = totalAves(f);
  if (ind.g === 'MBG') return t >= 200;
  if (ind.c === 'MBA10') return t > 200;
  if (ind.c === 'MBR3' || ind.c === 'MBR14') return f.sis === 'piso';
  if (ind.c === 'MBR4') return f.sis === 'jaula';
  return true
}
const tipo = ind => ind.g === 'MBG' ? 'doc' : PCT[ind.c] ? 'pct' : (ind.c === 'MBR13' || ind.c === 'MBR14') ? 'dens' : 'scale';
const sClass = v => v == null ? '' : v === 100 ? 'ok' : v === 0 ? 'bad' : 'warn';
function puntajes(ev) {
  const r = {}; let fin = 0;
  for (const g of GROUPS) {
    const cs = ev.inds.filter(c => IX[c].g === g); const vals = cs.map(c => ev.ans[c]?.v).filter(v => v != null);
    const pct = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; r[g] = { n: cs.length, resp: vals.length, pct };
    if (pct != null) fin += pct * ev.pesos[g] / 100
  }
  r.final = Math.round(fin * 100) / 100; r.resp = GROUPS.reduce((a, g) => a + r[g].resp, 0); r.n = ev.inds.length; return r
}
function validar(ev) {
  const faltan = [], bloq = [], avisos = [];
  for (const c of ev.inds) {
    const a = ev.ans[c]; if (!a || a.v == null) { faltan.push(c); continue }
    if (tipo(IX[c]) === 'doc' && !a.ev) { (a.v === 100 ? bloq : avisos).push(c) }
  }
  const w = []; const j = ev.ans.MBA1?.v, t = ev.ans.MBR11?.v;
  if (j != null && t != null && Math.abs(j - t) === 100) w.push('Jadeo (MBA1) y confort térmico (MBR11) quedaron en niveles opuestos; revisa la coherencia.');
  return { faltan, bloq, avisos, coher: w, ok: !faltan.length && !bloq.length }
}

/* ============ Estado en memoria (sin base de datos) ============ */
const S = {
  user: null, view: 'dashboard', sel: null, tab: 'MBA', ptab: 'indicadores', fgrp: 'MBA', fdep: '', ui: {}, fails: {}, lock: {},
  users: [
    { id: 'U1', usuario: 'admin', clave: 'admin123', nombre: 'Administrador del sistema', correo: 'admin@evalcodorniz.edu.co', rol: 'admin', activo: true },
    { id: 'U2', usuario: 'docente', clave: 'docente123', nombre: 'Marta Rincón', correo: 'mrincon@evalcodorniz.edu.co', rol: 'docente', activo: true },
    { id: 'U3', usuario: 'evaluador', clave: 'eval123', nombre: 'Laura Gómez', correo: 'lgomez@evalcodorniz.edu.co', rol: 'evaluador', activo: true },
    { id: 'U4', usuario: 'consultor', clave: 'consultor123', nombre: 'Andrés Pérez', correo: 'aperez@evalcodorniz.edu.co', rol: 'consultor', activo: true }],
  fincas: [
    { id: 'F1', nombre: 'Granja La Esperanza', sis: 'jaula', depto: 'Boyacá', mun: 'Tunja', vereda: 'Runta', dir: 'Km 4 vía Tunja–Moniquirá', inv: { dia: 0, levante: 300, prod: 1200 }, activa: true, ej: true },
    { id: 'F2', nombre: 'Codornices El Mirador', sis: 'piso', depto: 'Cundinamarca', mun: 'Fusagasugá', vereda: 'La Aguadita', dir: '', inv: { dia: 0, levante: 40, prod: 120 }, activa: true, ej: true },
    { id: 'F3', nombre: 'Avícola San Rafael', sis: 'jaula', depto: 'Santander', mun: 'Piedecuesta', vereda: 'Mensulí', dir: '', inv: { dia: 50, levante: 200, prod: 650 }, activa: true, ej: true }],
  evals: [], log: []
};
const finca = id => S.fincas.find(f => f.id === id);
const evalById = id => S.evals.find(e => e.id === id);
const can = (mod, lvl = 'r') => { const p = PERM[S.user?.rol]?.[mod]; return lvl === 'r' ? !!p : p === 'w' };
function log(accion, detalle) { S.log.unshift({ f: new Date().toLocaleString('es-CO'), u: S.user?.nombre || 'Sistema', accion, detalle }) }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2400) }

function crearEval(f, fecha, evaluador) {
  const t = totalAves(f);
  return {
    id: nid('E'), finca: f.id, fecha, evaluador, estado: 'en progreso', sis: f.sis, total: t,
    pesos: pesosPara(t), mu: muestreoPara(t), inds: IND.filter(i => aplica(i, f)).sort((a, b) => GROUPS.indexOf(a.g) - GROUPS.indexOf(b.g)).map(i => i.c),// snapshot (RF13)
    ans: {}, recs: [], acciones: [], forma: null
  }
}
function cerrarEval(ev, fecha) { ev.estado = 'cerrada'; ev.res = puntajes(ev); ev.nivel = nivelDe(ev.res.final).n; ev.cierre = fecha || today(); ev.forma = 'provisional' }
const VERB = { MBA: 'Intervenir el manejo de las aves', MBR: 'Adecuar instalaciones y recursos', MBG: 'Documentar y formalizar la gestión' };
function generarRecs(ev) {
  const out = [];
  for (const c of ev.inds) {
    const a = ev.ans[c]; if (a && a.v < 100) {
      const ind = IX[c];
      const pr = a.v === 0 ? 'Alta' : ind.g === 'MBA' ? 'Media' : 'Baja';
      const txt = `${VERB[ind.g]} en «${ind.n}» hasta cumplir el nivel 100: ${ind.l[0][1]}.`;
      out.push({ id: nid('R'), ind: c, pr, orig: txt, txt, estado: 'pendiente' })
    }
  }
  const o = { Alta: 0, Media: 1, Baja: 2 };
  return out.sort((x, y) => o[x.pr] - o[y.pr] || ev.pesos[IX[y.ind].g] - ev.pesos[IX[x.ind].g])
}

/* ============ Datos de ejemplo ============ */
function sembrar(ev, pat, hasta = Infinity) {
  ev.inds.slice(0, hasta).forEach(c => {
    const v = pat[c] ?? 100, ind = IX[c], ty = tipo(ind), a = { v, obs: '' };
    if (ty === 'pct') a.raw = { MBA1: { 100: 18, 55: 47, 0: 68 }, MBA2: { 100: 22, 55: 51, 0: 66 }, MBA10: { 100: 8.4, 55: 13.1, 0: 16.5 }, MBA11: { 100: 94, 55: 81, 0: 52 } }[c][v];
    if (ty === 'dens') a.raw = v === 100 ? { aves: ev.total, m2: Math.ceil(ev.total / 48) } : { aves: ev.total, m2: Math.ceil(ev.total / 68) };
    if (ty === 'doc' && v === 100) a.ev = `soporte_${c}.pdf`;
    ev.ans[c] = a
  })
}
(function seed() {
  const e1 = crearEval(finca('F1'), '2026-03-10', 'Laura Gómez');
  sembrar(e1, { MBA1: 55, MBA4: 0, MBA7: 55, MBR2: 0, MBR7: 0, MBR11: 0, MBR5: 55, MBG1: 55, MBG5: 0, MBG6: 0, MBG7: 0, MBG10: 50 }); cerrarEval(e1, '2026-03-10'); e1.forma = 'definitiva';
  const e2 = crearEval(finca('F3'), '2026-05-22', 'Laura Gómez');
  sembrar(e2, { MBA1: 0, MBA2: 55, MBA3: 55, MBA6: 55, MBA11: 55, MBR2: 0, MBR5: 55, MBR6: 55, MBR11: 0, MBR13: 0, MBG2: 0, MBG4: 0, MBG5: 0, MBG6: 0, MBG10: 50 }); cerrarEval(e2, '2026-05-22'); e2.forma = 'definitiva';
  e2.recs = generarRecs(e2); e2.recs.slice(0, 3).forEach(r => r.estado = 'aprobada');
  e2.acciones = [{ id: nid('A'), rec: e2.recs[0].id, desc: 'Instalar ventilación forzada y nebulizadores en el galpón 2', resp: 'Propietario', fecha: '2026-07-30', estado: 'cumplida', avance: 100 },
  { id: nid('A'), rec: e2.recs[1].id, desc: 'Redistribuir aves para bajar la densidad a 55 aves/m²', resp: 'Administrador de la granja', fecha: '2026-09-15', estado: 'en curso', avance: 40 }];
  const e3 = crearEval(finca('F1'), '2026-08-14', 'Laura Gómez');
  sembrar(e3, { MBA1: 55, MBA7: 55, MBR2: 55, MBR7: 0, MBR11: 55, MBG1: 55, MBG7: 0 }); cerrarEval(e3, '2026-08-14'); e3.forma = 'definitiva';
  e3.recs = generarRecs(e3); e3.recs[0].estado = 'aprobada'; e3.recs[1].estado = 'aprobada';
  e3.acciones = [{ id: nid('A'), rec: e3.recs[0].id, desc: 'Instalar 6 bebederos de niple adicionales por batería', resp: 'Propietario', fecha: '2026-10-30', estado: 'en curso', avance: 50 }];
  const e4 = crearEval(finca('F2'), '2026-09-29', 'Laura Gómez'); sembrar(e4, { MBA1: 55, MBA4: 55 }, 8);
  S.evals.push(e1, e2, e3, e4);
  S.log.push({ f: '29/9/2026, 9:12:00 a. m.', u: 'Laura Gómez', accion: 'Creó evaluación', detalle: 'Codornices El Mirador' },
    { f: '14/8/2026, 4:40:00 p. m.', u: 'Laura Gómez', accion: 'Cerró evaluación', detalle: 'Granja La Esperanza · Alto' });
})();

/* ============ Vistas ============ */
const app = document.getElementById('app');
function render() { app.innerHTML = S.user ? shell(view()) : loginView(); }

function loginView() {
  const u = S.ui; return `
<div class="login"><div class="login-card">
  <div class="brandmark"><span class="egg" aria-hidden="true"></span><b>EvalCodorniz</b></div>
  <div class="panel grid">
    <div><h1>Iniciar sesión</h1><p class="muted small">Evaluación de bienestar animal en codornices de postura · Metodología ICA</p></div>
    <form id="f-login" class="grid" autocomplete="off">
      <label>Usuario<input id="l-user" name="usuario" required value="${esc(u.lu || '')}"></label>
      <label>Contraseña<input id="l-pass" name="clave" type="password" required value="${esc(u.lp || '')}"></label>
      ${u.loginErr ? `<div class="notice bad">${esc(u.loginErr)}</div>` : ''}
      <button class="btn primary" type="submit">Entrar</button>
    </form>
    <button class="btn ghost" data-act="toggle" data-k="rec" type="button">¿Olvidaste tu contraseña?</button>
    ${u.rec ? `<form id="f-recuperar" class="grid"><label>Correo registrado<input id="r-mail" name="correo" type="email" required></label><button class="btn" type="submit">Enviar enlace</button>${u.recMsg ? `<div class="notice ok">${u.recMsg}</div>` : ''}</form>` : ''}
  </div>
  <div class="panel"><p class="eyebrow" style="margin-bottom:.5rem">Usuarios de prueba · toca uno para llenar</p>
    <div class="tablewrap"><table class="demo"><tbody>${S.users.filter(x => x.activo).map(x => `<tr data-act="fill" data-u="${x.usuario}" data-p="${x.clave}"><td>${ROLNAME[x.rol]}</td><td class="mono">${x.usuario}</td><td class="mono">${x.clave}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <p class="muted small">Prototipo sin base de datos: todo vive en memoria y se reinicia al recargar la página.</p>
</div></div>`}

function shell(content) {
  return `
<div class="app">
  <header class="top"><div class="brandmark"><span class="egg" aria-hidden="true"></span><b>EvalCodorniz</b></div>
    <div class="who"><span class="name">${esc(S.user.nombre)}</span><span class="pill brand">${ROLNAME[S.user.rol]}</span><button class="btn" data-act="logout">Salir</button></div></header>
  <nav aria-label="Módulos">${NAV.filter(([k]) => can(k)).map(([k, t]) => `<button class="navbtn ${S.view === k || (S.view === 'eval' && k === 'evaluaciones') ? 'on' : ''}" data-act="go" data-v="${k}">${t}</button>`).join('')}</nav>
  <main>${content}</main>
</div>`}

function view() {
  switch (S.view) {
    case 'fincas': return fincasView(); case 'evaluaciones': return evalsView(); case 'eval': return evalView();
    case 'planes': return planesView(); case 'parametrizacion': return paramView(); case 'usuarios': return usuariosView();
    case 'bitacora': return bitacoraView(); default: return dashView()
  }
}

function nivelPill(n) { const l = NIVELES.find(x => x.n === n); return n ? `<span class="pill ${l.k}">${n}</span>` : '<span class="pill">—</span>' }
function estadoPill(ev) { return ev.estado === 'cerrada' ? '<span class="pill brand">Cerrada</span>' : '<span class="pill warn">En progreso</span>' }

function dashView() {
  const fs = S.fincas.filter(f => !S.fdep || f.depto === S.fdep); const ids = new Set(fs.map(f => f.id));
  const ev = S.evals.filter(e => ids.has(e.finca)); const cerr = ev.filter(e => e.estado === 'cerrada');
  const prom = cerr.length ? cerr.reduce((a, e) => a + e.res.final, 0) / cerr.length : null;
  const dist = NIVELES.map(l => ({ ...l, c: cerr.filter(e => e.nivel === l.n).length })); const mx = Math.max(1, ...dist.map(d => d.c));
  const inc = {}; cerr.forEach(e => e.inds.forEach(c => { if (e.ans[c]?.v === 0) inc[c] = (inc[c] || 0) + 1 }));
  const top = Object.entries(inc).sort((a, b) => b[1] - a[1]).slice(0, 6); const mi = Math.max(1, ...top.map(t => t[1]));
  return `
<div class="pagehead"><div><p class="eyebrow">Panel general</p><h1>Bienestar animal en las fincas evaluadas</h1></div>
  <label style="min-width:200px">Departamento<select id="d-dep" data-in="fdep"><option value="">Todos</option>${DEPTOS.map(d => `<option ${S.fdep === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
<div class="grid g4">
  <div class="panel kpi"><span class="eyebrow">Fincas activas</span><span class="v">${fs.filter(f => f.activa).length}</span></div>
  <div class="panel kpi"><span class="eyebrow">Evaluaciones cerradas</span><span class="v">${cerr.length}</span></div>
  <div class="panel kpi"><span class="eyebrow">En progreso</span><span class="v">${ev.length - cerr.length}</span></div>
  <div class="panel kpi"><span class="eyebrow">Calificación promedio</span><span class="v">${fmt(prom)}</span>${prom != null ? nivelPill(nivelDe(prom).n) : ''}</div>
</div>
<div class="grid g2">
  <div class="panel"><h2>Distribución por nivel de bienestar</h2>
    ${cerr.length ? `<div class="bars">${dist.map(d => `<div class="bar"><span>${d.n}</span><div class="track"><div class="fill ${d.k}" style="width:${d.c / mx * 100}%"></div></div><span class="n">${d.c}</span></div>`).join('')}</div>` : '<p class="muted">No hay evaluaciones cerradas con este filtro.</p>'}
    <p class="muted small" style="margin-top:.8rem">Tabla 2 ICA: Excelente ≥ 90 · Alto ≥ 75 · Medio ≥ 50 · Bajo &lt; 50</p></div>
  <div class="panel"><h2>Indicadores con más incumplimientos</h2>
    ${top.length ? `<div class="bars">${top.map(([c, n]) => `<div class="bar" title="${esc(IX[c].n)}"><span class="mono">${c}</span><div class="track"><div class="fill bad" style="width:${n / mi * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}</div>
    <p class="muted small" style="margin-top:.8rem">Veces que el indicador quedó en 0 en evaluaciones cerradas.</p>`: '<p class="muted">Sin indicadores en 0.</p>'}</div>
</div>
<div class="panel"><div class="head"><h2>Evaluaciones recientes</h2></div>${evalTable(ev.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5))}</div>`
}

function evalTable(list) {
  if (!list.length) return '<p class="muted">No hay evaluaciones.</p>'; return `
<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Finca</th><th>Evaluador</th><th>Estado</th><th class="num">Calificación</th><th>Nivel</th><th></th></tr></thead><tbody>
${list.map(e => { const f = finca(e.finca); return `<tr><td class="mono">${e.fecha}</td><td>${esc(f.nombre)}${f.ej ? ' <span class="pill ej">Ejemplo</span>' : ''}</td><td>${esc(e.evaluador)}</td><td>${estadoPill(e)}</td><td class="num">${e.estado === 'cerrada' ? fmt(e.res.final) : '—'}</td><td>${e.estado === 'cerrada' ? nivelPill(e.nivel) : ''}</td><td><button class="btn" data-act="open" data-id="${e.id}">${e.estado === 'cerrada' ? 'Ver diagnóstico' : 'Continuar'}</button></td></tr>` }).join('')}
</tbody></table></div>`}

function fincasView() {
  const w = can('fincas', 'w'); const ev = can('evaluaciones', 'w'); return `
<div class="pagehead"><div><p class="eyebrow">RF05 – RF08</p><h1>Fincas</h1><p class="muted">Cada finca guarda su sistema productivo (piso o jaula) y el inventario por grupo etario. Con esos datos el sistema decide qué indicadores aplican.</p></div>
${w ? `<button class="btn primary" data-act="toggle" data-k="fform">${S.ui.fform ? 'Cerrar formulario' : 'Nueva finca'}</button>` : ''}</div>
${S.ui.fform ? `<form id="f-finca" class="panel grid"><h2>Registrar finca</h2>
  <div class="form-grid">
    <label>Nombre de la finca<input id="fi-nombre" name="nombre" required></label>
    <label>Sistema productivo<select id="fi-sis" name="sis" required><option value="jaula">Jaula</option><option value="piso">Piso</option></select></label>
    <label>Especie<input id="fi-esp" value="Codorniz (Coturnix coturnix)" disabled></label>
    <label>Departamento<select id="fi-depto" name="depto" required>${DEPTOS.map(d => `<option>${d}</option>`).join('')}</select></label>
    <label>Municipio<input id="fi-mun" name="mun" required></label>
    <label>Vereda (opcional)<input id="fi-ver" name="vereda"></label>
    <label>Aves de un día<input id="fi-dia" name="dia" type="number" min="0" value="0"></label>
    <label>Aves en levante<input id="fi-lev" name="levante" type="number" min="0" value="0"></label>
    <label>Aves en producción<input id="fi-prod" name="prod" type="number" min="0" value="0"></label>
  </div>
  <p class="muted small">Con menos de 200 aves no se evalúa la gestión (MBG) y la ponderación es 70/30. Con 200 o más se usa 60/25/15.</p>
  <div class="row"><button class="btn primary" type="submit">Guardar finca</button></div></form>`: ''}
<div class="tablewrap"><table><thead><tr><th>Finca</th><th>Sistema</th><th>Ubicación</th><th class="num">Aves</th><th>Indicadores</th><th>Estado</th><th></th></tr></thead><tbody>
${S.fincas.map(f => {
    const t = totalAves(f); const n = IND.filter(i => aplica(i, f)).length; const prog = S.evals.some(e => e.finca === f.id && e.estado === 'en progreso'); return `<tr>
<td><b>${esc(f.nombre)}</b>${f.ej ? ' <span class="pill ej">Ejemplo</span>' : ''}</td><td>${f.sis === 'piso' ? 'Piso' : 'Jaula'}</td>
<td>${esc(f.mun)}, ${esc(f.depto)}${f.vereda ? `<br><span class="muted small">Vda. ${esc(f.vereda)}</span>` : ''}</td>
<td class="num">${t.toLocaleString('es-CO')}</td><td><span class="mono">${n}</span> <span class="muted small">${t >= 200 ? 'MBA·MBR·MBG' : 'MBA·MBR'}</span></td>
<td>${f.activa ? '<span class="pill ok">Activa</span>' : '<span class="pill">Inactiva</span>'}</td>
<td><div class="row">${ev && f.activa ? (prog ? '<span class="muted small">Evaluación en progreso</span>' : `<button class="btn" data-act="neweval" data-id="${f.id}">Evaluar</button>`) : ''}${w ? `<button class="btn ghost" data-act="toggleFinca" data-id="${f.id}">${f.activa ? 'Inactivar' : 'Activar'}</button>` : ''}</div></td></tr>`
  }).join('')}
</tbody></table></div>`}

function evalsView() {
  return `
<div class="pagehead"><div><p class="eyebrow">RF13 – RF22 · RF29</p><h1>Evaluaciones</h1><p class="muted">Historial de visitas, de la más reciente a la más antigua. Para iniciar una nueva, ve a Fincas y elige Evaluar.</p></div></div>
${evalTable(S.evals.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)))}`
}

/* ---- Diligenciamiento ---- */
function evalView() { const ev = evalById(S.sel); return ev.estado === 'cerrada' ? reportView(ev) : fillView(ev) }
function fillView(ev) {
  const f = finca(ev.finca); const w = can('evaluaciones', 'w');
  const groups = GROUPS.filter(g => ev.inds.some(c => IX[c].g === g)); if (!groups.includes(S.tab)) S.tab = groups[0];
  const list = ev.inds.filter(c => IX[c].g === S.tab);
  const v = S.ui.val;
  return `
<div class="pagehead"><div><p class="eyebrow">Evaluación ${ev.id} · ${ev.fecha}</p><h1>${esc(f.nombre)}</h1>
  <p class="muted">${ev.sis === 'piso' ? 'Piso' : 'Jaula'} · ${ev.total.toLocaleString('es-CO')} aves · ${esc(f.mun)}, ${esc(f.depto)} · Evaluador: ${esc(ev.evaluador)}</p></div>
  <button class="btn ghost" data-act="go" data-v="evaluaciones">Volver al listado</button></div>
${v ? valNotice(v) : ''}
<div class="evalgrid">
  <div class="grid" style="min-width:0">
    <div class="tabs" role="tablist">${groups.map(g => { const n = ev.inds.filter(c => IX[c].g === g); const r = n.filter(c => ev.ans[c]?.v != null).length; return `<button class="tab ${S.tab === g ? 'on' : ''}" data-act="tab" data-g="${g}" role="tab">${g}<span class="c" id="tc-${g}">${r}/${n.length}</span></button>` }).join('')}</div>
    <p class="muted small">${GNAME[S.tab]} · peso ${ev.pesos[S.tab]} %</p>
    ${list.map(c => indCard(ev, c, w)).join('')}
  </div>
  <aside class="sticky" id="score-panel">${scorePanel(ev)}</aside>
</div>`}
function valNotice(v) {
  if (v.ok) return `<div class="notice ok">Todo está completo. Usa «Confirmar cierre» en el panel de la derecha para cerrar la evaluación.${v.avisos.length ? ` Hay ${v.avisos.length} indicador(es) documental(es) en nivel bajo sin evidencia: se cerrará con advertencia.` : ''}${v.coher.length ? '<ul>' + v.coher.map(x => `<li>${x}</li>`).join('') + '</ul>' : ''}</div>`;
  return `<div class="notice bad"><b>No se puede cerrar todavía.</b><ul>
  ${v.faltan.length ? `<li>Faltan ${v.faltan.length} indicador(es) por responder: <span class="mono">${v.faltan.join(', ')}</span></li>` : ''}
  ${v.bloq.length ? `<li>Marcados en 100 sin evidencia adjunta: <span class="mono">${v.bloq.join(', ')}</span></li>` : ''}
  ${v.coher.map(x => `<li>${x}</li>`).join('')}</ul></div>`
}
function indCard(ev, c, w) {
  const ind = IX[c], a = ev.ans[c] || {}, ty = tipo(ind), dis = w ? '' : 'disabled';
  let body = '';
  if (ty === 'pct') {
    const p = PCT[c]; body = `<div class="calc"><label>${p.lbl}<input id="in-${c}" type="number" min="0" max="100" step="0.1" data-k="${c}" data-f="pct" value="${a.raw ?? ''}" ${dis}></label></div>
    <div class="levels">${ind.l.map(([pts, t]) => `<div class="lv${a.v === pts ? ' on' : ''}" data-pts="${pts}" style="cursor:default"><span></span><span class="pts">${pts}</span><span>${esc(t)}</span></div>`).join('')}</div>`
  }
  else if (ty === 'dens') {
    const r = a.raw || {}; body = `<div class="calc"><label>Total de aves (TG)<input id="av-${c}" type="number" min="0" data-k="${c}" data-f="aves" value="${r.aves ?? ev.total}" ${dis}></label>
    <label>Área útil en m² (AU)<input id="m2-${c}" type="number" min="0" step="0.1" data-k="${c}" data-f="m2" value="${r.m2 ?? ''}" ${dis}></label></div>
    <p class="muted small">Umbral: 55 aves por m². ${ind.l.map(([p, t]) => `<b>${p}</b>: ${esc(t)}`).join(' · ')}</p>`
  }
  else {
    body = `<div class="levels">${ind.l.map(([pts, t]) => `<label class="lv"><input type="radio" name="r-${c}" value="${pts}" data-k="${c}" data-f="radio" ${a.v === pts ? 'checked' : ''} ${dis}><span class="pts">${pts}</span><span>${esc(t)}</span></label>`).join('')}</div>`;
    if (ty === 'doc') body += `<label>Documento de soporte (PDF o imagen, máx. 5 MB)<input id="ev-in-${c}" type="file" accept=".pdf,.jpg,.jpeg,.png" data-k="${c}" data-f="ev" ${dis}></label><p class="small" id="ev-${c}">${a.ev ? `Adjunto: <span class="mono">${esc(a.ev)}</span>` : '<span class="muted">Sin evidencia adjunta</span>'}</p>`
  }
  return `<article class="ind ${a.v != null ? 's' + a.v : ''}" id="card-${c}">
  <div class="meta"><span class="mono">${c}</span><span id="b-${c}">${badge(a.v)}</span></div>
  <div><h3>${esc(ind.n)}</h3><p class="q">${esc(ind.q)}</p><p class="muted small">${esc(ind.m)}</p></div>
  ${body}
  <label>Observación (opcional)<input id="ob-${c}" data-k="${c}" data-f="obs" value="${esc(a.obs || '')}" ${dis}></label>
</article>`}
const badge = v => v == null ? '<span class="pill">Sin responder</span>' : `<span class="pill ${sClass(v)}">${v} puntos</span>`;
function scorePanel(ev) {
  const r = puntajes(ev); const nv = nivelDe(r.final); const v = S.ui.val;
  return `<div class="panel grid">
  <div><p class="eyebrow">Calificación parcial</p><div class="score-big">${fmt(r.final)}</div><p class="muted small">${r.resp} de ${r.n} indicadores respondidos</p></div>
  <div class="lvlscale">${['Bajo', 'Medio', 'Alto', 'Excelente'].map(n => `<span class="${r.resp && nv.n === n ? 'on' : ''}">${n}</span>`).join('')}</div>
  <div class="grid" style="gap:.5rem">${GROUPS.map(g => `<div class="gline"><span class="mono">${g}</span><div class="track"><div class="fill" style="width:${r[g].pct ?? 0}%"></div></div><span class="small">${r[g].n ? fmt(r[g].pct) + ' % × ' + ev.pesos[g] : 'no aplica'}</span></div>`).join('')}</div>
  <p class="muted small">Final = Σ (promedio del grupo × peso Tabla 1)</p>
</div>
<div class="panel grid"><p class="eyebrow">Plan de muestreo · Tabla 3</p>
  <div class="plan"><div><b>${ev.mu.corrales}</b><span>corrales</span></div><div><b>${ev.mu.puntos}</b><span>puntos</span></div><div><b>${ev.mu.puntos * 10}</b><span>aves</span></div></div>
  <p class="muted small">10 aves por punto, de 4 semanas o más en producción. ${ev.total > 1000 ? 'Más de 1.000 aves: se exige soporte documental en agua y espacio.' : ''}</p></div>
${can('evaluaciones', 'w') ? `<div class="grid"><button class="btn" data-act="save">Guardar avance</button><button class="btn primary" data-act="close">Cerrar evaluación</button>${v && v.ok ? '<button class="btn danger" data-act="confirmClose">Confirmar cierre</button>' : ''}</div>` : ''}`
}

/* ---- Diagnóstico / forma oficial ---- */
function reportView(ev) {
  const f = finca(ev.finca), r = ev.res; const crit = ev.inds.filter(c => ev.ans[c].v === 0); const wr = can('planes', 'w');
  const pend = ev.inds.filter(c => tipo(IX[c]) === 'doc' && !ev.ans[c].ev);
  return `
<div class="pagehead"><div><p class="eyebrow">Forma oficial de la visita · ${ev.id}</p><h1>${esc(f.nombre)}</h1>
  <p class="muted">Cerrada el ${ev.cierre} por ${esc(ev.evaluador)}</p></div>
  <div class="row">${ev.forma === 'provisional' ? `<span class="pill warn">Provisional</span>${can('evaluaciones', 'w') ? '<button class="btn" data-act="definitiva">Emitir forma definitiva</button>' : ''}` : '<span class="pill ok">Definitiva</span>'}
  <button class="btn ghost" data-act="go" data-v="evaluaciones">Volver</button></div></div>
${ev.forma === 'provisional' ? `<div class="notice warn">${pend.length ? `Hay 1 día hábil para subsanar ${pend.length} documento(s) pendiente(s): <span class="mono">${pend.join(', ')}</span>. Si no llegan, la calificación queda definitiva.` : 'No hay documentos pendientes. Puedes emitir la forma definitiva.'}</div>` : ''}
<div class="report">
  <section class="panel"><h2>Datos generales del predio</h2><dl class="dl">
    <div><dt>Sistema</dt><dd>${ev.sis === 'piso' ? 'Piso' : 'Jaula'}</dd></div><div><dt>Número de aves</dt><dd>${ev.total.toLocaleString('es-CO')}</dd></div>
    <div><dt>Ubicación</dt><dd>${esc(f.mun)}, ${esc(f.depto)}</dd></div><div><dt>Fecha de visita</dt><dd>${ev.fecha}</dd></div>
    <div><dt>Indicadores aplicados</dt><dd>${ev.inds.length}</dd></div><div><dt>Ponderación</dt><dd>${GROUPS.map(g => ev.pesos[g]).join(' / ')}</dd></div></dl></section>
  <section class="grid g2">
    <div class="panel grid"><p class="eyebrow">Calificación final</p><div class="row" style="align-items:baseline"><span class="score-big">${fmt(r.final)}</span>${nivelPill(ev.nivel)}</div>
      <div class="grid" style="gap:.5rem">${GROUPS.map(g => `<div class="gline"><span class="mono">${g}</span><div class="track"><div class="fill" style="width:${r[g].pct ?? 0}%"></div></div><span class="small">${r[g].n ? fmt(r[g].pct) + ' % × ' + ev.pesos[g] + ' = ' + fmt(r[g].pct * ev.pesos[g] / 100) : 'no aplica'}</span></div>`).join('')}</div></div>
    <div class="panel"><h2>Indicadores críticos</h2>${crit.length ? GROUPS.filter(g => crit.some(c => IX[c].g === g)).map(g => `<p class="eyebrow" style="margin:.6rem 0 .3rem">${g}</p><div class="grid" style="gap:.3rem">${crit.filter(c => IX[c].g === g).map(c => `<div class="row"><span class="pill bad">0</span><span class="mono">${c}</span><span>${esc(IX[c].n)}</span></div>`).join('')}</div>`).join('') : '<p class="notice ok">No hay indicadores críticos en esta evaluación.</p>'}</div>
  </section>
  <section class="panel"><div class="head"><h2>Recomendaciones</h2>
    ${wr && !ev.recs.length ? `<button class="btn primary" data-act="genrecs" ${S.ui.gen ? 'disabled' : ''}>${S.ui.gen ? 'Generando…' : 'Generar con IA'}</button>` : ''}</div>
    ${ev.recs.length ? `<div class="grid" style="gap:.6rem">${ev.recs.map(rc => recCard(ev, rc, wr)).join('')}</div>` : `<p class="muted">${S.ui.gen ? 'El servicio de IA está analizando los indicadores con puntaje bajo…' : 'Aún no se han generado recomendaciones. La IA propone una por cada indicador por debajo de 100 y el evaluador decide cuáles aprobar.'}</p>`}
    <p class="muted small" style="margin-top:.8rem">Prototipo: la "IA" se simula con plantillas basadas en el nivel 100 de cada ficha.</p></section>
  <section class="panel"><div class="head"><h2>Plan de mejora</h2>${ev.acciones.length ? planPill(ev) : ''}</div>${accionesTable(ev.acciones.map(a => ({ a, ev })), wr, false)}</section>
  <section class="panel"><h2>Detalle por indicador</h2><div class="tablewrap"><table><thead><tr><th>Código</th><th>Indicador</th><th>Respuesta</th><th class="num">Puntaje</th></tr></thead><tbody>
    ${ev.inds.map(c => {
    const a = ev.ans[c], ind = IX[c]; const lvl = ind.l.find(l => l[0] === a.v); const raw = tipo(ind) === 'pct' ? ` (${fmt(a.raw)} %)` : tipo(ind) === 'dens' && a.raw ? ` (${fmt(a.raw.aves / a.raw.m2)} aves/m²)` : '';
    return `<tr><td class="mono">${c}</td><td>${esc(ind.n)}</td><td class="small">${esc(lvl ? lvl[1] : '')}${raw}${a.ev ? `<br><span class="muted">Soporte: ${esc(a.ev)}</span>` : ''}</td><td class="num"><span class="pill ${sClass(a.v)}">${a.v}</span></td></tr>`
  }).join('')}
  </tbody></table></div></section>
</div>`}
function recCard(ev, rc, wr) {
  const ind = IX[rc.ind]; const acc = ev.acciones.find(a => a.rec === rc.id); const k = { Alta: 'bad', Media: 'warn', Baja: 'brand' }[rc.pr];
  return `<div class="rec ${rc.estado}">
  <div class="row" style="justify-content:space-between"><div class="row"><span class="pill ${k}">Prioridad ${rc.pr.toLowerCase()}</span><span class="mono">${rc.ind}</span><span class="small">${esc(ind.n)} · ${ev.ans[rc.ind].v} pts</span></div>
  <span class="pill ${rc.estado === 'aprobada' ? 'ok' : ''}">${rc.estado[0].toUpperCase() + rc.estado.slice(1)}</span></div>
  ${rc.estado === 'pendiente' && wr ? `<textarea id="tx-${rc.id}" data-rec="${rc.id}" data-e="${ev.id}">${esc(rc.txt)}</textarea>` : `<p>${esc(rc.txt)}</p>`}
  ${rc.txt !== rc.orig ? `<p class="muted small">Texto original de la IA: ${esc(rc.orig)}</p>` : ''}
  ${wr && rc.estado === 'pendiente' ? `<div class="row"><button class="btn primary" data-act="rec" data-s="aprobada" data-id="${rc.id}">Aprobar</button><button class="btn" data-act="rec" data-s="descartada" data-id="${rc.id}">Descartar</button></div>` : ''}
  ${wr && rc.estado === 'aprobada' && !acc ? (S.ui.accFor === rc.id ? `<form id="f-acc" data-rec="${rc.id}" class="form-grid"><label>Acción concreta<input id="ac-desc" name="desc" required></label><label>Responsable<input id="ac-resp" name="resp" required></label><label>Fecha límite<input id="ac-fecha" name="fecha" type="date" required></label><div class="row" style="align-self:end"><button class="btn primary" type="submit">Crear acción</button></div></form>` : `<div><button class="btn" data-act="accFor" data-id="${rc.id}">Convertir en acción del plan</button></div>`) : ''}
  ${acc ? `<p class="small muted">En plan de mejora: ${esc(acc.desc)}</p>` : ''}
</div>`}
const atrasada = a => a.estado !== 'cumplida' && a.fecha < today();
function planPill(ev) { const c = ev.acciones.length && ev.acciones.every(a => a.estado === 'cumplida'); return c ? '<span class="pill ok">Plan cerrado</span>' : '<span class="pill warn">Plan abierto</span>' }
function accionesTable(rows, wr, showFinca) {
  if (!rows.length) return '<p class="muted">Sin acciones. Aprueba una recomendación y conviértela en acción.</p>'; return `
<div class="tablewrap"><table><thead><tr>${showFinca ? '<th>Finca</th>' : ''}<th>Acción</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th><th>Avance</th></tr></thead><tbody>
${rows.map(({ a, ev }) => `<tr>${showFinca ? `<td><button class="btn ghost" data-act="open" data-id="${ev.id}">${esc(finca(ev.finca).nombre)}</button></td>` : ''}<td>${esc(a.desc)}</td><td>${esc(a.resp)}</td>
<td class="mono">${a.fecha}${atrasada(a) ? ' <span class="pill bad">Atrasada</span>' : ''}</td>
<td>${wr ? `<select id="st-${a.id}" data-acc="${a.id}" data-f="estado">${['pendiente', 'en curso', 'cumplida'].map(s => `<option ${a.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : a.estado}</td>
<td style="min-width:150px"><div class="row" style="flex-wrap:nowrap">${wr ? `<input id="av-${a.id}" type="range" min="0" max="100" step="10" value="${a.avance}" data-acc="${a.id}" data-f="avance">` : ''}<span class="mono">${a.avance}%</span></div></td></tr>`).join('')}
</tbody></table></div>`}

function planesView() {
  const rows = S.evals.flatMap(ev => ev.acciones.map(a => ({ a, ev }))); const at = rows.filter(r => atrasada(r.a)).length; return `
<div class="pagehead"><div><p class="eyebrow">RF27 – RF28 · RF40</p><h1>Planes de mejora</h1><p class="muted">Seguimiento de las acciones que salieron de recomendaciones aprobadas.</p></div></div>
${at ? `<div class="notice warn">${at} acción(es) vencida(s) sin cumplir.</div>` : ''}
${accionesTable(rows, can('planes', 'w'), true)}`
}

function paramView() {
  const t = S.ptab; const tabs = [['indicadores', 'Indicadores (35)'], ['tablas', 'Ponderaciones y niveles'], ['permisos', 'Matriz de permisos']]; return `
<div class="pagehead"><div><p class="eyebrow">RF09 – RF12 · RF38</p><h1>Parametrización</h1><p class="muted">Checklist de codorniz según la metodología ICA. En este prototipo se muestra en modo consulta.</p></div></div>
<div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${t === k ? 'on' : ''}" data-act="ptab" data-t="${k}">${n}</button>`).join('')}</div>
${t === 'indicadores' ? `<div class="row">${GROUPS.map(g => `<button class="btn ${S.fgrp === g ? 'primary' : ''}" data-act="fgrp" data-g="${g}">${g} · ${IND.filter(i => i.g === g).length}</button>`).join('')}</div>
<div class="tablewrap"><table><thead><tr><th>Código</th><th>Indicador</th><th>Método</th><th>Tipo de campo</th><th>Escala</th><th>Aplica</th></tr></thead><tbody>
${IND.filter(i => i.g === S.fgrp).map(i => `<tr><td class="mono">${i.c}</td><td><b>${esc(i.n)}</b><br><span class="small muted">${esc(i.q)}</span></td><td class="small">${esc(i.m)}</td>
<td class="small">${{ scale: 'Selección de escala', pct: 'Porcentaje con umbral', dens: 'Fórmula (aves/m²)', doc: 'Escala + carga de archivo' }[tipo(i)]}</td><td class="mono">${i.l.map(l => l[0]).join('/')}</td>
<td class="small">${i.g === 'MBG' ? '≥ 200 aves' : i.c === 'MBA10' ? '> 200 aves' : i.c === 'MBR4' ? 'Solo jaula' : (i.c === 'MBR3' || i.c === 'MBR14') ? 'Solo piso' : 'Piso y jaula'}</td></tr>`).join('')}
</tbody></table></div>`: ''}
${t === 'tablas' ? `<div class="grid g2">
<div class="panel"><h2>Tabla 1 · Ponderación</h2><div class="tablewrap"><table><thead><tr><th>Aves</th><th class="num">MBA</th><th class="num">MBR</th><th class="num">MBG</th></tr></thead><tbody>
<tr><td>≥ 200</td><td class="num">60 %</td><td class="num">25 %</td><td class="num">15 %</td></tr><tr><td>&lt; 200</td><td class="num">70 %</td><td class="num">30 %</td><td class="num">—</td></tr></tbody></table></div></div>
<div class="panel"><h2>Tabla 2 · Niveles de bienestar</h2><div class="tablewrap"><table><thead><tr><th>Nivel</th><th>Rango</th></tr></thead><tbody>
<tr><td>${nivelPill('Excelente')}</td><td>≥ 90</td></tr><tr><td>${nivelPill('Alto')}</td><td>≥ 75 y &lt; 90</td></tr><tr><td>${nivelPill('Medio')}</td><td>≥ 50 y &lt; 75</td></tr><tr><td>${nivelPill('Bajo')}</td><td>&lt; 50</td></tr></tbody></table></div></div>
<div class="panel"><h2>Tabla 3 · Tamaño de muestra</h2><div class="tablewrap"><table><thead><tr><th>Aves</th><th class="num">Corrales</th><th class="num">Puntos</th><th class="num">Aves por punto</th></tr></thead><tbody>
<tr><td>&lt; 200</td><td class="num">1</td><td class="num">5</td><td class="num">10</td></tr><tr><td>≥ 200</td><td class="num">2</td><td class="num">9</td><td class="num">10</td></tr></tbody></table></div><p class="muted small" style="margin-top:.6rem">Un predio con exactamente 200 aves se trata como ≥ 200.</p></div></div>`: ''}
${t === 'permisos' ? `<div class="tablewrap"><table><thead><tr><th>Módulo</th>${Object.keys(PERM).map(r => `<th>${ROLNAME[r]}</th>`).join('')}</tr></thead><tbody>
${NAV.map(([k, n]) => `<tr><td>${n}</td>${Object.keys(PERM).map(r => `<td>${PERM[r][k] === 'w' ? '<span class="pill ok">Edición</span>' : PERM[r][k] ? '<span class="pill">Lectura</span>' : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
</tbody></table></div>`: ''}`
}

function usuariosView() {
  return `
<div class="pagehead"><div><p class="eyebrow">RF02 – RF03</p><h1>Usuarios</h1><p class="muted">Un usuario inactivo no puede iniciar sesión. El cambio de rol aplica de inmediato.</p></div>
<button class="btn primary" data-act="toggle" data-k="uform">${S.ui.uform ? 'Cerrar formulario' : 'Nuevo usuario'}</button></div>
${S.ui.uform ? `<form id="f-user" class="panel grid"><div class="form-grid">
<label>Nombre<input id="u-nombre" name="nombre" required></label><label>Correo<input id="u-correo" name="correo" type="email" required></label>
<label>Usuario<input id="u-usuario" name="usuario" required></label><label>Contraseña<input id="u-clave" name="clave" required></label>
<label>Rol<select id="u-rol" name="rol">${Object.entries(ROLNAME).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label></div>
<div class="row"><button class="btn primary" type="submit">Crear usuario</button></div></form>`: ''}
<div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
${S.users.map(u => `<tr><td>${esc(u.nombre)}</td><td class="mono">${esc(u.usuario)}</td><td class="small">${esc(u.correo)}</td>
<td><select id="ur-${u.id}" data-urol="${u.id}" ${u.id === S.user.id ? 'disabled' : ''}>${Object.entries(ROLNAME).map(([k, n]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
<td>${u.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill">Inactivo</span>'}</td>
<td>${u.id !== S.user.id ? `<button class="btn ghost" data-act="toggleUser" data-id="${u.id}">${u.activo ? 'Inactivar' : 'Activar'}</button>` : ''}</td></tr>`).join('')}
</tbody></table></div>`}

function bitacoraView() {
  return `
<div class="pagehead"><div><p class="eyebrow">RF39</p><h1>Bitácora de auditoría</h1><p class="muted">Registro de solo lectura de las acciones relevantes.</p></div></div>
<div class="tablewrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
${S.log.map(l => `<tr><td class="mono small">${esc(l.f)}</td><td>${esc(l.u)}</td><td>${esc(l.accion)}</td><td class="small">${esc(l.detalle)}</td></tr>`).join('')}
</tbody></table></div>`}

/* ============ Acciones ============ */
const ACT = {
  fill: d => { S.ui.lu = d.u; S.ui.lp = d.p; render() },
  toggle: d => { S.ui[d.k] = !S.ui[d.k]; if (d.k === 'rec') S.ui.recMsg = ''; render() },
  logout: () => { log('Cerró sesión', ''); S.user = null; S.ui = {}; render() },
  go: d => { S.view = d.v; S.ui.val = null; render(); scrollTo(0, 0) },
  open: d => { S.sel = d.id; S.view = 'eval'; S.ui.val = null; S.ui.accFor = null; render(); scrollTo(0, 0) },
  tab: d => { S.tab = d.g; render() }, ptab: d => { S.ptab = d.t; render() }, fgrp: d => { S.fgrp = d.g; render() },
  toggleFinca: d => { const f = finca(d.id); f.activa = !f.activa; log(f.activa ? 'Activó finca' : 'Inactivó finca', f.nombre); toast(f.activa ? 'Finca activada' : 'Finca inactivada; sus evaluaciones se conservan'); render() },
  toggleUser: d => { const u = S.users.find(x => x.id === d.id); u.activo = !u.activo; log(u.activo ? 'Activó usuario' : 'Inactivó usuario', u.usuario); render() },
  neweval: d => {
    const f = finca(d.id); if (totalAves(f) <= 0) { toast('Registra el inventario de aves antes de evaluar'); return }
    const ev = crearEval(f, today(), S.user.nombre); S.evals.push(ev); log('Creó evaluación', f.nombre); S.sel = ev.id; S.view = 'eval'; S.tab = 'MBA'; S.ui.val = null; render(); scrollTo(0, 0); toast(`Checklist cargado: ${ev.inds.length} indicadores`)
  },
  save: () => { log('Guardó avance', finca(evalById(S.sel).finca).nombre); toast('Avance guardado') },
  close: () => { const ev = evalById(S.sel); S.ui.val = validar(ev); render(); scrollTo(0, 0) },
  confirmClose: () => {
    const ev = evalById(S.sel); const v = validar(ev); if (!v.ok) { S.ui.val = v; render(); return }
    cerrarEval(ev); S.ui.val = null; log('Cerró evaluación', `${finca(ev.finca).nombre} · ${fmt(ev.res.final)} · ${ev.nivel}`); render(); scrollTo(0, 0); toast(`Evaluación cerrada: ${fmt(ev.res.final)} · ${ev.nivel}`)
  },
  definitiva: () => { const ev = evalById(S.sel); ev.forma = 'definitiva'; log('Emitió forma definitiva', finca(ev.finca).nombre); render() },
  genrecs: () => { const ev = evalById(S.sel); S.ui.gen = true; render(); setTimeout(() => { ev.recs = generarRecs(ev); S.ui.gen = false; log('Generó recomendaciones con IA', `${ev.recs.length} para ${finca(ev.finca).nombre}`); render() }, 900) },
  rec: d => {
    const ev = evalById(S.sel); const rc = ev.recs.find(r => r.id === d.id); const tx = document.getElementById('tx-' + rc.id); if (tx) rc.txt = tx.value.trim() || rc.orig;
    rc.estado = d.s; log(d.s === 'aprobada' ? 'Aprobó recomendación' : 'Descartó recomendación', rc.ind); render()
  },
  accFor: d => { S.ui.accFor = d.id; render() }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; ACT[b.dataset.act]?.(b.dataset, b, e) });

const FORMS = {
  'f-login': fd => {
    const u = fd.get('usuario').trim(), p = fd.get('clave'); S.ui.lu = u; S.ui.lp = '';
    if (S.lock[u] && S.lock[u] > Date.now()) { S.ui.loginErr = `Acceso bloqueado por 5 intentos fallidos. Intenta de nuevo en ${Math.ceil((S.lock[u] - Date.now()) / 1000)} s.`; render(); return }
    const usr = S.users.find(x => x.usuario === u && x.clave === p && x.activo);
    if (!usr) {
      S.fails[u] = (S.fails[u] || 0) + 1; if (S.fails[u] >= 5) { S.lock[u] = Date.now() + 60000; S.fails[u] = 0; S.ui.loginErr = 'Acceso bloqueado por 5 intentos fallidos. Intenta de nuevo en 60 s.' }
      else S.ui.loginErr = 'Usuario o contraseña incorrectos.'; render(); return
    }
    S.fails[u] = 0; S.user = usr; S.ui = {}; S.view = 'dashboard'; log('Inició sesión', ROLNAME[usr.rol]); render()
  },
  'f-recuperar': fd => {
    const u = S.users.find(x => x.correo === fd.get('correo').trim()); const tk = Math.random().toString(36).slice(2, 10);
    S.ui.recMsg = u ? `No hay servidor de correo configurado. Entrega este enlace por otro canal (válido 30 min, un solo uso):<br><span class="mono">evalcodorniz/restablecer?token=${tk}</span>` : 'Si el correo está registrado, se generó un enlace de recuperación.'; render()
  },
  'f-finca': fd => {
    const f = {
      id: nid('F'), nombre: fd.get('nombre').trim(), sis: fd.get('sis'), depto: fd.get('depto'), mun: fd.get('mun').trim(), vereda: fd.get('vereda').trim(), dir: '',
      inv: { dia: +fd.get('dia') || 0, levante: +fd.get('levante') || 0, prod: +fd.get('prod') || 0 }, activa: true
    };
    S.fincas.push(f); S.ui.fform = false; log('Registró finca', f.nombre); toast(`Finca registrada · ${IND.filter(i => aplica(i, f)).length} indicadores aplican`); render()
  },
  'f-user': fd => {
    if (S.users.some(x => x.usuario === fd.get('usuario').trim())) { toast('Ese usuario ya existe'); return }
    S.users.push({ id: nid('U'), nombre: fd.get('nombre').trim(), correo: fd.get('correo').trim(), usuario: fd.get('usuario').trim(), clave: fd.get('clave'), rol: fd.get('rol'), activo: true });
    S.ui.uform = false; log('Creó usuario', fd.get('usuario')); toast('Usuario creado; ya puede iniciar sesión'); render()
  },
  'f-acc': (fd, form) => {
    const ev = evalById(S.sel); ev.acciones.push({ id: nid('A'), rec: form.dataset.rec, desc: fd.get('desc').trim(), resp: fd.get('resp').trim(), fecha: fd.get('fecha'), estado: 'pendiente', avance: 0 });
    S.ui.accFor = null; log('Creó acción de mejora', fd.get('desc')); render()
  }
};
document.addEventListener('submit', e => { e.preventDefault(); FORMS[e.target.id]?.(new FormData(e.target), e.target) });

document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if (d.in === 'fdep') { S.fdep = el.value; render(); return }
  if (d.urol) { const u = S.users.find(x => x.id === d.urol); u.rol = el.value; log('Cambió rol', `${u.usuario} → ${ROLNAME[u.rol]}`); toast('Rol actualizado'); return }
  if (d.rec) { const ev = evalById(d.e); const rc = ev.recs.find(r => r.id === d.rec); rc.txt = el.value.trim() || rc.orig; log('Editó recomendación', rc.ind); return }
  if (d.acc) {
    const a = S.evals.flatMap(x => x.acciones).find(x => x.id === d.acc);
    if (d.f === 'estado') { a.estado = el.value; if (a.estado === 'cumplida') a.avance = 100 } else { a.avance = +el.value; a.estado = a.avance === 100 ? 'cumplida' : a.avance > 0 ? 'en curso' : a.estado }
    log('Actualizó acción', `${a.desc} · ${a.estado} ${a.avance}%`); render(); return
  }
  if (!d.k) return;
  const ev = evalById(S.sel), c = d.k, a = ev.ans[c] || (ev.ans[c] = { v: null, obs: '' });
  if (d.f === 'radio') a.v = +el.value;
  else if (d.f === 'pct') { if (el.value === '') { a.v = null; a.raw = null } else { const x = Math.min(100, Math.max(0, +el.value)); a.raw = x; a.v = PCT[c].f(x) } }
  else if (d.f === 'aves' || d.f === 'm2') { a.raw = a.raw || { aves: ev.total }; a.raw[d.f] = +el.value; const r = a.raw; a.v = r.aves > 0 && r.m2 > 0 ? (r.aves / r.m2 <= 55 ? 100 : 0) : null }
  else if (d.f === 'obs') { a.obs = el.value; return }
  else if (d.f === 'ev') {
    const file = el.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { toast('El archivo supera 5 MB'); el.value = ''; return }
    a.ev = file.name; document.getElementById('ev-' + c).innerHTML = `Adjunto: <span class="mono">${esc(file.name)}</span>`; toast('Evidencia adjunta')
  }
  const card = document.getElementById('card-' + c); card.className = 'ind ' + (a.v != null ? 's' + a.v : '');
  card.querySelectorAll('.lv[data-pts]').forEach(x => x.classList.toggle('on', +x.dataset.pts === a.v));
  document.getElementById('b-' + c).innerHTML = badge(a.v) + (d.f === 'aves' || d.f === 'm2' ? (a.raw.m2 ? ` <span class="small muted">${fmt(a.raw.aves / a.raw.m2)} aves/m²</span>` : '') : '');
  const g = IX[c].g, n = ev.inds.filter(x => IX[x].g === g); document.getElementById('tc-' + g).textContent = `${n.filter(x => ev.ans[x]?.v != null).length}/${n.length}`;
  if (S.ui.val) S.ui.val = null;
  document.getElementById('score-panel').innerHTML = scorePanel(ev)
});

render();
