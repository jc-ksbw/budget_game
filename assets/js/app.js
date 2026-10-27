/* ============================================================
   app.js — screens, panels, state wiring.
   ============================================================ */

import { BUDGET, ACTIONS } from './data.gen.js';
import * as C from './charts.js';
import * as E from './engine.js';
import { h, SERIES, deptSlider, actionCard, financingCard, meterRow, communityRow, verdictRow, icon, ICONS } from './ui.js';

const $ = (id) => document.getElementById(id);
const fmt = C.fmt;

const DEPTS = BUDGET.generalFund.departments;
const DEPT_COLOR = {};
DEPTS.forEach((d, i) => { DEPT_COLOR[d.id] = SERIES[i % SERIES.length]; });

const METER_NAMES = {};
ACTIONS.meta.meters.forEach((m) => { METER_NAMES[m.id] = m.name; });

let state = E.createState(BUDGET, ACTIONS);
let activePanel = 'budget';
let statusFilter = 'all';

/* ---------- theme ---------- */
(function theme() {
  const saved = (() => { try { return localStorage.getItem('bh-theme'); } catch { return null; } })();
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  $('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const isDark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bh-theme', next); } catch {}
  });
})();

/* ---------- scoreboard ---------- */

function updateBoard() {
  const t = E.totals(state, BUDGET, ACTIONS);
  const gapEl = $('board-gap');
  const label = $('board-label');

  if (t.cashGap > 0) {
    gapEl.textContent = fmt.money(t.cashGap);
    gapEl.className = 'board-gap num ' + (t.cashGap < t.startGap * 0.25 ? 'is-close' : 'is-gap');
    label.textContent = 'Still to close';
  } else if (t.cashGap === 0) {
    gapEl.textContent = 'Balanced';
    gapEl.className = 'board-gap num is-balanced';
    label.textContent = 'General fund';
  } else {
    gapEl.textContent = fmt.money(-t.cashGap);
    gapEl.className = 'board-gap num is-balanced';
    label.textContent = 'Surplus / reserve';
  }

  $('board-exp').textContent = fmt.money(t.ongoingExp);
  $('board-rev').textContent = fmt.money(t.ongoingRev + t.oneTime);

  const pct = Math.max(0, Math.min(140, (t.closed / t.startGap) * 100));
  const bar = $('board-progress');
  bar.style.width = Math.min(100, pct) + '%';
  bar.className = 'progress-fill' + (t.cashGap < 0 ? ' is-over' : t.cashGap === 0 ? ' is-balanced' : '');
  bar.parentElement.setAttribute('aria-valuenow', Math.round(pct));

  const cuts = t.picked.filter((a) => a.category !== 'revenue').length;
  const rev = t.picked.filter((a) => a.category === 'revenue').length;
  badge('badge-cuts', cuts);
  badge('badge-revenue', rev);
}

function badge(id, n) {
  const b = $(id);
  b.hidden = n === 0;
  b.textContent = n;
}

/* ---------- state changes ---------- */

function changed() {
  updateBoard();
  if (activePanel === 'budget') refreshBudgetChart();
  if (activePanel === 'impact') renderImpact();
  if (activePanel === 'community') renderCommunity();
}

function toggleAction(id) {
  const a = ACTIONS.actions.find((x) => x.id === id);
  if (a && (a.locked || a.rescinded)) return;   // settled in the real world, either way
  if (state.chosen.has(id)) state.chosen.delete(id);
  else state.chosen.add(id);
  document.querySelectorAll(`[data-action="${id}"]`).forEach((n) => {
    n.setAttribute('aria-pressed', state.chosen.has(id) ? 'true' : 'false');
  });
  changed();
}

/* ============================================================
   Panel: Budget
   ============================================================ */

let budgetChartHost, budgetReadout;

