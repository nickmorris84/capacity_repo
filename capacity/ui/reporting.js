import { seasonalMult } from "../engine/engine.js";
import { STRATEGIES, strategyStats, recommendStrategy, strategyName, viewName } from "./views.js";
import { money, moneyFull, pct, num, secs } from "./format.js";

/* Shared, DOM-free reporting layer used by the Data / Summary / Report tabs and
   the Excel/CSV exports — one source of truth for the §6 column model, the §7
   verdict and audience blocks, and the risk register. */

// ---- §6 per-queue weekly row model ----
// One row per week carrying every output and the assumptions in effect.
export function buildWeeklyRows(sim, queue, config) {
  const qid = queue.id;
  const reqs = sim.weeks.map((w) => w.queues[qid].reqsRaised || 0);
  const lead = Math.max(0, Math.round(queue.wf.reqToStart));
  return sim.weeks.map((w, i) => {
    const s = w.queues[qid];
    // "Hires landing" = the cohort that starts (enters training) this week; it
    // originates from a requisition raised req-to-start weeks earlier.
    const hiresLanding = i - lead >= 0 ? reqs[i - lead] : 0;
    return {
      week: i + 1,
      base: s.baseVolume,
      // §24.6 the genuine per-week volume INPUT (editable in the Data tab): the
      // queue's weekly series value if present, else its single daily figure.
      volInput: Array.isArray(queue.weeklyVolumes) && queue.weeklyVolumes[i] != null ? queue.weeklyVolumes[i]
        : queue.dailyVolume != null ? queue.dailyVolume : null,
      seasonalMult: seasonalMult(i, config, queue),
      deflected: s.deflected || 0,
      redial: s.redial || 0,
      volume: s.volume,
      cover: s.cover,
      asa: s.asa,
      respMin: s.respMin,
      sl: s.sl,
      abandon: s.abandon,
      occ: s.occ,
      backlog: s.backlog || 0,
      burnout: s.burnout,
      leavers: s.leavers || 0,
      attrInEffect: s.attrInEffect || 0,
      reqsRaised: s.reqsRaised || 0,
      hiresLanding,
      training: s.training,
      ramping: s.ramp,
      trained: s.trained,
      active: s.active != null ? s.active : s.trained + s.ramp,
      startingHC: s.startingHC != null ? s.startingHC : 0,
      paid: s.paid,
      reqFte: s.reqFte,
      cost: s.cost,
      churnCost: s.churnCost,
      customersLost: s.churnCustomers,
      status: s.status,
      // §16/§17/§20a R2 audit + supply-ladder fields.
      otHours: s.otHours || 0,
      otCost: s.otCost || 0,
      reclaimedHours: s.reclaimedHours || 0,
      trainingDebt: s.trainingDebt || 0,
      trainShrink: s.trainShrinkInEffect || 0,
      recycledIn: s.recycledIn || 0,
      poolIn: s.poolIn || 0,
      leveragedIn: s.leveragedIn || 0,
      borrowedShare: s.borrowedSharePct || 0,
      ahtInEffect: s.ahtInEffect != null ? s.ahtInEffect : queue.aht,
      slaInEffect: s.slaInEffect != null ? s.slaInEffect : (queue.type === "voice" ? queue.asaTarget : queue.digitalSlaMinutes),
      scenarioTags: (s.scenarioTags || []).join(", "),
    };
  });
}

// Inputs-in-force contract — the resolved assumptions in effect, per week.
// OT used is an outcome, not an input in force; it stays in the Outputs columns.
export function assumptionsColumns(queue, cur = "£") {
  return [
    { key: "week", label: "Week", fmt: (v) => String(v) },
    { key: "volume", label: "Volume", fmt: (v) => num(v, 0) },
    { key: "ahtInEffect", label: "Blended AHT (s)", fmt: (v) => num(v, 0) },
    { key: "slaInEffect", label: "SLA in effect", fmt: (v) => num(v, queue.type === "voice" ? 0 : 1) },
    { key: "attrInEffect", label: "Attrition %", fmt: (v) => pct(v, 1) },
    { key: "trainShrink", label: "Train shrink %", fmt: (v) => pct(v, 1) },
    { key: "trainingDebt", label: "Training debt", fmt: (v) => num(v, 0) },
    { key: "scenarioTags", label: "Active scenarios", fmt: (v) => v || "—" },
  ];
}

