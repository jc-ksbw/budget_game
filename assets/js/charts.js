/* ============================================================
   charts.js — dependency-free SVG charts, phone-first.
   Rules followed: one axis per chart, categorical hues in fixed
   order (never cycled), single-series charts use one color,
   <=24px bars with a 4px rounded data-end, 2px lines, >=8px
   markers with a 2px surface ring, hairline solid gridlines,
   2px surface gaps between touching fills, selective direct
   labels, legend whenever >=2 series, text in text tokens only,
   and tap-to-reveal readouts (no hover-only information).
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';

/* ---------- small helpers ---------- */

function el(name, attrs = {}) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) {
    if (attrs[k] === null || attrs[k] === undefined) continue;
    n.setAttribute(k, attrs[k]);
  }
  return n;
}

function txt(x, y, s, attrs = {}) {
  const t = el('text', Object.assign({
    x, y,
    'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    'font-size': 11,
  }, attrs));
  t.textContent = s;
  return t;
}

/** Rounded only on the data-end; square at the baseline. */
function barPath(x, y, w, h, r, end) {
  if (w <= 0 || h <= 0) return '';
  if (end === 'right') {
    const rr = Math.max(0, Math.min(r, w, h / 2));
    return `M${x},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr}`
         + ` V${y + h - rr} A${rr},${rr} 0 0 1 ${x + w - rr},${y + h} H${x} Z`;
  }
  if (end === 'left') {
    const rr = Math.max(0, Math.min(r, w, h / 2));
    return `M${x + w},${y} H${x + rr} A${rr},${rr} 0 0 0 ${x},${y + rr}`
         + ` V${y + h - rr} A${rr},${rr} 0 0 0 ${x + rr},${y + h} H${x + w} Z`;
  }
  if (end === 'top') {
    const rr = Math.max(0, Math.min(r, h, w / 2));
    return `M${x},${y + h} V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y}`
         + ` H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr} V${y + h} Z`;
  }
  // bottom
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y} V${y + h - rr} A${rr},${rr} 0 0 0 ${x + rr},${y + h}`
       + ` H${x + w - rr} A${rr},${rr} 0 0 0 ${x + w},${y + h - rr} V${y} Z`;
}

function arcPath(cx, cy, r, a0, a1) {
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return `M${p0[0]},${p0[1]} A${r},${r} 0 ${large} 1 ${p1[0]},${p1[1]}`;
}

export const fmt = {
  /** $1.2M / $840K — compact money for axis ticks and labels. */
  money(v, dp) {
    const n = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(dp === undefined ? 1 : dp)}M`;
    if (n >= 1e3) return `${sign}$${Math.round(n / 1e3)}K`;
    return `${sign}$${Math.round(n)}`;
  },
  /** $48,500,000 — exact, for tables and readouts. */
  full(v) {
    const sign = v < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  },
  signed(v) { return (v > 0 ? '+' : v < 0 ? '-' : '') + fmt.money(Math.abs(v)); },
  pct(v, dp = 0) { return `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(dp)}%`; },
};

/** "nice" axis max so ticks land on round numbers. */
function niceMax(v, ticks = 4) {
  if (v <= 0) return 1;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const ladder = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = (ladder.find((x) => norm <= x) ?? 10) * mag;
  return step * ticks;
}

/** The step size itself, for axes that don't start at zero. */
function niceStep(raw) {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const ladder = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (ladder.find((x) => norm <= x) ?? 10) * mag;
}

/* ---------- mount: measures its container and redraws on resize ---------- */

const mounted = new WeakMap();

function mount(host, draw) {
  const render = () => {
    const w = Math.max(240, Math.round(host.getBoundingClientRect().width));
    host.replaceChildren(draw(w));
  };
  if (!mounted.has(host)) {
    mounted.set(host, render);
    if (typeof ResizeObserver !== 'undefined') {
      let last = 0;
      const ro = new ResizeObserver(() => {
        const w = Math.round(host.getBoundingClientRect().width);
        if (w && Math.abs(w - last) > 1) { last = w; mounted.get(host)(); }
      });
      ro.observe(host);
    }
  } else {
    mounted.set(host, render);
  }
  render();
}

