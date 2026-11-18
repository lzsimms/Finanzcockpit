/* =========================================================
   Dialoge
   ========================================================= */
function openModal({ title, body, submit = 'Speichern', cancel = 'Abbrechen', onSubmit, onOpen, onDelete, deleteLabel = 'Löschen', size = '' }) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><form class="modal ${size}" novalidate autocomplete="off">
    <header class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn sm bare" data-close aria-label="Schließen">${ic('x', 18)}</button></header>
    <div class="modal-body">${body}<div class="form-error" role="alert"></div></div>
    ${submit || cancel || onDelete ? `<footer class="modal-foot">${onDelete ? `<button type="button" class="btn danger" data-delete>${ic('trash', 16)} ${deleteLabel}</button>` : ''}<span class="grow"></span>${cancel ? `<button type="button" class="btn ghost" data-close>${cancel}</button>` : ''}${submit ? `<button type="submit" class="btn primary">${submit}</button>` : ''}</footer>` : ''}
  </form></div>`;
  const bd = root.firstElementChild, form = bd.firstElementChild, err = form.querySelector('.form-error');
  requestAnimationFrame(() => bd.classList.add('open'));
  bd.addEventListener('mousedown', e => { if (e.target === bd) closeModal(); });
  form.addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) closeModal();
    else if (e.target.closest('[data-delete]')) { const r = await onDelete(); if (r !== false && form.isConnected) closeModal(); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    const btn = form.querySelector('[type=submit]');
    try {
      if (btn) btn.disabled = true;
      const fd = Object.fromEntries(new FormData(form));
      const r = onSubmit ? await onSubmit(fd, form) : undefined;
      if (r !== false && form.isConnected) closeModal();
    } catch (x) {
      err.textContent = x.message || String(x);
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    } finally { if (btn) btn.disabled = false; }
  });
  onOpen && onOpen(form);
  const first = form.querySelector('[autofocus]') || form.querySelector('.modal-body input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), .modal-body select');
  if (first) { first.focus({ preventScroll: true }); if (first.select && first.type !== 'date') first.select(); }
  return form;
}
function closeModal() { $('#modal-root').innerHTML = ''; }
const modalOpen = () => !!$('#modal-root').firstElementChild;

function confirmDialog({ title, text, ok = 'Bestätigen', danger = false, typed = '' }) {
  return new Promise(res => {
    const root = $('#confirm-root');
    root.innerHTML = `<div class="modal-backdrop top"><div class="modal small" role="alertdialog"><header class="modal-head"><h3>${title}</h3></header><div class="modal-body"><p class="muted">${text}</p>${typed ? `<input class="input" id="cfTyped" placeholder="${esc(typed)}" autocomplete="off">` : ''}</div><footer class="modal-foot"><span class="grow"></span><button class="btn ghost" data-r="0">Abbrechen</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1" ${danger ? 'style="border-color:rgba(255,93,115,.35)"' : ''}>${ok}</button></footer></div></div>`;
    const bd = root.firstElementChild; requestAnimationFrame(() => bd.classList.add('open'));
    const done = v => { document.removeEventListener('keydown', key, true); root.innerHTML = ''; res(v); };
    const tryOk = () => { if (typed && $('#cfTyped').value.trim().toUpperCase() !== typed) { const m = bd.querySelector('.modal'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); return; } done(true); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); tryOk(); } };
    document.addEventListener('keydown', key, true);
    bd.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) b.dataset.r === '1' ? tryOk() : done(false); else if (e.target === bd) done(false); });
    (typed ? $('#cfTyped') : bd.querySelector('[data-r="1"]')).focus();
  });
}

