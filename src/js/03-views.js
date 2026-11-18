/* =========================================================
   Ansichten
   ========================================================= */
const NAV = [
  { id: 'dashboard', label: 'Übersicht', icon: 'home' },
  { id: 'accounts', label: 'Konten', icon: 'wallet' },
  { id: 'transactions', label: 'Buchungen', icon: 'list' },
  { id: 'depot', label: 'Depot', icon: 'trending' },
  { id: 'budgets', label: 'Budgets', icon: 'pie' },
  { id: 'goals', label: 'Sparziele', icon: 'target' },
  { id: 'recurring', label: 'Fixkosten', icon: 'repeat' },
  { id: 'forecast', label: 'Prognose', icon: 'forecast' },
  { id: 'settings', label: 'Einstellungen', icon: 'settings' },
];
const PAGE = {
  accounts: ['Konten', 'Bargeld, Bankkonten und Depots im Überblick'],
  transactions: ['Buchungen', 'Alle Einnahmen, Ausgaben und Umbuchungen'],
  depot: ['Depot', 'Wertpapiere, Sparpläne und Performance'],
  budgets: ['Budgets', 'Monatliche Limits und wohin dein Geld fließt'],
  goals: ['Sparziele', 'Worauf du hinsparst – und wie lange es noch dauert'],
  recurring: ['Fixkosten', 'Daueraufträge, Abos und regelmäßige Einnahmen – werden automatisch gebucht'],
  forecast: ['Prognose', 'Zinseszins, Inflation & dein Weg zur finanziellen Freiheit'],
  settings: ['Einstellungen', 'Sicherheit, Daten und Darstellung'],
};
const VIEWS = {};
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'; }
const head = (title, right = '') => `<div class="card-head"><h3>${title}</h3>${right}</div>`;
const emptyState = (emoji, title, text, btn = '') => `<div class="empty"><div class="e-ic">${emoji}</div><b>${title}</b><p>${text}</p>${btn}</div>`;
const pctColor = p => p >= 100 ? 'var(--neg)' : p >= 85 ? 'var(--warn)' : 'var(--pos)';

function txRow(t, opts = {}) {
  const ca = cat(t.category), a = acc(t.accountId), to = acc(t.toAccountId);
  const isT = t.kind === 'transfer';
  const icon = isT ? '🔁' : (ca?.icon || '•'), color = isT ? '#38bdf8' : (ca?.color || '#94a3b8');
  const title = t.note || (isT ? 'Umbuchung' : ca?.name || 'Ohne Kategorie');
  const sub = isT ? `${a?.name || '?'} → ${to?.name || '?'}` : `${ca?.name || 'Ohne Kategorie'} · ${a?.name || '?'}`;
  const amt = t.kind === 'income' ? `<b class="money pos">+${fmt(t.amount)}</b>` : t.kind === 'expense' ? `<b class="money">−${fmt(t.amount)}</b>` : `<b class="money muted">${fmt(t.amount)}</b>`;
  const flags = (t.recurringId ? ' · ↻ automatisch' : '') + (t.correction ? ' · Korrektur' : '') + (t.date > today() ? ' · geplant' : '');
  return `<button class="tx" data-action="editTx" data-id="${t.id}"><span class="tx-ic" style="--c:${color}">${icon}</span><span class="tx-main"><span class="tx-title">${esc(title)}</span><span class="tx-sub">${esc(sub + flags)}</span></span><span class="tx-amt">${amt}${opts.date ? `<small>${fmtDateS(t.date)}</small>` : ''}</span></button>`;
}
const sortedTx = () => S.transactions.slice().sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : (b.ts || 0) - (a.ts || 0));

