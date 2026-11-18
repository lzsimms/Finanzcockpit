/* =========================================================
   Demo-Daten: 12 Monate realistischer Finanzalltag
   ========================================================= */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildDemo() {
  const s = defaultState();
  s.settings.onboarded = true; s.settings.demo = true;
  const R = mulberry32(20261118), rr = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
  const t = today(), start = addMonths(t.slice(0, 7) + '-01', -12);
  const mk = o => ({ id: uid(), ...o });
  const cash = mk({ name: 'Bargeld', type: 'cash', opening: 180, color: '#f5b544', icon: '💶' });
  const giro = mk({ name: 'Girokonto', type: 'bank', opening: 2100, color: '#7c6cff', icon: '🏦' });
  const tg = mk({ name: 'Tagesgeld', type: 'bank', opening: 6200, color: '#22d3ee', icon: '🐷' });
  const tr = mk({ name: 'Trade Republic', type: 'depot', opening: 7600, color: '#2fd47a', icon: '📈' });
  s.accounts = [cash, giro, tg, tr];
  let ts = 1; const T = o => s.transactions.push({ id: uid(), ts: ts++, ...o });

  // Wertpapiere mit simuliertem Kursverlauf (endet exakt beim "aktuellen" Demo-Kurs)
  const weeks = Math.ceil(daysBetween(start, t) / 7) + 1, paths = {};
  const H = [
    ['iShares Core MSCI World', 'IE00B4L5Y983', 'ETF', 112.4, 0.0018, 0.018, '#7c6cff'],
    ['Vanguard FTSE All-World', 'IE00BK5BQT80', 'ETF', 141.8, 0.0016, 0.017, '#22d3ee'],
    ['Xtrackers MSCI Emerging Markets', 'IE00BTJRMP35', 'ETF', 62.1, 0.0012, 0.022, '#2fd47a'],
    ['Apple', 'US0378331005', 'Aktie', 245.3, 0.0022, 0.034, '#a78bfa'],
    ['Bitcoin', 'XF000BTC0017', 'Krypto', 78500, 0.0035, 0.055, '#f5b544'],
  ];
  s.holdings = H.map(([name, isin, type, price, drift, vol, color]) => {
    const h = mk({ name, isin, type, price, priceDate: t, accountId: tr.id, color });
    const p = new Array(weeks); p[weeks - 1] = price;
    for (let i = weeks - 1; i > 0; i--) { const g = (R() + R() + R() - 1.5) * 2; p[i - 1] = p[i] / (1 + drift + vol * g); }
    paths[h.id] = p; return h;
  });
  const priceAt = (h, d) => { const p = paths[h.id][clamp(Math.floor(daysBetween(start, d) / 7), 0, weeks - 1)]; return p > 1000 ? Math.round(p) : round2(p); };
  const [msci, vwrl, em, aapl, btc] = s.holdings;
  const trade = (h, d, side, shares, fee, extra = {}) => s.trades.push({ id: uid(), ts: ts++, holdingId: h.id, accountId: tr.id, date: d, side, shares: round6(shares), price: priceAt(h, d), fee, ...extra });
  trade(msci, start, 'buy', 38, 1); trade(aapl, start, 'buy', 12, 1); trade(vwrl, start, 'buy', 10, 1);
  trade(aapl, addMonths(start, 8, 20), 'sell', 4, 1);
  trade(btc, addMonths(start, 5, 9), 'buy', 0.004, 1);
  s.plans = [[msci, 250, 2], [vwrl, 150, 2], [em, 75, 16], [btc, 25, 16]].map(([h, amount, day]) => {
    let d = addMonths(start, 0, day), id = uid();
    while (d <= t) { trade(h, d, 'buy', amount / priceAt(h, d), 0, { planId: id }); d = addMonths(d, 1, day); }
    return { id, holdingId: h.id, amount, interval: 'monthly', day, next: d, paused: false };
  });

  // Alltag
  let cashBal = cash.opening;
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const day = +d.slice(8), month = +d.slice(5, 7), dow = parseDate(d).getDay(), mIdx = daysBetween(start, d) / 30.4;
    if (day === 5 || day === 19) { T({ date: d, kind: 'transfer', amount: 150, accountId: giro.id, toAccountId: cash.id, note: 'Geldautomat' }); cashBal += 150; }
    const spend = (p, category, min, max, notes, cashShare = 0) => {
      if (R() >= p) return;
      const amount = round2(rr(min, max)), useCash = R() < cashShare && cashBal > amount;
      if (useCash) cashBal -= amount;
      T({ date: d, kind: 'expense', amount, accountId: useCash ? cash.id : giro.id, category, note: pick(notes) });
    };
    spend(dow === 6 ? 0.75 : 0.28, 'c_food', 12, 92, ['Rewe', 'Edeka', 'Aldi Süd', 'Lidl', 'dm', 'Wochenmarkt', 'Bäckerei Kamps'], 0.3);
    spend(dow === 5 || dow === 6 ? 0.35 : 0.09, 'c_rest', 8, 58, ['Café Lotte', 'Pizzeria Da Mario', 'Sushi-Bar Kyoto', 'Biergarten', 'Döner Kebab', 'Thai Imbiss', 'Lieferando'], 0.45);
    spend(0.07, 'c_mob', 38, 75, ['Aral', 'Shell', 'Tankstelle', 'Parkhaus', 'DB Fernverkehr']);
    spend(0.055, 'c_shop', 15, 140, ['Amazon', 'Zalando', 'IKEA', 'MediaMarkt', 'H&M', 'Decathlon']);
    spend(dow === 6 || dow === 0 ? 0.12 : 0.035, 'c_fun', 8, 60, ['Kino', 'Konzert', 'Bowling', 'Freibad', 'Kletterhalle', 'Museum'], 0.3);
    spend(0.022, 'c_health', 6, 45, ['Apotheke', 'Physiotherapie', 'Optiker'], 0.2);
    spend(0.012, 'c_edu', 12, 49, ['Thalia', 'Udemy-Kurs', 'Hugendubel']);
    spend(0.01, 'c_gift', 15, 80, ['Geburtstagsgeschenk', 'Blumen', 'Mitbringsel']);
    if (day === 1) {
      T({ date: d, kind: 'income', amount: round2(rr(11, 15)), accountId: tg.id, category: 'c_interest', note: 'Zinsgutschrift Tagesgeld' });
      T({ date: d, kind: 'income', amount: round2(rr(1.5, 4)), accountId: tr.id, category: 'c_interest', note: 'Zinsen Trade Republic' });
    }
    if ([3, 6, 9, 12].includes(month) && day === 25) T({ date: d, kind: 'income', amount: round2(rr(6, 9)), accountId: tr.id, category: 'c_div', note: 'Dividende Vanguard FTSE All-World', holdingId: vwrl.id });
    if ([2, 5, 8, 11].includes(month) && day === 14) T({ date: d, kind: 'income', amount: round2(rr(1.8, 2.6)), accountId: tr.id, category: 'c_div', note: 'Dividende Apple', holdingId: aapl.id });
    if (month === 12 && day === 14) T({ date: d, kind: 'expense', amount: 268.4, accountId: giro.id, category: 'c_gift', note: 'Weihnachtsgeschenke' });
    if (Math.floor(mIdx) === 7 && day === 12) { T({ date: d, kind: 'expense', amount: 690, accountId: giro.id, category: 'c_travel', note: 'Ferienwohnung Gardasee' }); T({ date: d, kind: 'expense', amount: 236, accountId: giro.id, category: 'c_travel', note: 'Flug München–Verona' }); }
    if (Math.floor(mIdx) === 4 && day === 22) T({ date: d, kind: 'income', amount: 642.18, accountId: giro.id, category: 'c_refund', note: 'Steuererstattung' });
    if ((Math.floor(mIdx) === 2 || Math.floor(mIdx) === 9) && day === 27) T({ date: d, kind: 'income', amount: 480, accountId: giro.id, category: 'c_side', note: 'Freelance-Projekt' });
  }

  // Daueraufträge – werden über die echte Buchungslogik bis heute nachgetragen
  const rec = (name, kind, amount, accountId, category, interval, day, first, toAccountId = '') =>
    s.recurring.push({ id: uid(), name, kind, amount, accountId, toAccountId, category, interval, day, next: first || addMonths(start, 0, day), end: '', paused: false });
  rec('Gehalt', 'income', 3380, giro.id, 'c_salary', 'monthly', 1);
  rec('Miete', 'expense', 950, giro.id, 'c_home', 'monthly', 3);
  rec('Strom & Gas', 'expense', 112, giro.id, 'c_home', 'monthly', 15);
  rec('Internet', 'expense', 39.99, giro.id, 'c_home', 'monthly', 5);
  rec('Handyvertrag', 'expense', 19.99, giro.id, 'c_abo', 'monthly', 10);
  rec('Netflix', 'expense', 13.99, giro.id, 'c_abo', 'monthly', 12);
  rec('Spotify', 'expense', 10.99, giro.id, 'c_abo', 'monthly', 20);
  rec('Fitnessstudio', 'expense', 29.9, giro.id, 'c_fun', 'monthly', 1);
  rec('Deutschlandticket', 'expense', 63, giro.id, 'c_mob', 'monthly', 1);
  rec('Haftpflichtversicherung', 'expense', 6.5, giro.id, 'c_ins', 'monthly', 1);
  rec('Kfz-Versicherung', 'expense', 438, giro.id, 'c_ins', 'yearly', 1, addMonths(start, 1, 1));
  rec('Amazon Prime', 'expense', 89.9, giro.id, 'c_abo', 'yearly', 14, addMonths(start, 4, 14));
  rec('Sparrate Trade Republic', 'transfer', 600, giro.id, '', 'monthly', 4, null, tr.id);
  rec('Notgroschen aufstocken', 'transfer', 200, giro.id, '', 'monthly', 4, null, tg.id);
  processDue(s);

  s.goals = [
    { id: uid(), name: 'Notgroschen', emoji: '🛟', target: 12000, saved: 0, accountId: tg.id, deadline: '', color: '#22d3ee' },
    { id: uid(), name: 'Japan-Reise', emoji: '🗾', target: 4500, saved: 1850, accountId: '', deadline: addMonths(t, 10, 1), color: '#ff7a90' },
    { id: uid(), name: 'Neues E-Bike', emoji: '🚲', target: 2800, saved: 2240, accountId: '', deadline: addMonths(t, 4, 1), color: '#2fd47a' },
  ];
  s.budgets = { c_food: 420, c_rest: 160, c_shop: 180, c_fun: 150, c_mob: 200 };

  // Wöchentliche Depot-Snapshots für einen realistischen Vermögensverlauf
  const trs = s.trades.slice().sort(byDateTs), hm = {}; let j = 0;
  for (let d = start; d <= t; d = addDays(d, 7)) {
    while (j < trs.length && trs[j].date <= d) applyTrade(hm, trs[j++], () => { });
    let mv = 0, cb = 0;
    for (const h of s.holdings) { const x = hm[h.id]; if (!x) continue; mv += x.shares * priceAt(h, d); cb += x.cost; }
    s.snapshots.push({ d, mv: round2(mv), cb: round2(cb) });
  }
  return s;
}