/* ---------- Formular-Bausteine ---------- */
const F = {
  field: (label, inner, hint = '', cls = '') => `<div class="field ${cls}"><span class="field-label">${label}</span>${inner}${hint ? `<small class="hint">${hint}</small>` : ''}</div>`,
  text: (name, val = '', attrs = '') => `<input class="input" name="${name}" value="${esc(val)}" ${attrs}>`,
  money: (name, val, attrs = '', max = 2) => `<div class="input-affix"><input class="input" name="${name}" value="${val === '' || val == null ? '' : esc(fmtNumIn(val, max))}" inputmode="decimal" placeholder="0,00" autocomplete="off" ${attrs}><span>€</span></div>`,
  num: (name, val, attrs = '', suffix = '') => `<div class="input-affix"><input class="input" name="${name}" value="${val === '' || val == null ? '' : esc(String(val).replace('.', ','))}" inputmode="decimal" autocomplete="off" ${attrs}><span>${suffix}</span></div>`,
  date: (name, val, attrs = '') => `<input class="input" type="date" name="${name}" value="${esc(val || '')}" ${attrs}>`,
  select: (name, opts, val, attrs = '') => `<select class="input" name="${name}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`,
  check: (name, label, checked) => `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="box"></span><span>${label}</span></label>`,
  seg: (name, opts, val, cls = '') => `<div class="seg full ${cls}">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === val ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`,
  colors: (name, val) => `<div class="swatches">${PALETTE.map(c => `<label class="sw" style="--c:${c}"><input type="radio" name="${name}" value="${c}" ${c === val ? 'checked' : ''}><span></span></label>`).join('')}</div>`,
  emojis: (name, list, val) => `<div class="emoji-pick">${list.map(e => `<label><input type="radio" name="${name}" value="${e}" ${e === val ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>`,
};
function reqNum(v, msg, { allowZero = false, allowNeg = false } = {}) {
  const n = parseNum(v);
  if (!Number.isFinite(n) || (!allowNeg && (allowZero ? n < 0 : n <= 0))) throw new Error(msg);
  return n;
}
const optNum = v => { const n = parseNum(v); return Number.isFinite(n) ? n : 0; };
const reqDate = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) throw new Error('Bitte ein gültiges Datum wählen.'); return v; };
const accOpts = (filter = () => true) => S.accounts.filter(filter).map(a => [a.id, `${accEmoji(a)} ${a.name}`]);
function defaultAccountId(kind) {
  if (UI.lastAcc && acc(UI.lastAcc)) return UI.lastAcc;
  return (S.accounts.find(a => a.type === 'bank') || S.accounts[0])?.id;
}
function needAccounts() { if (!S.accounts.length) { toast('Lege zuerst ein Konto an.', 'err'); accountModal(); return false; } return true; }

/* ---------- Buchung ---------- */
function txModal(t, preset = {}) {
  if (!needAccounts()) return;
  if (typeof t === 'string') t = S.transactions.find(x => x.id === t);
  const isEdit = !!t;
  const d = t ? { ...t } : { kind: preset.kind || 'expense', amount: preset.amount || '', accountId: preset.accountId || defaultAccountId(), toAccountId: '', category: '', date: today(), note: preset.note || '' };
  const chosen = { expense: d.kind === 'expense' ? d.category : '', income: d.kind === 'income' ? d.category : '' };
  const notes = [...new Set(sortedTx().map(x => x.note).filter(Boolean))].slice(0, 300);
  const other = S.accounts.find(a => a.id !== d.accountId);
  openModal({
    title: isEdit ? 'Buchung bearbeiten' : 'Neue Buchung', submit: isEdit ? 'Speichern' : 'Buchen',
    body: `${F.seg('kind', [['expense', 'Ausgabe'], ['income', 'Einnahme'], ['transfer', 'Umbuchung']], d.kind, 'kind-seg')}
      <div class="amount-big"><input name="amount" inputmode="decimal" placeholder="0,00" value="${d.amount ? esc(fmtNumIn(d.amount)) : ''}" autocomplete="off" autofocus><span>€</span></div>
      <div class="field cat-wrap"><span class="field-label">Kategorie</span><div class="cat-grid" id="catGrid"></div></div>
      <div class="row2">${F.field('<span id="lblFrom">Konto</span>', F.select('accountId', accOpts(), d.accountId))}${F.field('Auf Konto', F.select('toAccountId', accOpts(), d.toAccountId || other?.id || ''), '', 'to-wrap')}</div>
      <div class="row2">${F.field('Datum', F.date('date', d.date))}${F.field('Notiz', F.text('note', d.note, 'list="noteList" maxlength="80" placeholder="z. B. Rewe, Tankstelle …"'))}</div>
      <datalist id="noteList">${notes.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      ${isEdit && t.recurringId ? '<p class="hint">↻ Automatisch aus einem Dauerauftrag gebucht. Änderungen betreffen nur diese Buchung.</p>' : ''}`,
    onOpen(form) {
      const grid = form.querySelector('#catGrid');
      const sync = () => {
        const kind = form.kind.value;
        form.querySelector('.cat-wrap').hidden = kind === 'transfer';
        form.querySelector('.to-wrap').hidden = kind !== 'transfer';
        form.querySelector('#lblFrom').textContent = kind === 'transfer' ? 'Von Konto' : 'Konto';
        if (kind !== 'transfer') grid.innerHTML = S.categories.filter(c => c.kind === kind).map(c => `<label class="cat-chip" style="--c:${c.color}"><input type="radio" name="category" value="${c.id}" ${chosen[kind] === c.id ? 'checked' : ''}><span>${c.icon}</span><small>${esc(c.name)}</small></label>`).join('');
      };
      const learn = () => {
        const n = form.note.value.trim().toLowerCase(); if (!n) return;
        const kind = form.kind.value;
        const prev = sortedTx().find(x => (x.note || '').toLowerCase() === n && x.kind === kind && x.category);
        if (prev && !form.querySelector('input[name=category]:checked')) {
          chosen[kind] = prev.category; sync();
          if (acc(prev.accountId)) form.accountId.value = prev.accountId;
        }
      };
      form.addEventListener('change', e => {
        if (e.target.name === 'kind') sync();
        if (e.target.name === 'category') chosen[form.kind.value] = e.target.value;
        if (e.target.name === 'note') learn();
      });
      sync(); if (!isEdit && d.note) learn();
    },
    onSubmit(fd) {
      const amount = reqNum(fd.amount, 'Bitte einen gültigen Betrag eingeben.');
      const date = reqDate(fd.date);
      if (fd.kind === 'transfer' && fd.accountId === fd.toAccountId) throw new Error('Quell- und Zielkonto müssen verschieden sein.');
      const obj = { kind: fd.kind, amount: round2(amount), accountId: fd.accountId, toAccountId: fd.kind === 'transfer' ? fd.toAccountId : '', category: fd.kind === 'transfer' ? '' : (fd.category || (fd.kind === 'income' ? 'c_misc_in' : 'c_misc')), date, note: (fd.note || '').trim() };
      UI.lastAcc = fd.accountId;
      if (isEdit) Object.assign(S.transactions.find(x => x.id === t.id), obj);
      else S.transactions.push({ id: uid(), ts: nextTs(), ...obj });
      commit(isEdit ? 'Buchung gespeichert' : `${obj.kind === 'expense' ? 'Ausgabe' : obj.kind === 'income' ? 'Einnahme' : 'Umbuchung'} über ${fmt(obj.amount)} gebucht`);
    },
    onDelete: isEdit ? () => { deleteTx(t.id); } : null,
  });
}
function deleteTx(id) {
  const i = S.transactions.findIndex(x => x.id === id); if (i < 0) return;
  const [t] = S.transactions.splice(i, 1);
  commit('Buchung gelöscht', { undo: () => { if (!S) return; S.transactions.splice(i, 0, t); commit('Wiederhergestellt'); } });
}

/* ---------- Konten ---------- */
function accountModal(id, presetType) {
  const a = id ? acc(id) : null;
  const d = a || { name: '', type: presetType || 'bank', opening: 0, color: PALETTE[S.accounts.length % PALETTE.length], icon: '' };
  const used = a ? S.transactions.filter(x => x.accountId === a.id || x.toAccountId === a.id).length + S.holdings.filter(h => h.accountId === a.id).length : 0;
  openModal({
    title: a ? 'Konto bearbeiten' : 'Neues Konto',
    body: `${F.field('Name', F.text('name', d.name, 'maxlength="40" placeholder="z. B. Girokonto Sparkasse" required'))}
      ${F.field('Typ', F.seg('type', [['cash', '💶 Bargeld'], ['bank', '🏦 Bankkonto'], ['depot', '📈 Depot']], d.type))}
      ${F.field(a ? 'Startsaldo' : 'Aktueller Kontostand', F.money('opening', d.opening, '', 2), a ? 'Saldo vor der ersten erfassten Buchung. Zum Korrigieren des aktuellen Stands nutze besser „Saldo abgleichen“.' : 'Bei einem Depot: nur das Cash auf dem Verrechnungskonto. Wertpapiere fügst du im Depot hinzu.')}
      ${F.field('Symbol', F.emojis('icon', ACC_EMOJIS, d.icon || ACC_TYPES[d.type].emoji))}
      ${F.field('Farbe', F.colors('color', d.color))}`,
    onSubmit(fd) {
      const name = (fd.name || '').trim(); if (!name) throw new Error('Bitte einen Namen eingeben.');
      const opening = round2(optNum(fd.opening));
      if (a) Object.assign(a, { name, type: fd.type, opening, color: fd.color || d.color, icon: fd.icon });
      else S.accounts.push({ id: uid(), name, type: fd.type, opening, color: fd.color || d.color, icon: fd.icon || ACC_TYPES[fd.type].emoji });
      commit(a ? 'Konto gespeichert' : `Konto „${name}“ angelegt`);
    },
    onDelete: a ? async () => {
      const ok = await confirmDialog({ title: `„${esc(a.name)}“ löschen?`, text: used ? `Damit werden auch <b>${used} zugehörige Buchungen/Positionen</b> unwiderruflich gelöscht.` : 'Das Konto wird gelöscht.', ok: 'Endgültig löschen', danger: true });
      if (!ok) return false;
      const hIds = new Set(S.holdings.filter(h => h.accountId === a.id).map(h => h.id));
      S.transactions = S.transactions.filter(x => x.accountId !== a.id && x.toAccountId !== a.id);
      S.recurring = S.recurring.filter(r => r.accountId !== a.id && r.toAccountId !== a.id);
      S.trades = S.trades.filter(x => !hIds.has(x.holdingId) && x.accountId !== a.id);
      S.plans = S.plans.filter(p => !hIds.has(p.holdingId));
      S.holdings = S.holdings.filter(h => !hIds.has(h.id));
      S.goals.forEach(g => { if (g.accountId === a.id) g.accountId = ''; });
      S.accounts = S.accounts.filter(x => x.id !== a.id);
      commit('Konto gelöscht');
    } : null,
  });
}

function reconcileModal(id) {
  const a = acc(id), c = computeAll(), cur = c.cash[id];
  openModal({
    title: `Saldo abgleichen · ${esc(a.name)}`, submit: 'Abgleichen',
    body: `<p class="muted">Trage den Stand aus deiner Banking-App ein. Die Differenz wird als Korrekturbuchung erfasst (zählt nicht in Statistiken).</p>
      <div class="preview"><span>Im Cockpit${a.type === 'depot' ? ' (Verrechnungskonto)' : ''}</span><b class="money">${fmt(cur)}</b></div>
      ${F.field('Tatsächlicher Stand', F.money('actual', '', 'autofocus'))}
      <div class="preview" id="diff"><span>Differenz</span><b>–</b></div>`,
    onOpen(form) { form.actual.addEventListener('input', () => { const v = parseNum(form.actual.value); form.querySelector('#diff b').innerHTML = Number.isFinite(v) ? moneyS(v - cur) : '–'; }); },
    onSubmit(fd) {
      const v = reqNum(fd.actual, 'Bitte den aktuellen Stand eingeben.', { allowZero: true, allowNeg: true });
      const diff = round2(v - cur); if (!diff) { toast('Alles stimmt bereits überein 👌'); return; }
      S.transactions.push({ id: uid(), ts: nextTs(), date: today(), kind: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), accountId: id, category: diff > 0 ? 'c_misc_in' : 'c_misc', note: 'Saldo-Abgleich', correction: true });
      commit(`Saldo angepasst (${fmtSigned(diff)})`);
    },
  });
}

const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
function cashCountModal(id) {
  const a = acc(id), cur = computeAll().cash[id], last = a.lastCount || {};
  openModal({
    title: `Kassensturz · ${esc(a.name)}`, submit: 'Übernehmen', size: 'wide',
    body: `<p class="muted">Zähl dein Bargeld nach Scheinen und Münzen – das Cockpit rechnet mit und bucht eine eventuelle Differenz.</p>
      <div class="field-label">Scheine</div><div class="denoms">${DENOMS.filter(x => x >= 5).map(dn => denomHTML(dn, last[dn])).join('')}</div>
      <div class="field-label">Münzen</div><div class="denoms">${DENOMS.filter(x => x < 5).map(dn => denomHTML(dn, last[dn])).join('')}</div>
      <div class="cash-total"><span>Gezählt</span><b class="money" id="cashSum">0,00 €</b></div>
      <div class="preview"><span>Im Cockpit erfasst</span><b class="money">${fmt(cur)}</b></div>
      <div class="preview" id="cashDiff"><span>Differenz</span><b>–</b></div>`,
    onOpen(form) {
      const upd = () => {
        let s = 0; $$('[data-dn]', form).forEach(i => { s += (parseInt(i.value, 10) || 0) * +i.dataset.dn; });
        s = round2(s); form.querySelector('#cashSum').textContent = fmt(s);
        form.querySelector('#cashDiff b').innerHTML = moneyS(s - cur); form.dataset.sum = s;
      };
      form.addEventListener('input', upd);
      form.addEventListener('click', e => {
        const b = e.target.closest('[data-step]'); if (!b) return;
        const i = b.parentElement.querySelector('input'); i.value = Math.max(0, (parseInt(i.value, 10) || 0) + +b.dataset.step); upd();
      });
      upd();
    },
    onSubmit(fd, form) {
      const counted = +form.dataset.sum, diff = round2(counted - cur);
      a.lastCount = {}; $$('[data-dn]', form).forEach(i => { const n = parseInt(i.value, 10) || 0; if (n) a.lastCount[i.dataset.dn] = n; });
      if (diff) S.transactions.push({ id: uid(), ts: nextTs(), date: today(), kind: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), accountId: id, category: diff > 0 ? 'c_misc_in' : 'c_misc', note: 'Kassensturz', correction: true });
      commit(diff ? `Kassensturz gebucht (${fmtSigned(diff)})` : 'Kasse stimmt auf den Cent 🎯');
    },
  });
}
const denomHTML = (dn, v) => `<div class="denom"><b>${dn >= 1 ? dn + ' €' : Math.round(dn * 100) + ' ct'}</b><button type="button" class="icon-btn sm" data-step="-1">${ic('minus', 13)}</button><input class="input" data-dn="${dn}" value="${v || ''}" inputmode="numeric" placeholder="0"><button type="button" class="icon-btn sm" data-step="1">${ic('plus', 13)}</button></div>`;

/* ---------- Depot ---------- */
const depotOpts = () => accOpts(a => a.type === 'depot');
function needDepot() { if (!S.accounts.some(a => a.type === 'depot')) { toast('Lege zuerst ein Depot-Konto an.', 'err'); accountModal(null, 'depot'); return false; } return true; }
function holdingModal(id) {
  if (!needDepot()) return;
  const h = id ? hold(id) : null;
  const d = h || { name: '', isin: '', type: 'ETF', price: '', color: PALETTE[S.holdings.length % PALETTE.length], accountId: UI.depot || S.accounts.find(a => a.type === 'depot').id };
  const x = h ? computeAll().hold[h.id] : null;
  openModal({
    title: h ? esc(h.name) : 'Neue Position',
    body: `${h ? `<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="label">Bestand</div><div class="v" style="font-size:17px">${fmtShares(x.shares)} Stk.</div></div><div class="kpi"><div class="label">Wert</div><div class="v money" style="font-size:17px">${fmt(x.value)}</div></div><div class="kpi"><div class="label">G/V</div><div class="v" style="font-size:17px">${moneyS(x.pl)}</div><div class="s">realisiert ${fmtSigned(x.realized)}</div></div></div>` : ''}
      ${F.field('Name', F.text('name', d.name, 'maxlength="60" placeholder="z. B. iShares Core MSCI World"'))}
      <div class="row2">${F.field('ISIN', F.text('isin', d.isin, 'maxlength="12" placeholder="IE00B4L5Y983" style="text-transform:uppercase"'))}${F.field('Art', F.select('type', Object.keys(HOLD_TYPES).map(k => [k, k]), d.type))}</div>
      <div class="row2">${F.field('Aktueller Kurs', F.money('price', d.price, '', 4))}${S.accounts.filter(a => a.type === 'depot').length > 1 ? F.field('Depot', F.select('accountId', depotOpts(), d.accountId)) : `<input type="hidden" name="accountId" value="${d.accountId}">`}</div>
      ${h ? '' : `<div class="divider" style="margin:4px 0"></div><div class="field-label">Bestehender Bestand (optional)</div>
      <div class="row3">${F.field('Stück', F.text('shares', '', 'inputmode="decimal" placeholder="0"'))}${F.field('Ø Kaufkurs', F.money('avg', '', '', 4))}${F.field('Datum', F.date('date', today()))}</div>
      ${F.check('noCash', 'Bereits im Depot – nicht vom Verrechnungskonto abziehen', true)}`}
      ${F.field('Farbe', F.colors('color', d.color))}
      ${h ? `<div class="btn-row"><button type="button" class="btn sm" data-sub="buy">${ic('plus', 14)} Kaufen</button><button type="button" class="btn sm" data-sub="sell">${ic('minus', 14)} Verkaufen</button><button type="button" class="btn sm" data-sub="div">${ic('coins', 14)} Dividende</button><button type="button" class="btn sm" data-sub="plan">${ic('repeat', 14)} Sparplan</button></div>` : ''}`,
    onOpen(form) {
      form.addEventListener('click', e => {
        const b = e.target.closest('[data-sub]'); if (!b) return;
        const s = b.dataset.sub;
        if (s === 'div') dividendModal(h.id); else if (s === 'plan') planModal(null, h.id); else tradeModal(s, h.id);
      });
    },
    onSubmit(fd) {
      const name = (fd.name || '').trim(); if (!name) throw new Error('Bitte einen Namen eingeben.');
      const price = reqNum(fd.price, 'Bitte den aktuellen Kurs eingeben.');
      const isin = (fd.isin || '').trim().toUpperCase();
      if (isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) throw new Error('Die ISIN sieht ungültig aus (12 Zeichen, z. B. IE00B4L5Y983).');
      const priceChanged = !h || h.price !== price;
      const obj = { name, isin, type: fd.type, price, color: fd.color || d.color, accountId: fd.accountId || d.accountId };
      if (priceChanged) obj.priceDate = today();
      if (h) { Object.assign(h, obj); commit('Position gespeichert'); return; }
      const nh = { id: uid(), ...obj, priceDate: today() }; S.holdings.push(nh);
      const sh = parseNum(fd.shares);
      if (sh > 0) {
        const avg = reqNum(fd.avg, 'Bitte den Ø Kaufkurs eingeben.');
        S.trades.push({ id: uid(), ts: nextTs(), holdingId: nh.id, accountId: nh.accountId, date: reqDate(fd.date), side: 'buy', shares: round6(sh), price: avg, fee: 0, noCash: fd.noCash === 'on' });
      }
      commit(`„${name}“ hinzugefügt`);
    },
    onDelete: h ? async () => {
      if (!(await confirmDialog({ title: `${esc(h.name)} löschen?`, text: 'Alle Orders und Sparpläne dieser Position werden ebenfalls gelöscht. Erhaltene Dividenden bleiben als Buchungen erhalten.', ok: 'Löschen', danger: true }))) return false;
      S.trades = S.trades.filter(x => x.holdingId !== h.id); S.plans = S.plans.filter(p => p.holdingId !== h.id); S.holdings = S.holdings.filter(x => x.id !== h.id);
      commit('Position gelöscht');
    } : null,
  });
}

function tradeModal(side = 'buy', holdingId, tradeId) {
  if (!needDepot()) return;
  const tr = tradeId ? S.trades.find(x => x.id === tradeId) : null;
  const list = S.holdings.filter(h => !UI.depot || h.accountId === UI.depot || tr);
  if (!list.length) { toast('Lege zuerst eine Position an.', 'err'); holdingModal(); return; }
  const c = computeAll();
  const d = tr ? { ...tr } : { side, holdingId: holdingId || list[0].id, shares: '', price: hold(holdingId || list[0].id).price, fee: 1, date: today(), noCash: false };
  openModal({
    title: tr ? 'Order bearbeiten' : 'Order erfassen', submit: tr ? 'Speichern' : 'Ausführen',
    body: `${F.seg('side', [['buy', 'Kauf'], ['sell', 'Verkauf']], d.side, 'kind-seg')}
      ${F.field('Wertpapier', F.select('holdingId', list.map(h => [h.id, `${h.name} (${fmtShares(c.hold[h.id].shares)} Stk.)`]), d.holdingId))}
      <div class="row3">${F.field('Stück', F.text('shares', d.shares === '' ? '' : fmtShares(d.shares), 'inputmode="decimal" placeholder="0" autofocus'))}${F.field('Kurs', F.money('price', d.price, '', 4))}${F.field('Gebühr', F.money('fee', d.fee))}</div>
      <div class="row2">${F.field('Datum', F.date('date', d.date))}${F.field('… oder Betrag eingeben', F.money('invest', ''), 'Stückzahl wird automatisch berechnet')}</div>
      <div class="preview"><span id="trLbl">Gesamt</span><b class="money" id="trTotal">–</b></div>
      ${F.check('noCash', 'Depotübertrag – Verrechnungskonto nicht belasten', d.noCash)}
      ${tr?.planId ? '<p class="hint">Diese Order wurde automatisch durch einen Sparplan ausgeführt.</p>' : ''}`,
    onOpen(form) {
      const upd = () => {
        const sh = parseNum(form.shares.value), p = parseNum(form.price.value), f = optNum(form.fee.value), buy = form.side.value === 'buy';
        form.querySelector('#trLbl').textContent = buy ? 'Gesamtkosten' : 'Erlös';
        form.querySelector('#trTotal').textContent = sh > 0 && p > 0 ? fmt(buy ? sh * p + f : sh * p - f) : '–';
      };
      const byAmount = () => { const amt = parseNum(form.invest.value), p = parseNum(form.price.value); if (amt > 0 && p > 0) form.shares.value = fmtShares(round6(amt / p)); };
      form.addEventListener('input', e => { if (e.target.name === 'invest' || (e.target.name === 'price' && form.invest.value)) byAmount(); else if (e.target.name === 'shares') form.invest.value = ''; upd(); });
      form.addEventListener('change', e => { if (e.target.name === 'holdingId' && !tr) { form.price.value = fmtNumIn(hold(e.target.value).price, 4); byAmount(); upd(); } if (e.target.name === 'side') upd(); });
      upd();
    },
    onSubmit(fd) {
      const h = hold(fd.holdingId), sh = round6(reqNum(fd.shares, 'Bitte die Stückzahl eingeben.')), price = reqNum(fd.price, 'Bitte den Kurs eingeben.'), fee = round2(optNum(fd.fee)), date = reqDate(fd.date);
      if (fd.side === 'sell') {
        const avail = c.hold[h.id].shares + (tr && tr.side === 'sell' && tr.holdingId === h.id ? tr.shares : 0) - (tr && tr.side === 'buy' && tr.holdingId === h.id ? tr.shares : 0);
        if (sh > avail + 1e-9) throw new Error(`Du hast nur ${fmtShares(avail)} Stück im Bestand.`);
      }
      const obj = { holdingId: h.id, accountId: h.accountId, date, side: fd.side, shares: sh, price, fee, noCash: fd.noCash === 'on' };
      if (tr) Object.assign(tr, obj); else S.trades.push({ id: uid(), ts: nextTs(), ...obj });
      if (!h.priceDate || date >= h.priceDate) { h.price = price; h.priceDate = date; }
      commit(tr ? 'Order gespeichert' : `${fd.side === 'buy' ? 'Kauf' : 'Verkauf'}: ${fmtShares(sh)} × ${h.name}`);
    },
    onDelete: tr ? async () => {
      if (!(await confirmDialog({ title: 'Order löschen?', text: 'Bestand und Verrechnungskonto werden entsprechend zurückgerechnet.', ok: 'Löschen', danger: true }))) return false;
      S.trades = S.trades.filter(x => x.id !== tr.id); commit('Order gelöscht');
    } : null,
  });
}

function dividendModal(holdingId) {
  if (!needDepot()) return;
  const list = S.holdings;
  openModal({
    title: 'Dividende / Ausschüttung', submit: 'Buchen',
    body: `${F.field('Wertpapier', F.select('holdingId', [['', '— Zinsen auf Verrechnungskonto —'], ...list.map(h => [h.id, h.name])], holdingId || list[0]?.id || ''))}
      <div class="row2">${F.field('Netto-Betrag', F.money('amount', '', 'autofocus'), 'nach Steuern, so wie gutgeschrieben')}${F.field('Datum', F.date('date', today()))}</div>
      ${S.accounts.filter(a => a.type === 'depot').length > 1 ? F.field('Gutschrift auf', F.select('accountId', depotOpts(), UI.depot)) : ''}`,
    onSubmit(fd) {
      const amount = round2(reqNum(fd.amount, 'Bitte den Betrag eingeben.')), h = hold(fd.holdingId);
      const accountId = fd.accountId || h?.accountId || UI.depot || S.accounts.find(a => a.type === 'depot').id;
      S.transactions.push({ id: uid(), ts: nextTs(), date: reqDate(fd.date), kind: 'income', amount, accountId, category: h ? 'c_div' : 'c_interest', note: h ? `Dividende ${h.name}` : 'Zinsen Verrechnungskonto', holdingId: h?.id || '' });
      commit(`${h ? 'Dividende' : 'Zinsen'} über ${fmt(amount)} gebucht 💰`);
    },
  });
}

function pricesModal() {
  const c = computeAll();
  const list = S.holdings.filter(h => c.hold[h.id].shares > 0);
  if (!list.length) { toast('Noch keine Positionen im Bestand.', 'err'); return; }
  openModal({
    title: 'Kurse aktualisieren', submit: 'Alle speichern',
    body: `<p class="muted small">Aktuelle Kurse findest du z. B. in der Trade-Republic-App. Das Cockpit selbst verbindet sich bewusst nie mit dem Internet.</p>
      <div class="price-list">${list.map(h => `<div class="price-item"><div><b>${esc(h.name)}</b><small>${esc(h.isin || h.type)} · zuletzt ${h.priceDate ? fmtDate(h.priceDate) : '–'}</small></div>${F.money('p_' + h.id, h.price, '', 4)}</div>`).join('')}</div>`,
    onSubmit(fd) {
      let n = 0;
      for (const h of list) {
        const v = parseNum(fd['p_' + h.id]); if (!(v > 0)) throw new Error(`Ungültiger Kurs bei ${h.name}.`);
        if (v !== h.price) n++;
        h.price = v; h.priceDate = today();
      }
      commit(n ? `${n} Kurs${n > 1 ? 'e' : ''} aktualisiert` : 'Kurse bestätigt');
    },
  });
}

function nextOnDay(day) { const t = today(); let d = addMonths(t.slice(0, 7) + '-01', 0, day); if (d <= t) d = addMonths(d, 1, day); return d; }
function planModal(id, holdingId) {
  if (!needDepot()) return;
  if (!S.holdings.length) { toast('Lege zuerst eine Position an.', 'err'); holdingModal(); return; }
  const p = id ? S.plans.find(x => x.id === id) : null;
  const d = p || { holdingId: holdingId || S.holdings[0].id, amount: '', interval: 'monthly', day: 2, next: nextOnDay(2), paused: false };
  openModal({
    title: p ? 'Sparplan bearbeiten' : 'Neuer Sparplan',
    body: `${F.field('Wertpapier', F.select('holdingId', S.holdings.map(h => [h.id, h.name]), d.holdingId))}
      <div class="row2">${F.field('Betrag', F.money('amount', d.amount, 'autofocus'))}${F.field('Rhythmus', F.select('interval', [['monthly', 'Monatlich'], ['biweekly', 'Alle 2 Wochen'], ['weekly', 'Wöchentlich'], ['quarterly', 'Vierteljährlich']], d.interval))}</div>
      ${F.field('Nächste Ausführung', F.date('next', d.next), 'Trade Republic führt Sparpläne am 2. oder 16. aus. Gebucht wird automatisch zum zuletzt eingetragenen Kurs.')}
      ${p ? F.check('paused', 'Pausiert', p.paused) : ''}`,
    onSubmit(fd) {
      const amount = round2(reqNum(fd.amount, 'Bitte den Sparbetrag eingeben.')), next = reqDate(fd.next);
      const obj = { holdingId: fd.holdingId, amount, interval: fd.interval, next, day: +next.slice(8), paused: fd.paused === 'on' };
      if (p) Object.assign(p, obj); else S.plans.push({ id: uid(), ...obj });
      const r = processDue(S);
      commit(p ? 'Sparplan gespeichert' : `Sparplan über ${fmt(amount)} angelegt${r.p ? ` (${r.p}× bereits ausgeführt)` : ''}`);
    },
    onDelete: p ? async () => { if (!(await confirmDialog({ title: 'Sparplan löschen?', text: 'Bereits ausgeführte Käufe bleiben erhalten.', ok: 'Löschen', danger: true }))) return false; S.plans = S.plans.filter(x => x.id !== p.id); commit('Sparplan gelöscht'); } : null,
  });
}

/* ---------- Daueraufträge ---------- */
function recurringModal(id) {
  if (!needAccounts()) return;
  const r = id ? S.recurring.find(x => x.id === id) : null;
  const d = r || { name: '', kind: 'expense', amount: '', accountId: defaultAccountId(), toAccountId: '', category: 'c_abo', interval: 'monthly', next: addDays(today(), 1), end: '', paused: false };
  const catOpts = k => S.categories.filter(c => c.kind === k).map(c => [c.id, `${c.icon} ${c.name}`]);
  openModal({
    title: r ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag / Abo',
    body: `${F.seg('kind', [['expense', 'Ausgabe'], ['income', 'Einnahme'], ['transfer', 'Sparrate / Umbuchung']], d.kind, 'kind-seg')}
      <div class="row2">${F.field('Bezeichnung', F.text('name', d.name, 'maxlength="50" placeholder="z. B. Miete, Netflix, Gehalt" autofocus'))}${F.field('Betrag', F.money('amount', d.amount))}</div>
      <div class="row2">${F.field('<span id="rLblFrom">Konto</span>', F.select('accountId', accOpts(), d.accountId))}
        ${F.field('Kategorie', F.select('category', catOpts(d.kind === 'income' ? 'income' : 'expense'), d.category), '', 'r-cat')}
        ${F.field('Auf Konto', F.select('toAccountId', accOpts(), d.toAccountId || S.accounts.find(a => a.id !== d.accountId)?.id), '', 'r-to')}</div>
      <div class="row3">${F.field('Rhythmus', F.select('interval', Object.entries(INTERVALS).map(([k, v]) => [k, v.label]), d.interval))}${F.field('Nächste Fälligkeit', F.date('next', d.next))}${F.field('Endet am', F.date('end', d.end), 'optional')}</div>
      ${r ? F.check('paused', 'Pausiert', r.paused) : `<p class="hint">Liegt die nächste Fälligkeit in der Vergangenheit, werden alle bis heute fälligen Buchungen sofort nachgetragen.</p>`}`,
    onOpen(form) {
      const sync = () => {
        const k = form.kind.value;
        form.querySelector('.r-cat').hidden = k === 'transfer'; form.querySelector('.r-to').hidden = k !== 'transfer';
        form.querySelector('#rLblFrom').textContent = k === 'transfer' ? 'Von Konto' : 'Konto';
        if (k !== 'transfer') { const cur = form.category.value; const opts = catOpts(k); form.category.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''); if (opts.some(o => o[0] === cur)) form.category.value = cur; }
      };
      form.addEventListener('change', e => { if (e.target.name === 'kind') sync(); }); sync();
      if (r) form.category.value = r.category || form.category.value;
    },
    onSubmit(fd) {
      const name = (fd.name || '').trim(); if (!name) throw new Error('Bitte eine Bezeichnung eingeben.');
      const amount = round2(reqNum(fd.amount, 'Bitte einen gültigen Betrag eingeben.')), next = reqDate(fd.next);
      if (fd.kind === 'transfer' && fd.accountId === fd.toAccountId) throw new Error('Quell- und Zielkonto müssen verschieden sein.');
      const obj = { name, kind: fd.kind, amount, accountId: fd.accountId, toAccountId: fd.kind === 'transfer' ? fd.toAccountId : '', category: fd.kind === 'transfer' ? '' : fd.category, interval: fd.interval, next, day: +next.slice(8), end: fd.end || '', paused: fd.paused === 'on' };
      if (r) Object.assign(r, obj); else S.recurring.push({ id: uid(), ...obj });
      const res = processDue(S);
      commit((r ? 'Dauerauftrag gespeichert' : `„${name}“ angelegt`) + (res.n ? ` · ${res.n} Buchung${res.n > 1 ? 'en' : ''} nachgetragen` : ''));
    },
    onDelete: r ? async () => { if (!(await confirmDialog({ title: `„${esc(r.name)}“ löschen?`, text: 'Bereits erfolgte Buchungen bleiben erhalten.', ok: 'Löschen', danger: true }))) return false; S.recurring = S.recurring.filter(x => x.id !== r.id); commit('Dauerauftrag gelöscht'); } : null,
  });
}

/* ---------- Ziele ---------- */
function goalModal(id) {
  const g = id ? S.goals.find(x => x.id === id) : null;
  const d = g || { name: '', emoji: '🎯', target: '', saved: 0, accountId: '', deadline: '', color: PALETTE[(S.goals.length + 4) % PALETTE.length] };
  openModal({
    title: g ? 'Sparziel bearbeiten' : 'Neues Sparziel',
    body: `<div class="row2">${F.field('Name', F.text('name', d.name, 'maxlength="40" placeholder="z. B. Japan-Reise" autofocus'))}${F.field('Zielbetrag', F.money('target', d.target))}</div>
      ${F.field('Fortschritt messen', F.select('accountId', [['', 'Manuell (Einzahlungen selbst erfassen)'], ...accOpts().map(([v, l]) => [v, 'Kontostand von ' + l])], d.accountId), 'Mit einem Konto verknüpft, entspricht der Fortschritt automatisch dessen Saldo – ideal für Tagesgeld oder Notgroschen.')}
      <div class="row2">${F.field('Bereits angespart', F.money('saved', d.saved), '', 'g-saved')}${F.field('Zieldatum', F.date('deadline', d.deadline), 'optional')}</div>
      ${F.field('Symbol', F.emojis('emoji', GOAL_EMOJIS, d.emoji))}
      ${F.field('Farbe', F.colors('color', d.color))}`,
    onOpen(form) { const s = () => { form.querySelector('.g-saved').style.visibility = form.accountId.value ? 'hidden' : ''; }; form.accountId.addEventListener('change', s); s(); },
    onSubmit(fd) {
      const name = (fd.name || '').trim(); if (!name) throw new Error('Bitte einen Namen eingeben.');
      const obj = { name, target: round2(reqNum(fd.target, 'Bitte einen Zielbetrag eingeben.')), saved: round2(optNum(fd.saved)), accountId: fd.accountId, deadline: fd.deadline || '', emoji: fd.emoji || '🎯', color: fd.color || d.color };
      if (g) Object.assign(g, obj); else S.goals.push({ id: uid(), ...obj });
      commit(g ? 'Sparziel gespeichert' : `Sparziel „${name}“ angelegt 🎯`);
    },
    onDelete: g ? async () => { if (!(await confirmDialog({ title: `„${esc(g.name)}“ löschen?`, text: 'Das Sparziel wird entfernt. Deine Konten bleiben unverändert.', ok: 'Löschen', danger: true }))) return false; S.goals = S.goals.filter(x => x.id !== g.id); commit('Sparziel gelöscht'); } : null,
  });
}
function goalMoveModal(id) {
  const g = S.goals.find(x => x.id === id);
  openModal({
    title: `${esc(g.emoji)} ${esc(g.name)}`, submit: 'Übernehmen',
    body: `${F.seg('dir', [['in', 'Einzahlen'], ['out', 'Entnehmen']], 'in', 'kind-seg')}
      <div class="amount-big"><input name="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" autofocus><span>€</span></div>
      <div class="preview"><span>Aktuell angespart</span><b class="money">${fmt(g.saved)} / ${fmt(g.target)}</b></div>
      <p class="hint">Das ist ein virtueller „Topf“ – es wird kein Geld zwischen Konten bewegt.</p>`,
    onSubmit(fd) {
      const v = reqNum(fd.amount, 'Bitte einen Betrag eingeben.'), before = g.saved;
      g.saved = round2(Math.max(0, g.saved + (fd.dir === 'out' ? -v : v)));
      commit(fd.dir === 'out' ? `${fmt(v)} entnommen` : `${fmt(v)} für „${g.name}“ zurückgelegt`);
      if (before < g.target && g.saved >= g.target) { confetti(); toast(`Ziel „${g.name}“ erreicht! 🎉`, 'info'); }
    },
  });
}

/* ---------- Budgets & Kategorien ---------- */
function budgetModal(catId) {
  const avg = avgMonthly(3);
  const ex = S.categories.filter(c => c.kind === 'expense');
  const cid = catId || ex.find(c => !S.budgets[c.id])?.id || ex[0].id;
  openModal({
    title: 'Monatsbudget festlegen',
    body: `${F.field('Kategorie', F.select('cat', ex.map(c => [c.id, `${c.icon} ${c.name}`]), cid))}
      ${F.field('Limit pro Monat', F.money('limit', S.budgets[cid] || '', 'autofocus'), 'Leer lassen oder 0, um das Budget zu entfernen.')}
      <div class="preview"><span>Ø Ausgaben der letzten Monate</span><b class="money" id="bAvg">${fmt(avg.byCat[cid] || 0)}</b></div>
      <button type="button" class="btn sm" data-suggest>${ic('sparkle', 14)} Vorschlag: Ø minus 10 %</button>`,
    onOpen(form) {
      form.cat.addEventListener('change', () => { form.querySelector('#bAvg').textContent = fmt(avg.byCat[form.cat.value] || 0); form.limit.value = S.budgets[form.cat.value] ? fmtNumIn(S.budgets[form.cat.value]) : ''; });
      form.querySelector('[data-suggest]').addEventListener('click', () => { const v = Math.max(10, Math.round((avg.byCat[form.cat.value] || 0) * 0.9 / 10) * 10); form.limit.value = fmtNumIn(v); });
    },
    onSubmit(fd) {
      const v = optNum(fd.limit);
      if (v > 0) S.budgets[fd.cat] = round2(v); else delete S.budgets[fd.cat];
      commit(v > 0 ? `Budget für ${cat(fd.cat).name}: ${fmt(v)}` : 'Budget entfernt');
    },
    onDelete: catId && S.budgets[catId] ? () => { delete S.budgets[catId]; commit('Budget entfernt'); } : null, deleteLabel: 'Entfernen',
  });
}
function categoryModal(id) {
  const c = id ? cat(id) : null;
  const d = c || { name: '', icon: '📦', kind: 'expense', color: PALETTE[S.categories.length % PALETTE.length] };
  openModal({
    title: c ? 'Kategorie bearbeiten' : 'Neue Kategorie',
    body: `${c ? '' : F.field('Art', F.seg('kind', [['expense', 'Ausgabe'], ['income', 'Einnahme']], d.kind, 'kind-seg'))}
      ${F.field('Name', F.text('name', d.name, 'maxlength="30" autofocus'))}
      ${F.field('Symbol', F.emojis('icon', CAT_EMOJIS.includes(d.icon) ? CAT_EMOJIS : [d.icon, ...CAT_EMOJIS], d.icon))}
      ${F.field('Farbe', F.colors('color', d.color))}`,
    onSubmit(fd) {
      const name = (fd.name || '').trim(); if (!name) throw new Error('Bitte einen Namen eingeben.');
      if (c) Object.assign(c, { name, icon: fd.icon || d.icon, color: fd.color || d.color });
      else S.categories.push({ id: 'c_' + uid(), name, icon: fd.icon || '📦', kind: fd.kind, color: fd.color || d.color });
      commit('Kategorie gespeichert');
    },
    onDelete: c && !c.locked ? async () => {
      const n = S.transactions.filter(x => x.category === c.id).length;
      if (!(await confirmDialog({ title: `„${esc(c.name)}“ löschen?`, text: n ? `${n} Buchungen werden nach „Sonstiges“ verschoben.` : 'Die Kategorie wird entfernt.', ok: 'Löschen', danger: true }))) return false;
      const to = c.kind === 'income' ? 'c_misc_in' : 'c_misc';
      S.transactions.forEach(x => { if (x.category === c.id) x.category = to; });
      S.recurring.forEach(x => { if (x.category === c.id) x.category = to; });
      delete S.budgets[c.id]; S.categories = S.categories.filter(x => x.id !== c.id);
      commit('Kategorie gelöscht');
    } : null,
  });
}

/* ---------- Sicherheit & Daten ---------- */
function passwordModal() {
  openModal({
    title: 'Master-Passwort ändern', submit: 'Neu verschlüsseln',
    body: `${F.field('Aktuelles Passwort', '<input class="input" type="password" name="cur" autocomplete="current-password" autofocus>')}
      ${F.field('Neues Passwort', '<input class="input" type="password" name="pw1" autocomplete="new-password">', 'Mindestens 8 Zeichen – eine Passphrase aus 4 Wörtern ist ideal.')}
      ${F.field('Neues Passwort wiederholen', '<input class="input" type="password" name="pw2" autocomplete="new-password">')}`,
    async onSubmit(fd) {
      try { await Vault.decryptBlob(Vault.read(), fd.cur); } catch { throw new Error('Das aktuelle Passwort ist falsch.'); }
      if ((fd.pw1 || '').length < 8) throw new Error('Das neue Passwort braucht mindestens 8 Zeichen.');
      if (fd.pw1 !== fd.pw2) throw new Error('Die neuen Passwörter stimmen nicht überein.');
      await saveChain;
      await Vault.create(fd.pw1, S);
      toast('Passwort geändert – alle Daten neu verschlüsselt 🔐');
    },
  });
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function exportBackup() {
  await saveChain;
  const blob = await Vault.encryptBlob(S);
  download(`finanzcockpit-backup-${today()}.fcbak`, JSON.stringify(blob), 'application/json');
  S.settings.lastBackup = today(); persist();
  toast('Verschlüsseltes Backup gespeichert');
}
async function exportCSV() {
  if (!(await confirmDialog({ title: 'CSV exportieren?', text: 'Die CSV-Datei ist <b>nicht verschlüsselt</b> und für jeden lesbar, der Zugriff auf die Datei hat.', ok: 'Exportieren' }))) return;
  const q = s => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
  const rows = [['Datum', 'Art', 'Betrag', 'Kategorie', 'Konto', 'Zielkonto', 'Notiz']];
  for (const t of sortedTx()) rows.push([fmtDate(t.date), { expense: 'Ausgabe', income: 'Einnahme', transfer: 'Umbuchung' }[t.kind], fmtNum(t.kind === 'expense' ? -t.amount : t.amount), cat(t.category)?.name || '', acc(t.accountId)?.name || '', acc(t.toAccountId)?.name || '', t.note || '']);
  download(`finanzcockpit-buchungen-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast(`${rows.length - 1} Buchungen exportiert`);
}
function importModal(fromLock) {
  openModal({
    title: 'Backup wiederherstellen', submit: 'Entschlüsseln & laden',
    body: `<p class="muted">Wähle eine <b>.fcbak</b>-Datei und gib das Passwort ein, mit dem das Backup erstellt wurde. Danach gilt dieses Passwort für den Tresor.</p>
      ${F.field('Backup- oder Sync-Datei', '<input class="input" type="file" name="file" style="padding-top:9px">', 'Neues Gerät einrichten? Lade hier die Sync-Datei vom ersten Gerät – dann teilen sich beide denselben Tresor.')}
      ${F.field('Passwort des Backups', '<input class="input" type="password" name="pw" autocomplete="off">')}`,
    async onSubmit(fd, form) {
      const file = form.file.files[0]; if (!file) throw new Error('Bitte eine Datei auswählen.');
      if (file.size > 20e6) throw new Error('Die Datei ist zu groß.');
      let blob; try { blob = JSON.parse(await file.text()); } catch { throw new Error('Die Datei ist kein gültiges Backup.'); }
      let r; try { r = await Vault.decryptBlob(blob, fd.pw || ''); } catch (e) { throw new Error(e.name === 'OperationError' ? 'Falsches Passwort für dieses Backup.' : e.message); }
      if (!fromLock && !(await confirmDialog({ title: 'Aktuelle Daten ersetzen?', text: 'Alle aktuellen Daten werden durch das Backup ersetzt. Das lässt sich nicht rückgängig machen.', ok: 'Ersetzen', danger: true }))) return false;
      await saveChain;
      Vault.adopt(r); S = migrate(r.data); C = null; resetBaseline();
      await Vault.save(S);
      closeModal();
      const stand = `Stand ${new Date(blob.saved || Date.now()).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} · ${S.accounts.length} Konten · ${S.transactions.length} Buchungen`;
      if (fromLock) { afterUnlock(); toast('Übernommen – ' + stand, 'info'); } else commit('Backup wiederhergestellt – ' + stand);
      return false;
    },
  });
}

/* ---------- Einrichtung ---------- */
function onboardingModal() {
  openModal({
    title: 'Willkommen im Finanzcockpit 👋', submit: null, cancel: null,
    body: `<p class="muted">Dein Tresor ist eingerichtet und verschlüsselt. Wie möchtest du starten?</p>
      <div class="choice-grid"><button type="button" class="choice" data-choice="own"><span class="choice-ic">✍️</span><b>Mit meinen Daten</b><small>Bargeld, 2 Konten & Trade Republic in einer Minute einrichten.</small></button>
      <button type="button" class="choice" data-choice="demo"><span class="choice-ic">✨</span><b>Demo erkunden</b><small>12 Monate realistische Beispieldaten. Später mit einem Klick entfernbar.</small></button></div>`,
    onOpen(form) { form.addEventListener('click', e => { const c = e.target.closest('[data-choice]'); if (!c) return; c.dataset.choice === 'demo' ? loadDemo() : setupOwnModal(); }); },
  });
}
function setupOwnModal() {
  openModal({
    title: 'Deine Startwerte', submit: 'Los geht’s 🚀',
    body: `<p class="muted small">Trage deine aktuellen Stände ein – alles lässt sich später ändern.</p>
      <div class="setup-row"><span class="e">💶</span>${F.field('Bargeld', F.money('cash', '', 'autofocus'))}</div>
      <div class="setup-row"><span class="e">🏦</span>${F.field('Konto 1', F.text('n1', 'Girokonto', 'maxlength="40"'))}${F.field('Kontostand', F.money('b1', ''))}</div>
      <div class="setup-row"><span class="e">🐷</span>${F.field('Konto 2', F.text('n2', 'Tagesgeld', 'maxlength="40"'))}${F.field('Kontostand', F.money('b2', ''))}</div>
      <div class="setup-row"><span class="e">📈</span>${F.field('Depot', F.text('n3', 'Trade Republic', 'maxlength="40"'))}${F.field('Cash (Verrechnungskonto)', F.money('b3', ''))}</div>
      <p class="hint">Deine Wertpapiere trägst du danach unter <b>Depot → Neue Position</b> ein (Stückzahl & Ø Kaufkurs findest du in der TR-App).</p>`,
    onSubmit(fd) {
      const v = k => round2(optNum(fd[k]));
      S.accounts = [
        { id: uid(), name: 'Bargeld', type: 'cash', opening: v('cash'), color: '#f5b544', icon: '💶' },
        { id: uid(), name: (fd.n1 || 'Girokonto').trim(), type: 'bank', opening: v('b1'), color: '#7c6cff', icon: '🏦' },
        { id: uid(), name: (fd.n2 || 'Tagesgeld').trim(), type: 'bank', opening: v('b2'), color: '#22d3ee', icon: '🐷' },
        { id: uid(), name: (fd.n3 || 'Trade Republic').trim(), type: 'depot', opening: v('b3'), color: '#2fd47a', icon: '📈' },
      ];
      S.settings.onboarded = true; S.settings.demo = false;
      commit('Eingerichtet – viel Spaß! 🎉');
      setTimeout(confetti, 200);
    },
  });
}
function loadDemo() {
  const keep = { name: S.settings.name, autoLock: S.settings.autoLock, lockOnHide: S.settings.lockOnHide, birthYear: S.settings.birthYear };
  S = buildDemo(); Object.assign(S.settings, keep);
  UI.fc = null; closeModal();
  commit('Demo-Daten geladen ✨ – schau dich um!', { tone: 'info' });
}
async function resetData() {
  const demo = S.settings.demo;
  if (!demo && !(await confirmDialog({ title: 'Alle Daten löschen?', text: 'Konten, Buchungen, Depot, Ziele und Budgets werden <b>unwiderruflich</b> gelöscht. Dein Passwort bleibt bestehen. Tippe <b>LÖSCHEN</b> zur Bestätigung.', ok: 'Alles löschen', danger: true, typed: 'LÖSCHEN' }))) return;
  if (demo && !(await confirmDialog({ title: 'Demo beenden?', text: 'Die Beispieldaten werden entfernt und du startest mit deinen eigenen Werten.', ok: 'Demo beenden' }))) return;
  const keep = { name: S.settings.name, autoLock: S.settings.autoLock, lockOnHide: S.settings.lockOnHide, birthYear: S.settings.birthYear };
  S = defaultState(); Object.assign(S.settings, keep);
  UI.fc = null; UI.tx = { q: '', acc: '', cat: '', month: '', kind: '' };
  commit(demo ? 'Demo beendet' : 'Alle Daten gelöscht');
  go('dashboard');
  onboardingModal();
}