// Per-queue summary metric for the Summary rollup (§20). Returns raw accumulator
// fields for one queue; sumQueueSummary merges a set of them into a subtotal so
// the shared HierTable can render Brand → channel → queue subtotal rows.
export function queueSummaryMetric(sim, q) {
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const last = series[series.length - 1] || {};
  return {
    volume: series.reduce((a, s) => a + s.volume, 0),
    required: last.reqFte || 0,
    active: last.active != null ? last.active : (last.trained || 0) + (last.ramp || 0),
    coverSum: series.reduce((a, s) => a + s.cover, 0),
    coverN: Math.max(1, series.length),
    weeksRed: series.filter((s) => s.status === "red").length,
    churn: series.reduce((a, s) => a + s.churnCost, 0),
  };
}
export function sumQueueSummary(list) {
  return list.reduce((t, m) => ({
    volume: t.volume + m.volume, required: t.required + m.required, active: t.active + m.active,
    coverSum: t.coverSum + m.coverSum, coverN: t.coverN + m.coverN, weeksRed: t.weeksRed + m.weeksRed, churn: t.churn + m.churn,
  }), { volume: 0, required: 0, active: 0, coverSum: 0, coverN: 0, weeksRed: 0, churn: 0 });
}

// Column model with groups + a formatter. columnsFor tailors the Service group
// to the queue type (ASA for voice, response for digital).
export function columnsFor(queue, cur = "£") {
  const P0 = (v) => pct(v, 0);
  const P1 = (v) => pct(v, 1);
  const N0 = (v) => num(v, 0);
  const N1 = (v) => num(v, 1);
  const M = (v) => money(cur, v);
  const service = queue.type === "voice"
    ? [
        { key: "cover", label: "Coverage", group: "Service", fmt: P0 },
        { key: "asa", label: "ASA (s)", group: "Service", fmt: (v) => secs(v) },
        { key: "sl", label: "SL", group: "Service", fmt: P0 },
        { key: "abandon", label: "Abandon", group: "Service", fmt: P1 },
        { key: "occ", label: "Occupancy", group: "Service", fmt: P0 },
      ]
    : [
        { key: "cover", label: "Coverage", group: "Service", fmt: P0 },
        { key: "respMin", label: "Response (m)", group: "Service", fmt: N1 },
        { key: "sl", label: "In SLA", group: "Service", fmt: P0 },
        { key: "backlog", label: "Backlog", group: "Service", fmt: N0 },
        { key: "occ", label: "Occupancy", group: "Service", fmt: P0 },
      ];
  return [
    { key: "week", label: "Week", group: "Week", fmt: (v) => String(v) },
    { key: "base", label: "Base vol", group: "Demand", fmt: N0 },
    // Editable input column (§24.6): writes back to the queue's weekly series.
    { key: "volInput", label: "Vol input", group: "Demand", fmt: N0, input: "volume" },
    { key: "seasonalMult", label: "Seasonal ×", group: "Demand", fmt: (v) => v.toFixed(2) },
    { key: "deflected", label: "Deflected", group: "Demand", fmt: N0 },
    { key: "redial", label: "Redial", group: "Demand", fmt: N0 },
    { key: "volume", label: "Total vol", group: "Demand", fmt: N0 },
    ...service,
    { key: "startingHC", label: "Starting HC", group: "People", fmt: N1 },
    { key: "burnout", label: "Burnout", group: "People", fmt: N0 },
    { key: "leavers", label: "Attrition #", group: "People", fmt: N1 },
    { key: "attrInEffect", label: "Attrition %", group: "People", fmt: P1 },
    { key: "reqsRaised", label: "Reqs raised", group: "People", fmt: N1 },
    { key: "hiresLanding", label: "Hires start", group: "People", fmt: N1 },
    { key: "training", label: "In training", group: "People", fmt: N1 },
    { key: "ramping", label: "Ramping", group: "People", fmt: N1 },
    { key: "trained", label: "Trained", group: "People", fmt: N1 },
    { key: "active", label: "Active FTE", group: "People", fmt: N1 },
    { key: "reqFte", label: "Req FTE", group: "People", fmt: N1 },
    { key: "otHours", label: "OT hours", group: "Supply", fmt: N1 },
    { key: "trainShrink", label: "Train shrink", group: "Supply", fmt: (v) => pct(v, 1) },
    { key: "trainingDebt", label: "Training debt", group: "Supply", fmt: N0 },
    { key: "recycledIn", label: "Recycled in", group: "Supply", fmt: N0 },
    { key: "poolIn", label: "Pool in", group: "Supply", fmt: N0 },
    { key: "leveragedIn", label: "Leveraged in", group: "Supply", fmt: N0 },
    { key: "borrowedShare", label: "Borrowed %", group: "Supply", fmt: P0 },
    { key: "cost", label: "Run cost", group: "Money", fmt: M },
    { key: "otCost", label: "OT cost", group: "Money", fmt: M },
    { key: "churnCost", label: "Churn cost", group: "Money", fmt: M },
    { key: "customersLost", label: "Cust. lost", group: "Money", fmt: N0 },
    { key: "status", label: "Status", group: "Status", fmt: (v) => v },
  ];
}

