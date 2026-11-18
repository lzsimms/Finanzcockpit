/* =========================================================
   Geräte-Abgleich (Ende-zu-Ende verschlüsselt) & installierbare App
   ========================================================= */
const SYNC_COLS = ['accounts', 'categories', 'transactions', 'recurring', 'holdings', 'trades', 'plans', 'goals'];
let lastSeen = null;   // Fingerabdruck aller Datensätze seit dem letzten Speichern

/** Markiert geänderte Datensätze mit Zeitstempel (_u) und gelöschte mit einem „Grabstein“ */
function stampChanges() {
  if (!S) return;
  const now = Date.now(), seen = new Map();
  S.tomb = S.tomb || {};
  for (const col of SYNC_COLS) for (const r of S[col]) {
    const { _u, ...rest } = r, j = JSON.stringify(rest);
    if (lastSeen && lastSeen.get(r.id) !== j) r._u = now;
    seen.set(r.id, j);
  }
  const bj = JSON.stringify(S.budgets);
  if (lastSeen) {
    for (const id of lastSeen.keys()) if (id !== '__budgets' && !seen.has(id)) S.tomb[id] = now;
    if (lastSeen.get('__budgets') !== bj) S.budgetsU = now;
  }
  seen.set('__budgets', bj);
  lastSeen = seen;
}
function resetBaseline() { lastSeen = null; stampChanges(); }

/** Führt einen fremden Stand in den lokalen ein: neuere Version gewinnt je Datensatz, Löschungen werden übernommen */
function mergeState(L, R) {
  const tomb = { ...(R.tomb || {}) };
  for (const [k, v] of Object.entries(L.tomb || {})) tomb[k] = Math.max(v, tomb[k] || 0);
  let added = 0, updated = 0, removed = 0;
  for (const col of SYNC_COLS) {
    const m = new Map((L[col] || []).map(r => [r.id, r])), localIds = new Set(m.keys());
    for (const r of R[col] || []) {
      const l = m.get(r.id);
      if (!l) { if (!(tomb[r.id] >= (r._u || 0))) added++; m.set(r.id, r); }
      else if ((r._u || 0) > (l._u || 0)) { m.set(r.id, r); if (JSON.stringify(r) !== JSON.stringify(l)) updated++; }
    }
    L[col] = [...m.values()].filter(r => {
      const dead = tomb[r.id] && tomb[r.id] >= (r._u || 0);
      if (dead && localIds.has(r.id)) removed++;
      return !dead;
    });
  }
  L.tomb = tomb;
  if ((R.budgetsU || 0) > (L.budgetsU || 0)) { L.budgets = R.budgets || {}; L.budgetsU = R.budgetsU; }
  const snaps = new Map((R.snapshots || []).map(s => [s.d, s]));
  for (const s of L.snapshots || []) snaps.set(s.d, s);
  L.snapshots = [...snaps.values()].sort((a, b) => a.d < b.d ? -1 : 1);
  if (!L.settings.name && R.settings?.name) L.settings.name = R.settings.name;
  if (R.settings?.onboarded) { L.settings.onboarded = true; if (!R.settings.demo) L.settings.demo = false; }
  return { added, updated, removed };
}

