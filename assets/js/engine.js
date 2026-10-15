/* ============================================================
   engine.js — budget state, consequences, community reaction, scoring.
   Pure functions over a plain state object. No DOM here.
   ============================================================ */

export const METER_IDS = ['safety', 'infrastructure', 'community', 'workforce', 'trust'];

/** Points a full 100% cut of one department would move a meter weighted 1.0.
 *  Department budgets are now the only lever with published dollars behind it,
 *  so the sliders carry the whole gap; at the old weight that guaranteed a
 *  collapsed scorecard for any balanced budget. */
const DEPT_METER_SCALE = 40;

export function createState(budget, actions) {
  const dept = {};
  budget.generalFund.departments.forEach((d) => { dept[d.id] = 100; });
  const meters = {};
  actions.meta.meters.forEach((m) => { meters[m.id] = m.start; });
  return {
    deptPct: dept,
    chosen: new Set(),
    startMeters: meters,
    ballotResults: null,   // filled in at submission
    submitted: false,
  };
}

/* ---------- money ---------- */

export function totals(state, budget, actions) {
  const depts = budget.generalFund.departments;
  const baseExp = depts.reduce((s, d) => s + d.baseline, 0);
  const curExp = depts.reduce((s, d) => s + d.baseline * (state.deptPct[d.id] / 100), 0);
  const deptSavings = baseExp - curExp;

  const baseRev = budget.generalFund.revenues.reduce((s, r) => s + r.amount, 0);

  let ongoingCuts = 0, ongoingRevenue = 0, oneTime = 0;
  let taxBurden = 0, bizBurden = 0;
  let unquantified = 0, cashBridge = 0, scenarioRevenue = 0;
  const picked = [];

  actions.actions.forEach((a) => {
    if (!state.chosen.has(a.id)) return;
    picked.push(a);

    // A conditional proposal — one that still needs legislation, a council
    // action or a vote — feeds the scenario view only, never the real budget.
    if (a.conditional && a.scenario) scenarioRevenue += a.scenario.amount;

    // No published figure means no effect on the gap. Zero is NOT substituted
    // as though it were the real-world estimate; the option simply cannot move
    // a dollar total until someone publishes one.
    if (!a.amountKnown) { unquantified += 1; return; }

    const value = a.amount;

    // A cash bridge supplies operating cash. It is one-time by construction and
    // must never reach the recurring side of the ledger.
    if (a.cashBridge) { cashBridge += value; oneTime += value; return; }

    if (a.type === 'onetime') oneTime += value;
    else if (a.category === 'revenue') {
      ongoingRevenue += value;
      taxBurden += value * (a.taxBurden ?? 0.6);
      bizBurden += value * (a.bizBurden ?? 0.3);
    } else ongoingCuts += value;
  });

  const ongoingExp = baseExp - deptSavings - ongoingCuts;
  const ongoingRev = baseRev + ongoingRevenue;

  // The honest measure: do recurring revenues cover recurring costs?
  const structuralGap = ongoingExp - ongoingRev;
  // The paper measure: what the adopted budget would show.
  const cashGap = ongoingExp - (ongoingRev + oneTime);

  const startGap = baseExp - baseRev;
  const closed = startGap - cashGap;

  // What the gap would be if every conditional proposal actually landed.
  const scenarioStructuralGap = ongoingExp - (ongoingRev + scenarioRevenue);

  return {
    baseExp, curExp, deptSavings, baseRev,
    ongoingCuts, ongoingRevenue, oneTime, taxBurden, bizBurden,
    unquantified, cashBridge, scenarioRevenue, scenarioStructuralGap,
    atRisk: 0,
    ongoingExp, ongoingRev,
    structuralGap, cashGap, startGap, closed,
    picked,
    balanced: cashGap <= 0,
    structurallyBalanced: structuralGap <= 0,
    surplus: cashGap < 0 ? -cashGap : 0,
    reserve: cashGap < 0 ? -cashGap : 0,
    reservePct: ongoingExp > 0 ? (cashGap < 0 ? -cashGap : 0) / ongoingExp * 100 : 0,
  };
}

/* ---------- consequences ---------- */

