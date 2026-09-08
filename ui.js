'use strict';

/* ── Rendering ── */
function weekLabelText(){
  const a = S.weekStart, b = addDays(a, 6);
  const yr = (a.getFullYear() !== new Date().getFullYear()) ? ' ' + a.getFullYear() : '';
  if (a.getMonth() === b.getMonth()) return MONTHS[a.getMonth()] + ' ' + a.getDate() + ' – ' + b.getDate() + yr;
  return MONTHS[a.getMonth()] + ' ' + a.getDate() + ' – ' + MONTHS[b.getMonth()] + ' ' + b.getDate() + yr;
}
function renderBlockStrip(cur){
  const bs = el.blockstrip;
  if (!cur){
    bs.classList.add('empty');
    const nb = S.program ? nextBlockAfter(S.program, wsStr()) : null;
    const d = nb ? parseDate(nb.start) : null;
    bs.innerHTML = '<div class="bs-top"><span class="bs-week">No block this week</span></div>' +
      '<p class="bs-focus">' + (nb ? escapeHtml(nb.name) + ' starts ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + '.' : 'A rest week, or the next block isn\u2019t in yet. <u>Add it in settings</u>.') + '</p>';
    return;
  }
  bs.classList.remove('empty');
  const w = (cur.block.weeks || [])[cur.weekIdx - 1] || {};
  bs.innerHTML = '<div class="bs-top"><span class="bs-week">Week <b>' + cur.weekIdx + '</b> of ' + cur.nWeeks + (w.label ? ' \u00b7 ' + escapeHtml(w.label) : '') + '</span><span class="bs-name">' + escapeHtml(cur.block.name) + '</span></div>' +
    (w.focus ? '<p class="bs-focus">' + escapeHtml(w.focus) + '</p>' : '');
}
function renderSpine(cur){
  const todayStr = fmtDate(new Date());
  const order = orderFor(S.state, wsStr());
  let h = '';
  for (let i = 0; i < 7; i++){
    const d = addDays(S.weekStart, i), ds = fmtDate(d);
    const isToday = ds === todayStr;
    h += '<div class="dayrow' + (isToday ? ' today' : '') + '" data-idx="' + i + '">' +
      '<div class="rail"><span class="dw">' + DOWS[i].toUpperCase() + '</span><span class="dn">' + d.getDate() + '</span></div>';
    if (!cur){
      h += '<div class="card empty" data-kind="rest">Nothing planned</div><button class="grip" disabled aria-hidden="true"></button>';
    } else {
      const day = dayAt(cur, order, i);
      const total = day.sessions.length;
      const doneN = day.sessions.filter(x => isDone(day.slot, x.sid)).length;
      const moved = day.slot !== i;
      let chips = '';
      for (const x of day.sessions){
        const dn = isDone(day.slot, x.sid);
        chips += '<span class="chip' + (dn ? ' done' : '') + '"><i>' + (dn ? '\u2713' : '') + '</i>' + escapeHtml(x.s.title) + '</span>';
      }
      h += '<button class="card' + (total && doneN === total ? ' alldone' : '') + '" data-kind="' + escapeHtml(day.dt.kind || 'rest') + '" data-idx="' + i + '" aria-label="' + DOWFULL[i] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ': ' + escapeHtml(day.dt.label) + (moved ? ', moved from ' + DOWFULL[day.slot] : '') + '">' +
        (moved ? '<span class="moved">from ' + DOWS[day.slot] + '</span>' : '') +
        '<span class="ttl">' + escapeHtml(day.dt.label) + '</span>' +
        '<span class="chips">' + chips + '</span></button>' +
        '<button class="grip" data-idx="' + i + '" aria-label="Drag to move ' + DOWFULL[i] + '"><svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor"><circle cx="4" cy="3" r="1.6"/><circle cx="10" cy="3" r="1.6"/><circle cx="4" cy="9" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="4" cy="15" r="1.6"/><circle cx="10" cy="15" r="1.6"/></svg></button>';
    }
    h += '</div>';
  }
  el.spine.innerHTML = h;
}
function renderStatus(){
  const m = el.statusMode;
  if (!S.repoCfg){ m.textContent = 'Local only'; m.classList.add('warn'); el.statusSync.innerHTML = ''; return; }
  if (!S.token){ m.textContent = 'Read-only'; m.classList.add('warn'); }
  else { m.textContent = S.local ? 'Unsaved changes' : 'Synced'; m.classList.toggle('warn', S.local); }
  if (S.loadError){ el.statusSync.innerHTML = (S.fromCache ? 'Showing saved copy \u00b7 ' : '') + '<u>Retry</u>'; return; }
  const t = S.lastSync ? S.lastSync.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : '\u2014';
  el.statusSync.innerHTML = t + ' &nbsp;<u>&#8635;</u>';
}
function render(){
  el.weekLabel.textContent = weekLabelText();
  el.btnToday.disabled = fmtDate(S.weekStart) === fmtDate(startOfWeek(new Date()));
  const cur = current();
  renderBlockStrip(cur);
  renderSpine(cur);
  renderStatus();
}

/* ── Sheets ── */
function openOverlay(which){ el.backdrop.classList.add('show'); which.classList.add('show'); which.scrollTop = 0; }
function closeOverlays(){ el.backdrop.classList.remove('show'); el.sheet.classList.remove('show'); el.settings.classList.remove('show'); S.open = null; }
el.backdrop.addEventListener('click', closeOverlays);

function openDay(i){
  const cur = current(); if (!cur) return;
  const order = orderFor(S.state, wsStr());
  const day = dayAt(cur, order, i);
  const d = addDays(S.weekStart, i);
  S.open = { kind:'day', i };
  let h = '<h2 class="sh-title">' + DOWFULL[i] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + '</h2>' +
    '<p class="sh-sub">' + escapeHtml(day.dt.label) + (day.slot !== i ? ' \u2014 moved here from ' + DOWFULL[day.slot] : '') + (day.dt.note ? '. ' + escapeHtml(day.dt.note) : '') + '</p>';
  h += '<div class="slist">';
  for (const x of day.sessions){
    const dn = isDone(day.slot, x.sid);
    h += '<button class="srow' + (dn ? ' done' : '') + '" data-kind="' + escapeHtml(x.s.kind || '') + '" data-sid="' + escapeHtml(x.sid) + '"><span><span class="st">' + escapeHtml(x.s.title) + '</span><span class="ss">' + escapeHtml([x.s.subtitle, x.s.duration].filter(Boolean).join(' \u00b7 ')) + '</span></span><span class="mark">' + (dn ? '\u2713' : '') + '</span></button>';
  }
  if (!day.sessions.length) h += '<p class="hint">Nothing scheduled.</p>';
  h += '</div>';
  h += '<div class="h3">Move this day</div><div class="movegrid">';
  for (let j = 0; j < 7; j++){
    const dj = addDays(S.weekStart, j);
    h += '<button class="movebtn' + (j === i ? ' cur' : '') + '" data-to="' + j + '"' + (j === i ? ' disabled' : '') + '>' + DOWS[j] + '<small>' + dj.getDate() + '</small></button>';
  }
  h += '</div><p class="hint">Swaps this day with the one you pick, for this week only.' + (!isDefaultOrder(order) ? ' <b>This week has been rearranged.</b>' : '') + '</p>';
  if (!isDefaultOrder(order)) h += '<div class="sh-actions"><button class="btn ghost" id="btnResetWeek">Reset week to plan</button></div>';
  el.sheetBody.innerHTML = h;
  el.sheetBody.querySelectorAll('.srow').forEach(b => b.addEventListener('click', () => openSession(i, b.dataset.sid)));
  el.sheetBody.querySelectorAll('.movebtn').forEach(b => b.addEventListener('click', () => { moveDay(i, +b.dataset.to); closeOverlays(); }));
  const r = $('btnResetWeek'); if (r) r.addEventListener('click', () => { resetWeek(); closeOverlays(); });
  openOverlay(el.sheet);
}
function openSession(i, sid){
  const cur = current(); if (!cur) return;
  const order = orderFor(S.state, wsStr());
  const day = dayAt(cur, order, i);
  const s = cur.block.sessions[sid]; if (!s) return;
  S.open = { kind:'session', i, sid };
  const dn = isDone(day.slot, sid);
  let h = '<button class="sh-back" id="btnBack">&#8249; ' + DOWS[i] + '</button>' +
    '<h2 class="sh-title">' + escapeHtml(s.title) + '</h2>' +
    '<p class="sh-sub">' + escapeHtml([s.subtitle, s.duration, 'Week ' + cur.weekIdx + ' of ' + cur.nWeeks].filter(Boolean).join(' \u00b7 ')) + '</p>';
  h += '<button class="donebtn' + (dn ? ' is-done' : '') + '" id="btnDone">' + (dn ? '\u2713 Done \u2014 tap to undo' : 'Mark done') + '</button>';
  for (const blk of (s.blocks || [])){
    const items = (blk.items || []).map(it => resolveItem(it, cur.weekIdx)).filter(Boolean);
    if (!items.length) continue;
    h += '<div class="ex-block">' + (blk.title ? '<h3>' + escapeHtml(blk.title) + '</h3>' : '');
    for (const it of items){
      h += '<div class="ex"><div class="exh"><span class="exn">' + escapeHtml(it.name) + (it.effort ? '<span class="exe">' + escapeHtml(it.effort) + '</span>' : '') + '</span>' + (it.sets ? '<span class="exs">' + escapeHtml(it.sets) + '</span>' : '') + '</div>';
      if (it.thisWeek) h += '<p class="exw">' + escapeHtml(it.thisWeek) + '</p>';
      if (it.detail) h += '<p class="exd">' + escapeHtml(it.detail) + '</p>';
      if (it.video) h += '<a class="vid" href="' + escapeHtml(it.video) + '" target="_blank" rel="noopener">Watch how</a>';
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="field"><label for="fNote">Notes</label><textarea id="fNote" placeholder="Loads, RPE, how it felt\u2026">' + escapeHtml(noteFor(day.slot, sid)) + '</textarea></div>' +
    '<div class="sh-actions"><button class="btn primary" id="btnNoteSave">Save note</button></div>';
  el.sheetBody.innerHTML = h;
  $('btnBack').addEventListener('click', () => openDay(i));
  $('btnDone').addEventListener('click', () => { toggleDone(day.slot, sid, s.title); openSession(i, sid); });
  $('btnNoteSave').addEventListener('click', () => { saveNote(day.slot, sid, $('fNote').value, s.title); });
  openOverlay(el.sheet);
}
function openBlock(){
  const cur = current();
  const b = cur ? cur.block : (S.program && S.program.blocks.length ? (nextBlockAfter(S.program, wsStr()) || S.program.blocks[S.program.blocks.length-1]) : null);
  S.open = { kind:'block' };
  if (!b){
    el.sheetBody.innerHTML = '<h2 class="sh-title">No blocks yet</h2><p class="sh-sub">Add the first block in settings \u2014 the chat produces the JSON for each cycle.</p>';
    openOverlay(el.sheet); return;
  }
  const sd = parseDate(b.start), ed = addDays(sd, blockWeeks(b) * 7 - 1);
  let h = '<h2 class="sh-title">' + escapeHtml(b.name) + '</h2>' +
    '<p class="sh-sub">' + escapeHtml(b.tag || '') + (b.tag ? ' \u00b7 ' : '') + MONTHS[sd.getMonth()] + ' ' + sd.getDate() + ' \u2013 ' + MONTHS[ed.getMonth()] + ' ' + ed.getDate() + '</p>';
  if (b.intro) h += '<p class="para">' + escapeHtml(b.intro) + '</p>';
  if (Array.isArray(b.weeks) && b.weeks.length){
    h += '<div class="h3">Week by week</div><div class="wk-table">';
    b.weeks.forEach((w, k) => {
      const wsd = addDays(startOfWeek(sd), k * 7);
      h += '<div class="wk' + (cur && cur.weekIdx === k + 1 ? ' cur' : '') + '"><div class="wkn">Week ' + (k + 1) + '<small>' + escapeHtml(w.label || '') + ' \u00b7 ' + MONTHS[wsd.getMonth()] + ' ' + wsd.getDate() + '</small></div><div class="wkf">' + escapeHtml(w.focus || '') + '</div></div>';
    });
    h += '</div>';
  }
  if (Array.isArray(b.rules) && b.rules.length){ h += '<div class="h3">The rules</div><ol class="rules">' + b.rules.map(r => '<li>' + escapeHtml(r) + '</li>').join('') + '</ol>'; }
  const wk = b.week.map(id => (b.dayTypes[id] || {}).label || id);
  h += '<div class="h3">Default week</div><ul class="plain">' + wk.map((l, k) => '<li><b style="color:var(--mut)">' + DOWS[k] + '</b> \u2014 ' + escapeHtml(l) + '</li>').join('') + '</ul>';
  if (Array.isArray(b.tests) && b.tests.length){ h += '<div class="h3">Baselines \u2014 Week 1, retest final week</div><ul class="plain">' + b.tests.map(r => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>'; }
  if (Array.isArray(b.recovery) && b.recovery.length){ h += '<div class="h3">Recovery & support</div><ul class="plain">' + b.recovery.map(r => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>'; }
  el.sheetBody.innerHTML = h;
  openOverlay(el.sheet);
}
function openSettings(){
  const c = S.repoCfg || {};
  el.fOwner.value = c.owner || ''; el.fRepo.value = c.repo || ''; el.fBranch.value = c.branch || 'main'; el.fDir.value = c.dir || '';
  el.fToken.value = S.token || ''; el.fImport.value = '';
  openOverlay(el.settings);
}

/* ── Drag to reorder ── */
let drag = null;
function rowsEls(){ return Array.from(el.spine.querySelectorAll('.dayrow')); }
el.spine.addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g || g.disabled) return;
  const row = g.closest('.dayrow'); const idx = +row.dataset.idx;
  drag = { idx, target:idx, startY:e.clientY, row, id:e.pointerId };
  row.classList.add('dragging');
  try { g.setPointerCapture(e.pointerId); } catch(err){}
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.row.style.transform = 'translateY(' + (e.clientY - drag.startY) + 'px)';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const r = under && under.closest ? under.closest('.dayrow') : null;
  const t = r ? +r.dataset.idx : drag.target;
  if (t !== drag.target){ drag.target = t; rowsEls().forEach(x => x.classList.toggle('drop', +x.dataset.idx === t && t !== drag.idx)); }
});
function endDrag(e){
  if (!drag || (e && e.pointerId !== undefined && e.pointerId !== drag.id)) return;
  const { idx, target, row } = drag;
  row.style.transform = ''; row.classList.remove('dragging');
  rowsEls().forEach(x => x.classList.remove('drop'));
  drag = null;
  if (target !== idx) moveDay(idx, target);
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ── Wiring ── */
el.spine.addEventListener('click', e => { const c = e.target.closest('.card'); if (c && c.dataset.idx !== undefined && !c.classList.contains('empty')) openDay(+c.dataset.idx); });
el.btnPrev.addEventListener('click', () => { S.weekStart = addDays(S.weekStart, -7); render(); });
el.btnNext.addEventListener('click', () => { S.weekStart = addDays(S.weekStart, 7); render(); });
el.btnToday.addEventListener('click', () => { S.weekStart = startOfWeek(new Date()); render(); });
el.blockstrip.addEventListener('click', openBlock);
el.btnBlock.addEventListener('click', openBlock);
el.btnGear.addEventListener('click', openSettings);
el.statusSync.addEventListener('click', () => reload(false));
el.btnSetCancel.addEventListener('click', closeOverlays);
el.btnSetSave.addEventListener('click', async () => {
  const cfg = { owner: el.fOwner.value.trim(), repo: el.fRepo.value.trim(), branch: el.fBranch.value.trim() || 'main', dir: el.fDir.value.trim().replace(/^\/+|\/+$/g,'') };
  if (!cfg.owner || !cfg.repo){ toast('User and repository are required'); return; }
  S.token = el.fToken.value.trim();
  if (S.token) safeStore.set('tb.token', S.token); else safeStore.del('tb.token');
  const inferred = inferRepoFromUrl();
  if (inferred && inferred.owner === cfg.owner && inferred.repo === cfg.repo && inferred.branch === cfg.branch && inferred.dir === cfg.dir) safeStore.del('tb.repo');
  else safeStore.set('tb.repo', JSON.stringify(cfg));
  S.repoCfg = cfg; S.repoSrc = 'saved'; S.programSha = null; S.stateSha = null; S.local = false;
  closeOverlays();
  await reload(false);
  toast(S.loadError ? 'Saved settings \u2014 couldn\u2019t load yet' : 'Connected');
});
el.btnImport.addEventListener('click', () => { const t = el.fImport.value.trim(); if (!t){ toast('Paste a block first'); return; } importBlock(t); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.repoCfg && !S.local && Date.now() - S.lastFetchMs > 60000) reload(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlays(); });

(async function init(){
  const r = resolveRepoCfg();
  S.repoCfg = r.cfg; S.repoSrc = r.src;
  const c = cacheGet();
  if (c && c.program){ S.program = normalizeProgram(c.program); S.state = normalizeState(c.state); S.fromCache = true; }
  else { S.program = normalizeProgram({}); S.state = normalizeState({}); }
  render();
  if (!S.repoCfg){
    setBanner('<b>Not connected to a repo.</b> When this page is served from GitHub Pages it finds the repo by itself; otherwise enter it in settings. <button>Open settings</button>');
    return;
  }
  await reload(true);
})();
