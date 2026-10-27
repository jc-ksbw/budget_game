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
  // Measures the City has already carried out are on the board from the first
  // screen and cannot be switched off.
  const chosen = new Set();
  actions.actions.forEach((a) => { if (a.locked && !a.rescinded) chosen.add(a.id); });

  return {
    deptPct: dept,
    chosen,
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
  let unquantified = 0, scenarioRevenue = 0;
  const picked = [];

  actions.actions.forEach((a) => {
    if (!state.chosen.has(a.id)) return;
    // The City reversed this one. It stays on the board for the record, but it
    // cannot be chosen and it never contributes a dollar.
    if (a.rescinded) return;
    picked.push(a);

    // A conditional proposal — one that still needs legislation, a council
    // action or a vote — feeds the scenario view only, never the real budget.
    if (a.conditional && a.scenario) scenarioRevenue += a.scenario.amount;

    // No published figure means no effect on the gap. Zero is NOT substituted
    // as though it were the real-world estimate; the option simply cannot move
    // a dollar total until someone publishes one.
    if (!a.amountKnown) { unquantified += 1; return; }

    const value = a.amount;

    if (a.type === 'onetime') oneTime += value;
    else if (a.category === 'revenue') {
      ongoingRevenue += value;
      taxBurden += value * (a.taxBurden ?? 0.6);
      bizBurden += value * (a.bizBurden ?? 0.3);
    } else ongoingCuts += value;
  });

  const ongoingExp = baseExp - deptSavings - ongoingCuts;
  const ongoingRev = baseRev + ongoingRevenue;

  // The gap left once the one-time money you used is taken back out. This is a
  // game estimate, not a verified structural deficit: the adopted revenue and
  // expenditure lines have never been classified recurring vs one-time, so the
  // baseline on both sides is assumed to recur. Only the measures the player
  // adds are genuinely typed.
  const ongoingGap = ongoingExp - ongoingRev;
  // The paper measure: what the adopted budget would show.
  const cashGap = ongoingExp - (ongoingRev + oneTime);

  const startGap = baseExp - baseRev;
  const closed = startGap - cashGap;

  // What the gap would be if every conditional proposal actually landed.
  const scenarioOngoingGap = ongoingExp - (ongoingRev + scenarioRevenue);

  return {
    baseExp, curExp, deptSavings, baseRev,
    ongoingCuts, ongoingRevenue, oneTime, taxBurden, bizBurden,
    unquantified, scenarioRevenue, scenarioOngoingGap,
    atRisk: 0,
    ongoingExp, ongoingRev,
    ongoingGap, cashGap, startGap, closed,
    picked,
    balanced: cashGap <= 0,
    ongoingBalanced: ongoingGap <= 0,
    // A single year's projected surplus. It is NOT a reserve balance: the game
    // models no opening reserve, no cash flows and no loan repayment, so it
    // cannot say what the City would actually have in hand.
    surplus: cashGap < 0 ? -cashGap : 0,
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
  const ongoing = clamp(-t.ongoingGap / 1e6, -12, 8);
  const onetimeReliance = t.closed > 0 ? clamp(t.oneTime / t.closed * 10, 0, 10) : 0;
  const newTaxes = clamp(t.taxBurden / 1e6 * 2.2, 0, 10);
  const bizBurden = clamp(t.bizBurden / 1e6 * 2.2, 0, 10);

  return actions.community.map((c) => {
    let score = 50;
    score += (c.weights.structural || 0) * ongoing;
    score += (c.weights.onetimeReliance || 0) * onetimeReliance;
    score += (c.weights.newTaxes || 0) * newTaxes;
    score += (c.weights.bizBurden || 0) * bizBurden;
    // Covering ongoing cost with ongoing money is a threshold, not a gradient.
    // Clearing it at all is the thing a fiscal conservative is voting for.
    if (t.ongoingBalanced) score += 3 * (c.weights.structural || 0);
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

  // Weights total 100. The old build spent 5 points on "what you left in
  // reserve", scored against the City's 20% policy target. The game models no
  // opening reserve, no cash flows and no loan repayment, so it could not know
  // that. Those 5 points moved to the two things it can still measure: closing
  // the adopted gap (+3) and closing it with ongoing money (+2).

  // 1. Did it close the adopted gap? (33)
  if (t.balanced) pts += 33;
  else pts += Math.max(0, 33 * (1 - t.cashGap / Math.max(1, t.startGap)));

  // 2. Does it hold without one-time money? (27)
  if (t.ongoingBalanced) pts += 27;
  else pts += Math.max(0, 27 * (1 - Math.min(1, t.ongoingGap / Math.max(1, t.startGap))));

  // 3. How did the community take it? (20)
  pts += (liked / 5) * 20;

  // 4. Are the services people actually use still working? (20)
  const avgMeter = METER_IDS.reduce((s, k) => s + m[k], 0) / METER_IDS.length;
  pts += (avgMeter / 100) * 20;
  const failing = METER_IDS.filter((k) => m[k] < 25);
  pts -= failing.length * 6;

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
  } else if (!t.ongoingBalanced) {
    push('serious', `It balances on paper, but <b>${money(t.ongoingGap)} of the fix is one-time money</b>. Next July the hole reopens, minus whatever you already sold or borrowed.`);
  } else {
    push('good', `On this game's assumptions, ongoing money covers ongoing cost — the one-time measures are not doing the work. The game has not verified that against the City's own lines, which have never been classified recurring or one-time, so treat it as a good result here rather than proven structural balance.`);
  }

  if (t.oneTime > 0) {
    const share = Math.round(t.oneTime / Math.max(1, t.closed) * 100);
    push(share > 55 ? 'critical' : share > 25 ? 'warning' : 'good',
      `<b>${share}%</b> of the gap you closed came from one-time sources. Interfund loans and asset sales work exactly once.`);
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

  const last = s.proj.gaps.length - 1;
  const yEnd = s.proj.gaps[last];
  const yrs = s.proj.years.length;
  if (yEnd > 0) {
    push(yEnd > 5e6 ? 'critical' : 'warning',
      `By <b>${s.proj.years[last]}</b> the projected gap is <b>${money(yEnd)}</b>. Salary steps and pension costs grow faster than this revenue base.`);
  } else {
    push('good', `The ${yrs}-year outlook holds: <b>${s.proj.years[last]}</b> still projects in the black.`);
  }

  if (t.surplus > 0) {
    push('good', `This plan projects a <b>${money(t.surplus)}</b> surplus for the year. That is a single year's projection, not money in the bank: the game models no opening reserve, no cash flow and no loan repayment.`);
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
