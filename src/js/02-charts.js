/* =========================================================
   Diagramme – handgemachtes SVG, interaktiv, ohne Bibliotheken
   ========================================================= */
const CHARTS = [];
function chart(type, cfg, id) {
  id = id || 'ch' + CHARTS.length + '_' + Math.random().toString(36).slice(2, 6);
  CHARTS.push({ id, type, cfg });
  const h = type === 'donut' ? (cfg.size || 180) : (cfg.height || 220);
  return `<div class="chart chart-${type}" id="${id}" style="height:${h}px;${type === 'donut' ? `width:${h}px` : ''}"></div>`;
}
function drawCharts() {
  for (const c of CHARTS) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    try { ({ line: drawLine, bars: drawBars, donut: drawDonut })[c.type](el, c.cfg); } catch (e) { console.error(e); }
  }
}
function setChartCfg(id, cfg) { const c = CHARTS.find(x => x.id === id); if (c) c.cfg = cfg; const el = document.getElementById(id); if (el && c) drawLine(el, cfg); }

function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; min = min - 1; }
  const span = max - min, step0 = span / count, mag = 10 ** Math.floor(Math.log10(step0)), norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) t.push(Math.abs(v) < 1e-9 ? 0 : v);
  return t;
}

function attachHover(el, svg, n, X, onIndex, onLeave) {
  const tip = el.querySelector('.tip');
  const move = e => {
    const r = svg.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const i = clamp(Math.round(X.inv(cx)), 0, n - 1);
    tip.innerHTML = onIndex(i);
    tip.hidden = false;
    const tw = tip.offsetWidth, W = el.clientWidth;
    let left = X(i) + 14; if (left + tw > W) left = X(i) - tw - 14; if (left < 0) left = 4;
    tip.style.left = left + 'px';
  };
  const leave = () => { tip.hidden = true; onLeave && onLeave(); };
  svg.addEventListener('mousemove', move);
  svg.addEventListener('touchstart', move, { passive: true });
  svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('mouseleave', leave);
  svg.addEventListener('touchend', leave);
}

