'use strict';

/* Used only when the app is NOT hosted at *.github.io and nothing is saved on this phone. */
const DEFAULT_REPO = { owner:'', repo:'', branch:'main', dir:'' };
const PROGRAM_FILE = 'program.json', STATE_FILE = 'state.json';

/*__LOGIC_START__*/
const pad2 = n => String(n).padStart(2,'0');
const fmtDate = d => d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
function parseDate(ds){ const p = ds.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }
function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
/* Training weeks run Monday → Sunday. */
function startOfWeek(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function daysBetween(a, b){ return Math.round((b - a) / 86400000); }

function normalizeProgram(raw){
  const p = (raw && typeof raw === 'object') ? raw : {};
  const blocks = Array.isArray(p.blocks) ? p.blocks.filter(b => b && b.id && b.start && Array.isArray(b.week)) : [];
  blocks.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  return { version:1, blocks };
}
function normalizeState(raw){
  const s = (raw && typeof raw === 'object') ? raw : {};
  return { version:1,
    weekOrders: (s.weekOrders && typeof s.weekOrders === 'object') ? s.weekOrders : {},
    done: (s.done && typeof s.done === 'object') ? s.done : {},
    notes: (s.notes && typeof s.notes === 'object') ? s.notes : {} };
}
function blockWeeks(b){ return Array.isArray(b.weeks) && b.weeks.length ? b.weeks.length : 4; }
/* Which block covers the week starting on wsStr (a Monday), and which week of it is that. */
function findBlock(program, wsStr){
  const ws = parseDate(wsStr);
  for (const b of program.blocks){
    const bs = startOfWeek(parseDate(b.start));
    const n = Math.floor(daysBetween(bs, ws) / 7) + 1;
    if (n >= 1 && n <= blockWeeks(b)) return { block:b, weekIdx:n, nWeeks:blockWeeks(b) };
  }
  return null;
}
function nextBlockAfter(program, wsStr){
  const ws = parseDate(wsStr);
  return program.blocks.find(b => startOfWeek(parseDate(b.start)) > ws) || null;
}
/* A week's order is a permutation of the block's seven template slots. */
function orderFor(state, wsStr){
  const o = state.weekOrders[wsStr];
  if (Array.isArray(o) && o.length === 7 && [...o].sort().join() === '0,1,2,3,4,5,6') return o.slice();
  return [0,1,2,3,4,5,6];
}
function swapSlots(order, i, j){ const o = order.slice(); const t = o[i]; o[i] = o[j]; o[j] = t; return o; }
function isDefaultOrder(order){ return order.join() === '0,1,2,3,4,5,6'; }
function keyFor(wsStr, slot, sid){ return wsStr + '|' + slot + '|' + sid; }
/* Resolve one exercise line for the given week of the block. */
function resolveItem(item, weekIdx){
  if (Array.isArray(item.weeks) && !item.weeks.includes(weekIdx)) return null;
  const thisWeek = (item.byWeek && item.byWeek[String(weekIdx)]) || null;
  return { name:item.name || '', sets:item.sets || '', effort:item.effort || '', detail:item.detail || '', video:item.video || '', thisWeek, hasByWeek: !!item.byWeek };
}
function validateBlock(b){
  const errs = [];
  if (!b || typeof b !== 'object') return ['Not a JSON object.'];
  if (!b.id) errs.push('Missing "id".');
  if (!b.name) errs.push('Missing "name".');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start || '')) errs.push('"start" must be YYYY-MM-DD.');
  if (!Array.isArray(b.week) || b.week.length !== 7) errs.push('"week" must list seven day-type ids (Mon–Sun).');
  if (!b.dayTypes || typeof b.dayTypes !== 'object') errs.push('Missing "dayTypes".');
  if (!b.sessions || typeof b.sessions !== 'object') errs.push('Missing "sessions".');
  if (!errs.length){
    for (const id of b.week) if (!b.dayTypes[id]) errs.push('Day type "' + id + '" is not defined.');
    for (const id of Object.keys(b.dayTypes)) for (const s of (b.dayTypes[id].sessions || [])) if (!b.sessions[s]) errs.push('Session "' + s + '" is not defined.');
  }
  return errs;
}
function mergeBlock(program, block){
  const blocks = program.blocks.filter(b => b.id !== block.id);
  blocks.push(block);
  return normalizeProgram({ blocks });
}
/*__LOGIC_END__*/

