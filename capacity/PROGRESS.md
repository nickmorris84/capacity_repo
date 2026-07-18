# Progress

## P1 — Engine + proof: ✅ COMPLETE (all 20 gate tests green)

Validated numbers (must match SPEC §11 E1 before P2 is authorised):
- Erlang C recursion ≡ direct summation to 1e-6 (N=11..16, 20, 30 at A=10)
- Patience→∞: N=13 → C=0.2853, ASA=17.11s, SL(20s)=79.6% ✓ (spec: 0.2853 / 17.0±0.3 / 79.7±0.5)
- Overload (patience 90s): abandonment strictly > 1−N/A, monotone in N; N=3 → 72.8% vs 70% conservation ✓
- ASA bounded (< patience) and monotone through N=9..25, no NaN/∞ ✓

Engine surface (engine/engine.js, pure JS, no DOM):
- Erlang B/C/A (self-consistent abandonment solve), fractional-agent blending, 0.05-Erlang quantised persistent caches
- Requirement curves (voice minimal-N search; digital demand/concurrency/ceiling), day models (requirement-shaped supply; digital fluid backlog with linear wait ramp)
- Volume precedence: CSV-or-flat → seasonality (system × queue monthly, startMonth; 5 built-in presets) → growth/events → endogenous deflection + redial (fixed point, ≤3 iters, 4× cap)
- View-aware scenarios: simulate(cfg, { viewIds, strategy, captureDaily })
- Supply projection to landing week; strategies S1 (meet), S2 (buffer, default +10%), S3 (forward backfill only), S4 (manual, ignores cap)
- Global hiring cap allocator: marginal churn cost averted per FTE, tie-break earliest projected breach; full weekly allocation trace (grants / denied / binding / order)
- Summary: findings + flags { tippingPoint, capInfeasible }, over-capacity time-to-rectify, compactRun() shape for saving/compare

Performance: 1 sim 106ms, 8 sims 871ms (budget 250ms / 1000ms) ✓

Notes for P2+: reqCurve/reqFte caches are per-simulate (profile edits would stale a global cache); Erlang caches are module-persistent by design. decideHiring exposes `trace` per week — render it in the holistic panel (P3).

## P2 — Core UI: not started
## P3 — Strategies + views: not started
## P4 — Data + documents: not started
## P5 — Persistence + packaging: not started