/** Sync-Datei mit dem eigenen Schlüssel öffnen (gleiches Salt = gleicher Tresor), sonst Passwort nötig */
Vault.decryptOwn = async function (blob) {
  if (!this.key || blob.salt !== b64e(this.salt) || (blob.iter || PBKDF2_ITER) !== this.iter) return null;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, this.key, b64d(blob.ct));
  return JSON.parse(dec.decode(pt));
};
async function decryptSyncText(text, interactive = true) {
  let blob;
  try { blob = JSON.parse(text); } catch { throw new Error('Die Datei ist keine gültige Finanzcockpit-Datei.'); }
  if (!blob || blob.app !== 'finanzcockpit') throw new Error('Die Datei ist keine gültige Finanzcockpit-Datei.');
  try { const own = await Vault.decryptOwn(blob); if (own) return own; } catch { }
  if (!interactive) return null;
  const pw = await promptPassword('Diese Sync-Datei wurde mit einem anderen Tresor-Schlüssel verschlüsselt. Gib das Passwort des anderen Geräts ein.');
  if (pw == null) return null;
  try { return (await Vault.decryptBlob(blob, pw)).data; }
  catch (e) { throw new Error(e.name === 'OperationError' ? 'Falsches Passwort für diese Sync-Datei.' : e.message); }
}
function applyMerge(remote) {
  const r = mergeState(S, migrate(remote));
  C = null; resetBaseline();
  processDue(S);
  S.settings.lastSync = new Date().toISOString();
  const changed = r.added + r.updated + r.removed;
  commit(changed ? `Abgeglichen: ${r.added} neu · ${r.updated} geändert${r.removed ? ` · ${r.removed} gelöscht` : ''}` : 'Abgeglichen – alles auf dem neuesten Stand ✅');
  return r;
}

function promptPassword(text) {
  return new Promise(res => {
    const root = $('#confirm-root');
    root.innerHTML = `<div class="modal-backdrop top"><form class="modal small" novalidate><header class="modal-head"><h3>Passwort benötigt</h3></header><div class="modal-body"><p class="muted">${text}</p><input class="input" type="password" id="ppw" autocomplete="off"></div><footer class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-r="0">Abbrechen</button><button class="btn primary">Entschlüsseln</button></footer></form></div>`;
    const bd = root.firstElementChild, form = bd.firstElementChild; requestAnimationFrame(() => bd.classList.add('open'));
    const done = v => { document.removeEventListener('keydown', key, true); root.innerHTML = ''; res(v); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); done(null); } };
    document.addEventListener('keydown', key, true);
    form.addEventListener('submit', e => { e.preventDefault(); done($('#ppw').value); });
    form.querySelector('[data-r]').addEventListener('click', () => done(null));
    $('#ppw').focus();
  });
}

/* ---------- Dateizugriff: PC (File System Access API) ---------- */
const HandleStore = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('finanzcockpit-sync', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { try { const db = await this.open(); await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); v == null ? tx.objectStore('kv').delete(k) : tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = res; }); } catch { } },
};
const fsSupported = () => 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
const FS_TYPES = [{ description: 'Finanzcockpit-Sync', accept: { 'application/octet-stream': ['.fcbak'] } }];
let syncHandle = null, syncBusy = false;
async function loadSyncHandle() { if (fsSupported()) { syncHandle = await HandleStore.get('sync'); if (S && UI.view === 'settings') render(); } }

async function syncWithHandle(h, interactive) {
  if (syncBusy) return false;
  syncBusy = true;
  try {
    let p = await h.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') {
      if (!interactive) return false;
      p = await h.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') throw new Error('Der Zugriff auf die Sync-Datei wurde nicht erlaubt.');
    }
    const text = await (await h.getFile()).text();
    let merged = false;
    if (text.trim()) {
      const remote = await decryptSyncText(text, interactive);
      if (!remote) return false;
      applyMerge(remote); merged = true;
    }
    await saveChain;
    const blob = await Vault.encryptBlob(S);
    const w = await h.createWritable(); await w.write(JSON.stringify(blob)); await w.close();
    if (!merged) { S.settings.lastSync = new Date().toISOString(); commit('Sync-Datei angelegt ✅'); }
    return true;
  } finally { syncBusy = false; }
}
async function linkSyncFile(existing) {
  try {
    const h = existing ? (await showOpenFilePicker({ types: FS_TYPES }))[0] : await showSaveFilePicker({ suggestedName: 'finanzcockpit-sync.fcbak', types: FS_TYPES });
    syncHandle = h; await HandleStore.set('sync', h);
    await syncWithHandle(h, true);
  } catch (e) { if (e.name !== 'AbortError') toast(e.message || String(e), 'err'); }
}
async function trySilentSync() {
  if (!S || !fsSupported()) return;
  if (!syncHandle) syncHandle = await HandleStore.get('sync');
  if (!syncHandle) return;
  try { await syncWithHandle(syncHandle, false); } catch (e) { console.warn('Auto-Sync:', e); }
}