export function meters(state, budget, actions) {
  const out = {};
  METER_IDS.forEach((m) => { out[m] = state.startMeters[m]; });

  budget.generalFund.departments.forEach((d) => {
    const delta = (state.deptPct[d.id] - 100) / 100; // -0.30 .. +0.20
    if (delta === 0) return;
    METER_IDS.forEach((m) => {
      const w = d.cutEffects[m] || 0;
      if (!w) return;
      // Increases help at a third of the rate cuts hurt — money alone
      // doesn't buy back service as fast as removing it takes it away.
      const eff = delta < 0 ? delta : delta * 0.34;
      out[m] += eff * w * DEPT_METER_SCALE;
    });
  });

  actions.actions.forEach((a) => {
    if (!state.chosen.has(a.id)) return;
    if (state.ballotResults && a.needsBallot && state.ballotResults[a.id] === false) return;
    for (const m in (a.effects || {})) {
      if (out[m] !== undefined) out[m] += a.effects[m];
    }
  });

  METER_IDS.forEach((m) => { out[m] = Math.max(0, Math.min(100, Math.round(out[m]))); });
  return out;
}

export function meterStatus(v) {
  if (v >= 65) return { key: 'good',     label: 'Healthy',  color: 'var(--good)' };
  if (v >= 45) return { key: 'warning',  label: 'Strained', color: 'var(--warning)' };
  if (v >= 25) return { key: 'serious',  label: 'Degraded', color: 'var(--serious)' };
  return         { key: 'critical', label: 'Failing',  color: 'var(--critical)' };
}

/* ---------- three-year outlook ---------- */

export function projection(state, budget, actions) {
  const t = totals(state, budget, actions);
  const p = budget.projection;
  const years = p.years;

  const rev = [], exp = [];
  for (let i = 0; i < years.length; i++) {
    // One-time money is in the first year and only the first year.
    const oneTimeThisYear = i === 0 ? t.oneTime : 0;
    rev.push(t.ongoingRev * Math.pow(1 + p.revenueGrowth, i) + oneTimeThisYear);
    exp.push(t.ongoingExp * Math.pow(1 + p.expenditureGrowth, i));
  }
  const gaps = exp.map((e, i) => e - rev[i]);
  return { years, rev, exp, gaps, cumulative: gaps.reduce((s, g) => s + Math.max(0, g), 0) };
}

/* ---------- community reaction ---------- */

export function communityReactions(state, budget, actions) {
  const t = totals(state, budget, actions);
  const m = meters(state, budget, actions);

  // Normalised signals, all roughly in a -10..+10 band.
  const structural = clamp(-t.structuralGap / 1e6, -12, 8);
  const onetimeReliance = t.closed > 0 ? clamp(t.oneTime / t.closed * 10, 0, 10) : 0;
  const newTaxes = clamp(t.taxBurden / 1e6 * 2.2, 0, 10);
  const bizBurden = clamp(t.bizBurden / 1e6 * 2.2, 0, 10);
  const reserve = clamp(t.reservePct / 20 * 8, 0, 10);

  return actions.community.map((c) => {
    let score = 50;
    score += (c.weights.structural || 0) * structural;
    score += (c.weights.onetimeReliance || 0) * onetimeReliance;
    score += (c.weights.newTaxes || 0) * newTaxes;
    score += (c.weights.bizBurden || 0) * bizBurden;
    score += (c.weights.reserve || 0) * reserve;
    // Structural balance is a threshold, not a gradient. Clearing it at all is
    // the thing a fiscal conservative is actually voting for.
    if (t.structurallyBalanced) score += 3 * (c.weights.structural || 0);
    METER_IDS.forEach((k) => {
      score += (c.weights[k] || 0) * ((m[k] - 48) / 4.5);
    });
    // A budget that does not balance is a non-starter for everyone.
    if (!t.balanced) score -= 28;

    // Round first, then judge, so the shown score and the verdict can never
    // disagree (a raw 49.6 displaying as 50 but reading "disliked").
    const rounded = Math.round(score);
    return { ...c, score: rounded, liked: rounded >= 50 };
  })
    // Ranked: whoever this budget sits best with comes first.
    .sort((a, b) => b.score - a.score);
}

/* ---------- ballot measures ---------- */

export function resolveBallots(state, actions, rng = Math.random) {
  const res = {};
  actions.actions.forEach((a) => {
    if (a.needsBallot && state.chosen.has(a.id)) {
      res[a.id] = rng() < (a.passChance ?? 0.5);
    }
  });
  return res;
}

/* ---------- the scorecard ---------- */