/* ── Safe storage ── */
const safeStore = (() => {
  const mem = {};
  let ok = false;
  try { const k='__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); ok = true; } catch(e){ ok = false; }
  return {
    get(k){ try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch(e){ return mem[k] ?? null; } },
    set(k,v){ try { if (ok) localStorage.setItem(k,v); else mem[k]=v; } catch(e){ mem[k]=v; } },
    del(k){ try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch(e){ delete mem[k]; } }
  };
})();

/* ── Repo resolution ── */
function inferRepoFromUrl(){
  const host = location.hostname;
  if (!host.endsWith('.github.io')) return null;
  const owner = host.slice(0, -'.github.io'.length);
  const segs = location.pathname.split('/').filter(Boolean);
  if (segs.length && /\.[a-z0-9]+$/i.test(segs[segs.length-1])) segs.pop();
  let repo, dir;
  if (segs.length){ repo = segs[0]; dir = segs.slice(1).join('/'); }
  else { repo = host; dir = ''; }
  return { owner, repo, branch:'main', dir };
}
function storedRepo(){ try { const j = safeStore.get('tb.repo'); return j ? JSON.parse(j) : null; } catch(e){ return null; } }
function resolveRepoCfg(){
  const s = storedRepo();
  if (s && s.owner && s.repo) return { src:'saved', cfg:s };
  const i = inferRepoFromUrl();
  if (i) return { src:'url', cfg:i };
  if (DEFAULT_REPO.owner && DEFAULT_REPO.repo) return { src:'default', cfg:{...DEFAULT_REPO} };
  return { src:'none', cfg:null };
}
function filePath(name){ const d = (S.repoCfg.dir || '').replace(/^\/+|\/+$/g,''); return (d ? d + '/' : '') + name; }

/* ── GitHub client ── */
function b64encode(str){ const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
function b64decode(b64){ const bin = atob(b64.replace(/\s/g,'')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
function GhError(status, msg){ this.status = status; this.message = msg || ('GitHub error ' + status); }
GhError.prototype = Object.create(Error.prototype);
const gh = {
  url(path){ const c = S.repoCfg; return 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); },
  headers(json){ const h = { 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' }; if (S.token) h['Authorization'] = 'Bearer ' + S.token; if (json) h['Content-Type'] = 'application/json'; return h; },
  async load(path){
    const res = await fetch(this.url(path) + '?ref=' + encodeURIComponent(S.repoCfg.branch) + '&_=' + Date.now(), { headers: this.headers(false), cache:'no-store' });
    if (res.status === 404) return { data:null, sha:null };
    if (!res.ok){
      if (res.status === 403 && !S.token){
        const c = S.repoCfg;
        const r2 = await fetch('https://raw.githubusercontent.com/' + c.owner + '/' + c.repo + '/' + c.branch + '/' + path + '?_=' + Date.now(), { cache:'no-store' });
        if (r2.ok) return { data: await r2.json(), sha:null };
      }
      throw new GhError(res.status);
    }
    const j = await res.json();
    return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
  },
  async save(path, data, sha, message){
    const body = { message, content: b64encode(JSON.stringify(data, null, 2)), branch: S.repoCfg.branch };
    if (sha) body.sha = sha;
    const res = await fetch(this.url(path), { method:'PUT', headers: this.headers(true), body: JSON.stringify(body) });
    if (!res.ok) throw new GhError(res.status);
    return (await res.json()).content.sha;
  }
};

/* ── State ── */
const S = {
  repoCfg:null, repoSrc:'none',
  token: safeStore.get('tb.token') || '',
  program:null, state:null, programSha:null, stateSha:null,
  weekStart: startOfWeek(new Date()),
  lastSync:null, lastFetchMs:0, loadError:null, fromCache:false, local:false,
  open:null
};
let saving = false;

const $ = id => document.getElementById(id);
const el = {
  banner:$('banner'), spine:$('spine'), weekLabel:$('weekLabel'), blockstrip:$('blockstrip'),
  statusMode:$('statusMode'), statusSync:$('statusSync'), backdrop:$('backdrop'), sheet:$('sheet'), sheetBody:$('sheetBody'),
  settings:$('settings'), toast:$('toast'),
  btnPrev:$('btnPrev'), btnNext:$('btnNext'), btnToday:$('btnToday'), btnBlock:$('btnBlock'), btnGear:$('btnGear'),
  fOwner:$('fOwner'), fRepo:$('fRepo'), fBranch:$('fBranch'), fDir:$('fDir'), fToken:$('fToken'), fImport:$('fImport'),
  btnSetSave:$('btnSetSave'), btnSetCancel:$('btnSetCancel'), btnImport:$('btnImport')
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOWS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOWFULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function wsStr(){ return fmtDate(S.weekStart); }

/* ── Toast & banner ── */
let toastTimer = null;
function toast(msg){ el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400); }
function setBanner(html){
  if (!html){ el.banner.classList.remove('show'); el.banner.innerHTML = ''; return; }
  el.banner.innerHTML = html; el.banner.classList.add('show');
  const b = el.banner.querySelector('button'); if (b) b.addEventListener('click', openSettings);
}

/* ── Derived ── */
function current(){ return S.program ? findBlock(S.program, wsStr()) : null; }
function dayAt(cur, order, i){
  const slot = order[i];
  const dtId = cur.block.week[slot];
  const dt = cur.block.dayTypes[dtId] || { label:dtId, kind:'rest', sessions:[] };
  return { slot, dtId, dt, sessions: (dt.sessions || []).map(sid => ({ sid, s: cur.block.sessions[sid] })).filter(x => x.s) };
}
function isDone(slot, sid){ return !!S.state.done[keyFor(wsStr(), slot, sid)]; }
function noteFor(slot, sid){ return S.state.notes[keyFor(wsStr(), slot, sid)] || ''; }

/* ── Mutations ── */
function moveDay(i, j){
  if (i === j) return;
  const before = orderFor(S.state, wsStr());
  const after = swapSlots(before, i, j);
  persist(st => { if (isDefaultOrder(after)) delete st.weekOrders[wsStr()]; else st.weekOrders[wsStr()] = after; }, DOWS[i] + ' \u2194 ' + DOWS[j]);
}
function resetWeek(){ persist(st => { delete st.weekOrders[wsStr()]; }, 'reset week ' + wsStr()); }
function toggleDone(slot, sid, title){
  const k = keyFor(wsStr(), slot, sid);
  const now = !S.state.done[k];
  persist(st => { if (now) st.done[k] = true; else delete st.done[k]; }, (now ? 'done: ' : 'undo: ') + title);
}
function saveNote(slot, sid, text, title){
  const k = keyFor(wsStr(), slot, sid);
  const t = (text || '').trim();
  persist(st => { if (t) st.notes[k] = t; else delete st.notes[k]; }, 'note: ' + title);
  toast(t ? 'Note saved' : 'Note cleared');
}
function pruneState(st){
  const keep = fmtDate(addDays(startOfWeek(new Date()), -7 * 26));
  for (const k of Object.keys(st.weekOrders)) if (k < keep) delete st.weekOrders[k];
  for (const k of Object.keys(st.done)) if (k.slice(0,10) < keep) delete st.done[k];
  for (const k of Object.keys(st.notes)) if (k.slice(0,10) < keep) delete st.notes[k];
}
async function persist(mutator, summary){
  mutator(S.state);
  cacheSet();
  render();
  if (!S.repoCfg){ S.local = true; renderStatus(); return; }
  if (!S.token){ S.local = true; renderStatus(); toast('Read-only \u2014 add your token in settings to save'); return; }
  if (saving){ S.local = true; renderStatus(); toast('Still saving the previous change\u2026'); return; }
  saving = true;
  pruneState(S.state);
  const msg = 'Plan: ' + summary;
  try {
    S.stateSha = await gh.save(filePath(STATE_FILE), S.state, S.stateSha, msg);
    S.lastSync = new Date(); S.loadError = null; S.local = false; renderStatus();
  } catch(e){
    if (e.status === 409 || e.status === 422){
      try {
        const fresh = await gh.load(filePath(STATE_FILE));
        S.state = normalizeState(fresh.data);
        mutator(S.state);
        S.stateSha = await gh.save(filePath(STATE_FILE), S.state, fresh.sha, msg);
        S.lastSync = new Date(); S.loadError = null; S.local = false; cacheSet(); render();
      } catch(e2){ failSave(e2); }
    } else failSave(e);
  } finally { saving = false; }
}
function failSave(e){
  S.local = true; renderStatus();
  if (e.status === 401 || e.status === 403) toast('Not saved \u2014 token rejected. Check it in settings.');
  else if (e.status === 404) toast('Not saved \u2014 repo or file not found.');
  else toast('Not saved \u2014 no connection. Kept on this phone for now.');
}
async function importBlock(text){
  let obj;
  try { obj = JSON.parse(text); } catch(e){ toast('That isn\u2019t valid JSON'); return; }
  const blocks = Array.isArray(obj.blocks) ? obj.blocks : [obj];
  for (const b of blocks){ const errs = validateBlock(b); if (errs.length){ toast(errs[0]); return; } }
  let next = S.program || normalizeProgram({});
  for (const b of blocks) next = mergeBlock(next, b);
  if (!S.token){ S.program = next; cacheSet(); render(); closeOverlays(); toast('Added on this phone only \u2014 no token to save'); return; }
  el.btnImport.disabled = true;
  try {
    S.programSha = await gh.save(filePath(PROGRAM_FILE), next, S.programSha, 'Plan: add block ' + blocks.map(b => b.id).join(', '));
    S.program = next; cacheSet(); render(); closeOverlays(); toast('Block added');
  } catch(e){
    if (e.status === 409 || e.status === 422){
      try {
        const fresh = await gh.load(filePath(PROGRAM_FILE));
        let merged = normalizeProgram(fresh.data);
        for (const b of blocks) merged = mergeBlock(merged, b);
        S.programSha = await gh.save(filePath(PROGRAM_FILE), merged, fresh.sha, 'Plan: add block ' + blocks.map(b => b.id).join(', '));
        S.program = merged; cacheSet(); render(); closeOverlays(); toast('Block added');
      } catch(e2){ failSave(e2); }
    } else failSave(e);
  } finally { el.btnImport.disabled = false; }
}

/* ── Cache (opens instantly in the garage, syncs when it can) ── */
function cacheSet(){ try { safeStore.set('tb.cache', JSON.stringify({ program:S.program, state:S.state, at:Date.now() })); } catch(e){} }
function cacheGet(){ try { const j = safeStore.get('tb.cache'); return j ? JSON.parse(j) : null; } catch(e){ return null; } }

/* ── Loading ── */
async function reload(silent){
  if (!S.repoCfg){ render(); return; }
  if (!silent) el.statusSync.innerHTML = 'Loading\u2026';
  try {
    const [p, st] = await Promise.all([gh.load(filePath(PROGRAM_FILE)), gh.load(filePath(STATE_FILE))]);
    S.program = normalizeProgram(p.data); S.programSha = p.sha;
    if (!S.local) { S.state = normalizeState(st.data); }
    S.stateSha = st.sha;
    S.lastSync = new Date(); S.lastFetchMs = Date.now(); S.loadError = null; S.fromCache = false;
    cacheSet();
    if (!p.data) setBanner('<b>No program.json in this repo yet.</b> Add the first block in settings, or upload program.json to the repo.');
    else setBanner('');
  } catch(e){
    S.loadError = e;
    if (!S.program){
      const c = cacheGet();
      if (c && c.program){ S.program = normalizeProgram(c.program); S.state = normalizeState(c.state); S.fromCache = true; }
      else { S.program = normalizeProgram({}); S.state = normalizeState({}); }
    }
    if (e.status === 401 || e.status === 403) setBanner('<b>GitHub rejected the request.</b> If the repo is private or you\u2019re rate-limited, add your token. <button>Open settings</button>');
    else if (e.status === 404) setBanner('<b>Repo not found</b> \u2014 check user, repository, and branch. <button>Open settings</button>');
    else setBanner('<b>Couldn\u2019t reach GitHub.</b> ' + (S.fromCache ? 'Showing the last copy saved on this phone.' : 'Try again when you\u2019re online.'));
  }
  render();
}
