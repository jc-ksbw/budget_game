/* ============================================================
   ui.js — component builders. Each returns a DOM node and calls
   back on change. Touch targets are >=40px; the slider owns its
   gestures via Pointer Events so dragging never scrolls the page.
   ============================================================ */

import { fmt } from './charts.js';
import { meterStatus } from './engine.js';

export const SERIES = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
];

export function h(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}

const icon = (d, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.innerHTML = d;
  return s;
};

export const ICONS = {
  check:  '<path d="M4 12.5l5.5 5.5L20 6.5"/>',
  shield: '<path d="M12 22s8-3.6 8-10V5.5L12 2.5 4 5.5V12c0 6.4 8 10 8 10z"/>',
  road:   '<path d="M4 22L7 2h10l3 20M12 4v3M12 11v3M12 18v3"/>',
  tree:   '<path d="M12 22v-5M12 17l-5-3h10l-5 3zM12 2L6.5 11h11L12 2z"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0113 0M17 11.5a3 3 0 100-6M18 20a6 6 0 00-2.2-4.6"/>',
  scale:  '<path d="M12 3v18M4 7h16M6.5 7l-3 6a3.5 3.5 0 007 0zM17.5 7l-3 6a3.5 3.5 0 007 0z"/>',
  good:   '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  warning:'<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  serious:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.2v.3"/>',
  critical:'<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
};

/* ============================================================
   Department slider
   ============================================================ */

export function deptSlider(dept, pct, color, onChange) {
  const amount = dept.baseline * (pct / 100);
  const delta = amount - dept.baseline;
  const deltaPct = pct - 100;

  const amtEl   = h('div', { class: 'dept-amt num', text: fmt.full(amount) });
  const deltaEl = h('div', {
    class: 'dept-delta ' + (deltaPct < 0 ? 'is-cut' : deltaPct > 0 ? 'is-add' : 'is-flat'),
    text: deltaPct === 0 ? 'At baseline' : `${deltaPct > 0 ? '+' : ''}${deltaPct}% · ${fmt.signed(delta)}`,
  });

  const fill  = h('div', { class: 'slider-fill' });
  const thumb = h('div', { class: 'slider-thumb' });
  const base  = h('div', { class: 'slider-base' });
  const track = h('div', { class: 'slider-track' }, [fill]);

  const slider = h('div', {
    class: 'slider', role: 'slider', tabindex: '0',
    'aria-label': `${dept.name} funding level`,
    'aria-valuemin': dept.minPct, 'aria-valuemax': dept.maxPct,
  }, [track, base, thumb]);

  const warn = h('div', { class: 'dept-warn', hidden: true });

  const minus = h('button', { class: 'step', 'aria-label': `Reduce ${dept.name} funding`, text: '−' });
  const plus  = h('button', { class: 'step', 'aria-label': `Increase ${dept.name} funding`, text: '+' });

  const span = dept.maxPct - dept.minPct;

  function paint(v) {
    const frac = (v - dept.minPct) / span;
    const baseFrac = (100 - dept.minPct) / span;
    thumb.style.left = `${frac * 100}%`;
    base.style.left = `${baseFrac * 100}%`;

    // The fill runs from the baseline marker to the thumb, so the
    // direction of the change reads at a glance.
    const lo = Math.min(frac, baseFrac), hi = Math.max(frac, baseFrac);
    fill.style.left = `${lo * 100}%`;
    fill.style.width = `${(hi - lo) * 100}%`;
    fill.style.background = v < 100 ? 'var(--pos)' : v > 100 ? 'var(--neg)' : 'transparent';

    const amt = dept.baseline * (v / 100);
    const d = amt - dept.baseline, dp = v - 100;
    amtEl.textContent = fmt.full(amt);
    deltaEl.className = 'dept-delta ' + (dp < 0 ? 'is-cut' : dp > 0 ? 'is-add' : 'is-flat');
    deltaEl.textContent = dp === 0 ? 'At baseline' : `${dp > 0 ? '+' : ''}${dp}% · ${fmt.signed(d)}`;

    slider.setAttribute('aria-valuenow', v);
    slider.setAttribute('aria-valuetext', `${v}% of baseline, ${fmt.full(amt)}`);

    if (dp <= -12) { warn.hidden = false; warn.textContent = dept.cutNarrative; }
    else if (dp >= 8) { warn.hidden = false; warn.textContent = dept.raiseNarrative; }
    else warn.hidden = true;

    minus.disabled = v <= dept.minPct;
    plus.disabled = v >= dept.maxPct;
  }

  const clampV = (v) => Math.max(dept.minPct, Math.min(dept.maxPct, Math.round(v)));
  const set = (v) => { const c = clampV(v); paint(c); onChange(c); };

  const fromX = (clientX) => {
    const r = track.getBoundingClientRect();
    return dept.minPct + ((clientX - r.left) / r.width) * span;
  };

  let dragging = false;
  slider.addEventListener('pointerdown', (e) => {
    dragging = true;
    slider.classList.add('is-dragging');
    slider.setPointerCapture(e.pointerId);
    set(fromX(e.clientX));
    e.preventDefault();
  });
  slider.addEventListener('pointermove', (e) => { if (dragging) set(fromX(e.clientX)); });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove('is-dragging');
    try { slider.releasePointerCapture(e.pointerId); } catch {}
  };
  slider.addEventListener('pointerup', end);
  slider.addEventListener('pointercancel', end);

  slider.addEventListener('keydown', (e) => {
    const cur = +slider.getAttribute('aria-valuenow');
    const big = e.shiftKey ? 10 : 1;
    const map = {
      ArrowLeft: -big, ArrowDown: -big, ArrowRight: big, ArrowUp: big,
      PageDown: -10, PageUp: 10, Home: dept.minPct - cur, End: dept.maxPct - cur,
    };
    if (map[e.key] === undefined) return;
    e.preventDefault();
    set(cur + map[e.key]);
  });

  minus.addEventListener('click', () => set(+slider.getAttribute('aria-valuenow') - 1));
  plus.addEventListener('click', () => set(+slider.getAttribute('aria-valuenow') + 1));

  const node = h('div', { class: 'dept' }, [
    h('div', { class: 'dept-head' }, [
      h('div', { class: 'dept-swatch', style: `background:${color}` }),
      h('div', { class: 'dept-name', text: dept.name }),
      amtEl,
    ]),
    h('div', { class: 'dept-meta' }, [
      h('div', { class: 'dept-blurb', text: dept.blurb }),
      deltaEl,
    ]),
    h('div', { class: 'slider-row' }, [minus, slider, plus]),
    h('div', { class: 'dept-scale' }, [
      h('span', { text: `${dept.minPct}%` }),
      // sits under the baseline tick, not at the midpoint of the row
      h('span', {
        class: 'dept-scale-base', text: 'baseline',
        style: `left:${((100 - dept.minPct) / span) * 100}%`,
      }),
      h('span', { text: `${dept.maxPct}%` }),
    ]),
    warn,
  ]);

  paint(pct);
  return node;
}