/* ---------- Dateizugriff: Handy (Datei wählen + Teilen) ---------- */
async function shareSyncFile() {
  await saveChain;
  const text = JSON.stringify(await Vault.encryptBlob(S));
  const file = new File([text], 'finanzcockpit-sync.fcbak', { type: 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Finanzcockpit-Sync' }); S.settings.lastSync = new Date().toISOString(); persist(); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(file.name, text, 'application/octet-stream');
  S.settings.lastSync = new Date().toISOString(); persist();
}
function mobileSyncModal() {
  openModal({
    title: 'Geräte abgleichen', submit: 'Abgleichen',
    body: `<p class="muted">Die Sync-Datei liegt in deiner Cloud (iCloud Drive, OneDrive, Google Drive …). Ihr Inhalt ist verschlüsselt – die Cloud sieht nur Zeichensalat.</p>
      <div class="stack small"><div><b>1.</b> Sync-Datei auswählen – die Daten werden zusammengeführt.</div><div><b>2.</b> Aktualisierte Datei wieder in denselben Ordner sichern (ersetzen).</div></div>
      ${F.field('Sync-Datei', '<input class="input" type="file" name="file" style="padding-top:9px">')}
      <button type="button" class="btn sm ghost" data-share>${ic('upload', 14)} Noch keine Datei? Jetzt erstellen & sichern</button>`,
    onOpen(form) { form.querySelector('[data-share]').addEventListener('click', shareSyncFile); },
    async onSubmit(fd, form) {
      const file = form.file.files[0]; if (!file) throw new Error('Bitte die Sync-Datei auswählen.');
      if (file.size > 20e6) throw new Error('Die Datei ist zu groß.');
      const remote = await decryptSyncText(await file.text(), true);
      if (!remote) return false;
      applyMerge(remote);
      form.querySelector('.modal-body').innerHTML = `<div class="empty" style="padding:16px"><div class="e-ic">✅</div><b>Zusammengeführt!</b><p>Sichere jetzt die aktualisierte Datei zurück in denselben Cloud-Ordner, damit das andere Gerät die Änderungen bekommt.</p><button type="button" class="btn primary" data-share2>${ic('upload', 16)} Aktualisierte Datei sichern</button></div>`;
      form.querySelector('[data-share2]').addEventListener('click', async () => { await shareSyncFile(); closeModal(); });
      form.querySelector('[type=submit]').hidden = true;
      return false;
    },
  });
}
function syncSetupModal() {
  openModal({
    title: 'Abgleich einrichten', submit: null, cancel: 'Abbrechen',
    body: `<p class="muted">Speichere die Sync-Datei in einem Ordner, den deine Cloud automatisch synchronisiert – z. B. <b>OneDrive</b>, <b>iCloud Drive</b> oder <b>Google Drive</b>. Die Datei ist Ende-zu-Ende verschlüsselt.</p>
      <div class="choice-grid"><button type="button" class="choice" data-c="new"><span class="choice-ic">🆕</span><b>Neue Sync-Datei</b><small>Für das erste Gerät: Datei im Cloud-Ordner anlegen.</small></button>
      <button type="button" class="choice" data-c="old"><span class="choice-ic">🔗</span><b>Vorhandene verknüpfen</b><small>Die Datei gibt es schon (vom Handy oder anderen PC).</small></button></div>`,
    onOpen(form) { form.addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (!c) return; const existing = c.dataset.c === 'old'; linkSyncFile(existing); closeModal(); }); },
  });
}
async function syncNow() {
  if (!S) return;
  if (!fsSupported()) return mobileSyncModal();
  if (!syncHandle) syncHandle = await HandleStore.get('sync');
  if (!syncHandle) return syncSetupModal();
  try { if (!(await syncWithHandle(syncHandle, true))) toast('Abgleich abgebrochen', 'info'); }
  catch (e) {
    if (e.name === 'NotFoundError') { toast('Die Sync-Datei wurde nicht gefunden – bitte neu verknüpfen.', 'err'); syncHandle = null; await HandleStore.set('sync', null); syncSetupModal(); }
    else toast(e.message || String(e), 'err');
  }
}