function renderBudget() {
  const p = $('panel-budget');
  const t = E.totals(state, BUDGET, ACTIONS);

  budgetChartHost = h('div', { class: 'chart-wrap' });
  budgetReadout = h('div', { class: 'readout is-empty', text: 'Tap a slice for the department total.' });

  const sliders = h('div', { class: 'card' }, DEPTS.map((d) =>
    deptSlider(d, state.deptPct[d.id], DEPT_COLOR[d.id], (v) => {
      state.deptPct[d.id] = v;
      changed();
    })
  ));

  const lockedCuts = ACTIONS.actions.filter((a) => a.locked);
  const lockedMoney = lockedCuts.reduce((n, a) => n + (a.amountKnown ? a.amount : 0), 0);

  setChildren(p, [
    h('div', { class: 'panel-head' }, [
      h('h2', { text: 'General fund spending' }),
      h('p', { text: 'Drag to change what each department gets. The floors are set where a department stops being able to do its job.' }),
    ]),
    lockedCuts.length ? h('div', { class: 'callout', html: lockedMoney
      ? `The adopted budget opened <b>${fmt.full(t.startGap)}</b> short. The City has already acted on `
        + `<b>${lockedCuts.length}</b> of the measures below, worth about <b>${fmt.money(lockedMoney)}</b>, `
        + `so you start with <b>${fmt.full(Math.max(0, t.cashGap))}</b> left to close. Those measures are `
        + `locked on &mdash; they have happened.`
      : `The adopted budget opened <b>${fmt.full(t.startGap)}</b> short, and that is where you start. `
        + `${lockedCuts.length === 1 ? 'One measure below has' : `${lockedCuts.length} measures below have`} `
        + `already been carried out and ${lockedCuts.length === 1 ? 'is' : 'are'} locked on, but the City has `
        + `published no savings figure for ${lockedCuts.length === 1 ? 'it' : 'them'}, so the gap is still the `
        + `full adopted one.` }) : null,
    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['Where the money goes']),
      h('div', { class: 'chart-sub', text: lockedMoney
        ? 'Department budgets, as you have them now. The citywide measures below are not in this ring, because they are not charged to one department \u2014 which is why the banner above reads lower.'
        : 'Share of general fund spending, as you have it now.' }),
      budgetChartHost,
      budgetReadout,
      legendFor(DEPTS.map((d) => ({ label: d.short, color: DEPT_COLOR[d.id] }))),
    ]),
    sliders,
    h('div', { class: 'source-note', html:
      '<b>About these figures.</b> Every department total here is taken from the City of Hollister\'s published FY 2026-27 Approved Budget and sums exactly to its $56,588,184 General Fund expense total. The policy options on the other tabs are game-design estimates — see SOURCES.md.' }),
  ]);

  refreshBudgetChart();
}

function refreshBudgetChart() {
  if (!budgetChartHost) return;
  const segs = DEPTS.map((d) => ({
    id: d.id,
    label: d.name,
    value: d.baseline * (state.deptPct[d.id] / 100),
    color: DEPT_COLOR[d.id],
  })).filter((s) => s.value > 0);

  const total = segs.reduce((s, x) => s + x.value, 0);

  C.donut(budgetChartHost, segs, {
    centerValue: fmt.money(total),
    centerLabel: 'total spending',
    ariaLabel: 'General fund spending by department',
    onPick: (d) => {
      const share = (d.value / total * 100).toFixed(1);
      budgetReadout.className = 'readout';
      budgetReadout.replaceChildren(
        h('span', { class: 'readout-key', style: `background:${d.color}` }),
        h('span', { html: `<b>${d.label}</b> — ${fmt.full(d.value)} · ${share}% of spending` }),
      );
    },
  });
}

function legendFor(items) {
  return h('div', { class: 'legend' }, items.map((i) =>
    h('span', { class: 'legend-item' }, [
      h('span', { class: 'legend-key' + (i.line ? ' is-line' : ''), style: `background:${i.color}` }),
      i.label,
    ])
  ));
}

/* ============================================================
   Panels: Cuts & Revenue
   ============================================================ */