export const COLUMN_GROUPS = ["Week", "Demand", "Service", "People", "Supply", "Money", "Status"];

// ---- §7 verdict + recommendation ----
export function buildVerdict(strategySims, activeStrategyId, activeViewId, config) {
  const statsById = {};
  for (const s of STRATEGIES) if (strategySims[s.id]) statsById[s.id] = strategyStats(strategySims[s.id]);
  const recommended = recommendStrategy(statsById);
  const active = strategySims[activeStrategyId];
  const cur = config.engine.currency;

  // RAG counts across all queue-weeks of the active simulation.
  let green = 0, amber = 0, red = 0;
  if (active) {
    for (const w of active.weeks) for (const q of config.queues) {
      const st = w.queues[q.id].status;
      if (st === "green") green++; else if (st === "amber") amber++; else red++;
    }
  }
  const recStats = recommended ? statsById[recommended] : null;
  const others = Object.entries(statsById).filter(([id]) => id !== recommended);
  const cheapestOther = others.length ? others.reduce((a, b) => (a[1].allIn < b[1].allIn ? a : b)) : null;
  const holds = recStats && recStats.feasible;

  const paragraph = recommended
    ? `Across ${active.weeks.length} weeks and ${config.queues.length} queues under the ${viewName(config, activeViewId)} view, ${green} queue-weeks meet SLA, ${amber} are at risk and ${red} breach. ` +
      `The recommended strategy is ${recommended} (${strategyName(recommended)}) — ${holds ? "the lowest all-in cost that holds SLA" : "the least-bad option; no strategy holds SLA everywhere"} at ${moneyFull(cur, recStats.allIn)} all-in` +
      (cheapestOther ? `, versus ${moneyFull(cur, cheapestOther[1].allIn)} for the next-best ${cheapestOther[0]}.` : ".")
    : "No simulations are available yet.";

  return { statsById, recommended, active: activeStrategyId, rag: { green, amber, red }, paragraph, holds };
}

// ---- §7 Finance / HR / Business blocks ----
export function buildAudienceBlocks(sim, config) {
  const cur = config.engine.currency;
  const weeks = sim.weeks;
  const sm = sim.summary;
  const totalVolume = weeks.reduce((a, w) => a + w.totals.volume, 0);
  const totalCost = sm.totalCost;
  const churn = sm.churnCost;
  const idle = sm.waste;

  // break-even week: idle pay vs churn cost cross-over.
  let breakEven = null;
  for (let i = 1; i < weeks.length; i++) {
    const a = weeks[i - 1].totals.waste - weeks[i - 1].totals.churnCost;
    const b = weeks[i].totals.waste - weeks[i].totals.churnCost;
    if (a === 0 || (a < 0) !== (b < 0)) { breakEven = i + 1; break; }
  }

  const leaversWk = weeks.map((w) => config.queues.reduce((a, q) => a + w.queues[q.id].leavers, 0));
  const avgLeavers = leaversWk.reduce((a, v) => a + v, 0) / Math.max(1, leaversWk.length);
  const peakBurn = Math.max(0, ...config.queues.map((q) => Math.max(...weeks.map((w) => w.queues[q.id].burnout))));
  const avgTraining = weeks.reduce((a, w) => a + w.totals.inTraining, 0) / Math.max(1, weeks.length);
  const totalReqs = weeks.reduce((a, w) => a + config.queues.reduce((s, q) => s + (w.queues[q.id].reqsRaised || 0), 0), 0);

  const perQueueSla = config.queues.map((q) => {
    const greenWeeks = weeks.filter((w) => w.queues[q.id].status === "green").length;
    return { name: q.name, attainment: greenWeeks / Math.max(1, weeks.length) };
  });
  const totalDeflected = weeks.reduce((a, w) => a + config.queues.reduce((s, q) => s + (w.queues[q.id].deflected || 0), 0), 0);
  const p1Enabled = config.scenarios.some((s) => s.type === "p1" && (sim.viewIds || []).includes(s.id));

  return {
    finance: {
      runCost: totalCost, churn, idle, allIn: sm.allIn,
      costPerContact: totalVolume > 0 ? totalCost / totalVolume : 0,
      breakEven,
    },
    hr: {
      totalReqs, cap: config.hiring.cap, avgLeavers, tippingMargin: config.hiring.cap - avgLeavers,
      peakBurn, avgTraining, tippingPoint: sm.flags.tippingPoint,
    },
    business: {
      perQueueSla, customersLost: sm.lost, totalDeflected,
      p1Enabled, capInfeasible: sm.flags.capInfeasible,
    },
  };
}