/* ---------- Installierbare App ---------- */
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isWeb = () => location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (S && UI.view === 'settings') render(); });
addEventListener('appinstalled', () => { deferredInstall = null; toast('App installiert 🎉'); if (S && UI.view === 'settings') render(); });
async function installApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice.catch(() => { });
  deferredInstall = null; if (S) render();
}
if ('serviceWorker' in navigator && isWeb()) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const waiting = w => toast('Eine neue Version ist da.', 'info', { action: { label: 'Aktualisieren', run: () => w.postMessage('skipWaiting') }, sticky: true });
    if (reg.waiting && navigator.serviceWorker.controller) waiting(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) waiting(w); }); });
    setInterval(() => reg.update().catch(() => { }), 3600e3);
  }).catch(e => console.warn('Service Worker:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}

function syncCardHTML() {
  const st = S.settings, last = st.lastSync ? new Date(st.lastSync).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'noch nie';
  let install;
  if (isStandalone()) install = `<div class="badge pos">${ic('check', 13, 2.4)} Als App installiert</div><p class="hint" style="margin-top:8px">Startet offline in einem eigenen Fenster.</p>`;
  else if (!isWeb()) install = `<p class="small muted">Du nutzt gerade die <b>lokale Datei</b>. Zum Installieren – auch auf dem Handy – öffne die Web-Version des Finanzcockpits im Browser.</p>`;
  else if (deferredInstall) install = `<p class="small muted" style="margin-bottom:10px">Eigenes App-Symbol, eigenes Fenster, funktioniert offline.</p><button class="btn primary sm" data-action="installApp">${ic('download', 15)} App installieren</button>`;
  else if (isIOS()) install = `<p class="small muted">Tippe in Safari auf <b>Teilen</b> <span style="font-size:15px">⎋</span> und dann auf <b>„Zum Home-Bildschirm“</b>. Danach startet das Cockpit wie eine normale App – auch offline.</p>`;
  else install = `<p class="small muted">Im Browser-Menü <b>„App installieren“</b> bzw. <b>„Als App installieren“</b> wählen (Edge: ⋯ → Apps, Chrome: ⋮ → Streamen, speichern und teilen).</p>`;
  const fs = fsSupported();
  return `<div class="card span-12">${head(`${ic('refresh', 17)} Geräte & Abgleich`, `<span class="sub">Letzter Abgleich: ${last}</span>`)}
    <div class="row2" style="gap:28px;align-items:start">
      <div><div class="field-label" style="margin-bottom:8px">Als App nutzen</div>${install}</div>
      <div><div class="field-label" style="margin-bottom:8px">PC ⇄ Handy abgleichen</div>
        <p class="small muted" style="margin-bottom:10px">Über eine <b>verschlüsselte Sync-Datei</b> in deiner Cloud. Änderungen beider Geräte werden zusammengeführt – nichts geht verloren.${fs && syncHandle ? ` Verknüpft: <b>${esc(syncHandle.name)}</b>` : ''}</p>
        <div class="btn-row"><button class="btn primary sm" data-action="syncNow">${ic('refresh', 15)} ${fs && !syncHandle ? 'Abgleich einrichten' : 'Jetzt abgleichen'}</button>${fs && syncHandle ? `<button class="btn sm ghost" data-action="syncSetup">Andere Datei</button>` : ''}</div>
      </div></div></div>`;
}
Object.assign(ACTIONS, { syncNow: () => syncNow(), syncSetup: () => syncSetupModal(), installApp: () => installApp() });