function renderActionPanel(which) {
  const p = $(which === 'cuts' ? 'panel-cuts' : 'panel-revenue');
  const isCuts = which === 'cuts';

  let list = ACTIONS.actions.filter((a) =>
    isCuts ? a.category !== 'revenue' : a.category === 'revenue');

  if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter);

  // Adopted first, then discussed, then exploratory; published figures ahead
  // of unpublished ones inside each group.
  const rank = { adopted: 0, discussed: 1, exploratory: 2, benchmark: 3 };
  list = list.slice().sort((a, b) =>
    (rank[a.status] - rank[b.status]) ||
    (Number(b.amountKnown) - Number(a.amountKnown)) ||
    ((b.amount || 0) - (a.amount || 0)));

  const head = h('div', { class: 'panel-head' }, [
    h('h2', { text: isCuts ? 'Savings and one-time money' : 'Revenue options' }),
    h('p', { text: isCuts
      ? 'Reductions, deferrals and borrowing. The one-time options close this year and reopen next year.'
      : 'What the City has on the record, plus revenue tools other California cities use that Hollister has not proposed.' }),
  ]);

  const kids = [head];

  kids.push(h('div', { class: 'filter-row' }, [
    ['all', 'All'], ['adopted', 'Adopted'], ['discussed', 'Discussed'], ['benchmark', 'Common elsewhere'],
  ].map(([k, label]) => h('button', {
    class: 'chip', 'aria-pressed': statusFilter === k ? 'true' : 'false', text: label,
    onclick: () => { statusFilter = k; renderActionPanel(which); },
  }))));

  // Financing is not an option on the board: it is shown, never chosen.
  if (!isCuts) {
    (ACTIONS.financing || []).forEach((f) => kids.push(financingCard(f)));
  }

  // A rescinded measure has no figure because it was reversed, not because
  // nobody published one — it does not belong in this count.
  const unpub = list.filter((a) => !a.amountKnown && !a.rescinded).length;
  if (unpub) {
    kids.push(h('div', { class: 'callout is-warning', html:
      `<b>${unpub} of these ${list.length}</b> have no published savings or revenue figure. They are real measures, but they cannot move the deficit, because nobody has put a number on them.` }));
  }

  list.forEach((a) => {
    const card = actionCard(a, state.chosen.has(a.id), METER_NAMES, toggleAction, ACTIONS.meta.statuses, ACTIONS.meta.amountKinds);
    card.setAttribute('data-action', a.id);
    kids.push(card);
  });

  p.replaceChildren(...kids);
}

/* ============================================================
   Panel: Impact
   ============================================================ */

/** replaceChildren() renders a null child as the literal text "null". */
function setChildren(el, kids) {
  el.replaceChildren(...kids.filter(Boolean));
}

/** "FY 2026-27" -> "FY27", for axes too narrow for the full label. */
const shortYear = (y) => String(y).replace(/^FY\s*\d{4}-/, 'FY');