// ---- §20a parameterised risk register ----
// Thresholds come from config.settings.risk so the register RE-SCORES at render
// time when a threshold changes — no re-simulation needed (the sim ignores
// settings.risk). Families beyond the R1 set: sustained-overtime dependence,
// training-debt peaks, borrowed-capacity dependence and unmanned starvation.
export function buildRiskRegister(sim, config) {
  const cur = config.engine.currency;
  const weeks = sim.weeks;
  const R = (config.settings && config.settings.risk) || {};
  const th = {
    burnout: R.burnout || { amber: 60, red: 85 },
    trainingDebt: R.trainingDebt || { amber: 40, red: 70 },
    otStreakWeeks: R.otStreakWeeks || { amber: 4, red: 8 },
    borrowedShare: R.borrowedShare || { amber: 0.25, red: 0.5 },
    unmanned: R.unmannedStarvation || { floorCover: 0.5, weeks: 4 },
    overCap: R.overCapacityPct || { amber: 0.1, red: 0.2 },
  };
  const risks = [];
  const push = (r) => risks.push(r);

  // cap infeasibility
  const binding = (sim.allocTrace || []).filter((t) => t.binding);
  if (binding.length) {
    const first = binding[0];
    const shortNames = Object.keys(first.denied).map((id) => (config.queues.find((q) => q.id === id) || {}).name || id);
    // projected churn from shorted queues over the horizon
    let projChurn = 0;
    for (const t of binding) for (const id of Object.keys(t.denied)) {
      const q = config.queues.find((x) => x.id === id);
      const lead = q ? q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length : 8;
      for (let w = t.week; w < Math.min(t.week + lead, weeks.length); w++) projChurn += weeks[w].queues[id].churnCost;
    }
    push({
      risk: "Hiring cap infeasible", driver: `Plan wants more than +${config.hiring.cap}/wk; ${shortNames.join(", ")} go short`,
      week: first.week + 1, severityValue: projChurn, severityMoney: projChurn, sla: `${binding.length} cap-bound wk`,
      lever: "Raise the global cap or hire earlier",
    });
  }

  // tipping point
  if (sim.summary.flags.tippingPoint) {
    push({
      risk: "Attrition tipping point", driver: "Weekly leavers exceed hiring throughput",
      week: null, severityValue: Infinity, severityMoney: null, sla: "Headcount cannot recover",
      lever: "Cut attrition/burnout or raise the cap",
    });
  }

  for (const q of config.queues) {
    const series = weeks.map((w) => w.queues[q.id]);
    const firstBreach = series.findIndex((s) => s.status === "red");
    const redWeeks = series.filter((s) => s.status !== "green").length;
    const qChurn = series.reduce((a, s) => a + s.churnCost, 0);
    if (firstBreach >= 0) {
      const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
      push({
        risk: `${q.name} breaches SLA`, driver: firstBreach < lead ? "Breach lands inside the hire-to-productive lead" : "Demand outruns supply",
        week: firstBreach + 1, severityValue: qChurn, severityMoney: qChurn, sla: `${redWeeks} wk not green`,
        lever: firstBreach < lead ? "Cover with flex, service teams or deferral" : "Hire earlier / raise cap",
      });
    }
    const peakBurn = Math.max(...series.map((s) => s.burnout));
    if (peakBurn >= th.burnout.amber) {
      const wk = series.findIndex((s) => s.burnout === peakBurn);
      push({
        risk: `${q.name} burnout peak`, driver: `Occupancy over threshold lifts attrition (peak ${Math.round(peakBurn)}/100)`,
        week: wk + 1, severityValue: peakBurn * 1000, severityMoney: null, sla: `${Math.round(peakBurn)}/100`,
        lever: "Add heads or ease occupancy", band: peakBurn >= th.burnout.red ? "red" : "amber",
      });
    }
    // §17 sustained-overtime dependence
    const peakOtStreak = Math.max(0, ...series.map((s) => s.otStreakWeeks || 0));
    if (peakOtStreak >= th.otStreakWeeks.amber) {
      const wk = series.findIndex((s) => (s.otStreakWeeks || 0) === peakOtStreak);
      const otCost = series.reduce((a, s) => a + (s.otCost || 0), 0);
      push({
        risk: `${q.name} sustained overtime`, driver: `OT used ${peakOtStreak} consecutive weeks`,
        week: wk + 1, severityValue: otCost, severityMoney: otCost, sla: `${peakOtStreak} wk streak`,
        lever: "Hire — OT is masking a structural shortfall", band: peakOtStreak >= th.otStreakWeeks.red ? "red" : "amber",
      });
    }
    // §17 training-debt peaks
    const peakDebt = Math.max(0, ...series.map((s) => s.trainingDebt || 0));
    if (peakDebt >= th.trainingDebt.amber) {
      const wk = series.findIndex((s) => (s.trainingDebt || 0) === peakDebt);
      push({
        risk: `${q.name} training debt`, driver: `Reclaimed training accrues debt (peak ${Math.round(peakDebt)}/100 — AHT + attrition drift up)`,
        week: wk + 1, severityValue: peakDebt * 1500, severityMoney: null, sla: `${Math.round(peakDebt)}/100`,
        lever: "Restore training hours to let debt decay", band: peakDebt >= th.trainingDebt.red ? "red" : "amber",
      });
    }
    // §20a borrowed-capacity dependence (a resilience risk even when green)
    const peakBorrow = Math.max(0, ...series.map((s) => s.borrowedSharePct || 0));
    if (peakBorrow > th.borrowedShare.amber) {
      const wk = series.findIndex((s) => (s.borrowedSharePct || 0) === peakBorrow);
      push({
        risk: `${q.name} borrowed-capacity dependence`, driver: `Meets ${Math.round(peakBorrow * 100)}% of requirement from pools / leverage / recycling`,
        week: wk + 1, severityValue: peakBorrow * 5000, severityMoney: null, sla: `${Math.round(peakBorrow * 100)}% borrowed`,
        lever: "Resource this queue directly to reduce fragility", band: peakBorrow > th.borrowedShare.red ? "red" : "amber",
      });
    }
    // §17/§20a unmanned starvation
    if ((q.resourcing === "unmanned" || q.resourcing === "supported")) {
      const starved = series.filter((s) => s.cover < th.unmanned.floorCover).length;
      if (starved >= th.unmanned.weeks) {
        const wk = series.findIndex((s) => s.cover < th.unmanned.floorCover);
        push({
          risk: `${q.name} unmanned starvation`, driver: `Below ${Math.round(th.unmanned.floorCover * 100)}% cover for ${starved} weeks with no own staff`,
          week: wk + 1, severityValue: starved * 4000 + qChurn, severityMoney: qChurn, sla: `${starved} wk starved`,
          lever: "Add a supporter/pool donor or give it dedicated HC", band: "red",
        });
      }
    }
    // over-capacity carrying cost with time-to-rectify under a freeze
    const last = series[series.length - 1];
    if (last.paid > last.reqFte * (1 + th.overCap.amber) && last.reqFte > 0) {
      const excess = last.paid - last.reqFte;
      const perWeek = last.paid * (q.wf.attrition / 4.345);
      const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
      const carry = ((excess * q.agentCost) / 52) * (wks / 2);
      push({
        risk: `${q.name} over capacity`, driver: `${excess.toFixed(0)} FTE above requirement at horizon end`,
        week: weeks.length, severityValue: carry, severityMoney: carry, sla: `~${wks} wk to clear under a freeze`,
        lever: "Freeze hiring; let attrition rebalance",
      });
    }
    // deflection spiral (digital)
    if (q.type === "digital") {
      const totalDefl = series.reduce((a, s) => a + (s.deflected || 0), 0);
      if (totalDefl > q.dailyVolume) {
        push({
          risk: `${q.name} deflection spiral`, driver: `${Math.round(totalDefl).toLocaleString()} contacts deflected to voice`,
          week: series.findIndex((s) => (s.deflected || 0) > 0) + 1, severityValue: totalDefl * 10, severityMoney: null,
          sla: `${Math.round(totalDefl).toLocaleString()} deflected`, lever: "Add digital capacity or raise the backlog limit",
        });
      }
    }
  }

  // default sort: money severity desc, then week asc
  risks.sort((a, b) => (b.severityValue - a.severityValue) || ((a.week || 999) - (b.week || 999)));
  return risks;
}
