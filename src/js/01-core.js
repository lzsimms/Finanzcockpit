'use strict';
/* =========================================================
   Finanzcockpit – Kern: Helfer, Verschlüsselung, Datenmodell
   ========================================================= */
const APP_VERSION = '1.0.0';
const VAULT_KEY = 'finanzcockpit.vault.v1';
const THROTTLE_KEY = 'finanzcockpit.throttle.v1';
const PREFS_KEY = 'finanzcockpit.prefs.v1';
const PBKDF2_ITER = 600000;          // OWASP-Empfehlung 2023+ für PBKDF2-SHA256
const enc = new TextEncoder(), dec = new TextDecoder();

/* ---------- DOM & allgemeine Helfer ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function uid() { const b = crypto.getRandomValues(new Uint8Array(9)); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }
const round2 = n => { n = +n || 0; return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7) / 100; };
const round6 = n => Math.round((+n || 0) * 1e6) / 1e6;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Deutsche und englische Zahleneingaben verstehen: "1.234,56", "12,5", "12.5", "1.234" */
function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).trim().replace(/[\s€%]/g, '').replace(/[−–]/g, '-');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ---------- Formatierung ---------- */
const nfEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = n => nfEUR.format(round2(n) + 0);
const fmtSigned = n => { const r = round2(n); return (r > 0 ? '+' : r < 0 ? '−' : '') + nfEUR.format(Math.abs(r)); };
function fmtC(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio €';
  if (a >= 1e4) return s + Math.round(a / 1e3) + 'k €';
  if (a >= 1e3) return s + (a / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'k €';
  return s + Math.round(a) + ' €';
}
const fmtPct = (n, signed = true) => (signed && n > 0.049 ? '+' : n < -0.049 ? '−' : '') + Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const fmtNum = (n, d = 2) => (+n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtShares = n => (+n).toLocaleString('de-DE', { maximumFractionDigits: 6 });
const fmtNumIn = (n, max = 2) => (n === '' || n == null || isNaN(n)) ? '' : (+n).toLocaleString('de-DE', { minimumFractionDigits: Math.min(2, max), maximumFractionDigits: max, useGrouping: false });
const fmtPrice = n => (+n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 4 : 2 });
const money = (n, cls = '') => `<span class="money ${cls}">${fmt(n)}</span>`;
const moneyS = (n, cls = '') => `<span class="money ${n > 0.004 ? 'pos' : n < -0.004 ? 'neg' : ''} ${cls}">${fmtSigned(n)}</span>`;

/* ---------- Datum ---------- */
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const today = () => isoDate(new Date());
function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
function addMonths(s, n, day) {
  const d = parseDate(s), want = day || d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(want, last));
  return isoDate(t);
}
function shiftMonth(k, n) { const [y, m] = k.split('-').map(Number); return isoDate(new Date(y, m - 1 + n, 1)).slice(0, 7); }
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
function daysInMonth(k) { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).getDate(); }
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function monthLabel(k, short) { const [y, m] = k.split('-').map(Number); return short ? `${MONTHS_S[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`; }
const fmtDate = s => s ? parseDate(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
const fmtDateS = s => { const d = parseDate(s); return `${d.getDate()}. ${MONTHS_S[d.getMonth()]}`; };
const fmtDateLong = s => parseDate(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function fmtDay(s) {
  const t = today();
  if (s === t) return 'Heute';
  if (s === addDays(t, -1)) return 'Gestern';
  if (s === addDays(t, 1)) return 'Morgen';
  const o = { weekday: 'long', day: 'numeric', month: 'long' };
  if (s.slice(0, 4) !== t.slice(0, 4)) o.year = 'numeric';
  return parseDate(s).toLocaleDateString('de-DE', o);
}
function relDays(s) {
  const n = daysBetween(today(), s);
  if (n === 0) return 'heute'; if (n === 1) return 'morgen'; if (n === -1) return 'gestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}
const INTERVALS = {
  weekly: { label: 'Wöchentlich', perMonth: 52 / 12 },
  biweekly: { label: 'Alle 2 Wochen', perMonth: 26 / 12 },
  monthly: { label: 'Monatlich', perMonth: 1 },
  quarterly: { label: 'Vierteljährlich', perMonth: 1 / 3 },
  halfyearly: { label: 'Halbjährlich', perMonth: 1 / 6 },
  yearly: { label: 'Jährlich', perMonth: 1 / 12 },
};
function nextDate(s, iv, day) {
  switch (iv) {
    case 'weekly': return addDays(s, 7);
    case 'biweekly': return addDays(s, 14);
    case 'quarterly': return addMonths(s, 3, day);
    case 'halfyearly': return addMonths(s, 6, day);
    case 'yearly': return addMonths(s, 12, day);
    default: return addMonths(s, 1, day);
  }
}

/* ---------- Icons (eigene Strichzeichnungen, 24er Raster) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-6h4v6"/>',
  wallet: '<path d="M4 7.5V6a2 2 0 0 1 2-2h11"/><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 13.5h.01"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  pie: '<path d="M12 3v9h9"/><circle cx="12" cy="12" r="9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  forecast: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/><path d="M20 7v4"/><path d="M16 7h4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 15v2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  bank: '<path d="M3 21h18M4.5 10h15M12 3l8.5 5h-17z"/><path d="M6.5 10v8M10.5 10v8M13.5 10v8M17.5 10v8"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  up: '<path d="M7 17L17 7M8 7h9v9"/>',
  down: '<path d="M7 7l10 10M17 8v9H8"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.7 4.3L20 16"/><path d="M20 20.5V16h-4.5"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.4-2.9-5.5-3"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevl: '<path d="M15 6l-6 6 6 6"/>',
  chevr: '<path d="M9 6l6 6-6 6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  file: '<path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3v6h6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
};
function ic(name, size = 18, sw = 1.8) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- Unverschlüsselte Einstellungen (nur Darstellung) ---------- */
const Prefs = {
  get() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } },
  set(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...this.get(), ...p })); } catch { } },
};