function renderImpact() {
  const p = $('panel-impact');
  const t = E.totals(state, BUDGET, ACTIONS);
  const m = E.meters(state, BUDGET, ACTIONS);
  const proj = E.projection(state, BUDGET, ACTIONS);

  /* --- service meters --- */
  const lockedTotal = ACTIONS.actions
    .reduce((n, a) => n + (a.locked && a.amountKnown ? a.amount : 0), 0);

  const metersCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['What residents will notice']),
    h('div', { class: 'chart-sub', text: 'The notch on each bar is where you started.' }),
    ...ACTIONS.meta.meters.map((def) => meterRow(def, m[def.id], state.startMeters[def.id])),
  ]);

  /* --- department change --- */
  const changeHost = h('div', { class: 'chart-wrap' });
  const changed_ = DEPTS.map((d) => ({
    label: d.short,
    value: d.baseline * (state.deptPct[d.id] / 100) - d.baseline,
  }));
  const changeCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['Change from the adopted budget']),
    h('div', { class: 'chart-sub', text: 'Department funding against the baseline you inherited.' }),
    changeHost,
    legendFor([
      { label: 'Cut', color: 'var(--pos)' },
      { label: 'Increase', color: 'var(--neg)' },
    ]),
  ]);

  /* --- revenue --- */
  const revHost = h('div', { class: 'chart-wrap' });
  const revReadout = h('div', { class: 'readout is-empty', text: 'Tap a bar for the exact amount.' });
  const addedRev = ACTIONS.actions.some((a) => a.category === 'revenue' && state.chosen.has(a.id));
  const revCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['Where the money comes from']),
    h('div', { class: 'chart-sub', text: 'Recurring general fund revenue, largest first.' }),
    revHost,
    addedRev ? legendFor([
      { label: 'Existing revenue', color: 'var(--series-1)' },
      { label: 'Added by you', color: 'var(--series-3)' },
    ]) : null,
    revReadout,
  ]);

  /* --- three-year outlook --- */
  const projHost = h('div', { class: 'chart-wrap' });
  const projReadout = h('div', { class: 'readout is-empty', text: 'Tap a year to compare.' });
  const lastYr = proj.gaps.length - 1;
  const yEnd = proj.gaps[lastYr];
  const projCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, [`${proj.years.length}-year outlook`]),
    h('div', { class: 'chart-sub', html:
      `Costs grow about <b>4.2%</b> a year, revenue about <b>2.2%</b>. One-time money lands in year one only. The shaded band is the gap.` }),
    projHost,
    legendFor([
      { label: 'Revenue', color: 'var(--series-1)', line: true },
      { label: 'Spending', color: 'var(--series-2)', line: true },
      { label: 'Covered', color: 'var(--pos)' },
      { label: 'Short', color: 'var(--neg)' },
    ]),
    projReadout,
    h('div', { class: 'callout ' + (yEnd > 3e6 ? 'is-critical' : yEnd > 0 ? 'is-warning' : ''), html:
      yEnd > 0
        ? `By <b>${proj.years[lastYr]}</b> this plan projects a <b>${fmt.money(yEnd)}</b> gap. ${t.structurallyBalanced ? 'Even a structurally balanced budget erodes when costs outgrow revenue.' : 'The structural problem has not been solved.'}`
        : `<b>${proj.years[lastYr]}</b> still projects in the black. That is a genuinely durable fix.` }),
  ]);

  /* --- how the gap was closed --- */
  const wfCard = buildWaterfall(t);

  /* --- the two deficit figures, kept apart --- */
  const rv = BUDGET.revisedDeficit;
  const srcLine = (x) => h('span', { class: 'src' }, [
    h('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.title }),
    h('span', { class: 'src-meta', text: ` — ${x.publisher}, ${x.date}` }),
  ]);
  const figuresCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['Which deficit figure is which']),
    h('table', { class: 'dt', style: 'margin-top:8px' }, [
      h('tbody', {}, [
        h('tr', {}, [
          h('td', { text: BUDGET.generalFund.deficitLabel }),
          h('td', { class: 'neg', text: fmt.full(BUDGET.generalFund.structuralDeficit) }),
        ]),
        h('tr', {}, [
          h('td', { text: rv.label + ' (' + rv.asOfPeriod + ')' }),
          h('td', { class: 'neg', text: fmt.full(rv.amount) }),
        ]),
        ...(lockedTotal ? [h('tr', {}, [
          h('td', { text: 'Measures the City has already carried out, as this game sizes them' }),
          h('td', { class: 'pos', text: fmt.full(lockedTotal) }),
        ])] : []),
        ...(ACTIONS.financing || []).flatMap((f) => f.advances
          .filter((a) => /general fund/i.test(a.fund))
          .map((a) => h('tr', { class: 'is-muted' }, [
            h('td', { text: f.label + ' to the General Fund (' + f.asOfLabel + ') \u2014 borrowed cash, in no figure above' }),
            h('td', { class: 'num', text: fmt.full(a.amount) }),
          ]))),
      ]),
    ]),
    (ACTIONS.financing || []).length ? h('div', { class: 'basis', style: 'margin-left:0', text:
      'The interfund loan is financing, not revenue. It is repayable by '
      + ACTIONS.financing[0].dueDate + ', so it is kept out of every figure in this table and out of '
      + 'the game\u2019s totals. See the Revenue tab for the full terms.' }) : null,
    h('div', { class: 'basis', style: 'margin-left:0', text: rv.note }),
    h('div', { class: 'basis', style: 'margin-left:0', text: rv.labelDiscrepancy }),
    h('div', { class: 'srcs', style: 'margin-left:0' }, [
      h('div', { class: 'srcs-label', text: 'Sources' }),
      srcLine(BUDGET.generalFund.deficitSource),
      ...rv.sources.map(srcLine),
    ]),
  ]);

  /* --- conditional scenario, only when one is picked --- */
  let scenarioCard = null;
  if (t.scenarioRevenue > 0) {
    const conds = t.picked.filter((a) => a.conditional && a.scenario);
    scenarioCard = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['Conditional scenario']),
      h('div', { class: 'chart-sub', text: 'What the gap would be if these landed. None of this is counted anywhere else in the game.' }),
      ...conds.map((a) => h('div', { class: 'scenario', style: 'margin-left:0' }, [
        h('div', { class: 'scenario-head', text: a.name }),
        h('div', { class: 'scenario-v', text: '+' + fmt.money(a.scenario.amount) + ' a year' }),
        (a.scenario.rateFrom && a.scenario.rateTo) ? h('div', { class: 'scenario-rate' }, [
          h('span', { html: `Sales tax <b>${a.scenario.rateFrom}%</b> &rarr; <b>${a.scenario.rateTo}%</b>` }),
        ]) : null,
        h('div', { class: 'scenario-note', text: a.scenario.basis }),
      ])),
      h('table', { class: 'dt', style: 'margin-top:10px' }, [
        h('tbody', {}, [
          h('tr', {}, [h('td', { text: 'Structural gap now' }),
                       h('td', { class: t.structuralGap > 0 ? 'neg' : 'pos', text: fmt.full(t.structuralGap) })]),
          h('tr', {}, [h('td', { text: 'If the conditional measures landed' }),
                       h('td', { class: t.scenarioStructuralGap > 0 ? 'neg' : 'pos', text: fmt.full(t.scenarioStructuralGap) })]),
        ]),
      ]),
    ]);
  }

  /* --- data table --- */
  const tableCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['The numbers']),
    dataTable(t, proj),
  ]);

  setChildren(p, [
    h('div', { class: 'panel-head' }, [
      h('h2', { text: 'Impact' }),
      h('p', { text: 'Whether your budget holds up, and what it does to the city.' }),
    ]),
    projCard, metersCard, figuresCard, scenarioCard, wfCard, changeCard, revCard, tableCard,
  ]);

  /* draw */
  C.divergingBars(changeHost, changed_, {
    ariaLabel: 'Change in department funding from baseline',
    leftLabel: 'Cut', rightLabel: 'Increase',
  });

  const revItems = BUDGET.generalFund.revenues.map((r) => ({ label: r.name, value: r.amount }));
  ACTIONS.actions.forEach((a) => {
    if (a.category === 'revenue' && state.chosen.has(a.id)) {
      revItems.push({ label: a.name, value: a.amount, isNew: true, color: 'var(--series-3)' });
    }
  });
  revItems.sort((a, b) => b.value - a.value);
  C.barsH(revHost, revItems, {
    ariaLabel: 'General fund revenue by source',
    onPick: (d) => {
      revReadout.className = 'readout';
      revReadout.replaceChildren(
        h('span', { class: 'readout-key', style: `background:${d.color || 'var(--series-1)'}` }),
        h('span', { html: `<b>${d.label}</b> — ${fmt.full(d.value)}${d.isNew ? ' · added by you' : ''}` }),
      );
    },
  });

  C.lines(projHost, [
    { name: 'Revenue', color: 'var(--series-1)', values: proj.rev },
    { name: 'Spending', color: 'var(--series-2)', values: proj.exp },
  ], proj.years, {
    height: 200, zeroBased: false, band: true,
    categoriesShort: proj.years.map(shortYear),
    ariaLabel: 'Three-year revenue and spending outlook',
    onPick: (d) => {
      const gap = proj.gaps[d.index];
      projReadout.className = 'readout';
      projReadout.replaceChildren(h('span', { html:
        `<b>${d.label}</b> — revenue ${fmt.money(proj.rev[d.index])}, spending ${fmt.money(proj.exp[d.index])} · ` +
        `<b style="color:${gap > 0 ? 'var(--critical)' : 'var(--good-ink)'}">${gap > 0 ? fmt.money(gap) + ' short' : fmt.money(-gap) + ' over'}</b>` }));
    },
  });
}