/** Liniendiagramm: cfg = { height, labels[], series:[{values[], color, fill, dash, name}], xfmt, tip(i), zero } */
function drawLine(el, cfg) {
  const W = Math.max(220, el.clientWidth), H = cfg.height || 220;
  const P = { l: cfg.yAxis === false ? 4 : 52, r: 8, t: 14, b: cfg.labels ? 26 : 6 };
  const n = cfg.series[0].values.length;
  if (n < 2) { el.innerHTML = '<div class="empty-chart">Noch nicht genug Daten für einen Verlauf</div>'; return; }
  const all = cfg.series.flatMap(s => s.values);
  let mn = Math.min(...all), mx = Math.max(...all);
  if (cfg.zero) mn = Math.min(0, mn);
  else { const pad = (mx - mn) * 0.15 || Math.abs(mx) * 0.05 || 1; mn -= pad; mx += pad * 0.6; }
  const ticks = niceTicks(mn, mx, 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const X = i => P.l + i * iw / (n - 1); X.inv = x => (x - P.l) / (iw / (n - 1));
  const Y = v => P.t + (1 - (v - y0) / (y1 - y0)) * ih;
  let s = `<svg width="${W}" height="${H}">`;
  s += '<defs>' + cfg.series.map((se, si) => se.fill ? `<linearGradient id="${el.id}g${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity=".32"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>` : '').join('') + '</defs>';
  if (cfg.yAxis !== false) for (const t of ticks) {
    s += `<line class="gridl" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/>`;
    s += `<text class="ylab" x="${P.l - 8}" y="${Y(t) + 4}" text-anchor="end">${fmtC(t)}</text>`;
  }
  if (cfg.labels) {
    const want = Math.max(2, Math.min(7, Math.floor(iw / 90)));
    const every = Math.max(1, Math.round((n - 1) / (want - 1)));
    for (let i = 0; i < n; i += every) {
      if (i > 0 && n - 1 - i < every * 0.6) continue;
      s += `<text class="xlab" x="${X(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${esc(cfg.xfmt ? cfg.xfmt(cfg.labels[i], i) : cfg.labels[i])}</text>`;
    }
    s += `<text class="xlab" x="${X(n - 1)}" y="${H - 6}" text-anchor="end">${esc(cfg.xfmt ? cfg.xfmt(cfg.labels[n - 1], n - 1) : cfg.labels[n - 1])}</text>`;
  }
  cfg.series.forEach((se, si) => {
    const pts = se.values.map((v, i) => [X(i), Y(v)]);
    const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
    if (se.fill) s += `<path class="area" d="${d}L${X(n - 1)},${Y(y0)}L${X(0)},${Y(y0)}Z" fill="url(#${el.id}g${si})"/>`;
    s += `<path class="line ${cfg.animate !== false && !reducedMotion() ? 'draw' : ''}" d="${d}" stroke="${se.color}" ${se.dash ? `stroke-dasharray="${se.dash}" style="animation:none"` : ''} ${se.width ? `stroke-width="${se.width}"` : ''}/>`;
  });
  s += `<line class="vline" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}"/>`;
  cfg.series.forEach((se) => { s += `<circle class="hdot" r="5" fill="${se.color}" stroke="var(--panel2)" stroke-width="2.5"/>`; });
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  el.innerHTML = s;
  const svg = el.querySelector('svg');
  $$('.line.draw', svg).forEach(p => { if (!p.getAttribute('stroke-dasharray')) { const L = p.getTotalLength(); p.style.setProperty('--len', L); } });
  const vline = svg.querySelector('.vline'), dots = $$('.hdot', svg);
  attachHover(el, svg, n, X, i => {
    vline.setAttribute('x1', X(i)); vline.setAttribute('x2', X(i)); vline.style.opacity = 1;
    dots.forEach((d, si) => { d.setAttribute('cx', X(i)); d.setAttribute('cy', Y(cfg.series[si].values[i])); d.style.opacity = 1; });
    return cfg.tip ? cfg.tip(i) : `<b class="money">${fmt(cfg.series[0].values[i])}</b>`;
  }, () => { vline.style.opacity = 0; dots.forEach(d => d.style.opacity = 0); });
}

/** Balkendiagramm: cfg = { height, labels[], series:[{name,color,values[]}], tip(i) } */
function drawBars(el, cfg) {
  const W = Math.max(220, el.clientWidth), H = cfg.height || 220, P = { l: 52, r: 8, t: 14, b: 26 };
  const n = cfg.labels.length, m = cfg.series.length;
  const all = cfg.series.flatMap(s => s.values);
  const ticks = niceTicks(0, Math.max(1, ...all), 4), y1 = ticks[ticks.length - 1];
  const iw = W - P.l - P.r, ih = H - P.t - P.b, gw = iw / n;
  const bw = Math.max(4, Math.min(22, (gw * 0.62 - (m - 1) * 4) / m));
  const Y = v => P.t + (1 - v / y1) * ih;
  let s = `<svg width="${W}" height="${H}">`;
  for (const t of ticks) s += `<line class="gridl" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ylab" x="${P.l - 8}" y="${Y(t) + 4}" text-anchor="end">${fmtC(t)}</text>`;
  s += '<g class="bars-g">';
  for (let i = 0; i < n; i++) {
    const gx = P.l + i * gw + gw / 2 - (m * bw + (m - 1) * 4) / 2;
    s += `<g class="grp" data-i="${i}"><rect x="${P.l + i * gw}" y="${P.t}" width="${gw}" height="${ih}" fill="transparent"/>`;
    cfg.series.forEach((se, si) => {
      const v = Math.max(0, se.values[i] || 0), y = Y(v), h = Math.max(v > 0 ? 2 : 0, P.t + ih - y);
      s += `<rect class="barr" x="${gx + si * (bw + 4)}" y="${P.t + ih - h}" width="${bw}" height="${h}" rx="${Math.min(5, bw / 2)}" fill="${se.color}" style="animation-delay:${i * 40}ms"/>`;
    });
    s += `<text class="xlab" x="${P.l + i * gw + gw / 2}" y="${H - 6}" text-anchor="middle">${esc(cfg.labels[i])}</text></g>`;
  }
  s += `</g></svg><div class="tip" hidden></div>`;
  el.innerHTML = s;
  const svg = el.querySelector('svg');
  const X = i => P.l + i * gw + gw / 2; X.inv = x => (x - P.l - gw / 2) / gw;
  attachHover(el, svg, n, X, i => cfg.tip ? cfg.tip(i) : '');
}

/** Ringdiagramm: cfg = { size, thick, segments:[{label,value,color}], label, total } */
function drawDonut(el, cfg) {
  const size = cfg.size || 180, th = cfg.thick || 18, r = (size - th) / 2 - 2, Cc = 2 * Math.PI * r, mid = size / 2;
  const segs = cfg.segments.filter(s => s.value > 0.004), total = sum(segs, s => s.value);
  let s = `<svg width="${size}" height="${size}"><circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${th}"/><g transform="rotate(-90 ${mid} ${mid})">`;
  let acc0 = 0; const gap = segs.length > 1 ? Math.min(4, Cc * 0.006) : 0;
  segs.forEach((g, i) => {
    const frac = g.value / total, len = Math.max(0.5, frac * Cc - gap);
    s += `<circle class="seg-c" data-i="${i}" cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${g.color}" stroke-width="${th}" stroke-dasharray="${len} ${Cc - len}" stroke-dashoffset="${-acc0 * Cc}" stroke-linecap="${segs.length > 1 ? 'butt' : 'round'}"/>`;
    acc0 += frac;
  });
  s += '</g></svg>';
  const center = (l, v, p) => `<small>${esc(l)}</small><b class="money">${fmt(v)}</b>${p != null ? `<span>${fmtPct(p, false)}</span>` : ''}`;
  el.innerHTML = s + `<div class="donut-center">${center(cfg.label || 'Gesamt', cfg.total ?? total)}</div>`;
  const c = el.querySelector('.donut-center');
  $$('.seg-c', el).forEach(node => {
    node.addEventListener('mouseenter', () => { const g = segs[+node.dataset.i]; c.innerHTML = center(g.label, g.value, g.value / total * 100); });
    node.addEventListener('mouseleave', () => { c.innerHTML = center(cfg.label || 'Gesamt', cfg.total ?? total); });
  });
}
function legend(segs, total) {
  total = total || sum(segs, s => Math.max(0, s.value));
  return `<div class="legend">${segs.filter(s => s.value > 0.004).map(s => `<div class="lg-i" style="--c:${s.color}"><span class="dot"></span><span>${esc(s.label)}</span><b class="money">${fmt(s.value)}</b><em>${total ? fmtPct(s.value / total * 100, false) : ''}</em></div>`).join('')}</div>`;
}

/** Kleiner Verlauf als Inline-SVG */
function sparkline(values, color = '#7c6cff', h = 56) {
  if (!values || values.length < 2) return '';
  const w = 300, mn = Math.min(...values), mx = Math.max(...values), span = mx - mn || 1;
  const pts = values.map((v, i) => [i / (values.length - 1) * w, h - 4 - (v - mn) / span * (h - 8)]);
  const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
  const id = 'sp' + Math.random().toString(36).slice(2, 8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${w},${h}L0,${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

/** Fortschrittsring */
function ring(pct, color = '#7c6cff', size = 64, th = 7, inner = '') {
  const r = (size - th) / 2, Cc = 2 * Math.PI * r, p = clamp(pct, 0, 100);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${th}"/><circle class="prog" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${th}" stroke-linecap="round" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div class="ring-c">${inner}</div></div>`;
}

/** Ausgaben-Kalender (Heatmap) der letzten Wochen */
function heatmap(weeks = 26) {
  const t = today();
  let start = addDays(t, -(weeks * 7 - 1));
  start = addDays(start, -((parseDate(start).getDay() + 6) % 7));   // auf Montag ausrichten
  const daily = {};
  for (const x of S.transactions) if (x.kind === 'expense' && !x.correction && x.date >= start && x.date <= t) daily[x.date] = (daily[x.date] || 0) + x.amount;
  const vals = Object.values(daily).sort((a, b) => a - b);
  const q = p => vals.length ? vals[Math.floor((vals.length - 1) * p)] : 0;
  const th = [q(.3), q(.6), q(.88)];
  const priv = document.body.classList.contains('privacy');
  let cols = '', d = start, lastM = '';
  while (d <= t) {
    let col = '';
    const m = d.slice(0, 7);
    const label = m !== lastM ? MONTHS_S[+m.slice(5) - 1] : '';
    lastM = m;
    for (let i = 0; i < 7; i++) {
      if (d > t) { col += '<i class="x"></i>'; }
      else {
        const v = daily[d] || 0;
        const l = v <= 0 ? 0 : v <= th[0] ? 1 : v <= th[1] ? 2 : v <= th[2] ? 3 : 4;
        col += `<i class="l${l}" title="${fmtDate(d)}${priv ? '' : ': ' + fmt(v)}"></i>`;
      }
      d = addDays(d, 1);
    }
    cols += `<div class="heat-col"><span class="m">${label}</span>${col}</div>`;
  }
  return `<div class="heat"><div class="heat-days"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span>So</span></div><div class="heat-cols">${cols}</div></div>
  <div class="heat-legend">weniger <i class="l0" style="background:var(--track)"></i><i style="background:rgba(124,108,255,.28)"></i><i style="background:rgba(124,108,255,.5)"></i><i style="background:rgba(124,108,255,.75)"></i><i style="background:#7c6cff"></i> mehr</div>`;
}