/* ---------- Schutz gegen Durchprobieren von Passwörtern ---------- */
const Throttle = {
  get() { try { return JSON.parse(localStorage.getItem(THROTTLE_KEY)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } },
  fail() {
    const t = this.get(); t.fails++;
    if (t.fails >= 5) t.until = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (t.fails - 5));
    try { localStorage.setItem(THROTTLE_KEY, JSON.stringify(t)); } catch { }
    return t;
  },
  clear() { try { localStorage.removeItem(THROTTLE_KEY); } catch { } },
};

/* ---------- Tresor: AES-256-GCM, Schlüssel per PBKDF2-SHA256 ---------- */
function b64e(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64d(str) { const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }

const Vault = {
  key: null, salt: null, iter: PBKDF2_ITER,
  exists() { try { return !!localStorage.getItem(VAULT_KEY); } catch { return false; } },
  read() { return JSON.parse(localStorage.getItem(VAULT_KEY)); },
  async derive(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    // nicht extrahierbar: der Schlüssel kann nicht aus dem Speicher ausgelesen werden
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async create(pw, data) {
    this.salt = crypto.getRandomValues(new Uint8Array(16));
    this.iter = PBKDF2_ITER;
    this.key = await this.derive(pw, this.salt, this.iter);
    await this.save(data);
  },
  async decryptBlob(blob, pw) {
    if (!blob || blob.app !== 'finanzcockpit' || !blob.ct) throw new Error('Keine gültige Finanzcockpit-Datei.');
    const salt = b64d(blob.salt), iter = blob.iter || PBKDF2_ITER;
    const key = await this.derive(pw, salt, iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
    return { data: JSON.parse(dec.decode(pt)), key, salt, iter };
  },
  async unlock(pw) {
    const r = await this.decryptBlob(this.read(), pw);
    this.key = r.key; this.salt = r.salt; this.iter = r.iter;
    return r.data;
  },
  async encryptBlob(data) {
    if (!this.key) throw new Error('Tresor ist gesperrt.');
    const iv = crypto.getRandomValues(new Uint8Array(12));   // frischer Zufalls-IV bei jedem Speichern
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, enc.encode(JSON.stringify(data)));
    return { app: 'finanzcockpit', v: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-256-GCM', iter: this.iter, salt: b64e(this.salt), iv: b64e(iv), ct: b64e(ct), saved: new Date().toISOString() };
  },
  async save(data) { const blob = await this.encryptBlob(data); localStorage.setItem(VAULT_KEY, JSON.stringify(blob)); return blob; },
  adopt(r) { this.key = r.key; this.salt = r.salt; this.iter = r.iter; },
  lock() { this.key = null; this.salt = null; },
  destroy() { try { localStorage.removeItem(VAULT_KEY); } catch { } this.lock(); },
};

function pwStrength(p) {
  if (!p) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (classes >= 3) s++;
  if (p.length >= 16 || (p.length >= 12 && classes === 4)) s++;
  if (p.length < 8) s = p.length >= 5 ? 1 : 0;
  if (/^(.)\1+$/.test(p) || /^(passwort|password|12345678|qwertz|qwerty)/i.test(p)) s = Math.min(s, 1);
  return s;
}
const STRENGTH = ['Sehr schwach', 'Schwach', 'Okay', 'Gut', 'Stark 💪'];

/* ---------- Stammdaten ---------- */
const PALETTE = ['#7c6cff', '#22d3ee', '#2fd47a', '#f5b544', '#ff7a90', '#a78bfa', '#38bdf8', '#fb923c', '#34d399', '#f472b6', '#facc15', '#94a3b8'];
const ACC_TYPES = { cash: { label: 'Bargeld', emoji: '💶' }, bank: { label: 'Bankkonto', emoji: '🏦' }, depot: { label: 'Depot', emoji: '📈' } };
const HOLD_TYPES = { ETF: '#7c6cff', Aktie: '#22d3ee', Krypto: '#f5b544', Anleihe: '#2fd47a', Fonds: '#a78bfa', Rohstoff: '#fb923c', Sonstiges: '#94a3b8' };
const ACC_EMOJIS = ['💶', '🏦', '💳', '🐷', '📈', '💰', '🪙', '🏛️', '💼', '🏠', '🌍', '⭐'];
const GOAL_EMOJIS = ['🛟', '✈️', '🗾', '🏖️', '🚲', '🚗', '🏠', '💍', '🎓', '💻', '📱', '🎸', '👶', '🐶', '🎁', '🌍'];
const CAT_EMOJIS = ['🏠', '🛒', '🍽️', '☕', '🚗', '⛽', '🚆', '🛍️', '👕', '🎉', '🎬', '🎮', '💊', '🏋️', '📺', '📱', '🛡️', '✈️', '📚', '🎁', '🐶', '👶', '💡', '🔧', '💼', '🏦', '📈', '🧰', '↩️', '➕', '📦', '💸'];
const DEFAULT_CATEGORIES = [
  { id: 'c_home', name: 'Wohnen', icon: '🏠', kind: 'expense', color: '#7c6cff' },
  { id: 'c_food', name: 'Lebensmittel', icon: '🛒', kind: 'expense', color: '#2fd47a' },
  { id: 'c_rest', name: 'Restaurant & Café', icon: '🍽️', kind: 'expense', color: '#fb923c' },
  { id: 'c_mob', name: 'Mobilität', icon: '🚗', kind: 'expense', color: '#38bdf8' },
  { id: 'c_shop', name: 'Shopping', icon: '🛍️', kind: 'expense', color: '#f472b6' },
  { id: 'c_fun', name: 'Freizeit', icon: '🎉', kind: 'expense', color: '#facc15' },
  { id: 'c_health', name: 'Gesundheit', icon: '💊', kind: 'expense', color: '#34d399' },
  { id: 'c_abo', name: 'Abos & Medien', icon: '📺', kind: 'expense', color: '#a78bfa' },
  { id: 'c_ins', name: 'Versicherungen', icon: '🛡️', kind: 'expense', color: '#22d3ee' },
  { id: 'c_travel', name: 'Reisen', icon: '✈️', kind: 'expense', color: '#ff7a90' },
  { id: 'c_edu', name: 'Bildung', icon: '📚', kind: 'expense', color: '#f5b544' },
  { id: 'c_gift', name: 'Geschenke', icon: '🎁', kind: 'expense', color: '#e879f9' },
  { id: 'c_misc', name: 'Sonstiges', icon: '📦', kind: 'expense', color: '#94a3b8', locked: true },
  { id: 'c_salary', name: 'Gehalt', icon: '💼', kind: 'income', color: '#2fd47a' },
  { id: 'c_interest', name: 'Zinsen', icon: '🏦', kind: 'income', color: '#22d3ee' },
  { id: 'c_div', name: 'Dividenden', icon: '📈', kind: 'income', color: '#7c6cff', locked: true },
  { id: 'c_side', name: 'Nebeneinkünfte', icon: '🧰', kind: 'income', color: '#f5b544' },
  { id: 'c_refund', name: 'Erstattungen', icon: '↩️', kind: 'income', color: '#38bdf8' },
  { id: 'c_misc_in', name: 'Sonstige Einnahmen', icon: '➕', kind: 'income', color: '#94a3b8', locked: true },
];

/* ---------- Zustand ---------- */
let S = null;      // entschlüsselte Daten – nur im Arbeitsspeicher, solange entsperrt
let C = null;      // Berechnungs-Cache
const UI = {
  view: 'dashboard', range: '1J', _last: null,
  tx: { q: '', acc: '', cat: '', month: '', kind: '' }, txLimit: 150,
  budgetMonth: today().slice(0, 7), depot: '',
  fc: null,
};

function defaultState() {
  return {
    v: 1, created: today(),
    settings: { name: '', autoLock: 5, lockOnHide: false, onboarded: false, demo: false },
    accounts: [], categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    transactions: [], recurring: [], holdings: [], trades: [], plans: [], goals: [], budgets: {}, snapshots: [],
    tomb: {}, budgetsU: 0,
  };
}
function migrate(d) {
  const base = defaultState();
  for (const k of Object.keys(base)) if (d[k] == null) d[k] = base[k];
  d.settings = { ...base.settings, ...d.settings };
  return d;
}
const acc = id => S.accounts.find(a => a.id === id);
const cat = id => S.categories.find(c => c.id === id);
const hold = id => S.holdings.find(h => h.id === id);
const accEmoji = a => a ? (a.icon || ACC_TYPES[a.type]?.emoji || '💰') : '❔';
const byDateTs = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0);
let tsCounter = Date.now();
const nextTs = () => ++tsCounter;

/* ---------- Berechnungen ---------- */
function applyTrade(hm, t, addCash) {
  const h = hm[t.holdingId] || (hm[t.holdingId] = { shares: 0, cost: 0, realized: 0, invested: 0, fees: 0 });
  const gross = t.shares * t.price, fee = +t.fee || 0;
  if (t.side === 'buy') {
    h.shares += t.shares; h.cost += gross + fee; h.invested += gross + fee;
    if (!t.noCash) addCash(t.accountId, -(gross + fee));
  } else {
    const basis = h.shares > 0 ? h.cost * Math.min(1, t.shares / h.shares) : 0;
    const proceeds = gross - fee;
    h.cost -= basis; h.shares -= t.shares; h.realized += proceeds - basis;
    if (h.shares < 1e-9) { h.shares = 0; h.cost = 0; }
    if (!t.noCash) addCash(t.accountId, proceeds);
  }
  h.fees += fee;
}

function computeAll() {
  if (C) return C;
  const t = today(), cash = {};
  for (const a of S.accounts) cash[a.id] = +a.opening || 0;
  const add = (id, v) => { if (id in cash) cash[id] += v; };
  for (const x of S.transactions) {
    if (x.date > t) continue;
    if (x.kind === 'income') add(x.accountId, x.amount);
    else if (x.kind === 'expense') add(x.accountId, -x.amount);
    else { add(x.accountId, -x.amount); add(x.toAccountId, x.amount); }
  }
  const hm = {};
  for (const tr of S.trades.filter(x => x.date <= t).sort(byDateTs)) applyTrade(hm, tr, add);
  const holdC = {}; let depotValue = 0, depotCost = 0;
  for (const h of S.holdings) {
    const s = hm[h.id] || { shares: 0, cost: 0, realized: 0, invested: 0, fees: 0 };
    const value = s.shares * (+h.price || 0), pl = value - s.cost;
    holdC[h.id] = { ...s, value, pl, plPct: s.cost > 0 ? pl / s.cost * 100 : 0, avg: s.shares > 0 ? s.cost / s.shares : 0 };
    depotValue += value; depotCost += s.cost;
  }
  const total = { ...cash };
  for (const h of S.holdings) if (h.accountId in total) total[h.accountId] += holdC[h.id].value;
  const netWorth = sum(Object.values(total));
  const liquid = sum(Object.values(cash));
  return (C = { cash, total, hold: holdC, netWorth, depotValue, depotCost, liquid });
}

function monthStats(k, accId) {
  let inc = 0, exp = 0, expRec = 0; const byCat = {}, byCatRec = {}; const t = today();
  for (const x of S.transactions) {
    if (x.correction || x.kind === 'transfer' || x.date.slice(0, 7) !== k || x.date > t) continue;
    if (accId && x.accountId !== accId) continue;
    if (x.kind === 'income') inc += x.amount;
    else {
      exp += x.amount; byCat[x.category] = (byCat[x.category] || 0) + x.amount;
      if (x.recurringId) { expRec += x.amount; byCatRec[x.category] = (byCatRec[x.category] || 0) + x.amount; }
    }
  }
  return { inc: round2(inc), exp: round2(exp), expRec, net: round2(inc - exp), rate: inc > 0 ? (inc - exp) / inc * 100 : 0, byCat, byCatRec };
}
/** Hochrechnung bis Monatsende: Fixkosten zählen einmal (gebucht + noch fällig), nur variable Ausgaben werden linear hochgerechnet */
function projectMonth(ms, frac, catId) {
  if (!(frac > 0 && frac < 1)) return null;
  const mk = today().slice(0, 7), end = mk + '-' + String(daysInMonth(mk)).padStart(2, '0');
  let fixedLeft = 0;
  for (const r of S.recurring) {
    if (r.paused || r.kind !== 'expense' || (catId && r.category !== catId)) continue;
    let d = r.next, g = 0; while (d && d <= end && g++ < 40) { fixedLeft += r.amount; d = nextDate(d, r.interval, r.day); }
  }
  const spent = catId ? (ms.byCat[catId] || 0) : ms.exp, rec = catId ? (ms.byCatRec[catId] || 0) : ms.expRec;
  return rec + fixedLeft + (spent - rec) / frac;
}
/** Durchschnitt der letzten n abgeschlossenen Monate (nur Monate mit Daten) */
function avgMonthly(n = 3) {
  const mk = today().slice(0, 7); const list = [];
  for (let i = 1; i <= n; i++) { const s = monthStats(shiftMonth(mk, -i)); if (s.inc || s.exp) list.push(s); }
  if (!list.length) return { inc: 0, exp: 0, net: 0, n: 0, byCat: {} };
  const byCat = {};
  for (const s of list) for (const [c, v] of Object.entries(s.byCat)) byCat[c] = (byCat[c] || 0) + v / list.length;
  return { inc: sum(list, s => s.inc) / list.length, exp: sum(list, s => s.exp) / list.length, net: sum(list, s => s.net) / list.length, n: list.length, byCat };
}

/** Vermögen zu beliebigen Stichtagen: Konten exakt aus Buchungen, Depot über Einstandswert × Kursentwicklung (Snapshots) */
function nwAt(dates) {
  const tx = S.transactions.filter(t => t.kind !== 'transfer').sort(byDateTs);
  const tr = S.trades.slice().sort(byDateTs);
  const sn = S.snapshots.slice().sort((a, b) => a.d < b.d ? -1 : 1);
  let cash = sum(S.accounts, a => a.opening); const hm = {}; let i = 0, j = 0, k = 0, ratio = 1;
  const addCash = (_, v) => { cash += v; };
  return dates.map(d => {
    while (i < tx.length && tx[i].date <= d) { const t = tx[i++]; cash += t.kind === 'income' ? t.amount : -t.amount; }
    while (j < tr.length && tr[j].date <= d) applyTrade(hm, tr[j++], addCash);
    while (k < sn.length && sn[k].d <= d) { const s = sn[k++]; ratio = s.cb > 0 ? s.mv / s.cb : 1; }
    let cb = 0; for (const id in hm) cb += hm[id].cost;
    return cash + cb * ratio;
  });
}
function seriesNW(from, to, maxPts = 90) {
  const days = Math.max(1, daysBetween(from, to)), step = Math.max(1, Math.ceil(days / maxPts));
  const dates = []; for (let d = from; d < to; d = addDays(d, step)) dates.push(d);
  dates.push(to);
  const values = nwAt(dates);
  if (to === today()) values[values.length - 1] = computeAll().netWorth;
  return { dates, values };
}
function accountSeries(id, from, to, maxPts = 40) {
  const a = acc(id); const days = Math.max(1, daysBetween(from, to)), step = Math.max(1, Math.ceil(days / maxPts));
  const tx = S.transactions.filter(x => x.accountId === id || x.toAccountId === id).sort(byDateTs);
  const tr = S.trades.filter(x => x.accountId === id && !x.noCash).sort(byDateTs);
  let v = +a.opening || 0, i = 0, j = 0; const out = [];
  const dates = []; for (let d = from; d < to; d = addDays(d, step)) dates.push(d); dates.push(to);
  for (const d of dates) {
    while (i < tx.length && tx[i].date <= d) {
      const x = tx[i++];
      if (x.kind === 'income') v += x.amount; else if (x.kind === 'expense') v -= x.amount;
      else { if (x.accountId === id) v -= x.amount; if (x.toAccountId === id) v += x.amount; }
    }
    while (j < tr.length && tr[j].date <= d) { const x = tr[j++]; const g = x.shares * x.price, f = +x.fee || 0; v += x.side === 'buy' ? -(g + f) : g - f; }
    out.push(v);
  }
  return out;
}
function firstDataDate() {
  let m = today();
  for (const x of S.transactions) if (x.date < m) m = x.date;
  for (const x of S.trades) if (x.date < m) m = x.date;
  for (const x of S.snapshots) if (x.d < m) m = x.d;
  return m;
}
function recordSnapshot() {
  if (!S) return;
  const c = computeAll(), d = today();
  const snap = { d, mv: round2(c.depotValue), cb: round2(c.depotCost), nw: round2(c.netWorth) };
  const last = S.snapshots[S.snapshots.length - 1];
  if (last && last.d === d) S.snapshots[S.snapshots.length - 1] = snap; else S.snapshots.push(snap);
}

/** Fällige Daueraufträge & Sparpläne automatisch buchen */
function processDue(st) {
  const t = today(); let n = 0, p = 0;
  for (const r of st.recurring) {
    if (r.paused) continue;
    let guard = 0;
    while (r.next && r.next <= t && guard++ < 600) {
      if (r.end && r.next > r.end) { r.paused = true; break; }
      // deterministische ID: bucht ein zweites Gerät denselben Termin, erkennt der Abgleich das Duplikat
      st.transactions.push({ id: 'r' + r.id + r.next.replace(/-/g, ''), ts: nextTs(), date: r.next, kind: r.kind, amount: r.amount, accountId: r.accountId, toAccountId: r.toAccountId || '', category: r.kind === 'transfer' ? '' : r.category, note: r.name, recurringId: r.id });
      r.next = nextDate(r.next, r.interval, r.day); n++;
    }
  }
  for (const pl of st.plans) {
    if (pl.paused) continue;
    const h = st.holdings.find(x => x.id === pl.holdingId);
    if (!h || !(h.price > 0)) continue;
    let guard = 0;
    while (pl.next && pl.next <= t && guard++ < 600) {
      st.trades.push({ id: 'p' + pl.id + pl.next.replace(/-/g, ''), ts: nextTs(), holdingId: h.id, accountId: h.accountId, date: pl.next, side: 'buy', shares: round6(pl.amount / h.price), price: h.price, fee: 0, planId: pl.id });
      pl.next = nextDate(pl.next, pl.interval || 'monthly', pl.day); p++;
    }
  }
  return { n, p };
}
const monthlyEq = r => r.amount * (INTERVALS[r.interval]?.perMonth ?? 1);

/* ---------- Speichern ---------- */
let saveChain = Promise.resolve();
function persist() {
  if (!S || !Vault.key) return saveChain;
  const data = S;
  saveChain = saveChain.then(() => Vault.save(data)).catch(e => { console.error(e); toast('Speichern fehlgeschlagen: ' + (e.message || e), 'err'); });
  return saveChain;
}
function commit(msg, opts = {}) {
  C = null; stampChanges(); recordSnapshot(); persist(); render();
  if (msg) toast(msg, opts.tone || 'ok', opts);
}