function buildWaterfall(t) {
  const host = h('div', { class: 'chart-wrap' });
  const steps = [{ label: 'Starting gap', value: t.startGap, total: true }];
  if (t.deptSavings)   steps.push({ label: 'Department cuts', value: -t.deptSavings });
  if (t.ongoingCuts)   steps.push({ label: 'Savings measures', value: -t.ongoingCuts });
  if (t.ongoingRevenue)steps.push({ label: 'New revenue', value: -t.ongoingRevenue });
  if (t.oneTime)       steps.push({ label: 'One-time money', value: -t.oneTime });
  steps.push({ label: t.cashGap > 0 ? 'Still short' : 'Surplus', value: Math.abs(t.cashGap), total: true });

  const card = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['How you closed the gap']),
    h('div', { class: 'chart-sub', text: 'From the $6.36M you inherited to where you are now.' }),
    host,
    legendFor([
      { label: 'Closes the gap', color: 'var(--pos)' },
      { label: 'Totals', color: 'var(--series-7)' },
    ]),
    t.oneTime > 0 ? h('div', { class: 'callout is-warning', html:
      `<b>${Math.round(t.oneTime / Math.max(1, t.closed) * 100)}%</b> of what you closed is one-time money. It does not come back next year.` }) : null,
  ]);
  setTimeout(() => C.waterfall(host, steps, { height: 210, ariaLabel: 'How the deficit was closed' }), 0);
  return card;
}

