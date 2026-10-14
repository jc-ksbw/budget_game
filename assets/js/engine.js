/* ============================================================
   engine.js — budget state, consequences, council, scoring.
   Pure functions over a plain state object. No DOM here.
   ============================================================ */

export const METER_IDS = ['safety', 'infrastructure', 'community', 'workforce', 'trust'];

/** Points a full 100% cut of one department would move a meter weighted 1.0. */
const DEPT_METER_SCALE = 60;

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

  let ongoingCuts = 0, ongoingRevenue = 0, oneTime = 0, atRisk = 0;
  let taxBurden = 0, bizBurden = 0;
  const picked = [];

  actions.actions.forEach((a) => {
    if (!state.chosen.has(a.id)) return;
    picked.push(a);

    // A ballot measure that already failed contributes nothing.
    const failed = state.ballotResults && state.ballotResults[a.id] === false;
    const value = failed ? 0 : a.amount;

    if (a.type === 'onetime') oneTime += value;
    else if (a.category === 'revenue') {
      ongoingRevenue += value;
      // A cost-recovery fee and a utility users tax are not the same ask.
      taxBurden += value * (a.taxBurden ?? 0.6);
      bizBurden += value * (a.bizBurden ?? 0.3);
      if (a.needsBallot && !state.ballotResults) atRisk += a.amount;
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

  return {
    baseExp, curExp, deptSavings, baseRev,
    ongoingCuts, ongoingRevenue, oneTime, atRisk, taxBurden, bizBurden,
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

/* ---------- the council ---------- */

export function councilVotes(state, budget, actions) {
  const t = totals(state, budget, actions);
  const m = meters(state, budget, actions);

  // Normalised signals, all roughly in a -10..+10 band.
  const structural = clamp(-t.structuralGap / 1e6, -12, 8);
  const onetimeReliance = t.closed > 0 ? clamp(t.oneTime / t.closed * 10, 0, 10) : 0;
  const newTaxes = clamp(t.taxBurden / 1e6 * 2.2, 0, 10);
  const bizBurden = clamp(t.bizBurden / 1e6 * 2.2, 0, 10);
  const reserve = clamp(t.reservePct / 20 * 8, 0, 10);

  return actions.council.map((c) => {
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
    // A budget that does not balance on paper cannot be adopted at all.
    if (!t.balanced) score -= 28;

    const yes = score >= 50;
    return { ...c, score: Math.round(score), yes };
  });
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
  const votes = councilVotes(state, budget, actions);
  const proj = projection(state, budget, actions);
  const yes = votes.filter((v) => v.yes).length;
  const adopted = yes >= 3 && t.balanced;

  let pts = 0;

  // 1. Did it balance at all? (30)
  if (t.balanced) pts += 30;
  else pts += Math.max(0, 30 * (1 - t.cashGap / Math.max(1, t.startGap)));

  // 2. Is it structural, or papered over? (25)
  if (t.structurallyBalanced) pts += 25;
  else pts += Math.max(0, 25 * (1 - Math.min(1, t.structuralGap / Math.max(1, t.startGap))));

  // 3. Did the council adopt it? (20)
  pts += (yes / 5) * 20;

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

  return { points: Math.round(pts), grade, adopted, yesVotes: yes, totals: t, meters: m, votes, proj, failing };
}

/* ---------- verdict lines ---------- */

export function verdicts(s, budget, actions) {
  const out = [];
  const t = s.totals;
  const push = (level, text) => out.push({ level, text });

  if (!t.balanced) {
    push('critical', `The budget still shows a <b>${money(t.cashGap)} gap</b>. Under California law a city council cannot adopt a general fund budget that does not balance, so this one never reached a vote.`);
  } else if (!t.structurallyBalanced) {
    push('serious', `It balances on paper, but <b>${money(t.structuralGap)} of the fix is one-time money</b>. Next July the hole reopens, minus whatever you already sold or borrowed.`);
  } else {
    push('good', `This is a <b>structurally balanced</b> budget: recurring revenue covers recurring cost. That is the thing Hollister has not had.`);
  }

  if (t.oneTime > 0) {
    const share = Math.round(t.oneTime / Math.max(1, t.closed) * 100);
    push(share > 55 ? 'critical' : share > 25 ? 'warning' : 'good',
      `<b>${share}%</b> of the gap you closed came from one-time sources. Interfund loans and property sales work exactly once.`);
  }

  if (s.adopted) push('good', `The council adopted it <b>${s.yesVotes}&ndash;${5 - s.yesVotes}</b>.`);
  else if (t.balanced) push('critical', `The council rejected it <b>${s.yesVotes}&ndash;${5 - s.yesVotes}</b>. Three votes is the whole job.`);

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