export function score(state, budget, actions) {
  const t = totals(state, budget, actions);
  const m = meters(state, budget, actions);
  const reactions = communityReactions(state, budget, actions);
  const proj = projection(state, budget, actions);
  const liked = reactions.filter((v) => v.liked).length;
  const wellReceived = liked >= 3 && t.balanced;

  let pts = 0;

  // 1. Did it balance at all? (30)
  if (t.balanced) pts += 30;
  else pts += Math.max(0, 30 * (1 - t.cashGap / Math.max(1, t.startGap)));

  // 2. Is it structural, or papered over? (25)
  if (t.structurallyBalanced) pts += 25;
  else pts += Math.max(0, 25 * (1 - Math.min(1, t.structuralGap / Math.max(1, t.startGap))));

  // 3. How did the community take it? (20)
  pts += (liked / 5) * 20;

  // 4. Are the services people actually use still working? (20)
  const avgMeter = METER_IDS.reduce((s, k) => s + m[k], 0) / METER_IDS.length;
  pts += (avgMeter / 100) * 20;
  const failing = METER_IDS.filter((k) => m[k] < 25);
  pts -= failing.length * 6;

  // 5. Is there anything left in reserve? (5)
  pts += Math.min(5, t.reservePct / 20 * 5);

  pts = Math.max(0, Math.min(100, pts));

  const grade =
    pts >= 90 ? 'A'  : pts >= 83 ? 'A-' : pts >= 77 ? 'B+' : pts >= 70 ? 'B' :
    pts >= 64 ? 'B-' : pts >= 57 ? 'C+' : pts >= 50 ? 'C'  : pts >= 43 ? 'C-' :
    pts >= 35 ? 'D'  : 'F';

  return {
    points: Math.round(pts), grade, wellReceived, likedCount: liked,
    totals: t, meters: m, reactions, proj, failing,
  };
}

/* ---------- verdict lines ---------- */

export function verdicts(s, budget, actions) {
  const out = [];
  const t = s.totals;
  const push = (level, text) => out.push({ level, text });

  if (!t.balanced) {
    push('critical', `The budget still shows a <b>${money(t.cashGap)} gap</b>. Under California law a city cannot adopt a general fund budget that does not balance, so there is nothing here to put in front of anyone.`);
  } else if (!t.structurallyBalanced) {
    push('serious', `It balances on paper, but <b>${money(t.structuralGap)} of the fix is one-time money</b>. Next July the hole reopens, minus whatever you already sold or borrowed.`);
  } else {
    push('good', `This is a <b>structurally balanced</b> budget: recurring revenue covers recurring cost. That is the thing Hollister has not had.`);
  }

  if (t.oneTime > 0) {
    const share = Math.round(t.oneTime / Math.max(1, t.closed) * 100);
    push(share > 55 ? 'critical' : share > 25 ? 'warning' : 'good',
      `<b>${share}%</b> of the gap you closed came from one-time sources. Interfund loans and asset sales work exactly once.`);
  }

  if (t.cashBridge > 0) {
    push('warning', `<b>${money(t.cashBridge)}</b> of that is the interfund loan, which is operating cash and is repayable by June 30, 2027. It does not shrink the structural gap by a dollar.`);
  }

  if (t.unquantified > 0) {
    push('warning', `<b>${t.unquantified}</b> of the measures you picked have no published savings or revenue figure, so none of them moved the deficit. They are real proposals; the numbers behind them are not public.`);
  }

  if (s.wellReceived) {
    push('good', `<b>${s.likedCount} of 5</b> community voices liked this budget.`);
  } else if (t.balanced) {
    push('critical', `Only <b>${s.likedCount} of 5</b> community voices liked this budget. Winning over three of them is the whole job.`);
  }

  s.failing.forEach((k) => {
    const name = actions.meta.meters.find((x) => x.id === k).name;
    push('critical', `<b>${name}</b> has collapsed. Cuts this deep stop being budget decisions and start being service failures.`);
  });

  const y3 = s.proj.gaps[2];
  if (y3 > 0) {
    push(y3 > 5e6 ? 'critical' : 'warning',
      `By <b>${s.proj.years[2]}</b> the projected gap is <b>${money(y3)}</b>. Salary steps and pension costs grow faster than this revenue base.`);
  } else {
    push('good', `The three-year outlook holds: <b>${s.proj.years[2]}</b> still projects in the black.`);
  }

  if (t.reservePct > 0) {
    push(t.reservePct >= 20 ? 'good' : 'warning',
      `Reserve lands at <b>${t.reservePct.toFixed(1)}%</b> of expenditures against the city's <b>20%</b> policy target.`);
  } else {
    push('warning', `You left <b>nothing in reserve</b>. The next unbudgeted storm drain failure is another emergency.`);
  }

  const ballot = Object.entries(s.ballotResults || {});
  ballot.forEach(([id, passed]) => {
    const a = actions.actions.find((x) => x.id === id);
    if (!a) return;
    push(passed ? 'good' : 'critical',
      `Voters <b>${passed ? 'approved' : 'rejected'}</b> ${a.name.toLowerCase()}${passed ? '' : `, taking ${money(a.amount)} back out of your budget`}.`);
  });

  return out;
}

/* ---------- utils ---------- */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function money(v) {
  const n = Math.abs(v);
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}