function dataTable(t, proj) {
  const row = (label, value, cls) => h('tr', {}, [
    h('td', { text: label }),
    h('td', { class: cls || '', text: typeof value === 'string' ? value : fmt.full(value) }),
  ]);
  return h('details', { class: 'data-table', open: true }, [
    h('summary', { text: 'Full figures' }),
    h('table', { class: 'dt' }, [
      h('tbody', {}, [
        row('Recurring spending', t.ongoingExp),
        row('Recurring revenue', t.ongoingRev),
        row('Structural gap', t.structuralGap, t.structuralGap > 0 ? 'neg' : 'pos'),
        row('One-time money used', t.oneTime),
        row('Budget as adopted', t.cashGap > 0 ? fmt.full(t.cashGap) + ' short' : fmt.full(-t.cashGap) + ' surplus',
            t.cashGap > 0 ? 'neg' : 'pos'),
        ...proj.years.slice(1).map((y, i) =>
          row(`${y} projected gap`, proj.gaps[i + 1], proj.gaps[i + 1] > 0 ? 'neg' : 'pos')),
      ]),
    ]),
  ]);
}

/* ============================================================
   Panel: Community
   ============================================================ */

function renderCommunity() {
  const p = $('panel-community');
  const t = E.totals(state, BUDGET, ACTIONS);
  const reactions = E.communityReactions(state, BUDGET, ACTIONS);
  const revealed = state.submitted;
  const liked = reactions.filter((v) => v.liked).length;

  const canSubmit = t.balanced;

  const tally = h('div', { class: 'tally' }, [
    h('div', { class: `tally-score ${revealed ? (liked >= 3 ? 'is-pass' : 'is-fail') : ''}`,
      text: revealed ? `${liked}/5` : '?' }),
    h('div', { class: 'tally-text' }, [
      h('b', { text: revealed
        ? (liked >= 3 ? 'Well received' : 'Not well received')
        : 'Win over three of five' }),
      h('span', { text: revealed
        ? (liked >= 3
            ? `${liked} of five community voices liked this budget.`
            : `Only ${liked} of five liked it.`)
        : 'Nobody sees your plan until you share it.' }),
    ]),
  ]);

  const kids = [
    h('div', { class: 'panel-head' }, [
      h('h2', { text: 'Community reaction' }),
      h('p', { text: revealed
        ? 'Ranked by how well your budget sat with each of them.'
        : 'Five residents, five sets of priorities. Win over at least three.' }),
    ]),
    tally,
    h('div', { class: 'card' }, reactions.map((v, i) => communityRow(v, revealed, i + 1))),
  ];

  if (!canSubmit) {
    kids.push(h('div', { class: 'callout is-critical', html:
      `Your budget is still <b>${fmt.money(t.cashGap)} short</b>. A California city cannot adopt an unbalanced general fund budget, so there is nothing to show anyone yet.` }));
  } else if (!t.structurallyBalanced) {
    kids.push(h('div', { class: 'callout is-warning', html:
      `It balances, but <b>${fmt.money(t.structuralGap)}</b> of that is one-time money. Some of them will notice.` }));
  }

  if (t.atRisk > 0 && !revealed) {
    kids.push(h('div', { class: 'callout is-warning', html:
      `<b>${fmt.money(t.atRisk)}</b> of your plan depends on ballot measures. Voters decide those when you share it.` }));
  }

  kids.push(h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, ['Your plan']),
    h('div', { class: 'card-note', text:
      `${t.picked.length} measure${t.picked.length === 1 ? '' : 's'}` +
      (t.unquantified ? ` (${t.unquantified} with no published figure)` : '') + ' \u00b7 ' +
      `${fmt.money(t.deptSavings)} from department budgets \u00b7 ` +
      `${fmt.money(t.ongoingCuts + t.ongoingRevenue)} recurring \u00b7 ` +
      `${fmt.money(t.oneTime)} one-time` }),
  ]));

  kids.push(h('button', {
    class: 'btn', id: 'btn-submit', disabled: !canSubmit || revealed,
    text: revealed ? 'Already shared' : 'Share your budget',
    onclick: submit,
  }));

  if (revealed) {
    kids.push(h('button', { class: 'btn btn-ghost', style: 'margin-top:10px',
      text: 'See the full scorecard', onclick: () => showResult() }));
  }

  p.replaceChildren(...kids);
}