/* ============================================================
   Policy action card
   ============================================================ */

export function actionCard(action, selected, meterNames, onToggle) {
  const tags = [];

  tags.push(h('span', {
    class: 'tag' + (action.type === 'onetime' ? ' is-onetime' : ''),
    text: action.type === 'onetime' ? 'One-time money' : 'Recurring',
  }));

  if (action.needsBallot) {
    tags.push(h('span', { class: 'tag is-ballot' },
      [`Needs voters · ${Math.round((action.passChance ?? .5) * 100)}% odds`]));
  }
  if (action.realWorld) {
    tags.push(h('span', { class: 'tag is-real' }, ['Actually happened']));
  }

  Object.entries(action.effects || {}).forEach(([k, v]) => {
    if (!v) return;
    tags.push(h('span', { class: 'tag is-harm' }, [
      h('span', {
        class: 'tag-dot',
        style: `background:${v < 0 ? 'var(--critical)' : 'var(--good)'}`,
      }),
      `${meterNames[k]} ${v > 0 ? '+' : ''}${v}`,
    ]));
  });

  const check = h('div', { class: 'action-check' }, [icon(ICONS.check, 14)]);

  const btn = h('button', {
    class: 'action', type: 'button',
    'aria-pressed': selected ? 'true' : 'false',
  }, [
    h('div', { class: 'action-top' }, [
      check,
      h('div', { class: 'action-body' }, [
        h('div', { class: 'action-name', text: action.name }),
        h('div', { class: 'action-desc', text: action.desc }),
      ]),
      h('div', { class: 'action-amt num', text: '+' + fmt.money(action.amount) }),
    ]),
    h('div', { class: 'tags' }, tags),
    action.consequence && h('div', {
      class: 'action-more' + (action.realWorld ? ' is-real' : ''),
      html: (action.realNote ? `<b>${action.realNote}</b> ` : '') + action.consequence,
    }),
  ]);

  btn.addEventListener('click', () => onToggle(action.id));
  return btn;
}

/* ============================================================
   Meters
   ============================================================ */

export function meterRow(def, value, startValue) {
  const st = meterStatus(value);
  const fill = h('div', {
    class: 'meter-fill',
    style: `width:${value}%;background:${st.color}`,
  });
  const track = h('div', { class: 'meter-track' }, [fill]);

  // Ghost marker = where this meter started, so the change is legible.
  if (Math.abs(value - startValue) > 1) {
    track.appendChild(h('div', { class: 'meter-ghost', style: `left:${startValue}%` }));
  }

  return h('div', { class: 'meter' }, [
    h('div', { class: 'meter-top' }, [
      h('span', { class: 'meter-icon' }, [icon(ICONS[def.icon] || ICONS.shield, 18)]),
      h('div', { class: 'meter-name', text: def.name }),
      h('div', { class: 'meter-val', style: `color:${st.color}` }, [`${value} · ${st.label}`]),
    ]),
    track,
  ]);
}

/* ============================================================
   Community voice row. `rank` is 1-based once revealed, since the
   list is ordered by how well the budget sat with each of them.
   ============================================================ */

export function communityRow(member, revealed, rank) {
  const mood = revealed ? (member.liked ? 'is-yes' : 'is-no') : '';
  return h('div', { class: 'cm' }, [
    h('div', { class: `cm-face ${mood}`, text: revealed ? String(rank) : '?' }),
    h('div', { class: 'cm-body' }, [
      h('div', { class: 'cm-name', text: member.name }),
      h('div', { class: 'cm-role', text: member.role }),
      h('div', {
        class: 'cm-line',
        text: revealed ? `“${member.liked ? member.likedLine : member.dislikedLine}”` : `“${member.line}”`,
      }),
    ]),
    revealed && h('div', { class: `cm-vote ${mood}`, text: member.liked ? 'Liked' : 'Disliked' }),
  ]);
}

/* ============================================================
   Verdict line
   ============================================================ */

export function verdictRow(v) {
  return h('div', { class: `verdict is-${v.level}` }, [
    h('span', { class: 'verdict-icon' }, [icon(ICONS[v.level] || ICONS.good, 18)]),
    h('div', { html: v.text }),
  ]);
}

export { icon };
