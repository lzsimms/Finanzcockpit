/* =========================================================
   App-Steuerung: Sperrbildschirm, Navigation, Aktionen, Palette
   ========================================================= */

/* ---------- Darstellung ---------- */
function applyTheme() {
  const p = Prefs.get().theme || 'system';
  const dark = p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const b = $('#btnTheme'); if (b) b.innerHTML = ic(dark ? 'sun' : 'moon', 18);
}
function toggleTheme() { Prefs.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }); applyTheme(); if (S) render(); }
function applyPrivacy() {
  const on = !!Prefs.get().privacy;
  document.body.classList.toggle('privacy', on);
  const b = $('#btnPriv'); if (b) { b.innerHTML = ic(on ? 'eyeoff' : 'eye', 18); b.classList.toggle('on', on); b.title = on ? 'Privatmodus aus (P)' : 'Privatmodus an (P)'; }
}
function togglePrivacy() { const on = !Prefs.get().privacy; Prefs.set({ privacy: on }); applyPrivacy(); toast(on ? 'Privatmodus an – Beträge verborgen' : 'Privatmodus aus', 'info'); }

/* ---------- Toasts & Effekte ---------- */
function toast(msg, tone = 'ok', opts = {}) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + tone;
  const act = opts.undo ? { label: 'Rückgängig', run: opts.undo } : opts.action;
  el.innerHTML = `<span class="t-ic">${ic(tone === 'err' ? 'x' : tone === 'info' ? 'sparkle' : 'check', 15, 2.2)}</span><span>${esc(msg)}</span>${act ? `<button class="t-undo">${esc(act.label)}</button>` : ''}`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
  const tm = opts.sticky ? null : setTimeout(kill, act ? 6500 : 3200);
  const u = el.querySelector('.t-undo'); if (u) u.addEventListener('click', () => { clearTimeout(tm); act.run(); kill(); });
  while (box.children.length > 4) box.firstElementChild.remove();
}
function confetti() {
  if (reducedMotion()) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight; c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const P = Array.from({ length: 180 }, () => ({ x: W / 2 + (Math.random() - .5) * 120, y: H * .38, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 7 + 4, c: PALETTE[Math.floor(Math.random() * 10)], a: Math.random() * 6.3, va: (Math.random() - .5) * .35 }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += .38; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.globalAlpha = Math.max(0, 1 - f / 150); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }
    if (++f < 160) requestAnimationFrame(tick); else c.remove();
  })();
}
function countUp(root) {
  if (reducedMotion()) return;
  $$('[data-count]', root).forEach(el => {
    const to = +el.dataset.count, from = to * 0.86, t0 = performance.now(), dur = 1000;
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- Sperrbildschirm ---------- */
function renderLock() {
  const setup = !Vault.exists();
  $('#root').innerHTML = `<div class="lock"><div class="lock-bg"><i></i><i></i><i></i></div>
    <form class="lock-card" id="lockForm" autocomplete="off" novalidate>
      <div class="logo">${ic('trending', 30, 2.2)}</div>
      <h1>Finanzcockpit</h1>
      <p>${setup ? 'Lege ein Master-Passwort fest. Damit werden alle deine Finanzdaten lokal auf diesem Gerät verschlüsselt.' : 'Willkommen zurück! Entsperre deinen Tresor.'}</p>
      <div class="pw-field"><input type="password" id="pw" class="input lg" placeholder="Master-Passwort" autocomplete="${setup ? 'new-password' : 'current-password'}"><button type="button" class="pw-eye" data-eye title="Anzeigen">${ic('eye', 18)}</button></div>
      ${setup ? `<div class="strength"><i></i><i></i><i></i><i></i></div><small id="strengthTxt" class="muted"></small>
        <input type="password" id="pw2" class="input lg" placeholder="Passwort wiederholen" autocomplete="new-password">` : ''}
      <div class="form-error" id="lockErr"></div>
      <button class="btn primary lg full" id="lockBtn">${setup ? 'Tresor erstellen' : 'Entsperren'}</button>
      <div class="lock-feats"><span>${ic('shield', 14)} AES-256-GCM</span><span>${ic('lock', 14)} 100 % offline</span><span>${ic('eyeoff', 14)} Kein Tracking</span></div>
      ${setup ? `<p class="tiny">Wichtig: Es gibt keine Passwort-Wiederherstellung – das ist der Preis echter Verschlüsselung. Lege später regelmäßig Backups an.</p><div class="lock-links"><button type="button" class="link tiny" data-import>${ic('refresh', 13)} Vom anderen Gerät übernehmen (Sync-/Backup-Datei)</button></div>`
      : `<div class="lock-links"><button type="button" class="link tiny" data-import>Backup laden</button><button type="button" class="link tiny" data-reset>Passwort vergessen?</button></div>`}
    </form></div>`;
  const form = $('#lockForm'), pw = $('#pw'), err = $('#lockErr'), btn = $('#lockBtn');
  setTimeout(() => pw.focus(), 50);
  const busy = (on, label) => { btn.disabled = on; btn.innerHTML = on ? `<span class="spinner"></span> ${label}` : (setup ? 'Tresor erstellen' : 'Entsperren'); };
  const shake = () => { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); };
  form.addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]');
    if (eye) { const t = pw.type === 'password' ? 'text' : 'password'; pw.type = t; const p2 = $('#pw2'); if (p2) p2.type = t; eye.innerHTML = ic(t === 'password' ? 'eye' : 'eyeoff', 18); }
    if (e.target.closest('[data-reset]')) forgotPassword();
    if (e.target.closest('[data-import]')) importModal(true);
  });
  if (setup) pw.addEventListener('input', () => {
    const s = pwStrength(pw.value);
    $$('.strength i').forEach((el, i) => { el.className = i < s ? 'on s' + s : ''; });
    $('#strengthTxt').textContent = pw.value ? `Stärke: ${STRENGTH[s]}` : '';
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    if (setup) {
      if (pw.value.length < 8) { err.textContent = 'Bitte mindestens 8 Zeichen verwenden – besser 12 oder mehr.'; shake(); return; }
      if (pw.value !== $('#pw2').value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; shake(); return; }
      busy(true, 'Tresor wird erstellt …');
      try { const st = defaultState(); await Vault.create(pw.value, st); S = st; afterUnlock(); }
      catch (x) { busy(false); err.textContent = 'Fehler: ' + x.message; }
      return;
    }
    const th = Throttle.get();
    if (th.until > Date.now()) { err.textContent = `Zu viele Fehlversuche. Bitte warte noch ${Math.ceil((th.until - Date.now()) / 1000)} Sekunden.`; shake(); return; }
    if (!pw.value) { shake(); return; }
    busy(true, 'Entschlüssele …');
    try { const data = await Vault.unlock(pw.value); Throttle.clear(); S = migrate(data); afterUnlock(); }
    catch (x) {
      busy(false); shake(); pw.select();
      if (x.name === 'OperationError') { const t = Throttle.fail(); err.textContent = t.until > Date.now() ? `Falsches Passwort. Gesperrt für ${Math.ceil((t.until - Date.now()) / 1000)} Sekunden.` : `Falsches Passwort (${t.fails}. Fehlversuch).`; }
      else err.textContent = 'Tresor konnte nicht gelesen werden: ' + x.message;
    }
  });
}
async function forgotPassword() {
  const ok = await confirmDialog({ title: 'Tresor zurücksetzen?', text: 'Ohne Passwort lassen sich die Daten nicht entschlüsseln – das ist Absicht. Du kannst den Tresor löschen und neu beginnen (oder ein Backup laden). Tippe <b>LÖSCHEN</b> zur Bestätigung.', ok: 'Tresor löschen', danger: true, typed: 'LÖSCHEN' });
  if (!ok) return;
  Vault.destroy(); Throttle.clear(); renderLock(); toast('Tresor gelöscht', 'info');
}
let lastAct = Date.now();
function afterUnlock() {
  C = null; resetBaseline(); const r = processDue(S); stampChanges(); C = null;
  recordSnapshot(); persist();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  loadSyncHandle().then(trySilentSync);
  $('#root').innerHTML = shellHTML();
  applyTheme(); applyPrivacy();
  const h = location.hash.replace(/^#\/?/, '');
  UI.view = VIEWS[h] ? h : 'dashboard'; UI._last = null;
  render(); lastAct = Date.now();
  if (r.n || r.p) toast(`${r.n ? `${r.n} fällige Buchung${r.n > 1 ? 'en' : ''}` : ''}${r.n && r.p ? ' und ' : ''}${r.p ? `${r.p} Sparplan-Ausführung${r.p > 1 ? 'en' : ''}` : ''} automatisch gebucht`, 'info');
  if (!S.settings.onboarded) onboardingModal();
  else if (!S.settings.demo && S.transactions.length > 20 && (!S.settings.lastBackup || daysBetween(S.settings.lastBackup, today()) > 30)) setTimeout(() => toast('Tipp: Dein letztes Backup ist über 30 Tage her (Einstellungen → Backup).', 'info'), 1500);
}
let locking = false;
async function lock(msg) {
  if (!S || locking) return;
  locking = true;
  try { await Promise.race([trySilentSync(), new Promise(r => setTimeout(r, 4000))]); } catch { }
  try { await saveChain; } catch { }
  locking = false;
  if (!S) return;
  S = null; C = null; Vault.lock(); UI.fc = null; lastSeen = null;
  closeModal(); $('#confirm-root').innerHTML = ''; closePalette();
  renderLock();
  if (msg) toast(msg, 'info');
}

/* ---------- App-Gerüst ---------- */
function shellHTML() {
  return `<div class="app">
    <aside class="sidebar">
      <div class="brand"><div class="logo">${ic('trending', 21, 2.2)}</div><div><b>Finanzcockpit</b><small>privat & verschlüsselt</small></div></div>
      <nav class="nav">${NAV.map((n, i) => `<button class="nav-item" data-nav="${n.id}">${ic(n.icon, 19)}<span>${n.label}</span><kbd>${i + 1}</kbd></button>`).join('')}</nav>
      <div class="side-foot"><div class="lbl">Gesamtvermögen</div><div class="nw" id="sideNW"></div><div class="sec">${ic('shield', 14)} Lokal verschlüsselt</div></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="title"><h1 id="pgTitle"></h1><p id="pgSub"></p></div>
        <button class="search-btn" data-action="palette">${ic('search', 17)}<span class="txt">Suchen & Befehle …</span><kbd>Strg K</kbd></button>
        <button class="icon-btn" id="btnPriv" data-action="privacy" title="Privatmodus (P)"></button>
        <button class="icon-btn" id="btnTheme" data-action="theme" title="Hell/Dunkel"></button>
        <button class="icon-btn" data-action="lock" title="Sperren (L)">${ic('lock', 18)}</button>
        <button class="btn primary top-add" data-action="newTx">${ic('plus', 17, 2.2)} Buchung</button>
      </header>
      <section id="view" class="view"></section>
    </main>
    <nav class="bottomnav">${NAV.map(n => `<button class="bn-item" data-nav="${n.id}">${ic(n.icon, 20)}<span>${n.label}</span></button>`).join('')}</nav>
    <button class="fab" data-action="newTx" aria-label="Neue Buchung">${ic('plus', 26, 2.4)}</button>
  </div>`;
}
function render() {
  if (!S || !$('#view')) return;
  const v = VIEWS[UI.view] ? UI.view : 'dashboard';
  const changed = UI._last !== v; UI._last = v;
  $$('.nav-item,.bn-item').forEach(b => b.classList.toggle('on', b.dataset.nav === v));
  const [title, sub] = v === 'dashboard' ? [`${greeting()}${S.settings.name ? ', ' + esc(S.settings.name) : ''} 👋`, fmtDateLong(today())] : PAGE[v];
  $('#pgTitle').innerHTML = title + (S.settings.demo ? ' <span class="demo-badge" data-action="resetData" title="Demo beenden">Demo</span>' : '');
  $('#pgSub').textContent = sub;
  const y = scrollY;
  CHARTS.length = 0;
  const view = $('#view');
  view.innerHTML = VIEWS[v]();
  if (changed) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); scrollTo(0, 0); }
  else { view.classList.remove('enter'); scrollTo(0, y); }
  drawCharts();
  if (changed) countUp(view);
  $('#sideNW').innerHTML = S.accounts.length ? money(computeAll().netWorth) : '–';
  document.title = `${v === 'dashboard' ? 'Übersicht' : PAGE[v][0]} · Finanzcockpit`;
}
function go(view) {
  if (('#/' + view) === location.hash) { UI.view = view; render(); }
  else location.hash = '#/' + view;
}
addEventListener('hashchange', () => { const h = location.hash.replace(/^#\/?/, ''); if (S && VIEWS[h]) { UI.view = h; closeModal(); render(); } });

/* ---------- Aktionen ---------- */
const ACTIONS = {
  palette: () => openPalette(), privacy: togglePrivacy, theme: toggleTheme, lock: () => lock(),
  onboarding: () => onboardingModal(),
  range: el => { UI.range = el.dataset.v; render(); },
  newTx: el => txModal(null, { kind: el.dataset.kind, accountId: el.dataset.acc }),
  editTx: el => txModal(el.dataset.id),
  newAccount: el => accountModal(null, el.dataset.type), editAccount: el => accountModal(el.dataset.id),
  reconcile: el => reconcileModal(el.dataset.id), cashCount: el => cashCountModal(el.dataset.id),
  accTx: el => { UI.tx = { q: '', acc: el.dataset.id, cat: '', month: '', kind: '' }; go('transactions'); },
  depotOf: el => { UI.depot = el.dataset.id; go('depot'); render(); },
  txMore: () => { UI.txLimit += 150; $('#txlist').innerHTML = txListHTML(); },
  txClear: () => { UI.tx = { q: '', acc: '', cat: '', month: '', kind: '' }; render(); },
  newHolding: () => holdingModal(), editHolding: el => holdingModal(el.dataset.id),
  trade: el => tradeModal(el.dataset.side), editTrade: el => { const t = S.trades.find(x => x.id === el.dataset.id); tradeModal(t.side, t.holdingId, t.id); },
  dividend: () => dividendModal(), prices: () => pricesModal(),
  newPlan: () => planModal(), editPlan: el => planModal(el.dataset.id),
  newRec: () => recurringModal(), editRec: el => recurringModal(el.dataset.id),
  toggleRec: el => { const r = S.recurring.find(x => x.id === el.dataset.id); r.paused = !r.paused; if (!r.paused && r.next < today()) { r.next = today(); } const res = processDue(S); commit(r.paused ? `„${r.name}“ pausiert` : `„${r.name}“ fortgesetzt${res.n ? ' · heute gebucht' : ''}`); },
  newGoal: () => goalModal(), editGoal: el => goalModal(el.dataset.id), goalMove: el => goalMoveModal(el.dataset.id),
  bmonth: el => { const v = +el.dataset.v; UI.budgetMonth = v ? shiftMonth(UI.budgetMonth, v) : today().slice(0, 7); render(); },
  editBudget: el => budgetModal(el.dataset.id),
  newCat: () => categoryModal(), editCat: el => categoryModal(el.dataset.id),
  setTheme: el => { Prefs.set({ theme: el.dataset.v }); applyTheme(); render(); },
  changePw: () => passwordModal(), exportBackup: () => exportBackup(), importBackup: () => importModal(false), exportCSV: () => exportCSV(),
  resetData: () => resetData(),
  fcReset: () => { UI.fc = fcDefaults(); render(); },
};
document.addEventListener('click', e => {
  if (!S) return;
  const el = e.target.closest('[data-action],[data-nav]');
  if (!el || el.closest('#modal-root,#confirm-root,#palette-root')) return;
  if (el.dataset.action) {
    e.preventDefault(); e.stopPropagation();
    const fn = ACTIONS[el.dataset.action]; if (fn) fn(el, e);
  } else if (el.dataset.nav) go(el.dataset.nav);
});
document.addEventListener('change', e => {
  if (!S) return;
  const t = e.target;
  if (t.dataset.filter) { UI.tx[t.dataset.filter] = t.value; UI.txLimit = 150; render(); }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    if (k === 'autoLock') S.settings.autoLock = +t.value;
    else if (k === 'lockOnHide') S.settings.lockOnHide = t.checked;
    else if (k === 'name') S.settings.name = t.value.trim().slice(0, 30);
    else if (k === 'birthYear') { const y = parseInt(t.value, 10); S.settings.birthYear = y > 1900 && y <= new Date().getFullYear() ? y : ''; }
    commit('Einstellung gespeichert');
  }
});
let txqTimer;
document.addEventListener('input', e => {
  if (!S) return;
  const t = e.target;
  if (t.id === 'txq') { clearTimeout(txqTimer); txqTimer = setTimeout(() => { UI.tx.q = t.value; UI.txLimit = 150; $('#txlist').innerHTML = txListHTML(); }, 120); }
  if (t.dataset.fc) {
    const k = t.dataset.fc, v = parseNum(t.value); if (!Number.isFinite(v)) return;
    UI.fc[k] = k === 'years' ? clamp(Math.round(v), 1, 70) : v;
    $$(`[data-fc="${k}"]`).forEach(o => { if (o !== t) o.value = o.type === 'range' ? UI.fc[k] : fmtNumIn(UI.fc[k], k === 'ret' || k === 'infl' || k === 'dyn' ? 1 : 0); });
    updateForecast();
  }
});

/* ---------- Befehlspalette ---------- */
function closePalette() { $('#palette-root').innerHTML = ''; }
function parseQuick(s) {
  let m = s.match(/^([+-])?\s*(\d+(?:[.,]\d{1,2})?)\s*€?\s*(.*)$/), sign, num, note;
  if (m) [, sign, num, note] = m;
  else { m = s.match(/^(.+?)\s+([+-])?(\d+(?:[.,]\d{1,2})?)\s*€?$/); if (!m) return null; [, note, sign, num] = m; }
  const amount = parseNum(num); if (!(amount > 0)) return null;
  return { kind: sign === '+' ? 'income' : 'expense', amount, note: (note || '').trim() };
}
function openPalette() {
  if (!S) return; closeModal();
  const root = $('#palette-root');
  root.innerHTML = `<div class="pal-backdrop"><div class="palette" role="dialog" aria-label="Befehlspalette">
    <div class="pal-input">${ic('search', 19)}<input id="palQ" placeholder="Suchen oder schnell erfassen – z. B. „4,20 Bäcker“" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>
    <div class="pal-list" id="palList"></div>
    <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> wählen</span><span><kbd>↵</kbd> ausführen</span><span>„+2500 Gehalt“ = Einnahme</span></div></div></div>`;
  const q = $('#palQ'), list = $('#palList'); let items = [], idx = 0;
  const cashAcc = S.accounts.find(a => a.type === 'cash');
  const base = [
    { icon: 'plus', label: 'Neue Ausgabe', hint: 'N', g: 'Aktionen', run: () => txModal(null, { kind: 'expense' }) },
    { icon: 'plus', label: 'Neue Einnahme', g: 'Aktionen', run: () => txModal(null, { kind: 'income' }) },
    { icon: 'swap', label: 'Umbuchung zwischen Konten', kw: 'geldautomat abheben', g: 'Aktionen', run: () => txModal(null, { kind: 'transfer' }) },
    { icon: 'trending', label: 'Wertpapier kaufen', kw: 'order aktie etf', g: 'Aktionen', run: () => tradeModal('buy') },
    { icon: 'trending', label: 'Wertpapier verkaufen', kw: 'order', g: 'Aktionen', run: () => tradeModal('sell') },
    { icon: 'refresh', label: 'Kurse aktualisieren', kw: 'preise depot', g: 'Aktionen', run: pricesModal },
    { icon: 'coins', label: 'Dividende erfassen', kw: 'ausschüttung zinsen', g: 'Aktionen', run: () => dividendModal() },
    ...(cashAcc ? [{ icon: 'cash', label: 'Kassensturz – Bargeld zählen', kw: 'münzen scheine', g: 'Aktionen', run: () => cashCountModal(cashAcc.id) }] : []),
    { icon: 'target', label: 'Neues Sparziel', g: 'Aktionen', run: () => goalModal() },
    { icon: 'repeat', label: 'Neuer Dauerauftrag / Abo', kw: 'fixkosten miete', g: 'Aktionen', run: () => recurringModal() },
    { icon: 'pie', label: 'Budget festlegen', kw: 'limit', g: 'Aktionen', run: () => budgetModal() },
    ...NAV.map((n, i) => ({ icon: n.icon, label: n.label, hint: String(i + 1), g: 'Navigation', kw: 'gehe zu öffnen', run: () => go(n.id) })),
    { icon: 'eye', label: 'Privatmodus umschalten', hint: 'P', kw: 'verbergen blur', g: 'System', run: togglePrivacy },
    { icon: 'sun', label: 'Hell / Dunkel umschalten', kw: 'theme farbe', g: 'System', run: toggleTheme },
    { icon: 'refresh', label: 'Geräte abgleichen (PC ⇄ Handy)', kw: 'sync synchronisieren handy', g: 'System', run: () => syncNow() },
    { icon: 'download', label: 'Verschlüsseltes Backup exportieren', kw: 'sicherung', g: 'System', run: exportBackup },
    { icon: 'lock', label: 'Jetzt sperren', hint: 'L', g: 'System', run: () => lock() },
  ];
  function build() {
    const s = q.value.trim(), low = s.toLowerCase(); items = [];
    const qa = parseQuick(s);
    if (qa) items.push({ icon: qa.kind === 'income' ? 'up' : 'down', label: `${qa.kind === 'income' ? 'Einnahme' : 'Ausgabe'} ${fmt(qa.amount)}${qa.note ? ` „${qa.note}“` : ''} erfassen`, hint: '↵', hl: true, g: 'Schnellerfassung', run: () => txModal(null, qa) });
    const words = low.split(/\s+/).filter(Boolean);
    for (const it of base) { const hay = (it.label + ' ' + (it.kw || '')).toLowerCase(); if (words.every(w => hay.includes(w))) items.push(it); }
    if (low.length >= 2 && !qa) {
      for (const t of sortedTx().filter(t => (t.note || '').toLowerCase().includes(low) || (cat(t.category)?.name || '').toLowerCase().includes(low)).slice(0, 6))
        items.push({ icon: 'list', label: `${t.note || cat(t.category)?.name || 'Buchung'} · ${t.kind === 'expense' ? '−' : ''}${fmt(t.amount)}`, sub: fmtDate(t.date), g: 'Buchungen', run: () => txModal(t) });
      for (const h of S.holdings.filter(h => h.name.toLowerCase().includes(low) || (h.isin || '').toLowerCase().includes(low)).slice(0, 4))
        items.push({ icon: 'trending', label: h.name, sub: h.isin, g: 'Wertpapiere', run: () => holdingModal(h.id) });
      for (const a of S.accounts.filter(a => a.name.toLowerCase().includes(low)))
        items.push({ icon: 'wallet', label: a.name, sub: fmt(computeAll().total[a.id]), g: 'Konten', run: () => { UI.tx = { q: '', acc: a.id, cat: '', month: '', kind: '' }; go('transactions'); } });
    }
    idx = 0; draw();
  }
  function draw() {
    let g = null;
    list.innerHTML = items.length ? items.map((it, i) => { const gh = it.g !== g ? `<div class="pal-group">${esc(it.g)}</div>` : ''; g = it.g; return gh + `<button class="pal-item ${i === idx ? 'on' : ''} ${it.hl ? 'hl' : ''}" data-i="${i}">${ic(it.icon, 17)}<span class="pal-label">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`; }).join('')
      : '<div class="pal-empty">Nichts gefunden. Probier „Depot“, „Netflix“ oder „12,50 Tanken“.</div>';
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  const run = i => { const it = items[i]; if (!it) return; closePalette(); it.run(); };
  q.addEventListener('input', build);
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  list.addEventListener('mousemove', e => { const b = e.target.closest('.pal-item'); if (b && +b.dataset.i !== idx) { idx = +b.dataset.i; $$('.pal-item', list).forEach(x => x.classList.toggle('on', +x.dataset.i === idx)); } });
  list.addEventListener('click', e => { const b = e.target.closest('.pal-item'); if (b) run(+b.dataset.i); });
  root.firstElementChild.addEventListener('mousedown', e => { if (e.target === root.firstElementChild) closePalette(); });
  build(); q.focus();
}

/* ---------- Tastatur ---------- */
document.addEventListener('keydown', e => {
  if (!S) return;
  const k = e.key, palOpen = !!$('#palette-root').firstElementChild, cfOpen = !!$('#confirm-root').firstElementChild;
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') { e.preventDefault(); palOpen ? closePalette() : openPalette(); return; }
  if (k === 'Escape') { if (cfOpen) return; if (palOpen) { closePalette(); return; } if (modalOpen()) { closeModal(); return; } }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalOpen() || palOpen || cfOpen) return;
  const lk = k.toLowerCase();
  if (lk === 'n') { e.preventDefault(); txModal(); }
  else if (lk === 'p') togglePrivacy();
  else if (lk === 'l') lock();
  else if (k === '/') { e.preventDefault(); openPalette(); }
  else if (/^[1-9]$/.test(k)) go(NAV[+k - 1].id);
});

/* ---------- Automatische Sperre ---------- */
['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => { if (S && S.settings.autoLock > 0 && Date.now() - lastAct > S.settings.autoLock * 60000) lock('Automatisch gesperrt nach Inaktivität'); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden && S && S.settings.lockOnHide) lock('Gesperrt beim Verlassen des Fensters'); });
addEventListener('pagehide', () => { if (S) { S = null; C = null; Vault.lock(); closeModal(); renderLock(); } });

/* ---------- Diagramme bei Größenänderung neu zeichnen ---------- */
let rzTimer; addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(() => { if (S) drawCharts(); }, 150); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); if (S) render(); });

/* ---------- Start ---------- */
(function init() {
  applyTheme();
  if (!window.crypto || !crypto.subtle) {
    $('#root').innerHTML = '<div class="lock"><div class="lock-card"><h1>Browser nicht unterstützt</h1><p>Dieser Browser bietet keine sichere Verschlüsselung (WebCrypto). Bitte öffne die Datei in einem aktuellen Chrome, Edge oder Firefox.</p></div></div>';
    return;
  }
  renderLock();
})();