/** A tap/click target that reports back through opts.onPick. */
function pickable(node, payload, onPick) {
  if (!onPick) return node;
  node.style.cursor = 'pointer';
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'button');
  const fire = (e) => { e.preventDefault(); e.stopPropagation(); onPick(payload); };
  node.addEventListener('click', fire);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fire(e);
  });
  return node;
}

/* ============================================================
   1. Donut — part-to-whole at a glance. <=8 segments, fixed hues.
   ============================================================ */

export function donut(host, segments, opts = {}) {
  mount(host, (W) => {
    const size = Math.min(W, 260);
    const cx = W / 2, cy = size / 2;
    const thickness = Math.max(26, Math.min(38, size * 0.15));
    const r = size / 2 - thickness / 2 - 2;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${size}`, width: W, height: size,
      role: 'img', 'aria-label': opts.ariaLabel || 'Donut chart',
    });

    const total = segments.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
    // 2px surface gap between touching segments, expressed as an angle.
    const gap = Math.min(0.055, 2 / r);
    let a = -Math.PI / 2;

    segments.forEach((d) => {
      const frac = Math.max(0, d.value) / total;
      const sweep = frac * Math.PI * 2;
      if (sweep <= 0.0005) return;
      const a0 = a + gap / 2;
      const a1 = a + sweep - gap / 2;
      if (a1 > a0) {
        const arc = el('path', {
          d: arcPath(cx, cy, r, a0, a1),
          fill: 'none', 'stroke-width': thickness, 'stroke-linecap': 'butt',
        });
        arc.style.stroke = d.color;
        arc.style.transition = 'opacity .15s ease';
        if (opts.dimOthers && opts.active && opts.active !== d.id) arc.style.opacity = '.3';
        const label = `${d.label}: ${fmt.full(d.value)}, ${(frac * 100).toFixed(1)} percent`;
        arc.setAttribute('aria-label', label);
        svg.appendChild(pickable(arc, d, opts.onPick));
      }
      a += sweep;
    });

    // Center: the hero number. Text wears text tokens, never a series color.
    if (opts.centerValue) {
      const v = txt(cx, cy - 1, opts.centerValue, {
        'text-anchor': 'middle', 'font-size': Math.round(size * 0.115),
        'font-weight': 700, 'letter-spacing': '-0.02em',
      });
      v.style.fill = 'var(--text-1)';
      svg.appendChild(v);
    }
    if (opts.centerLabel) {
      const l = txt(cx, cy + Math.round(size * 0.088), opts.centerLabel, {
        'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600,
      });
      l.style.fill = 'var(--muted)';
      svg.appendChild(l);
    }
    return svg;
  });
}

/* ============================================================
   2. Horizontal bars — ranked magnitude. ONE series = ONE color.
   ============================================================ */

export function barsH(host, items, opts = {}) {
  mount(host, (W) => {
    // Category names here are long ("Transient occupancy tax") and a phone is
    // narrow, so the label gets its own line above a full-width bar rather
    // than a cramped gutter that it would overrun.
    const rowH = opts.rowH || 44;
    const barH = 10;
    const valueW = 58;
    const H = items.length * rowH + 2;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H,
      role: 'img', 'aria-label': opts.ariaLabel || 'Bar chart',
    });

    const max = niceMax(Math.max(...items.map((d) => d.value), 1));
    const labelMax = Math.max(8, Math.floor((W - valueW - 8) / (12.5 * 0.55)));

    items.forEach((d, i) => {
      const y = i * rowH + 2;

      const label = d.label.length > labelMax ? d.label.slice(0, labelMax - 1) + '…' : d.label;
      const name = txt(0, y + 13, label, { 'font-size': 12.5 });
      name.style.fill = 'var(--text-2)';
      svg.appendChild(name);

      const val = txt(W, y + 13, fmt.money(d.value), {
        'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 650,
      });
      val.style.fill = 'var(--text-1)';
      val.style.fontVariantNumeric = 'tabular-nums';
      svg.appendChild(val);

      const w = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * W);
      const bar = el('path', { d: barPath(0, y + 22, w, barH, 4, 'right') });
      bar.style.fill = d.color || 'var(--series-1)';
      svg.appendChild(bar);

      const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' });
      hit.setAttribute('aria-label', `${d.label}: ${fmt.full(d.value)}`);
      svg.appendChild(pickable(hit, d, opts.onPick));
    });

    return svg;
  });
}

/* ============================================================
   3. Diverging bars — change vs baseline. Two poles + neutral zero.
   ============================================================ */

export function divergingBars(host, items, opts = {}) {
  mount(host, (W) => {
    const rowH = 32;
    const barH = 16;
    const labelW = Math.min(88, Math.round(W * 0.3));
    const valueW = 56;
    const H = items.length * rowH + 20;
    const plotL = labelW;
    const plotW = Math.max(40, W - labelW - valueW);
    const mid = plotL + plotW / 2;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H,
      role: 'img', 'aria-label': opts.ariaLabel || 'Change from baseline',
    });

    const max = niceMax(Math.max(...items.map((d) => Math.abs(d.value)), 1), 2) || 1;
    const half = plotW / 2;

    // Zero rule — a solid hairline, never dashed.
    const zero = el('line', { x1: mid, y1: 2, x2: mid, y2: H - 18, 'stroke-width': 1 });
    zero.style.stroke = 'var(--axis)';
    svg.appendChild(zero);

    items.forEach((d, i) => {
      const y = i * rowH + 2;
      const cy = y + rowH / 2;
      const len = Math.abs(d.value) / max * half;

      const name = txt(0, cy + 4, d.label, { 'font-size': 12 });
      name.style.fill = 'var(--text-2)';
      svg.appendChild(name);

      if (Math.abs(d.value) > 0.5) {
        const isCut = d.value < 0;
        const x = isCut ? mid - len : mid;
        const bar = el('path', {
          d: barPath(x, cy - barH / 2, len, barH, 4, isCut ? 'left' : 'right'),
        });
        bar.style.fill = isCut ? 'var(--pos)' : 'var(--neg)';
        svg.appendChild(bar);
      } else {
        const dot = el('circle', { cx: mid, cy, r: 2.5 });
        dot.style.fill = 'var(--muted)';
        svg.appendChild(dot);
      }

      const val = txt(W - 2, cy + 4, d.value === 0 ? '—' : fmt.signed(d.value), {
        'text-anchor': 'end', 'font-size': 12, 'font-weight': 650,
      });
      val.style.fill = d.value === 0 ? 'var(--muted)' : 'var(--text-1)';
      val.style.fontVariantNumeric = 'tabular-nums';
      svg.appendChild(val);

      const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' });
      hit.setAttribute('aria-label', `${d.label}: ${d.value === 0 ? 'unchanged' : fmt.full(d.value)}`);
      svg.appendChild(pickable(hit, d, opts.onPick));
    });

    const lo = txt(plotL + 4, H - 4, opts.leftLabel || 'Cut', { 'font-size': 10.5, 'font-weight': 600 });
    lo.style.fill = 'var(--muted)';
    const hi = txt(plotL + plotW - 4, H - 4, opts.rightLabel || 'Increase', {
      'font-size': 10.5, 'text-anchor': 'end', 'font-weight': 600,
    });
    hi.style.fill = 'var(--muted)';
    svg.appendChild(lo); svg.appendChild(hi);

    return svg;
  });
}

/* ============================================================
   4. Multi-line — change over time. ONE y-axis, always.
   ============================================================ */

export function lines(host, series, categories, opts = {}) {
  mount(host, (W) => {
    const padL = 42, padR = 14, padT = 14, padB = 30;
    const H = opts.height || 190;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H,
      role: 'img', 'aria-label': opts.ariaLabel || 'Line chart over time',
    });

    const all = series.flatMap((s) => s.values);
    const rawMax = Math.max(...all);
    const rawMin = Math.min(...all);

    // When every value sits in a narrow band far above zero, a zero-based axis
    // flattens the one thing the chart is for — the gap between the lines. Pad
    // around the data and snap both ends to round numbers instead.
    let min, max, step;
    const ticks = 4;
    if (opts.zeroBased === false && rawMin > 0 && (rawMax - rawMin) < rawMax * 0.5) {
      const pad = Math.max((rawMax - rawMin) * 0.45, rawMax * 0.04);
      step = niceStep(((rawMax + pad) - (rawMin - pad)) / ticks);
      min = Math.max(0, Math.floor((rawMin - pad) / step) * step);
      max = min + step * ticks;
      while (max < rawMax) { max += step; }
    } else {
      min = 0;
      max = niceMax(rawMax, ticks);
      step = (max - min) / ticks;
    }

    const X = (i) => padL + (categories.length === 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
    const Y = (v) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;

    // Gridlines: hairline, solid, recessive.
    for (let v = min; v <= max + 1e-6; v += step) {
      const y = Y(v);
      const t = v === min ? 0 : 1;
      const g = el('line', { x1: padL, y1: y, x2: W - padR, y2: y, 'stroke-width': 1 });
      g.style.stroke = t === 0 ? 'var(--axis)' : 'var(--grid)';
      svg.appendChild(g);
      const lab = txt(padL - 7, y + 3.5, fmt.money(v, v >= 1e6 && v % 1e6 ? 1 : 0), { 'text-anchor': 'end', 'font-size': 10.5 });
      lab.style.fill = 'var(--muted)';
      lab.style.fontVariantNumeric = 'tabular-nums';
      svg.appendChild(lab);
    }

    categories.forEach((c, i) => {
      const lab = txt(X(i), H - 9, c, {
        'text-anchor': i === 0 ? 'start' : i === categories.length - 1 ? 'end' : 'middle',
        'font-size': 10.5,
      });
      lab.style.fill = 'var(--muted)';
      svg.appendChild(lab);
    });

    // The band between the two lines IS the deficit. Shade it, and let the
    // shading change colour where the lines cross so the sign is never
    // carried by position alone.
    if (opts.band && series.length === 2) {
      const [A, B] = series;
      const quad = (x0, ya0, yb0, x1, ya1, yb1, positive) => {
        const q = el('path', {
          d: `M${x0},${ya0} L${x1},${ya1} L${x1},${yb1} L${x0},${yb0} Z`, stroke: 'none',
        });
        q.style.fill = positive ? 'var(--pos)' : 'var(--neg)';
        q.style.opacity = '.14';
        svg.appendChild(q);
      };
      for (let i = 0; i < A.values.length - 1; i++) {
        const d0 = A.values[i] - B.values[i];
        const d1 = A.values[i + 1] - B.values[i + 1];
        const x0 = X(i), x1 = X(i + 1);
        if (d0 === 0 && d1 === 0) continue;
        if (d0 >= 0 === d1 >= 0) {
          quad(x0, Y(A.values[i]), Y(B.values[i]), x1, Y(A.values[i + 1]), Y(B.values[i + 1]), d0 >= 0);
        } else {
          const t = d0 / (d0 - d1);
          const xc = x0 + (x1 - x0) * t;
          const yc = Y(A.values[i] + (A.values[i + 1] - A.values[i]) * t);
          quad(x0, Y(A.values[i]), Y(B.values[i]), xc, yc, yc, d0 >= 0);
          quad(xc, yc, yc, x1, Y(A.values[i + 1]), Y(B.values[i + 1]), d1 >= 0);
        }
      }
    }

    series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ');
      const line = el('path', {
        d, fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      });
      line.style.stroke = s.color;
      svg.appendChild(line);
    });

    // Markers carry a 2px surface ring so they stay legible where lines cross.
    series.forEach((s) => {
      s.values.forEach((v, i) => {
        const m = el('circle', { cx: X(i), cy: Y(v), r: 4.5, 'stroke-width': 2 });
        m.style.fill = s.color;
        m.style.stroke = 'var(--surface-1)';
        svg.appendChild(m);
      });
    });

    // Direct-label the endpoints only — never a number on every point. When the
    // lines converge, the labels would overlap; put one above its own marker
    // and one below rather than stacking them away from their lines.
    {
      const ends = series.map((s) => ({ s, i: s.values.length - 1, v: s.values[s.values.length - 1] }));
      ends.forEach((e) => { e.y = Y(e.v); });
      const collide = ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 22;
      const hiFirst = ends.length === 2 && ends[0].y <= ends[1].y;
      ends.forEach((e, k) => {
        let dy = -11;
        if (collide) dy = (k === 0) === hiFirst ? -11 : 17;
        const t = txt(X(e.i), e.y + dy, fmt.money(e.v), {
          'text-anchor': 'end', 'font-size': 11.5, 'font-weight': 650,
        });
        t.style.fill = 'var(--text-1)';
        t.style.fontVariantNumeric = 'tabular-nums';
        svg.appendChild(t);
      });
    }

    // Column-wide hit targets — the whole year, not just the dot.
    if (opts.onPick) {
      categories.forEach((c, i) => {
        const w = plotW / categories.length;
        const hit = el('rect', {
          x: padL + i * w - (i === 0 ? padL : 0), y: 0,
          width: w + (i === 0 || i === categories.length - 1 ? padL : 0), height: H,
          fill: 'transparent',
        });
        svg.appendChild(pickable(hit, {
          index: i, label: c,
          values: series.map((s) => ({ name: s.name, value: s.values[i], color: s.color })),
        }, opts.onPick));
      });
    }

    return svg;
  });
}

/* ============================================================
   5. Waterfall — how a total was reached, step by step.
   ============================================================ */

export function waterfall(host, steps, opts = {}) {
  mount(host, (W) => {
    const padT = 18, padB = 46;
    const H = opts.height || 200;
    const plotH = H - padT - padB;
    const n = steps.length;
    const slot = W / n;
    const barW = Math.min(24, slot - 10);

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H,
      role: 'img', 'aria-label': opts.ariaLabel || 'Waterfall chart',
    });

    // Running totals.
    let run = 0;
    const bars = steps.map((s) => {
      if (s.total) { const b = { ...s, from: 0, to: s.value }; run = s.value; return b; }
      const from = run; run += s.value;
      return { ...s, from, to: run };
    });

    const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
    const hi = Math.max(0, ...bars.map((b) => Math.max(b.from, b.to)));
    const span = (hi - lo) || 1;
    const Y = (v) => padT + plotH - ((v - lo) / span) * plotH;

    const zeroY = Y(0);
    const zero = el('line', { x1: 0, y1: zeroY, x2: W, y2: zeroY, 'stroke-width': 1 });
    zero.style.stroke = 'var(--axis)';
    svg.appendChild(zero);

    bars.forEach((b, i) => {
      const cx = slot * i + slot / 2;
      const x = cx - barW / 2;
      const yTop = Math.min(Y(b.from), Y(b.to));
      const h = Math.max(2, Math.abs(Y(b.to) - Y(b.from)));
      const rising = b.to >= b.from;

      const p = el('path', {
        d: barPath(x, yTop, barW, h, 4, b.total ? 'top' : (rising ? 'top' : 'bottom')),
      });
      p.style.fill = b.total ? 'var(--series-7)' : (b.value < 0 ? 'var(--pos)' : 'var(--neg)');
      svg.appendChild(p);

      // Connector to the next bar — hairline, solid.
      if (i < bars.length - 1 && !bars[i + 1].total) {
        const y = Y(b.to);
        const c = el('line', {
          x1: cx + barW / 2, y1: y, x2: slot * (i + 1) + slot / 2 - barW / 2, y2: y,
          'stroke-width': 1,
        });
        c.style.stroke = 'var(--grid)';
        svg.appendChild(c);
      }

      const vt = txt(cx, yTop - 6, b.total ? fmt.money(b.value) : fmt.signed(-b.value), {
        'text-anchor': 'middle', 'font-size': 11, 'font-weight': 650,
      });
      vt.style.fill = 'var(--text-1)';
      vt.style.fontVariantNumeric = 'tabular-nums';
      svg.appendChild(vt);

      // Two-line wrapped category label.
      const words = String(b.label).split(' ');
      const l1 = [], l2 = [];
      let cur = l1;
      words.forEach((wd) => {
        if (cur === l1 && l1.join(' ').length + wd.length > 9) cur = l2;
        cur.push(wd);
      });
      [l1.join(' '), l2.join(' ')].forEach((line, k) => {
        if (!line) return;
        const t = txt(cx, H - 28 + k * 12, line, { 'text-anchor': 'middle', 'font-size': 10 });
        t.style.fill = 'var(--muted)';
        svg.appendChild(t);
      });

      const hit = el('rect', { x: slot * i, y: 0, width: slot, height: H, fill: 'transparent' });
      hit.setAttribute('aria-label', `${b.label}: ${fmt.full(Math.abs(b.value))}`);
      svg.appendChild(pickable(hit, b, opts.onPick));
    });

    return svg;
  });
}

/* ============================================================
   6. Stacked comparison bar — two totals side by side.
   ============================================================ */

export function stackPair(host, pair, opts = {}) {
  mount(host, (W) => {
    const H = opts.height || 148;
    const labelH = 22;
    const barH = Math.min(24, (H - labelH * 2 - 16) / 2);
    const padL = 0;
    const plotW = W;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H,
      role: 'img', 'aria-label': opts.ariaLabel || 'Stacked comparison',
    });

    const max = Math.max(pair[0].total, pair[1].total) || 1;
    const GAP = 2; // the 2px surface gap between touching fills

    pair.forEach((row, ri) => {
      const yLab = ri * (barH + labelH + 14) + 12;
      const y = yLab + 8;

      const name = txt(padL, yLab, row.label, { 'font-size': 12, 'font-weight': 600 });
      name.style.fill = 'var(--text-2)';
      svg.appendChild(name);

      const tot = txt(W, yLab, fmt.money(row.total), {
        'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700,
      });
      tot.style.fill = 'var(--text-1)';
      tot.style.fontVariantNumeric = 'tabular-nums';
      svg.appendChild(tot);

      const fullW = (row.total / max) * plotW;
      let x = padL;
      row.parts.forEach((p, pi) => {
        const w = (p.value / (row.total || 1)) * fullW;
        const isLast = pi === row.parts.length - 1;
        const drawW = Math.max(0, isLast ? w : w - GAP);
        if (drawW <= 0) { x += w; return; }
        const seg = el('path', {
          d: barPath(x, y, drawW, barH, 4, isLast ? 'right' : (pi === 0 ? 'left' : 'none')),
        });
        seg.style.fill = p.color;
        seg.setAttribute('aria-label', `${row.label} ${p.label}: ${fmt.full(p.value)}`);
        svg.appendChild(pickable(seg, { ...p, row: row.label }, opts.onPick));
        x += w;
      });
    });

    return svg;
  });
}

export { niceMax };