/* ---------- Intelligente Hinweise ---------- */
function upcoming(days = 14) {
  const t = today(), end = addDays(t, days), out = [];
  for (const r of S.recurring) {
    if (r.paused) continue; let d = r.next, g = 0;
    while (d && d <= end && g++ < 20) { if (d > t) out.push({ date: d, name: r.name, amount: r.amount, kind: r.kind, cat: cat(r.category), id: r.id, type: 'rec' }); d = nextDate(d, r.interval, r.day); }
  }
  for (const p of S.plans) {
    if (p.paused) continue; const h = hold(p.holdingId); let d = p.next, g = 0;
    while (h && d && d <= end && g++ < 20) { if (d > t) out.push({ date: d, name: 'Sparplan ' + h.name, amount: p.amount, kind: 'plan', id: p.id, type: 'plan' }); d = nextDate(d, p.interval, p.day); }
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}

function spendingRoom() {
  const t = today(), mk = t.slice(0, 7), ms = monthStats(mk), avg = avgMonthly(3);
  const expInc = Math.max(ms.inc, avg.inc);
  if (expInc <= 0) return null;
  const end = mk + '-' + String(daysInMonth(mk)).padStart(2, '0');
  let fixedLeft = 0, saveMonth = 0;
  for (const r of S.recurring) {
    if (r.paused) continue;
    let d = r.next, g = 0;
    while (d && d <= end && g++ < 40) { if (r.kind === 'expense') fixedLeft += r.amount; if (r.kind === 'transfer') saveMonth += r.amount; d = nextDate(d, r.interval, r.day); }
  }
  for (const x of S.transactions) if (x.kind === 'transfer' && x.recurringId && x.date.slice(0, 7) === mk && x.date <= t) saveMonth += x.amount;
  const room = expInc - ms.exp - fixedLeft - saveMonth;
  const daysLeft = daysInMonth(mk) - (+t.slice(8)) + 1;
  return { room, perDay: room / daysLeft, daysLeft, fixedLeft, saveMonth };
}

function buildInsights() {
  const out = [], c = computeAll(), t = today(), mk = t.slice(0, 7), ms = monthStats(mk), avg = avgMonthly(3);
  const dayFrac = (+t.slice(8)) / daysInMonth(mk);
  // Budgets
  const over = [], close = [];
  for (const [cid, lim] of Object.entries(S.budgets)) {
    if (!(lim > 0)) continue; const sp = ms.byCat[cid] || 0, ca = cat(cid); if (!ca) continue;
    if (sp > lim) over.push(ca.name); else if (sp / lim > dayFrac + 0.15 && sp / lim > 0.6) close.push(ca.name);
  }
  if (over.length) out.push({ tone: 'neg', em: '🚨', title: `Budget überschritten: ${over.slice(0, 2).join(', ')}${over.length > 2 ? ' …' : ''}`, text: 'Schau in den Budgets nach, wo es gerade hakt.', nav: 'budgets' });
  else if (close.length) out.push({ tone: 'warn', em: '⏱️', title: `${close[0]} läuft dem Monat voraus`, text: `Du hast schon mehr ausgegeben, als für ${Math.round(dayFrac * 100)} % des Monats üblich wäre.`, nav: 'budgets' });
  // Ausreißer-Kategorie
  if (avg.n && dayFrac > 0.2) {
    let best = null;
    for (const [cid, v] of Object.entries(ms.byCat)) {
      const a = avg.byCat[cid] || 0; if (a < 20) continue;
      const diff = v - a; if (v > a * 1.2 && diff > 30 && (!best || diff > best.diff)) best = { cid, v, a, diff };
    }
    if (best) out.push({ tone: 'warn', em: cat(best.cid)?.icon || '📊', title: `${cat(best.cid)?.name}: ${Math.round((best.v / best.a - 1) * 100)} % über Schnitt`, text: `Diesen Monat ${fmt(best.v)} statt üblicher ${fmt(best.a)} (Ø 3 Monate).` });
  }
  // Notgroschen
  if (avg.exp > 0) {
    const m = c.liquid / avg.exp;
    out.push({ tone: m >= 3 ? 'pos' : 'warn', em: '🛟', title: `Notgroschen reicht ${m.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monate`, text: m >= 6 ? 'Sehr solide – deine liquiden Mittel decken mehr als 6 Monatsausgaben.' : m >= 3 ? 'Gut! Empfohlen sind 3–6 Monatsausgaben als Reserve.' : 'Empfohlen sind 3–6 Monatsausgaben. Ein Polster lohnt sich.' });
  }
  // Sparquote
  if (avg.n && avg.inc > 0) {
    const r = avg.net / avg.inc * 100;
    out.push({ tone: r >= 20 ? 'pos' : r >= 10 ? 'info' : 'warn', em: r >= 20 ? '🚀' : '💡', title: `Ø Sparquote: ${fmtPct(r, false)}`, text: r >= 20 ? 'Stark! Du legst über ein Fünftel deines Einkommens zurück.' : r >= 10 ? 'Solide. 20 % gelten als sehr gutes Ziel.' : 'Unter 10 %. Ein Blick in die Fixkosten lohnt sich.' });
  }
  // Depot
  const hs = S.holdings.map(h => ({ h, x: c.hold[h.id] })).filter(o => o.x.shares > 0 && o.x.cost > 0);
  if (hs.length) {
    const top = hs.reduce((a, b) => b.x.plPct > a.x.plPct ? b : a);
    if (top.x.plPct > 0) out.push({ tone: 'pos', em: '🏆', title: `Top-Position: ${top.h.name}`, text: `${fmtPct(top.x.plPct)} seit Kauf (${fmtSigned(top.x.pl)}).`, nav: 'depot' });
    const stale = S.holdings.filter(h => c.hold[h.id].shares > 0 && (!h.priceDate || daysBetween(h.priceDate, t) > 7));
    if (stale.length) out.push({ tone: 'info', em: '🔄', title: `${stale.length} Kurs${stale.length > 1 ? 'e' : ''} älter als 7 Tage`, text: 'Aktualisiere die Kurse für ein genaues Bild deines Depots.', action: 'prices' });
  }
  // Demnächst fällig
  const up = upcoming(7).filter(u => u.kind === 'expense');
  if (up.length) out.push({ tone: 'info', em: '📅', title: `${up.length} Abbuchung${up.length > 1 ? 'en' : ''} in den nächsten 7 Tagen`, text: `${up.slice(0, 3).map(u => u.name).join(', ')} – zusammen ${fmt(sum(up, u => u.amount))}.`, nav: 'recurring' });
  // Abos
  const abos = S.recurring.filter(r => !r.paused && r.kind === 'expense' && r.category === 'c_abo');
  if (abos.length >= 3) out.push({ tone: 'info', em: '📺', title: `Abo-Check: ${fmt(sum(abos, r => monthlyEq(r) * 12))} pro Jahr`, text: `${abos.length} laufende Abos. Nutzt du wirklich alle?`, nav: 'recurring' });
  const order = { neg: 0, warn: 1, pos: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
const insightHTML = i => `<div class="insight ${i.tone}" ${i.nav ? `data-nav="${i.nav}" style="cursor:pointer"` : i.action ? `data-action="${i.action}" style="cursor:pointer"` : ''}><span class="em">${i.em}</span><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`;

/* ---------- Übersicht ---------- */
VIEWS.dashboard = () => {
  if (!S.accounts.length) return `<div class="card">${emptyState('🧭', 'Noch keine Konten', 'Lege deine Konten an – oder schau dir zuerst die Demo an.', '<button class="btn primary" data-action="onboarding">Jetzt einrichten</button>')}</div>`;
  const c = computeAll(), t = today(), mk = t.slice(0, 7), ms = monthStats(mk), avg = avgMonthly(3);
  const ranges = { '1M': 30, '3M': 91, '6M': 182, '1J': 365, 'Max': null };
  const rangeTxt = { '1M': 'einem Monat', '3M': '3 Monaten', '6M': '6 Monaten', '1J': 'einem Jahr', 'Max': 'Beginn' };
  const days = ranges[UI.range];
  let from = days ? addDays(t, -days) : firstDataDate();
  if (daysBetween(from, t) < 14) from = addDays(t, -14);
  const se = seriesNW(from, t);
  const start = se.values[0], delta = c.netWorth - start, pct = start ? delta / Math.abs(start) * 100 : 0;

  const hero = `<div class="card hero span-8">
    <div class="hero-head"><div>
      <div class="label">Gesamtvermögen</div>
      <div class="big money" data-count="${c.netWorth}">${fmt(c.netWorth)}</div>
      <span class="delta ${delta >= 0 ? 'pos' : 'neg'}">${ic(delta >= 0 ? 'up' : 'down', 14, 2.2)} <span class="money">${fmtSigned(delta)}</span> · ${fmtPct(pct)} <span class="muted">seit ${rangeTxt[UI.range]}</span></span>
    </div>
    <div class="seg">${Object.keys(ranges).map(k => `<button data-action="range" data-v="${k}" class="${UI.range === k ? 'on' : ''}">${k}</button>`).join('')}</div></div>
    ${chart('line', { height: 230, labels: se.dates, xfmt: d => fmtDateS(d), series: [{ values: se.values, color: '#7c6cff', fill: true }], tip: i => `<small>${fmtDate(se.dates[i])}</small><b class="money">${fmt(se.values[i])}</b>` })}
  </div>`;

  const segs = S.accounts.map(a => ({ label: a.name, value: Math.max(0, c.total[a.id]), color: a.color || '#7c6cff' }));
  const alloc = `<div class="card span-4">${head('Verteilung', `<span class="sub">${S.accounts.length} Konten</span>`)}
    <div class="donut-wrap">${chart('donut', { size: 176, thick: 18, segments: segs, label: 'Vermögen', total: c.netWorth })}${legend(segs)}</div></div>`;

  const accCards = S.accounts.map(a => {
    let foot;
    if (a.type === 'depot') {
      const hs = S.holdings.filter(h => h.accountId === a.id), cost = sum(hs, h => c.hold[h.id].cost), val = sum(hs, h => c.hold[h.id].value), pl = val - cost;
      foot = `<span class="badge ${pl >= 0 ? 'pos' : 'neg'}">${pl >= 0 ? '▲' : '▼'} ${cost ? fmtPct(pl / cost * 100) : '0,0 %'}</span><span class="muted money">${fmtSigned(pl)}</span>`;
    } else {
      foot = `<div style="width:100%;height:34px">${sparkline(accountSeries(a.id, addDays(t, -60), t, 30), a.color, 34)}</div>`;
    }
    return `<div class="card acc-card click span-3" data-nav="accounts" style="--c:${esc(a.color)}">
      <div class="acc-top"><span class="acc-ic">${accEmoji(a)}</span><span class="badge">${ACC_TYPES[a.type]?.label}</span></div>
      <div class="acc-name">${esc(a.name)}</div><div class="acc-bal money">${fmt(c.total[a.id])}</div>
      <div class="acc-foot">${foot}</div></div>`;
  }).join('');

  const room = spendingRoom();
  const rateNow = ms.inc > 0 ? ms.rate : 0;
  const month = `<div class="card span-4 third">${head(monthLabel(mk), '<a data-nav="budgets">Details →</a>')}
    <div class="flow"><div><small>Einnahmen</small><b class="money pos">${fmt(ms.inc)}</b></div><div><small>Ausgaben</small><b class="money">${fmt(ms.exp)}</b></div></div>
    <div class="rate-row">${ring(rateNow, rateNow >= 20 ? '#2fd47a' : rateNow >= 0 ? '#7c6cff' : '#ff5d73', 62, 7, `<span style="font-size:13px;font-weight:700">${Math.round(rateNow)}%</span>`)}
      <div><b>Sparquote</b><small>${avg.n ? `Ø letzte ${avg.n} Monate: ${fmtPct(avg.inc ? avg.net / avg.inc * 100 : 0, false)}` : 'Noch keine Vormonate'}</small></div></div>
    ${room ? `<div class="room ${room.room < 0 ? 'neg' : ''}">${room.room >= 0 ? `💸 Spielraum bis Monatsende: <b class="money">${fmt(room.perDay)}</b> pro Tag <span class="muted">(${fmt(room.room)} für ${room.daysLeft} Tage, nach Fixkosten & Sparraten)</span>` : `⚠️ Du liegst <b class="money">${fmt(-room.room)}</b> über dem, was nach Fixkosten & Sparraten übrig wäre.`}</div>` : ''}
  </div>`;

  const ins = buildInsights().slice(0, 4);
  const insights = `<div class="card span-4 third">${head(`${ic('sparkle', 16)} Insights`)}<div class="insights">${ins.length ? ins.map(insightHTML).join('') : '<p class="muted small">Sobald ein paar Buchungen da sind, erscheinen hier persönliche Hinweise.</p>'}</div></div>`;

  const bud = Object.entries(S.budgets).filter(([id, v]) => v > 0 && cat(id)).map(([id, lim]) => ({ ca: cat(id), lim, sp: ms.byCat[id] || 0 })).sort((a, b) => b.sp / b.lim - a.sp / a.lim).slice(0, 5);
  const dayFrac = (+t.slice(8)) / daysInMonth(mk);
  const budgets = `<div class="card span-4 third">${head('Budgets', '<a data-nav="budgets">Alle →</a>')}
    ${bud.length ? `<div class="mini-budget">${bud.map(b => { const p = b.sp / b.lim * 100; return `<div><div class="r"><span>${b.ca.icon} ${esc(b.ca.name)}</span><span class="muted"><span class="money">${fmt(b.sp)}</span> / <span class="money">${fmt(b.lim)}</span></span></div><div class="bar" style="--c:${pctColor(p)}"><i style="width:${Math.min(100, p)}%"></i><span class="pace" style="left:${dayFrac * 100}%"></span></div></div>`; }).join('')}</div>` : emptyState('🎯', 'Keine Budgets', 'Setze Limits pro Kategorie und behalte den Monat im Griff.', '<button class="btn sm" data-nav="budgets">Budget anlegen</button>')}
  </div>`;

  const months = [...Array(6)].map((_, i) => shiftMonth(mk, i - 5)), mst = months.map(m => monthStats(m));
  const bars = `<div class="card span-7">${head('Einnahmen & Ausgaben', `<div class="chart-legend" style="margin:0"><span><i style="background:#2fd47a"></i>Einnahmen</span><span><i style="background:#7c6cff"></i>Ausgaben</span></div>`)}
    ${chart('bars', { height: 240, labels: months.map(m => MONTHS_S[+m.slice(5) - 1]), series: [{ name: 'Einnahmen', color: '#2fd47a', values: mst.map(s => s.inc) }, { name: 'Ausgaben', color: '#7c6cff', values: mst.map(s => s.exp) }], tip: i => `<small>${monthLabel(months[i])}</small><div class="tr"><span><i style="background:#2fd47a"></i> Einnahmen</span><b class="money">${fmt(mst[i].inc)}</b></div><div class="tr"><span><i style="background:#7c6cff"></i> Ausgaben</span><b class="money">${fmt(mst[i].exp)}</b></div><div class="tr"><span>Saldo</span><b class="money ${mst[i].net >= 0 ? 'pos' : 'neg'}">${fmtSigned(mst[i].net)}</b></div>` })}
  </div>`;

  const recent = sortedTx().filter(x => x.date <= t).slice(0, 6);
  const up = upcoming(10).slice(0, 3);
  const recentCard = `<div class="card span-5">${head('Letzte Buchungen', '<a data-nav="transactions">Alle →</a>')}
    ${recent.length ? `<div class="tx-list">${recent.map(x => txRow(x, { date: true })).join('')}</div>` : emptyState('🧾', 'Noch keine Buchungen', 'Drücke <kbd>N</kbd> für eine neue Buchung.')}
    ${up.length ? `<div class="group-title">Demnächst</div><div class="list">${up.map(u => `<div class="li" data-nav="${u.type === 'plan' ? 'depot' : 'recurring'}"><span class="tx-ic" style="--c:#38bdf8">${u.type === 'plan' ? '📈' : u.cat?.icon || '🔁'}</span><span class="tx-main"><span class="tx-title">${esc(u.name)}</span><small>${fmtDay(u.date)} · ${relDays(u.date)}</small></span><span class="right"><b class="money ${u.kind === 'income' ? 'pos' : ''}">${u.kind === 'income' ? '+' : u.kind === 'expense' ? '−' : ''}${fmt(u.amount)}</b></span></div>`).join('')}</div>` : ''}
  </div>`;

  return `<div class="grid dash">${hero}${alloc}</div><div class="grid acc-row">${accCards}</div><div class="grid">${month}${insights}${budgets}</div><div class="grid">${bars}${recentCard}</div>`;
};

/* ---------- Konten ---------- */
VIEWS.accounts = () => {
  const c = computeAll(), t = today(), mk = t.slice(0, 7);
  const invested = c.depotValue;
  const kpis = `<div class="kpis">
    <div class="kpi"><div class="label">${ic('wallet', 15)} Gesamt</div><div class="v money">${fmt(c.netWorth)}</div><div class="s">${S.accounts.length} Konten</div></div>
    <div class="kpi"><div class="label">${ic('cash', 15)} Liquide Mittel</div><div class="v money">${fmt(c.liquid)}</div><div class="s">${c.netWorth > 0 ? fmtPct(c.liquid / c.netWorth * 100, false) + ' des Vermögens' : '–'}</div></div>
    <div class="kpi"><div class="label">${ic('trending', 15)} Wertpapiere</div><div class="v money">${fmt(invested)}</div><div class="s">${c.netWorth > 0 ? fmtPct(invested / c.netWorth * 100, false) + ' des Vermögens' : '–'}</div></div>
  </div>`;
  const cards = S.accounts.map(a => {
    const ms = monthStats(mk, a.id);
    const isDepot = a.type === 'depot';
    const hv = isDepot ? sum(S.holdings.filter(h => h.accountId === a.id), h => c.hold[h.id].value) : 0;
    const txCount = S.transactions.filter(x => x.accountId === a.id || x.toAccountId === a.id).length;
    return `<div class="card span-6" style="--c:${esc(a.color)}">
      <div class="acct-head"><span class="acc-ic lg">${accEmoji(a)}</span><div><h3>${esc(a.name)}</h3><span class="badge">${ACC_TYPES[a.type]?.label}</span></div><span class="grow"></span>
        <button class="icon-btn sm bare" data-action="editAccount" data-id="${a.id}" title="Bearbeiten">${ic('edit', 16)}</button></div>
      <div class="acct-bal money">${fmt(c.total[a.id])}</div>
      ${isDepot ? `<div class="muted small">Wertpapiere <span class="money">${fmt(hv)}</span> · Verrechnungskonto <span class="money">${fmt(c.cash[a.id])}</span></div>` : sparkline(accountSeries(a.id, addDays(t, -90), t, 45), a.color)}
      <div class="acct-stats"><div><small>Eingänge ${MONTHS_S[+mk.slice(5) - 1]}</small><b class="money pos">${fmt(ms.inc)}</b></div><div><small>Ausgaben ${MONTHS_S[+mk.slice(5) - 1]}</small><b class="money">${fmt(ms.exp)}</b></div><div><small>Buchungen</small><b>${txCount}</b></div></div>
      <div class="btn-row">
        <button class="btn sm" data-action="newTx" data-acc="${a.id}">${ic('plus', 15)} Buchung</button>
        <button class="btn sm" data-action="accTx" data-id="${a.id}">${ic('list', 15)} Verlauf</button>
        ${a.type === 'cash' ? `<button class="btn sm" data-action="cashCount" data-id="${a.id}">${ic('coins', 15)} Kassensturz</button>` : `<button class="btn sm" data-action="reconcile" data-id="${a.id}">${ic('check', 15)} Saldo abgleichen</button>`}
        ${isDepot ? `<button class="btn sm" data-action="depotOf" data-id="${a.id}">${ic('trending', 15)} Depot</button>` : ''}
      </div></div>`;
  }).join('');
  return `${kpis}<div class="grid" style="margin-top:18px">${cards}<button class="add-card span-6" data-action="newAccount"><span class="plus">${ic('plus', 22)}</span><b>Konto hinzufügen</b><span class="small">Girokonto, Tagesgeld, Kreditkarte, weiteres Depot …</span></button></div>`;
};

/* ---------- Buchungen ---------- */
function filteredTx() {
  const f = UI.tx, q = f.q.trim().toLowerCase();
  return sortedTx().filter(t => {
    if (f.acc && t.accountId !== f.acc && t.toAccountId !== f.acc) return false;
    if (f.cat && t.category !== f.cat) return false;
    if (f.kind && t.kind !== f.kind) return false;
    if (f.month && t.date.slice(0, 7) !== f.month) return false;
    if (q) {
      const hay = [t.note, cat(t.category)?.name, acc(t.accountId)?.name, acc(t.toAccountId)?.name, fmtNum(t.amount), String(t.amount)].join(' ').toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
}
function txListHTML() {
  const list = filteredTx();
  if (!list.length) return emptyState('🔍', S.transactions.length ? 'Keine Treffer' : 'Noch keine Buchungen', S.transactions.length ? 'Passe Suche oder Filter an.' : 'Erfasse deine erste Ausgabe mit <kbd>N</kbd> oder dem Plus-Button.', S.transactions.length ? '<button class="btn sm" data-action="txClear">Filter zurücksetzen</button>' : '<button class="btn primary" data-action="newTx">Erste Buchung</button>');
  const real = list.filter(t => !t.correction);
  const inc = sum(real.filter(t => t.kind === 'income'), t => t.amount), exp = sum(real.filter(t => t.kind === 'expense'), t => t.amount);
  let html = `<div class="sum-bar"><span>${list.length} Buchungen</span><span>Einnahmen<b class="money pos">${fmt(inc)}</b></span><span>Ausgaben<b class="money">${fmt(exp)}</b></span><span>Saldo<b class="money ${inc - exp >= 0 ? 'pos' : 'neg'}">${fmtSigned(inc - exp)}</b></span></div><div class="card flat" style="padding:10px"><div class="tx-list">`;
  let day = null;
  const shown = list.slice(0, UI.txLimit);
  const dayTotals = {};
  for (const t of list) if (t.kind !== 'transfer' && !t.correction) dayTotals[t.date] = (dayTotals[t.date] || 0) + (t.kind === 'income' ? t.amount : -t.amount);
  for (const t of shown) {
    if (t.date !== day) { day = t.date; html += `<div class="day-head"><span>${fmtDay(day)}</span><span class="money">${dayTotals[day] ? fmtSigned(dayTotals[day]) : ''}</span></div>`; }
    html += txRow(t);
  }
  html += '</div></div>';
  if (list.length > UI.txLimit) html += `<div style="text-align:center;margin-top:14px"><button class="btn" data-action="txMore">Weitere ${Math.min(150, list.length - UI.txLimit)} anzeigen</button></div>`;
  return html;
}
VIEWS.transactions = () => {
  const f = UI.tx;
  const months = [...new Set(S.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  return `<div class="toolbar">
    <div class="search">${ic('search', 17)}<input class="input" id="txq" placeholder="Suchen nach Notiz, Kategorie, Betrag …" value="${esc(f.q)}" autocomplete="off"></div>
    <select class="input" data-filter="kind">${opt('', 'Alle Arten', f.kind)}${opt('expense', 'Ausgaben', f.kind)}${opt('income', 'Einnahmen', f.kind)}${opt('transfer', 'Umbuchungen', f.kind)}</select>
    <select class="input" data-filter="acc">${opt('', 'Alle Konten', f.acc)}${S.accounts.map(a => opt(a.id, a.name, f.acc)).join('')}</select>
    <select class="input" data-filter="cat">${opt('', 'Alle Kategorien', f.cat)}${S.categories.map(c => opt(c.id, c.icon + ' ' + c.name, f.cat)).join('')}</select>
    <select class="input" data-filter="month">${opt('', 'Alle Monate', f.month)}${months.map(m => opt(m, monthLabel(m), f.month)).join('')}</select>
    <button class="btn primary" data-action="newTx">${ic('plus', 16)} Neu</button>
  </div><div id="txlist">${txListHTML()}</div>`;
};

/* ---------- Depot ---------- */
VIEWS.depot = () => {
  const depots = S.accounts.filter(a => a.type === 'depot');
  if (!depots.length) return `<div class="card">${emptyState('📈', 'Kein Depot vorhanden', 'Lege ein Konto vom Typ „Depot“ an, z. B. Trade Republic.', '<button class="btn primary" data-action="newAccount" data-type="depot">Depot anlegen</button>')}</div>`;
  const d = depots.find(x => x.id === UI.depot) || depots[0]; UI.depot = d.id;
  const c = computeAll(), t = today();
  const rows = S.holdings.filter(h => h.accountId === d.id).map(h => ({ h, x: c.hold[h.id] })).sort((a, b) => b.x.value - a.x.value);
  const active = rows.filter(r => r.x.shares > 0);
  const value = sum(active, r => r.x.value), cost = sum(active, r => r.x.cost), pl = value - cost;
  const realized = sum(rows, r => r.x.realized);
  const yAgo = addDays(t, -365);
  const div12 = sum(S.transactions.filter(x => x.kind === 'income' && x.accountId === d.id && x.date > yAgo && x.date <= t && (x.category === 'c_div' || x.category === 'c_interest')), x => x.amount);
  const picker = depots.length > 1 ? `<div class="seg" style="margin-bottom:16px">${depots.map(x => `<button data-action="depotOf" data-id="${x.id}" class="${x.id === d.id ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : '';
  const kpis = `<div class="kpis">
    <div class="kpi"><div class="label">${accEmoji(d)} ${esc(d.name)}</div><div class="v money">${fmt(c.total[d.id])}</div><div class="s">Wertpapiere + Cash</div></div>
    <div class="kpi"><div class="label">Wertpapiere</div><div class="v money">${fmt(value)}</div><div class="s">Einstand <span class="money">${fmt(cost)}</span></div></div>
    <div class="kpi"><div class="label">Unrealisierte G/V</div><div class="v"><span class="money ${pl >= 0 ? 'pos' : 'neg'}">${fmtSigned(pl)}</span></div><div class="s ${pl >= 0 ? 'pos' : 'neg'}">${cost ? fmtPct(pl / cost * 100) : '–'}</div></div>
    <div class="kpi"><div class="label">Verrechnungskonto</div><div class="v money">${fmt(c.cash[d.id])}</div><div class="s">Realisiert: <span class="money">${fmtSigned(realized)}</span></div></div>
    <div class="kpi"><div class="label">Dividenden & Zinsen</div><div class="v money pos">${fmt(div12)}</div><div class="s">letzte 12 Monate</div></div>
  </div>`;
  const toolbar = `<div class="toolbar" style="margin-top:18px">
    <button class="btn primary" data-action="trade" data-side="buy">${ic('plus', 16)} Kauf</button>
    <button class="btn" data-action="trade" data-side="sell">${ic('minus', 16)} Verkauf</button>
    <button class="btn" data-action="dividend">${ic('coins', 16)} Dividende</button>
    <button class="btn" data-action="prices">${ic('refresh', 16)} Kurse aktualisieren</button>
    <span class="grow"></span>
    <button class="btn ghost" data-action="newHolding">${ic('plus', 16)} Neue Position</button>
  </div>`;
  const table = active.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Position</th><th class="hide-sm">Stück</th><th class="hide-sm">Ø Einstand</th><th>Kurs</th><th>Wert</th><th>G/V</th><th class="hide-sm">Anteil</th></tr></thead><tbody>
    ${active.map(({ h, x }) => { const share = value ? x.value / value * 100 : 0; const stale = !h.priceDate || daysBetween(h.priceDate, t) > 7; return `<tr data-action="editHolding" data-id="${h.id}">
      <td><div class="pos-name"><span class="pos-dot" style="--c:${esc(h.color)}">${esc(h.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase())}</span><div><b>${esc(h.name)}</b><small>${esc(h.type)} · ${esc(h.isin || '–')}</small></div></div></td>
      <td class="hide-sm tnum">${fmtShares(x.shares)}</td><td class="hide-sm money">${fmtPrice(x.avg)}</td>
      <td><span class="money">${fmtPrice(h.price)}</span>${stale ? '<span class="stale" title="Kurs älter als 7 Tage"></span>' : ''}<small>${h.priceDate ? fmtDateS(h.priceDate) : ''}</small></td>
      <td><b class="money">${fmt(x.value)}</b></td>
      <td><span class="money ${x.pl >= 0 ? 'pos' : 'neg'}">${fmtSigned(x.pl)}</span><small class="${x.pl >= 0 ? 'pos' : 'neg'}">${fmtPct(x.plPct)}</small></td>
      <td class="hide-sm">${fmtPct(share, false)}<span class="share-bar" style="--c:${esc(h.color)}"><i style="width:${share}%"></i></span></td></tr>`; }).join('')}
    </tbody></table></div>` : emptyState('🌱', 'Noch keine Wertpapiere', 'Füge deine Positionen aus Trade Republic hinzu – mit Stückzahl und Ø Kaufkurs.', '<button class="btn primary" data-action="newHolding">Position hinzufügen</button>');
  const byType = {};
  for (const r of active) byType[r.h.type] = (byType[r.h.type] || 0) + r.x.value;
  const typeSegs = Object.entries(byType).map(([k, v]) => ({ label: k, value: v, color: HOLD_TYPES[k] || '#94a3b8' })).sort((a, b) => b.value - a.value);
  const posSegs = active.map(r => ({ label: r.h.name, value: r.x.value, color: r.h.color }));
  const plans = S.plans.filter(p => hold(p.holdingId)?.accountId === d.id);
  const planCard = `<div class="card span-6">${head('Sparpläne', `<button class="btn sm" data-action="newPlan">${ic('plus', 14)} Sparplan</button>`)}
    ${plans.length ? `<div class="list">${plans.map(p => { const h = hold(p.holdingId); return `<div class="li ${p.paused ? 'paused' : ''}" data-action="editPlan" data-id="${p.id}"><span class="pos-dot" style="--c:${esc(h.color)};width:34px;height:34px">${esc(h.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase())}</span><span class="tx-main"><span class="tx-title">${esc(h.name)}</span><small>${INTERVALS[p.interval]?.label} · ${p.paused ? 'pausiert' : 'nächste ' + fmtDateS(p.next)}</small></span><span class="right"><b class="money">${fmt(p.amount)}</b><small>${fmt(monthlyEq(p))}/Monat</small></span></div>`; }).join('')}</div>
      <div class="divider"></div><div class="row small"><span class="muted">Summe pro Monat</span><span class="grow"></span><b class="money">${fmt(sum(plans.filter(p => !p.paused), monthlyEq))}</b></div>` : emptyState('🔁', 'Keine Sparpläne', 'Sparpläne werden am Ausführungstag automatisch mit dem aktuellen Kurs gebucht.')}
  </div>`;
  const tradeList = S.trades.filter(x => x.accountId === d.id).sort((a, b) => byDateTs(b, a)).slice(0, 8);
  const ordersCard = `<div class="card span-6">${head('Letzte Orders')}
    ${tradeList.length ? `<div class="list">${tradeList.map(x => { const h = hold(x.holdingId); return `<div class="li" data-action="editTrade" data-id="${x.id}"><span class="tx-ic" style="--c:${x.side === 'buy' ? '#2fd47a' : '#ff5d73'}">${x.side === 'buy' ? '🟢' : '🔴'}</span><span class="tx-main"><span class="tx-title">${x.side === 'buy' ? 'Kauf' : 'Verkauf'} ${esc(h?.name || '?')}</span><small>${fmtDate(x.date)} · ${fmtShares(x.shares)} Stk. à ${fmtPrice(x.price)}${x.planId ? ' · Sparplan' : ''}${x.noCash ? ' · Übertrag' : ''}</small></span><span class="right"><b class="money">${fmt(x.shares * x.price)}</b></span></div>`; }).join('')}</div>` : '<p class="muted small">Noch keine Orders.</p>'}
  </div>`;
  return `${picker}${kpis}${toolbar}
    <div class="grid"><div class="card span-8">${head('Positionen', `<span class="sub">${active.length} Werte</span>`)}${table}</div>
    <div class="card span-4">${head('Aufteilung')}${active.length ? `<div class="donut-wrap" style="flex-direction:column">${chart('donut', { size: 170, thick: 16, segments: posSegs, label: 'Depotwert', total: value })}${legend(typeSegs)}</div>` : '<p class="muted small">Sobald Positionen da sind, siehst du hier die Gewichtung.</p>'}</div></div>
    <div class="grid">${planCard}${ordersCard}</div>`;
};

/* ---------- Budgets ---------- */
VIEWS.budgets = () => {
  const mk = UI.budgetMonth, t = today(), cur = t.slice(0, 7);
  const ms = monthStats(mk), avg = avgMonthly(3);
  const frac = mk < cur ? 1 : mk > cur ? 0 : (+t.slice(8)) / daysInMonth(mk);
  const cats = S.categories.filter(c => c.kind === 'expense');
  const rows = cats.map(c => ({ c, lim: +S.budgets[c.id] || 0, sp: ms.byCat[c.id] || 0 })).filter(r => r.lim > 0 || r.sp > 0)
    .sort((a, b) => (b.lim > 0) - (a.lim > 0) || (b.lim ? b.sp / b.lim : 0) - (a.lim ? a.sp / a.lim : 0) || b.sp - a.sp);
  const totLim = sum(rows, r => r.lim), totSpB = sum(rows.filter(r => r.lim > 0), r => r.sp);
  const nav = `<div class="toolbar"><div class="seg"><button data-action="bmonth" data-v="-1">${ic('chevl', 16)}</button><button class="on" style="min-width:150px">${monthLabel(mk)}</button><button data-action="bmonth" data-v="1">${ic('chevr', 16)}</button></div>${mk !== cur ? '<button class="btn sm ghost" data-action="bmonth" data-v="0">Aktueller Monat</button>' : ''}<span class="grow"></span><button class="btn" data-action="editBudget">${ic('plus', 16)} Budget festlegen</button></div>`;
  const totP = totLim ? totSpB / totLim * 100 : 0;
  const summary = `<div class="card span-4">${head('Gesamtbudget')}
    <div class="row" style="gap:18px">${ring(totP, pctColor(totP), 96, 10, `<span style="font-size:16px;font-weight:750">${Math.round(totP)}%</span>`)}
    <div><div class="label">Verbraucht</div><div style="font-size:20px;font-weight:700"><span class="money">${fmt(totSpB)}</span></div><div class="muted small">von <span class="money">${fmt(totLim)}</span></div></div></div>
    <div class="divider"></div>
    <div class="stack small"><div class="row"><span class="muted">Verbleibend</span><span class="grow"></span><b class="money ${totLim - totSpB >= 0 ? 'pos' : 'neg'}">${fmt(totLim - totSpB)}</b></div>
    <div class="row"><span class="muted">Ausgaben gesamt (${MONTHS_S[+mk.slice(5) - 1]})</span><span class="grow"></span><b class="money">${fmt(ms.exp)}</b></div>
    <div class="row"><span class="muted">Ø Ausgaben (3 Monate)</span><span class="grow"></span><b class="money">${fmt(avg.exp)}</b></div>
    ${frac > 0 && frac < 1 ? `<div class="row"><span class="muted">Hochrechnung Monatsende</span><span class="grow"></span><b class="money">${fmt(projectMonth(ms, frac))}</b></div>` : ''}</div>
  </div>`;
  const list = `<div class="card span-8">${head('Kategorien', `<span class="sub">Strich = Monatsfortschritt</span>`)}
    ${rows.length ? rows.map(r => {
    const p = r.lim ? r.sp / r.lim * 100 : 0;
    const left = r.lim - r.sp;
    const proj = projectMonth(ms, frac, r.c.id);
    return `<div class="budget-row" data-action="editBudget" data-id="${r.c.id}">
        <div class="budget-top"><span class="tx-ic" style="--c:${r.c.color}">${r.c.icon}</span><div class="nm">${esc(r.c.name)}<small>${r.lim ? (left >= 0 ? `noch <span class="money">${fmt(left)}</span> übrig` : `<span class="neg"><span class="money">${fmt(-left)}</span> über Budget</span>`) + (proj && r.lim && proj > r.lim * 1.05 && left >= 0 ? ` · <span class="warn">Hochrechnung <span class="money">${fmt(proj)}</span></span>` : '') : 'kein Budget – tippen zum Festlegen'}</small></div>
        <div class="vals"><b class="money">${fmt(r.sp)}</b><small>${r.lim ? 'von <span class="money">' + fmt(r.lim) + '</span>' : 'Ø ' + fmt(avg.byCat[r.c.id] || 0)}</small></div></div>
        ${r.lim ? `<div class="bar" style="--c:${pctColor(p)}"><i style="width:${Math.min(100, p)}%"></i>${frac > 0 && frac < 1 ? `<span class="pace" style="left:${frac * 100}%"></span>` : ''}</div>` : ''}
      </div>`;
  }).join('') : emptyState('🧾', 'Keine Ausgaben in diesem Monat', 'Lege Budgets fest oder erfasse Ausgaben.')}
  </div>`;
  const segs = Object.entries(ms.byCat).map(([id, v]) => ({ label: cat(id)?.name || '?', value: v, color: cat(id)?.color || '#94a3b8' })).sort((a, b) => b.value - a.value);
  const donut = `<div class="card span-5">${head('Wohin fließt dein Geld?', `<span class="sub">${monthLabel(mk)}</span>`)}${segs.length ? `<div class="donut-wrap">${chart('donut', { size: 170, thick: 18, segments: segs, label: 'Ausgaben', total: ms.exp })}${legend(segs.slice(0, 7), ms.exp)}</div>` : '<p class="muted small">Keine Ausgaben.</p>'}</div>`;
  const heat = `<div class="card span-7">${head('Ausgaben-Kalender', '<span class="sub">letzte 6 Monate</span>')}${heatmap(26)}</div>`;
  return `${nav}<div class="grid">${summary}${list}</div><div class="grid">${donut}${heat}</div>`;
};

/* ---------- Sparziele ---------- */
function goalSaved(g) { if (g.accountId && acc(g.accountId)) return Math.max(0, computeAll().total[g.accountId]); return +g.saved || 0; }
VIEWS.goals = () => {
  const t = today();
  const cards = S.goals.map(g => {
    const saved = goalSaved(g), p = g.target > 0 ? saved / g.target * 100 : 0, left = Math.max(0, g.target - saved);
    const months = g.deadline ? Math.max(0, (parseDate(g.deadline).getFullYear() - parseDate(t).getFullYear()) * 12 + parseDate(g.deadline).getMonth() - parseDate(t).getMonth()) : null;
    const need = months != null && left > 0 ? left / Math.max(1, months) : null;
    const done = p >= 100;
    return `<div class="card goal span-4 ${done ? 'done' : ''}" style="--c:${esc(g.color)}">
      <div class="goal-top">${ring(p, g.color, 76, 8, esc(g.emoji || '🎯'))}<div style="min-width:0"><h3>${esc(g.name)}</h3><div class="muted small">${done ? '🎉 Ziel erreicht!' : `${fmtPct(p, false)} geschafft`}</div>${g.accountId && acc(g.accountId) ? `<span class="badge acc" style="margin-top:6px">🔗 ${esc(acc(g.accountId).name)}</span>` : ''}</div></div>
      <div class="bar lg" style="--c:${esc(g.color)}"><i style="width:${Math.min(100, p)}%"></i></div>
      <div class="meta"><span><b class="money">${fmt(saved)}</b> von <span class="money">${fmt(g.target)}</span></span><span>${done ? '' : `noch <b class="money">${fmt(left)}</b>`}</span></div>
      ${!done && g.deadline ? `<div class="meta"><span>${ic('calendar', 14)} bis ${fmtDate(g.deadline)}</span><span>${need != null ? `<b class="money">${fmt(need)}</b>/Monat nötig` : ''}</span></div>` : ''}
      <div class="btn-row">${g.accountId ? '' : `<button class="btn sm" data-action="goalMove" data-id="${g.id}">${ic('plus', 14)} Einzahlen</button>`}<button class="btn sm ghost" data-action="editGoal" data-id="${g.id}">${ic('edit', 14)} Bearbeiten</button></div>
    </div>`;
  }).join('');
  const total = sum(S.goals, g => g.target), saved = sum(S.goals, g => Math.min(goalSaved(g), g.target));
  return `${S.goals.length ? `<div class="kpis"><div class="kpi"><div class="label">Ziele</div><div class="v">${S.goals.length}</div><div class="s">${S.goals.filter(g => goalSaved(g) >= g.target).length} erreicht</div></div><div class="kpi"><div class="label">Angespart</div><div class="v money">${fmt(saved)}</div><div class="s">von <span class="money">${fmt(total)}</span></div></div><div class="kpi"><div class="label">Gesamtfortschritt</div><div class="v">${total ? fmtPct(saved / total * 100, false) : '–'}</div><div class="s">über alle Ziele</div></div></div>` : ''}
  <div class="grid" style="margin-top:18px">${cards}<button class="add-card span-4" data-action="newGoal"><span class="plus">${ic('plus', 22)}</span><b>Neues Sparziel</b><span class="small">Urlaub, Notgroschen, neues Auto …</span></button></div>`;
};

/* ---------- Fixkosten ---------- */
VIEWS.recurring = () => {
  const act = S.recurring.filter(r => !r.paused);
  const fixExp = sum(act.filter(r => r.kind === 'expense'), monthlyEq), fixInc = sum(act.filter(r => r.kind === 'income'), monthlyEq), fixSave = sum(act.filter(r => r.kind === 'transfer'), monthlyEq);
  const kpis = `<div class="kpis">
    <div class="kpi"><div class="label">Fixkosten / Monat</div><div class="v money">${fmt(fixExp)}</div><div class="s"><span class="money">${fmt(fixExp * 12)}</span> pro Jahr</div></div>
    <div class="kpi"><div class="label">Feste Einnahmen</div><div class="v money pos">${fmt(fixInc)}</div><div class="s">${fixInc ? fmtPct(fixExp / fixInc * 100, false) + ' davon sind Fixkosten' : '–'}</div></div>
    <div class="kpi"><div class="label">Sparraten / Monat</div><div class="v money">${fmt(fixSave)}</div><div class="s">automatische Umbuchungen</div></div>
    <div class="kpi"><div class="label">Frei verfügbar</div><div class="v money ${fixInc - fixExp - fixSave >= 0 ? '' : 'neg'}">${fmt(fixInc - fixExp - fixSave)}</div><div class="s">nach Fixkosten & Sparen</div></div>
  </div>`;
  const group = (kind, title) => {
    const list = S.recurring.filter(r => r.kind === kind).sort((a, b) => (a.paused - b.paused) || (a.next < b.next ? -1 : 1));
    if (!list.length) return '';
    return `<div class="group-title">${title}</div>` + list.map(r => {
      const ca = cat(r.category), a = acc(r.accountId), to = acc(r.toAccountId);
      return `<div class="li ${r.paused ? 'paused' : ''}" data-action="editRec" data-id="${r.id}"><span class="tx-ic" style="--c:${kind === 'transfer' ? '#38bdf8' : ca?.color || '#94a3b8'}">${kind === 'transfer' ? '🔁' : ca?.icon || '•'}</span>
        <span class="tx-main"><span class="tx-title">${esc(r.name)}</span><small>${INTERVALS[r.interval]?.label} · ${esc(kind === 'transfer' ? `${a?.name} → ${to?.name}` : a?.name || '')} · ${r.paused ? 'pausiert' : `nächste ${fmtDateS(r.next)} (${relDays(r.next)})`}</small></span>
        <span class="right"><b class="money ${kind === 'income' ? 'pos' : ''}">${fmt(r.amount)}</b><small>${r.interval !== 'monthly' ? fmt(monthlyEq(r)) + '/Monat' : ''}</small></span>
        <button class="icon-btn sm bare" data-action="toggleRec" data-id="${r.id}" title="${r.paused ? 'Fortsetzen' : 'Pausieren'}">${ic(r.paused ? 'play' : 'pause', 15)}</button></div>`;
    }).join('');
  };
  const byCat = {};
  for (const r of act.filter(r => r.kind === 'expense')) byCat[r.category] = (byCat[r.category] || 0) + monthlyEq(r);
  const segs = Object.entries(byCat).map(([id, v]) => ({ label: cat(id)?.name || '?', value: v, color: cat(id)?.color || '#94a3b8' })).sort((a, b) => b.value - a.value);
  const up = upcoming(30);
  return `${kpis}<div class="grid" style="margin-top:18px">
    <div class="card span-8">${head('Daueraufträge & Abos', `<button class="btn sm primary" data-action="newRec">${ic('plus', 14)} Neu</button>`)}
      ${S.recurring.length ? `<div class="list">${group('expense', 'Ausgaben')}${group('income', 'Einnahmen')}${group('transfer', 'Sparraten & Umbuchungen')}</div>` : emptyState('🔁', 'Noch keine Daueraufträge', 'Miete, Gehalt, Netflix & Co. – einmal anlegen, ab dann bucht das Cockpit automatisch.', '<button class="btn primary" data-action="newRec">Dauerauftrag anlegen</button>')}
    </div>
    <div class="span-4" style="display:flex;flex-direction:column;gap:18px">
      <div class="card">${head('Fixkosten nach Kategorie')}${segs.length ? `<div class="donut-wrap" style="flex-direction:column">${chart('donut', { size: 160, thick: 16, segments: segs, label: 'pro Monat', total: fixExp })}${legend(segs)}</div>` : '<p class="muted small">Keine laufenden Fixkosten.</p>'}</div>
      <div class="card">${head('Nächste 30 Tage')}${up.length ? `<div class="list">${up.slice(0, 8).map(u => `<div class="li" style="cursor:default"><span class="tx-main"><span class="tx-title">${esc(u.name)}</span><small>${fmtDay(u.date)}</small></span><span class="right"><b class="money ${u.kind === 'income' ? 'pos' : ''}">${u.kind === 'income' ? '+' : u.kind === 'expense' ? '−' : ''}${fmt(u.amount)}</b></span></div>`).join('')}</div>` : '<p class="muted small">Nichts geplant.</p>'}</div>
    </div></div>`;
};

/* ---------- Prognose ---------- */
function fcDefaults() {
  const c = computeAll(), avg = avgMonthly(3);
  const plans = sum(S.plans.filter(p => !p.paused), monthlyEq);
  return { start: Math.round(c.netWorth), monthly: Math.max(0, Math.round((avg.n ? avg.net : plans) / 25) * 25) || 300, ret: 6, infl: 2, years: 25, dyn: 0, spend: Math.round((avg.exp || 2000) * 12 / 100) * 100 };
}
function simulate(p, years) {
  const r = (1 + p.ret / 100) ** (1 / 12) - 1;
  let v = p.start, contrib = p.start, m = p.monthly; const pts = [{ y: 0, v, real: v, contrib }];
  for (let i = 1; i <= years * 12; i++) {
    v = v * (1 + r) + m; contrib += m;
    if (i % 12 === 0) { const y = i / 12; pts.push({ y, v, real: v / (1 + p.infl / 100) ** y, contrib }); m *= 1 + p.dyn / 100; }
  }
  return pts;
}
function fcChartCfg() {
  const p = UI.fc, pts = simulate(p, p.years), y0 = new Date().getFullYear();
  return {
    height: 300, zero: true, labels: pts.map(x => String(y0 + x.y)), animate: false,
    series: [{ values: pts.map(x => x.v), color: '#7c6cff', fill: true, name: 'Nominal' }, { values: pts.map(x => x.real), color: '#22d3ee', name: 'Real' }, { values: pts.map(x => x.contrib), color: '#94a3b8', dash: '5 5', width: 2, name: 'Einzahlungen' }],
    tip: i => `<small>${y0 + pts[i].y} · in ${pts[i].y} Jahren</small><div class="tr"><span><i style="background:#7c6cff"></i> Nominal</span><b class="money">${fmt(pts[i].v)}</b></div><div class="tr"><span><i style="background:#22d3ee"></i> Kaufkraft heute</span><b class="money">${fmt(pts[i].real)}</b></div><div class="tr"><span><i style="background:#94a3b8"></i> Eingezahlt</span><b class="money">${fmt(pts[i].contrib)}</b></div>`,
  };
}
function fcOut() {
  const p = UI.fc, pts = simulate(p, p.years), last = pts[pts.length - 1];
  const fireN = p.spend * 25;
  const long = simulate(p, 70); const hit = long.find(x => x.real >= fireN);
  const age = S.settings.birthYear ? hit && (new Date().getFullYear() + hit.y - S.settings.birthYear) : null;
  return `<div class="kpis">
    <div class="kpi"><div class="label">Vermögen in ${p.years} J.</div><div class="v money">${fmt(last.v)}</div><div class="s">Kaufkraft heute: <span class="money">${fmt(last.real)}</span></div></div>
    <div class="kpi"><div class="label">Davon eingezahlt</div><div class="v money">${fmt(last.contrib)}</div><div class="s">${fmtPct(last.v ? last.contrib / last.v * 100 : 0, false)} des Endwerts</div></div>
    <div class="kpi"><div class="label">Zinseszins-Effekt</div><div class="v money pos">${fmt(last.v - last.contrib)}</div><div class="s">Ertrag für's Nichtstun ✨</div></div>
  </div>
  <div class="fire" style="margin-top:14px"><div class="label">🔥 Finanzielle Freiheit (4-%-Regel)</div>
    <b class="big2">${hit ? (hit.y === 0 ? 'Schon erreicht! 🎉' : `in ca. ${hit.y} Jahren · ${new Date().getFullYear() + hit.y}`) : 'nicht innerhalb von 70 Jahren'}</b>
    <div class="small muted">Ziel: <b class="money">${fmt(fireN)}</b> (25 × Jahresausgaben von <span class="money">${fmt(p.spend)}</span>, in heutiger Kaufkraft)${age ? ` · du wärst dann etwa ${age}` : ''}. Danach könntest du jährlich 4 % entnehmen.</div></div>`;
}
function fcInput(key, label, min, max, step, suffix) {
  const v = UI.fc[key];
  return `<div><div class="f-top"><span class="field-label">${label}</span><div class="input-affix"><input class="input" data-fc="${key}" value="${esc(fmtNumIn(v, step < 1 ? 1 : 0))}" inputmode="decimal"><span>${suffix}</span></div></div>${min != null ? `<input type="range" data-fc="${key}" min="${min}" max="${max}" step="${step}" value="${v}">` : ''}</div>`;
}
VIEWS.forecast = () => {
  if (!UI.fc) UI.fc = fcDefaults();
  return `<div class="fc-grid"><div class="card fc-in">${head('Annahmen', '<button class="btn sm ghost" data-action="fcReset">Zurücksetzen</button>')}
    ${fcInput('start', 'Startvermögen', null, null, 1, '€')}
    ${fcInput('monthly', 'Sparrate pro Monat', 0, 5000, 25, '€')}
    ${fcInput('ret', 'Rendite p. a.', 0, 12, 0.1, '%')}
    ${fcInput('infl', 'Inflation p. a.', 0, 6, 0.1, '%')}
    ${fcInput('dyn', 'Sparraten-Dynamik p. a.', 0, 10, 0.5, '%')}
    ${fcInput('years', 'Zeitraum', 1, 50, 1, 'J.')}
    ${fcInput('spend', 'Jahresausgaben (für FIRE)', null, null, 100, '€')}
    <p class="hint">Vorbelegt mit deinen echten Werten: aktuelles Vermögen und Ø Überschuss der letzten Monate. Ein weltweit gestreuter ETF hat historisch ca. 6–8 % p. a. erzielt – keine Garantie für die Zukunft.</p>
  </div>
  <div class="stack"><div class="card">${head('Vermögensentwicklung', '<div class="chart-legend" style="margin:0"><span><i style="background:#7c6cff"></i>Nominal</span><span><i style="background:#22d3ee"></i>Kaufkraft heute</span><span><i style="background:#94a3b8"></i>Einzahlungen</span></div>')}${chart('line', fcChartCfg(), 'fcChart')}</div>
  <div id="fcOut">${fcOut()}</div></div></div>`;
};
function updateForecast() { const o = $('#fcOut'); if (!o) return; o.innerHTML = fcOut(); setChartCfg('fcChart', fcChartCfg()); }

/* ---------- Einstellungen ---------- */
VIEWS.settings = () => {
  const st = S.settings, theme = Prefs.get().theme || 'system';
  const blob = (() => { try { return Vault.read(); } catch { return null; } })();
  const size = (() => { try { return (localStorage.getItem(VAULT_KEY) || '').length; } catch { return 0; } })();
  const cats = k => S.categories.filter(c => c.kind === k).map(c => `<div class="cat-item" data-action="editCat" data-id="${c.id}" style="--c:${c.color}"><span class="e">${c.icon}</span>${esc(c.name)}</div>`).join('');
  return `<div class="grid">${syncCardHTML()}
  <div class="card span-6">${head(`${ic('shield', 17)} Sicherheit`)}
    <div class="set-row"><div class="t"><b>Automatisch sperren</b><small>nach Inaktivität</small></div><select class="input" data-setting="autoLock">${[[1, '1 Minute'], [5, '5 Minuten'], [15, '15 Minuten'], [30, '30 Minuten'], [60, '1 Stunde'], [0, 'Nie']].map(([v, l]) => `<option value="${v}" ${+st.autoLock === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="set-row"><div class="t"><b>Sperren beim Tab-Wechsel</b><small>sofort, wenn das Fenster in den Hintergrund geht</small></div><label class="toggle"><input type="checkbox" data-setting="lockOnHide" ${st.lockOnHide ? 'checked' : ''}><span></span></label></div>
    <div class="set-row"><div class="t"><b>Master-Passwort</b><small>alle Daten werden neu verschlüsselt</small></div><button class="btn sm" data-action="changePw">${ic('key', 15)} Ändern</button></div>
    <div class="divider"></div>
    <div class="sec-list">
      <div>${ic('check', 16)}<span><b>AES-256-GCM</b> – authentifizierte Verschlüsselung; jede Manipulation der Daten wird erkannt.</span></div>
      <div>${ic('check', 16)}<span><b>PBKDF2-SHA256 mit ${(blob?.iter || PBKDF2_ITER).toLocaleString('de-DE')} Iterationen</b> und zufälligem Salt – macht das Durchprobieren von Passwörtern extrem teuer.</span></div>
      <div>${ic('check', 16)}<span><b>100 % offline</b> – eine Content-Security-Policy verbietet jede Netzwerkverbindung. Keine Cloud, kein Tracking, keine Abhängigkeiten.</span></div>
      <div>${ic('check', 16)}<span><b>Schlüssel nur im Arbeitsspeicher</b> – nicht exportierbar, beim Sperren verworfen. Fehlversuche lösen eine wachsende Wartezeit aus.</span></div>
    </div>
  </div>
  <div class="span-6" style="display:flex;flex-direction:column;gap:18px">
  <div class="card">${head(`${ic('sun', 17)} Profil & Darstellung`)}
    <div class="set-row"><div class="t"><b>Dein Name</b><small>für die Begrüßung</small></div><input class="input" data-setting="name" value="${esc(st.name)}" placeholder="Vorname" maxlength="30"></div>
    <div class="set-row"><div class="t"><b>Geburtsjahr</b><small>optional, für die FIRE-Prognose</small></div><input class="input" data-setting="birthYear" value="${esc(st.birthYear || '')}" placeholder="z. B. 1992" inputmode="numeric" maxlength="4"></div>
    <div class="set-row"><div class="t"><b>Farbschema</b></div><div class="seg">${[['system', 'System'], ['dark', 'Dunkel'], ['light', 'Hell']].map(([v, l]) => `<button data-action="setTheme" data-v="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  </div>
  <div class="card">${head(`${ic('file', 17)} Daten`)}
    <div class="set-row"><div class="t"><b>Backup exportieren</b><small>verschlüsselte Datei – sicher für USB-Stick oder Cloud</small></div><button class="btn sm primary" data-action="exportBackup">${ic('download', 15)} Backup</button></div>
    <div class="set-row"><div class="t"><b>Backup wiederherstellen</b><small>ersetzt die aktuellen Daten</small></div><button class="btn sm" data-action="importBackup">${ic('upload', 15)} Importieren</button></div>
    <div class="set-row"><div class="t"><b>Buchungen als CSV</b><small>für Excel – <span class="warn">unverschlüsselt</span></small></div><button class="btn sm" data-action="exportCSV">${ic('download', 15)} CSV</button></div>
    <div class="set-row"><div class="t"><b>${st.demo ? 'Demo beenden' : 'Daten zurücksetzen'}</b><small>${st.demo ? 'Demo-Daten löschen und mit eigenen Werten starten' : 'alle Buchungen und Konten löschen, Passwort bleibt'}</small></div><button class="btn sm danger" data-action="resetData">${ic('trash', 15)} ${st.demo ? 'Demo beenden' : 'Zurücksetzen'}</button></div>
    <p class="hint" style="margin-top:12px">Tresorgröße: ${(size / 1024).toFixed(1)} KB · zuletzt gespeichert ${blob?.saved ? new Date(blob.saved).toLocaleString('de-DE') : '–'}</p>
  </div></div>
  <div class="card span-8">${head('Kategorien', `<button class="btn sm" data-action="newCat">${ic('plus', 14)} Kategorie</button>`)}
    <div class="label" style="margin-bottom:8px">Ausgaben</div><div class="cat-list">${cats('expense')}</div>
    <div class="label" style="margin:16px 0 8px">Einnahmen</div><div class="cat-list">${cats('income')}</div>
  </div>
  <div class="card span-4">${head(`${ic('keyboard', 17)} Tastenkürzel`)}
    <div class="kbd-list"><kbd>Strg K</kbd><span>Befehlspalette & Suche</span><kbd>N</kbd><span>Neue Buchung</span><kbd>P</kbd><span>Privatmodus</span><kbd>L</kbd><span>Sperren</span><kbd>1</kbd><span>… <kbd>9</kbd> Bereiche wechseln</span><kbd>Esc</kbd><span>Dialog schließen</span></div>
    <div class="divider"></div><p class="hint">Finanzcockpit v${APP_VERSION} · Alles läuft lokal in deinem Browser.</p>
  </div></div>`;
};
