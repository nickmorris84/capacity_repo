/* Single self-contained stylesheet, exported as a string so it can be injected
   into a <style> tag both in the browser and in the P5 standalone build.

   Design system: the approved Grey & Yellow guide — charcoal header, yellow
   accent, neutral cards. Two governing rules: (1) colour carries exactly two
   meanings — yellow = "the answer" (selected / recommended / total), RAG =
   status (warm red = financial risk) — everything else is neutral grey;
   (2) Summary reads like a document for leadership, other tabs are dense tools.
   Print follows the Definitive print guide: A4 portrait, ink economy (borders
   and rules, no fills or shadows), meanings that survive greyscale.
   Font: Public Sans when available, system-ui fallback (the app is offline —
   no webfont fetch). Fully responsive; visible focus rings. */
export const CSS = `
:root {
  /* surfaces */
  --bg:            #f1f1ef;
  --surface:       #ffffff;
  --surface-alt:   #faf9f6;
  --header-top:    #3b3e44;
  --header-bot:    #2a2c31;
  --on-header:     #f5f4f0;

  /* ink */
  --ink:           #26282c;
  --ink-muted:     #5c5b54;
  --ink-subtle:    #82817a;

  /* lines */
  --border:        #e4e3df;
  --border-soft:   #ecebe6;
  --field-border:  #dcdbd4;

  /* brand accent = "the answer" */
  --accent:        #f2c744;
  --accent-ink:    #2a2c31;
  --accent-tint:   #fbf1cf;
  --accent-tint-2: #faf6e8;
  --accent-row:    #f7f2df;
  --accent-border: #ecdb95;
  --accent-text:   #8a6d10;
  --input-fill:    #fbf4d8;
  --input-border:  #e6d9a6;

  /* status: RAG (+ warm red = financial risk) */
  --green:         #12a06b; --green-text: #0f7a4f; --green-tint: #e6f6ef; --green-border: #bfe8d4;
  --amber:         #c99a2e; --amber-text: #b5822c; --amber-tint: #fdf3e6;
  --red:           #e0574a; --risk-text:  #b23c2a; --risk-tint:  #fdf8f6; --risk-subtle: #b06a5a;

  /* data-segment groups (Data tab column bands) */
  --seg-demand:  #8a6d10; --seg-demand-bg:  #efe9d6;
  --seg-service: #4655c9; --seg-service-bg: #eef0fb;
  --seg-people:  #7a4bc4; --seg-people-bg:  #f2ebfa;
  --seg-supply:  #2f8f5b; --seg-supply-bg:  #e8f5ec;
  --seg-money:   #b5822c; --seg-money-bg:   #fdf3e6;
  --seg-status:  #5a6b7a; --seg-status-bg:  #eef1f4;

  /* geometry */
  --r-chip: 6px; --r-btn: 8px; --r-card: 14px; --r-pill: 20px;
  --radius: var(--r-card); --radius-s: var(--r-btn);
  --line: var(--border); --line-2: var(--field-border);
  --panel: var(--surface); --panel-2: var(--surface-alt);
  --text: var(--ink); --muted: var(--ink-muted);
  --green-s: var(--green-tint); --amber-s: var(--amber-tint); --red-s: #f9e6e3;

  /* elevation: cards use borders, not shadow */
  --shadow: none;
  --lift-sheet: 0 24px 50px -34px rgba(0,0,0,.45);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sans: "Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--sans); color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45; }
.app { min-height: 100vh; display: flex; flex-direction: column; }

/* ---- top bar (charcoal gradient, yellow logo mark) ---- */
.topbar { display: flex; align-items: center; gap: 14px; padding: 10px 18px; background: linear-gradient(180deg, var(--header-top), var(--header-bot)); color: var(--on-header); position: sticky; top: 0; z-index: 30; }
.brand { display: flex; align-items: baseline; gap: 9px; font-weight: 700; letter-spacing: .2px; }
.brand .mark { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--accent); color: var(--accent-ink); font-size: 16px; font-weight: 800; align-self: center; }
.brand small { color: #a9a8a1; font-weight: 500; letter-spacing: .3px; }
.topbar .spacer { flex: 1; }
.backlink { appearance: none; border: 1px solid rgba(255,255,255,.18); background: transparent; color: var(--on-header); font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: var(--r-btn); cursor: pointer; white-space: nowrap; }
.backlink:hover { background: rgba(255,255,255,.08); }
.backlink:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.recalc { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--amber-text); background: var(--amber-tint); padding: 5px 11px; border-radius: var(--r-pill); }
.recalc .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: pulse 1s ease-in-out infinite; }
.recalc.idle { color: var(--green-text); background: var(--green-tint); border: 1px solid var(--green-border); }
.recalc.idle .dot { background: var(--green); animation: none; }
@keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
@media (prefers-reduced-motion: reduce) { .recalc .dot { animation: none; } * { transition: none !important; } }

/* ---- tabs (in the charcoal band; active = white + yellow underline) ---- */
.tabs { display: flex; gap: 2px; overflow-x: auto; background: var(--header-bot); padding: 0 8px; position: sticky; top: 52px; z-index: 25; scrollbar-width: thin; }
.tab { appearance: none; border: 0; background: transparent; color: var(--on-header); opacity: .65; font: inherit; font-weight: 600; font-size: 14px; padding: 11px 16px; cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; }
.tab:hover { opacity: .9; }
.tab[aria-selected="true"] { color: #fff; opacity: 1; font-weight: 700; border-bottom-color: var(--accent); }
.tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 4px; }

/* ---- context strip (white bar; the single source of run-state) ---- */
.ctxbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 8px 18px; background: var(--surface); color: var(--ink); border-bottom: 1px solid var(--border); position: sticky; top: 94px; z-index: 24; }
.ctx-item { display: flex; align-items: center; gap: 7px; position: relative; }
.ctx-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-subtle); font-weight: 700; }
.ctx-chip { appearance: none; border: 1px solid var(--field-border); background: var(--accent-tint-2); color: var(--ink); border-radius: var(--r-btn); padding: 6px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; max-width: 340px; }
.ctx-chip strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-strat { position: relative; }
.ctx-chip:hover { border-color: var(--accent-border); }
.ctx-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ctx-chip .ctx-sub { font-size: 11px; color: var(--ink-muted); font-weight: 500; }
.ctx-select { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 9px; border-radius: var(--r-btn); border: 1px solid var(--field-border); background: var(--accent-tint-2); color: var(--ink); }
.ctx-select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ctx-pop { top: 40px; left: 0; transform: none; width: 320px; max-width: 88vw; text-align: left; }
@media (max-width: 760px) { .ctxbar { position: static; } }

/* ---- layout ---- */
/* Rule 9: the document itself never scrolls horizontally. Sticky chrome (topbar,
   tabs, context bar) are siblings of .main, so clipping overflow here is safe and
   never disables their stickiness. Intrinsically-wide content still scrolls
   internally inside its own width-capped .tbl-wrap / .ribbon-wrap / .chart. */
.main { flex: 1; padding: 18px 28px; max-width: 1200px; width: 100%; margin: 0 auto; overflow-x: clip; }
.grid { display: grid; gap: 16px; min-width: 0; }
.grid > * { min-width: 0; }
.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 900px) { .cols-2, .cols-3 { grid-template-columns: 1fr; } }

/* ---- card (border, no shadow) ---- */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); max-width: 100%; min-width: 0; }
.card > .card-h { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.card > .card-h h3, .card > .card-h h4 { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: .1px; }
.card > .card-h .sub { color: var(--ink-subtle); font-size: 12px; font-weight: 500; }
.card > .card-b { padding: 16px; }
.section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: var(--accent-text); margin: 4px 2px 10px; }

/* ---- findings strip ---- */
.findings { display: flex; gap: 10px; overflow-x: auto; padding: 2px; scrollbar-width: thin; }
.finding { flex: 0 0 auto; max-width: 340px; display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: var(--r-btn); border: 1px solid var(--border); background: var(--surface); font-size: 12.5px; line-height: 1.4; }
.finding .pip { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex: 0 0 auto; }
.finding.red { background: var(--risk-tint); border-color: #ecc9c1; }
.finding.amber { background: var(--amber-tint); border-color: #ecd8ac; }
.finding.green { background: var(--green-tint); border-color: var(--green-border); }
.finding.red .pip { background: var(--red); } .finding.amber .pip { background: var(--amber); } .finding.green .pip { background: var(--green); }

/* ---- RAG ribbon ---- */
.ribbon-wrap { overflow-x: auto; scrollbar-width: thin; max-width: 100%; }
.ribbon { border-collapse: separate; border-spacing: 3px; }
.ribbon th { font-size: 11px; font-weight: 600; color: var(--ink-muted); text-align: right; padding: 2px 6px; white-space: nowrap; position: sticky; left: 0; background: var(--surface); z-index: 2; }
.ribbon thead th { text-align: center; position: static; }
.ribbon .wk { font-size: 10px; color: var(--ink-subtle); font-weight: 600; }
.cell { width: 22px; height: 22px; border-radius: 5px; border: 0; padding: 0; cursor: pointer; position: relative; transition: transform .08s ease; }
.cell:hover { transform: scale(1.18); z-index: 3; }
.cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.cell[data-st="green"] { background: var(--green); } .cell[data-st="amber"] { background: var(--amber); } .cell[data-st="red"] { background: var(--red); }
.cell.scrubbed { box-shadow: 0 0 0 2px var(--ink); }
.evmark { position: relative; }
.evmark::after { content: ""; position: absolute; top: -1px; right: -1px; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 1.5px #fff; }
.ribbon-scrub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
.scrub-week { font-weight: 700; font-size: 13px; }
.legend { display: flex; gap: 12px; align-items: center; font-size: 11.5px; color: var(--ink-muted); }
.legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }

/* ---- intraday week strip ---- */
.week-strip { display: flex; flex-wrap: wrap; gap: 4px; }
.wk-cell { width: 34px; height: 30px; border-radius: 6px; border: 1px solid var(--border); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; font-variant-numeric: tabular-nums; }
.wk-cell[data-st="green"] { background: var(--green); } .wk-cell[data-st="amber"] { background: var(--amber); } .wk-cell[data-st="red"] { background: var(--red); }
.wk-cell:hover { filter: brightness(1.08); }
.wk-cell.sel { box-shadow: 0 0 0 2px var(--ink); }
.wk-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* ---- queue status cards ---- */
.qcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.qcard { border: 1px solid var(--border); border-radius: var(--r-btn); padding: 12px; background: var(--surface); border-left: 4px solid var(--field-border); }
.qcard.green { border-left-color: var(--green); } .qcard.amber { border-left-color: var(--amber); } .qcard.red { border-left-color: var(--red); }
.qcard .qn { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 7px; }
.qcard .qtype { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-subtle); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; }
.qcard .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 10px; }
.qcard .kpi .l { font-size: 11px; color: var(--ink-subtle); text-transform: uppercase; letter-spacing: .04em; }
.qcard .kpi .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 3px 8px; border-radius: var(--r-chip); }
.badge.green { background: var(--green-tint); color: var(--green-text); } .badge.amber { background: var(--amber-tint); color: var(--amber-text); } .badge.red { background: var(--red-s); color: var(--risk-text); }

/* ---- charts ---- */
.chart { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); overflow: hidden; max-width: 100%; min-width: 0; }
.chart-h { display: flex; align-items: center; gap: 8px; padding: 11px 14px 6px; }
.chart-h h4 { margin: 0; font-size: 13px; font-weight: 700; }
.chart-b { padding: 4px 8px 10px; overflow-x: auto; }
.recharts-text { font-size: 11px; fill: var(--ink-muted); }
.recharts-cartesian-axis-tick-value { font-size: 11px; }

/* ---- tables (figures tabular + right-aligned; totals = the answer) ---- */
.tbl-wrap { overflow-x: auto; scrollbar-width: thin; border: 1px solid var(--border); border-radius: var(--r-btn); max-width: 100%; }
table.data { border-collapse: collapse; width: 100%; font-size: 12.5px; font-variant-numeric: tabular-nums; }
table.data th, table.data td { padding: 7px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--border-soft); }
table.data th:first-child, table.data td:first-child { text-align: left; }
table.data thead th { position: sticky; top: 0; background: var(--surface-alt); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-subtle); z-index: 1; }
table.data tbody tr:hover { background: var(--surface-alt); }
table.data td.st-green { color: var(--green-text); } table.data td.st-amber { color: var(--amber-text); } table.data td.st-red { color: var(--risk-text); font-weight: 700; }
/* Data-tab column-group tints */
table.data.grouped td.grp-demand { background: rgba(138,109,16,.05); }
table.data.grouped td.grp-service { background: rgba(70,85,201,.05); }
table.data.grouped td.grp-people { background: rgba(122,75,196,.05); }
table.data.grouped td.grp-money { background: rgba(181,130,44,.06); }
table.data.grouped thead th.grp-demand { border-bottom: 2px solid var(--seg-demand); }
table.data.grouped thead th.grp-service { border-bottom: 2px solid var(--seg-service); }
table.data.grouped thead th.grp-people { border-bottom: 2px solid var(--seg-people); }
table.data.grouped thead th.grp-money { border-bottom: 2px solid var(--seg-money); }
table.data.grouped tbody tr:hover td { background: var(--surface-alt); }
/* hiring summary group rows; the grand total is "the answer" → accent row */
table.data tr.grp td { background: var(--surface-alt); border-top: 1px solid var(--field-border); }
table.data tr.grp.total td { border-top: 2px solid var(--accent); background: var(--accent-row); font-weight: 800; }

/* ---- form controls ---- */
.field { display: flex; flex-direction: column; gap: 4px; }
.field > .lab { font-size: 11px; color: var(--ink-subtle); font-weight: 600; letter-spacing: .04em; display: flex; align-items: center; gap: 6px; }
.field input, .field select, input.inp, select.inp { font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid var(--field-border); border-radius: var(--r-btn); background: var(--surface); color: var(--ink); width: 100%; }
.field input:focus, .field select:focus, input.inp:focus, select.inp:focus, .field input:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; border-color: var(--accent-border); }
.field .unit { color: var(--ink-subtle); font-size: 11px; }
.fieldrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }

/* ---- buttons ---- */
.btn { appearance: none; font: inherit; font-weight: 600; font-size: 13px; padding: 8px 14px; border-radius: var(--r-btn); border: 1px solid var(--border); background: var(--surface); color: var(--ink-muted); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.btn:hover { background: var(--surface-alt); color: var(--ink); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn.primary { background: var(--header-bot); border-color: var(--header-bot); color: var(--accent); font-weight: 700; }
.btn.primary:hover { background: #3b3e44; color: var(--accent); }
.btn.ghost { border-color: transparent; background: transparent; color: var(--accent-text); }
.btn.danger { color: var(--risk-text); border-color: #e6c4bc; }
.btn.danger:hover { background: var(--risk-tint); }
.btn.sm { padding: 5px 10px; font-size: 12px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btnbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ---- toggle / switch ---- */
.switch { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch .track { width: 38px; height: 22px; border-radius: 999px; background: var(--field-border); position: relative; transition: background .15s; flex: 0 0 auto; }
.switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
.switch input:checked + .track { background: var(--accent); }
.switch input:checked + .track::after { transform: translateX(16px); }
.switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ---- hint (tap to reveal, not hover title) ---- */
.hint { position: relative; display: inline-flex; }
.hint > button { appearance: none; border: 1px solid var(--field-border); background: var(--surface-alt); color: var(--ink-subtle); width: 16px; height: 16px; border-radius: 50%; font-size: 10px; font-weight: 700; line-height: 1; cursor: pointer; padding: 0; display: inline-grid; place-items: center; }
.hint > button:hover { color: var(--accent-text); border-color: var(--accent-border); }
.hint > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hint .pop { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 260px; background: var(--header-bot); color: #f2f1ec; font-size: 12px; font-weight: 400; line-height: 1.4; padding: 9px 11px; border-radius: var(--r-btn); box-shadow: 0 6px 24px rgba(0,0,0,.25); z-index: 40; text-transform: none; letter-spacing: 0; }
.hint .pop::before { content: ""; position: absolute; top: -5px; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-bottom-color: var(--header-bot); border-top: 0; }

/* generic popover (context bar etc.) */
.pop { position: absolute; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 10px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.14); z-index: 40; }

/* ---- editor list rows ---- */
.rows { display: flex; flex-direction: column; gap: 12px; }
.erow { border: 1px solid var(--border); border-radius: var(--r-btn); background: var(--surface); }
.erow > summary, .erow .erow-h { list-style: none; cursor: pointer; padding: 12px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.erow > summary::-webkit-details-marker { display: none; }
.erow-h .drag { color: var(--ink-subtle); }
.erow[open] > summary { border-bottom: 1px solid var(--border); }
.erow .erow-b { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.chev { transition: transform .12s; color: var(--ink-subtle); }
.erow[open] .chev { transform: rotate(90deg); }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--surface-alt); border: 1px solid var(--border); color: var(--ink-muted); }

/* ---- intraday sliders ---- */
.sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(52px, 1fr)); gap: 6px; align-items: end; }
.slider-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.slider-cell input[type=range] { writing-mode: vertical-lr; direction: rtl; width: 20px; height: 90px; accent-color: var(--accent); }
.slider-cell .t { font-size: 9px; color: var(--ink-subtle); font-variant-numeric: tabular-nums; }
.slider-cell .val { font-size: 9px; color: var(--ink); font-variant-numeric: tabular-nums; }

/* ---- misc ---- */
.stat-row { display: flex; gap: 18px; flex-wrap: wrap; }
.stat { min-width: 110px; }
.stat .l { font-size: 11px; color: var(--ink-subtle); text-transform: uppercase; letter-spacing: .04em; display: block; }
.stat .v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.4px; }
.stat .v small { font-size: 12px; font-weight: 600; color: var(--ink-muted); }
.empty { color: var(--ink-muted); font-size: 13px; padding: 24px; text-align: center; }
.note { font-size: 12px; color: var(--ink-muted); background: var(--surface-alt); border: 1px dashed var(--field-border); border-radius: var(--r-btn); padding: 10px 12px; }
.tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--r-chip); background: var(--accent); color: var(--accent-ink); }
.tag.soft { background: var(--accent-tint); color: var(--accent-text); }
.rowflex { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.spacer { flex: 1; }
hr.sep { border: 0; border-top: 1px solid var(--border); margin: 4px 0; }

@media (max-width: 760px) { .topbar { flex-wrap: wrap; } }
@media (max-width: 640px) {
  .main { padding: 12px; }
  .topbar { padding: 9px 12px; }
  .brand small { display: none; }
  .qcards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) { .qcards { grid-template-columns: 1fr; } }

/* ---- report ---- */
.report { display: flex; flex-direction: column; gap: 16px; }
.report-section { break-inside: avoid; }
.report-section h2 { font-size: 20px; }
.report-section h3 { font-size: 15px; margin: 0 0 10px; }
.report-section h4 { font-size: 13px; margin: 16px 0 8px; color: var(--ink-muted); }
.report-chart { overflow-x: auto; margin: 4px 0; }

/* ---- read-only banner ---- */
.ro-banner { background: var(--amber-tint); color: var(--amber-text); border-bottom: 1px solid var(--amber); padding: 8px 20px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
table.data.grouped td.grp-week { background: rgba(90,107,122,.05); }
table.data.grouped td.grp-supply { background: rgba(47,143,91,.06); }
table.data.grouped td.grp-status { background: rgba(90,107,122,.04); }
table.data.grouped thead th.grp-week { border-bottom: 2px solid var(--seg-status); }
table.data.grouped thead th.grp-supply { border-bottom: 2px solid var(--seg-supply); }
table.data.grouped thead th.grp-status { border-bottom: 2px solid var(--seg-status); }

/* decision matrix — the selected cell is "the answer": accent tint + 2px
   accent border + 800 weight (reads in greyscale via border + weight). */
table.matrix { border-collapse: separate; border-spacing: 4px; }
table.matrix th { font-size: 11px; color: var(--ink-subtle); font-weight: 700; padding: 4px 8px; text-align: center; text-transform: uppercase; letter-spacing: .04em; }
table.matrix th.row-h { text-align: right; white-space: nowrap; }
.mx-cell { border: 1px solid var(--border); border-radius: var(--r-btn); padding: 8px 10px; min-width: 116px; cursor: pointer; background: var(--surface); text-align: center; font-variant-numeric: tabular-nums; }
.mx-cell:hover { border-color: var(--accent-border); }
.mx-cell.green { background: var(--green-tint); } .mx-cell.amber { background: var(--amber-tint); } .mx-cell.red { background: var(--risk-tint); }
.mx-cell.sel { background: var(--accent-tint); border: 2px solid var(--accent); font-weight: 800; padding: 7px 9px; }
.mx-cell .mx-all { font-weight: 700; font-size: 13px; }
.mx-cell.sel .mx-all { font-weight: 800; }
.mx-cell .mx-flags { font-size: 10px; color: var(--ink-muted); margin-top: 2px; }
.mx-stale { background: var(--amber-tint); color: var(--amber-text); border: 1px solid var(--amber); border-radius: var(--r-btn); padding: 8px 12px; font-size: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.mx-autopick { color: var(--ink-muted); font-size: 11.5px; margin-bottom: 8px; font-style: italic; }

/* holistic hierarchy blocks + filter chips */
.holo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.holo-block { border: 1px solid var(--border); border-radius: var(--r-btn); padding: 10px 12px; background: var(--surface-alt); }
.holo-block-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.holo-block-h strong { font-size: 12.5px; }
.holo-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.holo-mini .l { font-size: 10px; color: var(--ink-subtle); display: block; }
.holo-mini .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chip { appearance: none; font: inherit; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--field-border); background: var(--surface); color: var(--ink-muted); cursor: pointer; }
.chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ink-muted); margin-right: 10px; }

/* blank empty state */
.empty-state { text-align: center; padding: 40px 20px; border: 1px dashed var(--field-border); border-radius: var(--r-card); background: var(--surface); margin-bottom: 16px; }
.empty-state .es-mark { font-size: 34px; color: var(--accent-text); }
.empty-state h2 { margin: 8px 0 6px; font-size: 20px; }
.empty-state p { color: var(--ink-muted); max-width: 520px; margin: 0 auto 16px; }

/* files card rows */
.files-row { border: 1px solid var(--border); border-radius: var(--r-btn); padding: 12px 14px; background: var(--surface-alt); }
.files-row-h { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.files-row-h strong { font-size: 12.5px; }
.files-row-h .note { font-size: 11.5px; }

/* preset library rows */
.preset-lib { display: flex; flex-direction: column; gap: 10px; }
.preset-item { border: 1px solid var(--border); border-radius: var(--r-btn); background: var(--surface); padding: 10px 12px; }
.preset-item .preset-item-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

/* inheritance indicator */
.inherit-ind { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; }
.inherit-ind.inherited { background: var(--seg-service-bg); color: var(--seg-service); }
.inherit-ind.overridden { background: var(--amber-tint); color: var(--amber-text); }
.acc-sec { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; background: var(--surface); }
.acc-sec > summary { list-style: none; cursor: pointer; padding: 10px 12px; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.acc-sec > summary::-webkit-details-marker { display: none; }
.acc-sec > .acc-b { padding: 0 12px 12px; }

/* Data tab — editable input cells vs computed outcomes: inputs are accent
   chips (the only editable affordance), outcomes plain muted text. */
table.data.seg th.seg-first, table.data.seg td.seg-first { border-left: 2px solid var(--field-border); }
table.data td.cell-ro { color: var(--ink-muted); }
table.data th.col-input { color: var(--accent-text); }
table.data td.col-input { background: var(--accent-tint-2); }
.cell-inp { width: 74px; font: inherit; font-size: 12px; font-weight: 700; padding: 3px 6px; border: 1px solid var(--input-border); border-radius: var(--r-chip); background: var(--input-fill); color: var(--accent-text); text-align: right; font-variant-numeric: tabular-nums; }
.cell-inp:focus { outline: 2px solid var(--accent); outline-offset: 0; }

/* ---- §26 landing ---- */
.landing-title { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -.3px; }
.sim-cards { display: flex; flex-direction: column; gap: 14px; }
.sim-card > .card-h h3 { font-size: 16px; }
.sim-headline { display: flex; gap: 22px; flex-wrap: wrap; }
.sim-headline .stat { min-width: 90px; }
.sim-headline .stat .v { font-size: 17px; }
.delete-confirm { margin-top: 10px; border: 1px solid #e6c4bc; background: var(--risk-tint); border-radius: var(--r-btn); padding: 12px; }

/* ---- §26.5 wizard ---- */
.wiz-steps { list-style: none; display: flex; gap: 8px; flex-wrap: wrap; padding: 0; margin: 0 0 16px; }
.wiz-steps li { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink-subtle); border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; background: var(--surface); }
.wiz-steps li .wiz-n { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--surface-alt); border: 1px solid var(--field-border); font-size: 10.5px; font-weight: 700; }
.wiz-steps li.active { color: var(--accent-ink); background: var(--accent-tint); border-color: var(--accent); font-weight: 700; }
.wiz-steps li.active .wiz-n { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.wiz-steps li.done { color: var(--green-text); background: var(--green-tint); border-color: var(--green-border); }

/* ---- §26.4 Simulation Settings collapsible sections ---- */
.set-secs { display: flex; flex-direction: column; gap: 10px; }
.set-sec { border: 1px solid var(--border); border-radius: var(--r-card); background: var(--surface); }
.set-sec > summary { list-style: none; cursor: pointer; padding: 13px 16px; display: flex; align-items: center; gap: 10px; }
.set-sec > summary::-webkit-details-marker { display: none; }
.set-sec .set-sec-t { font-size: 14px; font-weight: 800; }
.set-sec > summary .sub { color: var(--ink-subtle); font-size: 12px; font-weight: 500; }
.set-sec[open] > summary { border-bottom: 1px solid var(--border); }
.set-sec[open] > summary .chev { transform: rotate(90deg); }
.set-sec .set-b { padding: 16px; }
.set-h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: var(--accent-text); margin: 0 0 10px; }
.set-h4 + .fieldrow { margin-bottom: 14px; }

/* ═══ Print (Definitive guide): A4 portrait, ink economy, greyscale-safe ═══ */
@page { size: A4 portrait; margin: 14mm 15mm; }
@media print {
  :root {
    --bg: #ffffff; --surface: #ffffff; --surface-alt: #f7f6f2;
    --ink: #1e2024; --ink-muted: #565550; --ink-subtle: #7c7b74;
    --border: #d9d8d3; --border-soft: #e7e6e1;
    --accent-text: #7a5f0d; --accent-border: #e6d494;
    --green-text: #0d6b45; --green-tint: #e6f4ec;
    --amber-text: #9a6c14; --amber-tint: #fbf0da;
    --risk-text: #a5341f; --risk-tint: #fbf1ee;
    --r-card: 8px; --r-chip: 5px;
    --lift-sheet: none;
  }
  html, body { background: #fff; }
  body { font-size: 11.5pt; }
  /* screen chrome never prints */
  .topbar, .tabs, .ctxbar, .recalc, .btnbar, .btn, .backlink, .hint,
  .mx-stale, .ro-banner, [data-print="hide"] { display: none !important; }
  .main { padding: 0; max-width: none; }
  /* structure with hairline borders and rules — no shadows, no dark fills */
  .card, .chart, .erow, .set-sec { box-shadow: none; break-inside: avoid; border-radius: var(--r-card); }
  .card > .card-h { border-bottom: 2px solid var(--ink); }
  .card > .card-h h3, .card > .card-h h4 { break-after: avoid; }
  h1, h2, .section-title { break-after: avoid; }
  table.data { font-size: 10pt; }
  table.data thead th { font-size: 8pt; }
  table.data thead { break-inside: avoid; }
  tr { break-inside: avoid; }
  /* totals + recommended survive greyscale via rule weight, not tint alone */
  table.data tr.grp.total td { border-top: 2px solid var(--accent); font-weight: 800; }
  .mx-cell.sel { border: 2px solid var(--accent); font-weight: 800; }
  .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-chart { overflow: visible; }
  [role="tabpanel"][hidden] { display: none !important; }
}
`;