/* ============================================================
   Submit & result
   ============================================================ */

function submit() {
  state.ballotResults = {};
  state.submitted = true;
  renderCommunity();
  setTimeout(showResult, 650);
}

function showResult() {
  const s = E.score(state, BUDGET, ACTIONS);
  s.ballotResults = state.ballotResults;
  const vs = E.verdicts(s, BUDGET, ACTIONS);
  const p = $('panel-result');

  const gradeColor =
    s.points >= 77 ? 'var(--good-ink)' :
    s.points >= 57 ? 'var(--warning)' :
    s.points >= 43 ? 'var(--serious)' : 'var(--critical)';

  const headline = !s.totals.balanced ? 'Never got off the ground'
    : s.wellReceived && s.totals.structurallyBalanced ? 'Well liked — and it holds'
    : s.wellReceived ? 'Well liked — for one year'
    : 'The community disliked it';

  const projHost = h('div', { class: 'chart-wrap' });
  const stackHost = h('div', { class: 'chart-wrap' });

  p.replaceChildren(
    h('div', { class: 'panel-head', style: 'padding-top:calc(env(safe-area-inset-top) + 14px)' }, [
      h('h2', { text: 'Your budget' }),
      h('p', { text: 'City of Hollister · General Fund · FY 2026-27' }),
    ]),

    h('div', { class: 'grade-card' }, [
      h('div', { class: 'grade', style: `color:${gradeColor}`, text: s.grade }),
      h('div', { class: 'grade-label', text: headline }),
      h('div', { class: 'grade-sub', text: `${s.points} out of 100 · ${s.likedCount} of 5 community voices liked it` }),
    ]),

    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['The verdict']),
      h('div', { class: 'verdict-list', style: 'margin-top:10px' }, vs.map(verdictRow)),
    ]),

    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['Adopted budget vs. yours']),
      h('div', { class: 'chart-sub', text: 'Recurring spending against recurring revenue.' }),
      stackHost,
      legendFor([
        { label: 'Recurring revenue', color: 'var(--series-1)' },
        { label: 'One-time money', color: 'var(--series-4)' },
        { label: 'Spending', color: 'var(--series-2)' },
      ]),
    ]),

    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [`${s.proj.years.length}-year outlook`]),
      h('div', { class: 'chart-sub', text: 'Whether this budget survives past next June. The shaded band is the gap.' }),
      projHost,
      legendFor([
        { label: 'Revenue', color: 'var(--series-1)', line: true },
        { label: 'Spending', color: 'var(--series-2)', line: true },
        { label: 'Covered', color: 'var(--pos)' },
        { label: 'Short', color: 'var(--neg)' },
      ]),
    ]),

    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['Services, after your budget']),
      ...ACTIONS.meta.meters.map((def) => meterRow(def, s.meters[def.id], state.startMeters[def.id])),
    ]),

    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['How the community ranked it']),
      h('div', { class: 'chart-sub', text: 'Best received first.' }),
      ...s.reactions.map((v, i) => communityRow(v, true, i + 1)),
    ]),

    h('div', { class: 'btn-row', style: 'margin-top:16px' }, [
      h('button', { class: 'btn btn-ghost', text: 'Revise', onclick: () => {
        state.submitted = false; state.ballotResults = null;
        go('game'); switchPanel('budget'); changed();
      }}),
      h('button', { class: 'btn', text: 'Start over', onclick: reset }),
    ]),

    h('div', { class: 'source-note', html:
      '<b>Sources.</b> The General Fund totals, every revenue line and every department total come from the City of Hollister FY 2026-27 Approved Budget Document. The fiscal emergency, the $18M interfund loan and the $178 bank balance come from reporting on council actions. Policy options and service-impact values are game-design estimates. See SOURCES.md in the repository.' }),
  );

  go('result');
  window.scrollTo(0, 0);

  C.lines(projHost, [
    { name: 'Revenue', color: 'var(--series-1)', values: s.proj.rev },
    { name: 'Spending', color: 'var(--series-2)', values: s.proj.exp },
  ], s.proj.years, {
    height: 200, zeroBased: false, band: true,
    categoriesShort: s.proj.years.map(shortYear),
    ariaLabel: `${s.proj.years.length}-year outlook`,
  });

  const t = s.totals;
  C.stackPair(stackHost, [
    { label: 'Money available', total: t.ongoingRev + t.oneTime, parts: [
      { label: 'Recurring revenue', value: t.ongoingRev, color: 'var(--series-1)' },
      { label: 'One-time money', value: t.oneTime, color: 'var(--series-4)' },
    ].filter((x) => x.value > 0) },
    { label: 'Money committed', total: t.ongoingExp, parts: [
      { label: 'Spending', value: t.ongoingExp, color: 'var(--series-2)' },
    ] },
  ], { height: 150, ariaLabel: 'Resources against spending' });
}

function reset() {
  state = E.createState(BUDGET, ACTIONS);
  statusFilter = 'all';
  go('intro');
  window.scrollTo(0, 0);
}

/* ============================================================
   Navigation
   ============================================================ */

function go(screen) {
  ['intro', 'game', 'result'].forEach((s) => {
    $(`screen-${s}`).classList.toggle('is-active', s === screen);
  });
}

function switchPanel(name) {
  activePanel = name;
  ['budget', 'cuts', 'revenue', 'impact', 'community'].forEach((n) => {
    $(`panel-${n}`).classList.toggle('is-active', n === name);
    $(`tab-${n}`).setAttribute('aria-selected', n === name ? 'true' : 'false');
  });
  if (name === 'budget') renderBudget();
  if (name === 'cuts') renderActionPanel('cuts');
  if (name === 'revenue') renderActionPanel('revenue');
  if (name === 'impact') renderImpact();
  if (name === 'community') renderCommunity();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-btn').forEach((b) => {
  b.addEventListener('click', () => switchPanel(b.dataset.panel));
});

$('btn-start').addEventListener('click', () => {
  go('game');
  switchPanel('budget');
  updateBoard();
});

const aboutSheet = $('about-sheet');

function openAbout() {
  // showModal() gives focus trapping and Esc for free, and unlike alert()
  // it still works when this page is embedded cross-origin in an iframe.
  if (typeof aboutSheet.showModal === 'function') aboutSheet.showModal();
  else aboutSheet.setAttribute('open', '');
}
function closeAbout() {
  if (typeof aboutSheet.close === 'function') aboutSheet.close();
  else aboutSheet.removeAttribute('open');
}

$('btn-about-intro').addEventListener('click', openAbout);
$('about-close').addEventListener('click', closeAbout);
// Clicking the backdrop lands on the dialog element itself.
aboutSheet.addEventListener('click', (e) => { if (e.target === aboutSheet) closeAbout(); });

/* boot */
updateBoard();
