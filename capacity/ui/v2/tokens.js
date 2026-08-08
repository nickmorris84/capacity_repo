/* v2.4 rebuild — shared design system (extracted verbatim from the mockups'
 * :root and component CSS: setup-page-v3.html, results/levers/home-*-v2.html).
 * Blue-led light theme, six KPI-family colours, status = colour + glyph, tabular
 * numerals. One injected stylesheet for the whole v2 UI. Kept as a JS string so
 * the standalone build and the JSDOM gate inject it the same way the v1 app does.
 */
export const FAMILY_COLORS = {
  inputs: "#185FA5",      // blue
  performance: "#0F6E56", // teal
  efficiency: "#534AB7",  // purple
  workforce: "#993C1D",   // coral
  customer: "#993556",    // pink
  outputs: "#BA7517",     // amber (ink-safe)
};

export const CSS = `
:root{
  --blue:#185FA5; --blue-deep:#0C447C; --blue-tint:#E6F1FB; --blue-line:#B5D4F4; --blue-mid:#378ADD;
  --purple:#534AB7; --purple-bg:#EEEDFE;
  --teal:#0F6E56; --teal-bg:#E1F5EE;
  --amber:#EF9F27; --amber-bg:#FAEEDA; --amber-ink:#633806;
  --green-bg:#EAF3DE; --green-ink:#27500A;
  --coral:#993C1D; --coral-bg:#FAECE7;
  --pink:#993556; --pink-bg:#FBEAF0;
  --red:#E24B4A; --red-bg:#FCEBEB; --red-ink:#791F1F; --red-line:#F0B4B4;
  /* --ink-3 was #8a887f: 3.40:1 on canvas at 9-12.5px, i.e. below AA for most
     of the words on the surface. #6f6d64 is 4.97:1 on canvas and 4.53:1 on
     blue-tint, with --ink-2 at 6.61:1 so the three-step hierarchy survives. */
  --ink:#1a1a1a; --ink-2:#5c5a54; --ink-3:#6f6d64;
  --line:#e4e2db; --canvas:#fbfaf7;
}
*{box-sizing:border-box; margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:var(--canvas); color:var(--ink); font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums}
.shell{max-width:960px; margin:0 auto; padding:0 16px 60px}

header.top{display:flex; align-items:center; justify-content:space-between;
  padding:14px 0; border-bottom:0.5px solid var(--line); margin-bottom:18px}
.brand{display:flex; align-items:center; gap:10px}
.mark{width:32px; height:32px; border-radius:9px; background:var(--blue); color:var(--blue-tint);
  display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px}
.brand h1{font-size:15px; font-weight:600}
.brand small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400}
.tabs{display:flex; gap:2px; font-size:12.5px; color:var(--ink-3)}
.tabs button{padding:4px 8px; border-radius:7px; border:none; background:none; font:inherit; font-size:12.5px; color:var(--ink-3); cursor:pointer}
.tabs button.on{background:var(--blue-tint); color:var(--blue-deep); font-weight:600}
.tabs button:focus-visible{outline:2px solid var(--blue); outline-offset:2px}

h2{font-size:20px; font-weight:600; letter-spacing:-0.015em}
.lede{font-size:12.5px; color:var(--ink-2); margin:2px 0 16px}

.btn{border:0.5px solid var(--blue-line); background:#fff; color:var(--blue); border-radius:8px;
  padding:6px 11px; font:inherit; font-size:12.5px; font-weight:500; cursor:pointer}
.btn:hover{background:var(--blue-tint)}
.btn:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.btn:disabled{opacity:0.45; cursor:not-allowed}
.btn:disabled:hover{background:#fff}
.dots:disabled{opacity:0.4; cursor:not-allowed}
.btn.primary{background:var(--blue); border-color:var(--blue); color:#fff}
.btn.sm{padding:4px 9px; font-size:11.5px}
.btn.danger{color:var(--red-ink); border-color:var(--red-line)}
.btn.danger:hover{background:var(--red-bg)}
.hint{font-size:12px; color:var(--ink-3)}

.sec{background:#fff; border:0.5px solid var(--line); border-radius:14px; margin-bottom:12px; overflow:hidden}
.sechead{display:flex; align-items:center; gap:10px; width:100%; background:none; border:none;
  font:inherit; text-align:left; padding:13px 16px; cursor:pointer}
.sechead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.secnum{width:24px; height:24px; border-radius:50%; background:var(--blue-tint); color:var(--blue-deep);
  font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; flex:none}
.sechead b{font-size:14px; font-weight:600}
.sechead small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400}
.badge{margin-left:auto; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px;
  background:var(--green-bg); color:var(--green-ink); white-space:nowrap}
.badge.todo{background:var(--amber-bg); color:var(--amber-ink)}
.chev{color:var(--ink-3); font-size:11px; margin-left:6px}
.sec.open .chev{display:inline-block; transform:rotate(180deg)}
.secbody{display:none; border-top:0.5px solid var(--line); padding:14px 16px}
.sec.open .secbody{display:block}

.bu{border:0.5px solid var(--line); border-radius:11px; margin-bottom:8px; overflow:hidden}
.buhead{display:flex; align-items:center; gap:8px; width:100%; background:var(--canvas); border:none;
  font:inherit; text-align:left; padding:10px 12px; cursor:pointer}
.buhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.buhead b{font-size:13px; font-weight:600}
.buhead .sum{margin-left:auto; font-size:11.5px; color:var(--ink-3)}
.bu.open .chev{transform:rotate(180deg)}
.bubody{display:none; padding:8px 12px 12px}
.bu.open .bubody{display:block}
.prod{display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 0 7px 14px;
  border-left:2px solid var(--blue-line); margin:6px 0}
.prod b{font-size:12.5px; font-weight:600}
.chip{font-size:10.5px; font-weight:600; padding:2px 9px; border-radius:999px;
  background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap; border:none; font-family:inherit}
.chip.off{background:var(--canvas); border:0.5px dashed var(--line); color:var(--ink-3); cursor:pointer}
.chip.on-toggle{cursor:pointer}
.chip.shared{background:var(--teal-bg); color:var(--teal)}
.tax{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--canvas); border:0.5px solid var(--line); color:var(--ink-2); white-space:nowrap}

.qline{display:flex; align-items:center; gap:8px; padding:9px 6px; border-bottom:0.5px solid var(--line); cursor:pointer; flex-wrap:wrap; width:100%; background:none; border-left:none; border-right:none; border-top:none; font:inherit; text-align:left}
.qline:hover{background:var(--blue-tint)}
.qline:last-child{border-bottom:none}
.qline:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.qline b{font-size:12.5px; font-weight:600}
.qstats{margin-left:auto; display:flex; gap:16px; align-items:center; font-size:12px; color:var(--ink-2); flex-wrap:wrap}
.qstats .lab{font-size:9.5px; color:var(--ink-3); display:block}
.moddot{display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--amber); margin-left:6px; vertical-align:1px}
.spark{width:60px; height:20px}

.card{border:0.5px solid var(--line); border-radius:11px; margin-bottom:8px; overflow:hidden}
.cardhead{display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%; background:none; border:none;
  font:inherit; text-align:left; padding:10px 12px; cursor:pointer}
.cardhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.cardhead b{font-size:13px; font-weight:600}
.card.open .chev{transform:rotate(180deg)}
.cardbody{display:none; border-top:0.5px solid var(--line); padding:10px 12px}
.card.open .cardbody{display:block}
.jour{display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:4px}
.jstep{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap}
.jstep.gov{background:var(--purple-bg); color:var(--purple)}
.jarr{color:var(--ink-3); font-size:10px}
.fields{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px}
.field label{display:block; font-size:11.5px; font-weight:500; color:var(--ink-2); margin-bottom:3px}
.field input,.field select{width:100%; font:inherit; font-size:13px; padding:7px 9px;
  border:0.5px solid var(--line); border-radius:8px; background:#fff}
.field input:focus-visible,.field select:focus-visible{outline:2px solid var(--blue); outline-offset:0}
.mixrow{display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:0.5px solid var(--line); font-size:12.5px}
.mixrow select{flex:1; font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px}
.mixrow input{width:64px; text-align:right; font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px}
.mixsum{display:flex; justify-content:space-between; padding:7px 0 0; font-size:12.5px; font-weight:600; color:var(--green-ink)}
.mixsum.warn{color:var(--amber-ink)}
.path{font-size:11px; font-weight:600; color:var(--purple); background:var(--purple-bg);
  padding:2px 9px; border-radius:999px; white-space:nowrap}
.warnmsg{margin-top:8px; font-size:12px; color:var(--amber-ink)}

.importbox{margin-top:4px; border:0.5px dashed var(--blue-line); border-radius:12px; padding:12px 14px;
  display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap}
.importbox p{font-size:12.5px; color:var(--ink-2)}
.importbox b{font-weight:600; color:var(--ink)}

.scrim{display:none; position:fixed; inset:0; background:rgba(26,26,26,.35); z-index:10}
.scrim.on{display:block}
.drawer{position:fixed; top:0; right:-420px; width:min(420px,100%); height:100%; background:#fff; z-index:11;
  box-shadow:-12px 0 40px rgba(12,68,124,.15); transition:right .22s ease; display:flex; flex-direction:column}
.drawer.on{right:0}
.dhead{padding:14px 16px 10px; border-bottom:0.5px solid var(--line); display:flex; justify-content:space-between}
.dhead h3{font-size:15px; font-weight:600}
.dhead p{font-size:11.5px; color:var(--ink-3)}
.close{background:none; border:none; font-size:17px; color:var(--ink-3); cursor:pointer; padding:4px 8px; border-radius:6px}
.dbody{overflow-y:auto; padding:8px 16px 22px; flex:1}
.acc{border:0.5px solid var(--line); border-radius:10px; margin-top:8px; overflow:hidden}
.acchead{display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; font:inherit;
  padding:10px 11px; cursor:pointer; text-align:left}
.acchead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.fam{width:4px; align-self:stretch; border-radius:2px}
.acchead b{font-size:12.5px; font-weight:600}
.acchead small{display:block; font-size:11px; color:var(--ink-3); font-weight:400}
.accbody{display:none; padding:4px 11px 12px; border-top:0.5px solid var(--line)}
.acc.open .accbody{display:block}
.acc.open .chev{transform:rotate(180deg)}

.note{margin-top:18px; font-size:12.5px; color:var(--ink-3); border-top:0.5px solid var(--line); padding-top:12px}
.note b{color:var(--ink-2); font-weight:600}

/* ---- Results (results-page-v2.html) ---- */
.ctx{display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#fff;
  border:0.5px solid var(--line); border-radius:12px; padding:10px 12px; margin-bottom:12px}
.ctx label{font-size:11px; font-weight:600; color:var(--ink-3)}
.ctx select{font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px; background:#fff}
.fresh{margin-left:auto; font-size:11.5px; font-weight:600; color:var(--green-ink); background:var(--green-bg); padding:3px 10px; border-radius:999px}
.fresh.stale{color:var(--amber-ink); background:var(--amber-bg)}
.sub{display:flex; gap:4px; margin-bottom:14px; overflow-x:auto}
.sub button{border:none; background:none; font:inherit; font-size:13px; font-weight:500; color:var(--ink-2); padding:7px 13px; border-radius:9px; cursor:pointer; white-space:nowrap}
.sub button.on{background:var(--blue); color:#fff}
.sub button:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.panel{background:#fff; border:0.5px solid var(--line); border-radius:14px; padding:16px; margin-bottom:12px}
.panel h3{font-size:14px; font-weight:600; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center}
.panel h3 small{font-size:11.5px; color:var(--ink-3); font-weight:400}
.verdict{font-size:13.5px; color:var(--ink-2); border-left:3px solid var(--blue); padding-left:10px; margin-bottom:14px}
.verdict b{color:var(--ink); font-weight:600}
.weight{display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap}
.weight label{font-size:11.5px; font-weight:500; color:var(--ink-2)}
.weight input{flex:1; min-width:130px; accent-color:var(--blue)}
.mx{width:100%; border-collapse:separate; border-spacing:4px}
.mx th{font-size:10.5px; font-weight:600; color:var(--ink-3); text-align:center; padding:2px}
.mx th.rh{text-align:left; font-size:11px; color:var(--ink-2); white-space:nowrap}
.cell{border:0.5px solid var(--line); border-radius:9px; background:#fff; padding:7px 5px; font:inherit; cursor:pointer; width:100%; text-align:center; position:relative}
.cell:hover{border-color:var(--blue-line)}
.cell.sel{border-color:var(--blue); background:var(--blue-tint)}
.cell:focus-visible{outline:2px solid var(--blue); outline-offset:1px}
.cell .c1{font-size:12.5px; font-weight:600; color:var(--amber-ink)}
.cell .c2{font-size:11px; color:var(--teal); font-weight:600}
.cell .c3{font-size:10.5px; font-weight:600}
.cell .c3.ok{color:var(--green-ink)} .cell .c3.warn{color:var(--amber-ink)} .cell .c3.bad{color:var(--red-ink)}
.best{position:absolute; top:-8px; left:50%; transform:translateX(-50%); background:var(--blue); color:#fff; font-size:9px; font-weight:600; padding:2px 7px; border-radius:999px; white-space:nowrap}
.fam6{display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px}
.fcard{background:#fff; border:0.5px solid var(--line); border-left-width:3px; padding:10px 12px; border-radius:8px}
.fcard .fl{font-size:11px; font-weight:600}
.fcard .fv{font-size:20px; font-weight:600; margin:1px 0}
.fcard .fs{font-size:11px; color:var(--ink-2)}
.risk{width:100%; border-collapse:collapse; font-size:12.5px}
.risk th{font-size:11px; font-weight:600; color:var(--ink-3); text-align:left; padding:5px 6px; border-bottom:0.5px solid var(--line)}
.risk td{padding:7px 6px; border-bottom:0.5px solid var(--line); vertical-align:top}
.sev{font-size:10.5px; font-weight:600; padding:1px 8px; border-radius:999px; white-space:nowrap}
.sev.red{background:var(--red-bg); color:var(--red-ink)} .sev.amb{background:var(--amber-bg); color:var(--amber-ink)} .sev.grn{background:var(--green-bg); color:var(--green-ink)}
.filters{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:8px}
.filters select{font:inherit; font-size:12px; padding:4px 8px; border:0.5px solid var(--line); border-radius:7px; background:#fff}
.filters label{font-size:11px; font-weight:600; color:var(--ink-3)}
.ribwrap{overflow-x:auto}
.ribbon{border-collapse:collapse}
.ribbon th{font-size:10px; color:var(--ink-3); font-weight:500; padding:1px}
.ribbon .qh{font-size:11.5px; font-weight:600; color:var(--ink-2); text-align:left; padding-right:8px; white-space:nowrap}
.ribbon .gh{font-size:10.5px; font-weight:600; color:var(--blue-deep); text-align:left; padding:5px 0 2px}
.rc{width:15px; height:17px; border:none; padding:0; cursor:pointer; font-size:8.5px; line-height:17px; text-align:center; border-radius:3px; color:#fff}
.rc.g{background:#97C459; color:#27500A} .rc.a{background:#FAC775; color:#633806} .rc.r{background:#F09595; color:#501313}
.rc.cur{outline:2px solid var(--blue); outline-offset:1px}
.wklabel{font-size:12.5px; color:var(--ink-2); margin:8px 0}
.wklabel b{color:var(--blue-deep); font-weight:600}
.inherit{font-size:12px; color:var(--blue-deep); background:var(--blue-tint); display:inline-flex; gap:8px; align-items:center; padding:5px 10px; border-radius:999px; margin-bottom:10px}
.inherit button{border:none; background:none; color:var(--blue); font-weight:600; cursor:pointer; font:inherit; font-size:12px; padding:0 4px}
.dtab{width:100%; border-collapse:collapse; font-size:12px}
.dtab th{padding:5px 8px; text-align:right; font-size:10.5px; font-weight:600; border-bottom:0.5px solid var(--line)}
.dtab td{padding:6px 8px; text-align:right; border-bottom:0.5px solid var(--line)}
.dtab .l{text-align:left}
.gInp{color:var(--blue-deep)} .gPerf{color:var(--teal)} .gWf{color:var(--coral)} .gOut{color:var(--amber-ink)}
.dtab .grp td{background:var(--canvas); font-size:11px; font-weight:600; color:var(--blue-deep); text-align:left}
.flowctl{display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap}
.flowctl input[type=range]{flex:1; min-width:120px; accent-color:var(--blue)}
.flowctl .wk{font-size:12.5px; font-weight:600; color:var(--blue-deep); min-width:64px}
.hide{display:none}

/* ---- Levers (levers-page-v2.html) ---- */
.cardlist{display:grid; gap:8px}
.scard{border:0.5px solid var(--line); border-radius:11px; background:#fff}
.schead{display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; font:inherit; text-align:left; padding:11px 12px; cursor:pointer}
.schead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.schead b{font-size:13.5px; font-weight:600}
.schead .desc{display:block; font-size:12px; color:var(--ink-2); font-weight:400}
.pill{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap}
.pill.builtin{background:var(--canvas); color:var(--ink-3); border:0.5px solid var(--line)}
.pill.shared{background:#E1F5EE; color:#0F6E56}
.param{margin-left:auto; font-size:12px; color:var(--ink-2)}
.param b{font-weight:600; color:var(--ink)}
.param input{font:inherit; font-size:12px; padding:3px 6px; border:0.5px solid var(--line); border-radius:6px; text-align:right}
.scard .chev{color:var(--ink-3); font-size:11px; margin-left:8px}
.scbody{display:none; border-top:0.5px solid var(--line); padding:10px 12px; font-size:12.5px; color:var(--ink-2)}
.scard.open .scbody{display:block}
.scard.open .chev{transform:rotate(180deg); display:inline-block}
.grph{font-size:11px; font-weight:600; color:var(--blue-deep); margin:8px 0 4px}
.qtoggle{display:flex; justify-content:space-between; padding:3px 0}
.tl{display:flex; gap:1px; margin-top:6px}
.tl span{flex:1; height:6px; border-radius:2px; background:var(--line)}
.tl span.on{background:#97C459}
.mxnote{font-size:12px; color:var(--ink-3); margin-top:8px}
.caps{width:100%; border-collapse:collapse; font-size:13px}
.caps th{font-size:11.5px; font-weight:600; color:var(--ink-3); text-align:left; padding:6px 8px; border-bottom:0.5px solid var(--line)}
.caps td{padding:7px 8px; border-bottom:0.5px solid var(--line)}
.caps input{width:70px; font:inherit; font-size:13px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px; text-align:right}
@media(min-width:760px){ .cols{display:grid; grid-template-columns:1fr 1fr; gap:14px} }

/* ---- Home (home-page-v2.html) ---- */
.avatar{width:32px; height:32px; border-radius:50%; background:var(--blue-tint); color:var(--blue-deep); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px}
.pagehead{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap}
.pagehead h2{font-size:22px; font-weight:600; letter-spacing:-0.015em}
.toolbar{display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap}
.search{flex:1; min-width:200px; display:flex; align-items:center; gap:8px; background:#fff; border:0.5px solid var(--line); border-radius:9px; padding:8px 12px; color:var(--ink-3); font-size:13px}
.grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px}
.card{background:#fff; border:0.5px solid var(--line); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:12px}
.card:hover{border-color:var(--blue-line)}
.head{display:flex; gap:14px; align-items:flex-start}
.thumb{flex:none; width:84px; height:70px; background:var(--canvas); border:0.5px solid var(--line); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0}
.thumb:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.card h3{font-size:14.5px; font-weight:600; letter-spacing:-0.01em}
.meta{font-size:12px; color:var(--ink-3); margin-top:1px}
.dots{margin-left:auto; color:var(--ink-3); background:none; border:none; font-size:18px; cursor:pointer; line-height:1; padding:2px 6px; border-radius:6px}
.dots:hover{background:var(--canvas)}
.chips{display:flex; gap:6px; flex-wrap:wrap}
.chips .chip{font-size:11.5px; font-weight:500; padding:3px 9px; border-radius:999px; background:var(--blue-tint); color:var(--blue-deep)}
.chip.money{background:var(--amber-bg); color:var(--amber-ink)}
.chip.hc{background:#FAECE7; color:#712B13}
.chip.ok{background:var(--green-bg); color:var(--green-ink)}
.chip.warn{background:var(--amber-bg); color:var(--amber-ink)}
.chip.bad{background:var(--red-bg); color:var(--red-ink)}
.open{width:100%}
.newcard{border:1.5px dashed var(--blue-line); background:transparent; border-radius:14px; padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--blue); font:inherit; font-size:13.5px; font-weight:500; cursor:pointer; min-height:180px}
.newcard:hover{background:var(--blue-tint)}
.newcard .plus{font-size:26px; font-weight:400; line-height:1}
.newcard small{color:var(--ink-3); font-weight:400; font-size:12px}
.overlay{display:none; position:fixed; inset:0; background:rgba(26,26,26,.35); z-index:10; align-items:center; justify-content:center; padding:20px}
.overlay.on{display:flex}
.modal{background:#fff; border-radius:16px; padding:22px; max-width:520px; width:100%; box-shadow:0 20px 60px rgba(12,68,124,.18)}
.modal h3{font-size:17px; font-weight:600; margin-bottom:2px; letter-spacing:-0.01em}
.modal>p{font-size:13px; color:var(--ink-2); margin-bottom:16px}
.forks{display:grid; gap:10px}
.fork{display:flex; gap:14px; align-items:center; text-align:left; background:#fff; border:0.5px solid var(--line); border-radius:12px; padding:14px; font:inherit; cursor:pointer; width:100%}
.fork:hover{border-color:var(--blue); background:var(--blue-tint)}
.fork .t{font-size:14px; font-weight:600}
.fork .d{font-size:12.5px; color:var(--ink-2); margin-top:1px}
.foot{display:flex; justify-content:space-between; align-items:center; margin-top:16px}
.link{background:none; border:none; color:var(--blue); font:inherit; font-size:13px; font-weight:500; cursor:pointer; padding:0}
.link:hover{text-decoration:underline}
.eco-scrim{display:none; position:fixed; inset:0; background:rgba(26,26,26,.45); z-index:20; align-items:center; justify-content:center; padding:16px}
.eco-scrim.on{display:flex}
.eco{background:#fff; border-radius:16px; max-width:680px; width:100%; max-height:92vh; overflow-y:auto; padding:20px}
.eco h3{font-size:16px; font-weight:600}
.eco .sub{font-size:12px; color:var(--ink-3); margin-bottom:10px}
.legend{display:flex; gap:8px; flex-wrap:wrap; margin:10px 0}
.lg{font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px}
.lg.pool{background:#EEEDFE; color:#534AB7}
.lg.sup{background:#E1F5EE; color:#0F6E56}
.lg.ovf{background:var(--amber-bg); color:var(--amber-ink)}
.ecofoot{display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:8px}
.ecohint{font-size:12px; color:var(--ink-2)}

/* ---- domain redesign: six-tab Setup shell (U1) ---- */
.linkbtn{background:none; border:none; color:var(--blue); font:inherit; font-size:12px; font-weight:500; cursor:pointer; padding:0}
.linkbtn:hover{text-decoration:underline}
.pstrip{display:flex; align-items:center; gap:9px; font-size:12.5px; color:var(--amber-ink); background:var(--amber-bg);
  border:0.5px solid #EAD1A4; border-radius:10px; padding:8px 12px; margin-bottom:12px}
.pstrip.done{color:var(--green-ink); background:var(--green-bg); border-color:#CBDDB4}
.pstrip .btn{margin-left:auto}
.glyph{font-size:10px}
.glyph.ok{color:var(--green-ink)}
.glyph.todo{color:var(--amber-ink)}
.subtabs{display:flex; gap:6px; border-bottom:0.5px solid var(--line); margin-bottom:18px; overflow-x:auto}
.subtabs button{display:flex; align-items:center; gap:6px; padding:9px 13px; border:none; border-bottom:2px solid transparent;
  background:none; font:inherit; font-size:13px; color:var(--ink-2); cursor:pointer; white-space:nowrap}
.subtabs button.on{color:var(--blue-deep); font-weight:600; border-bottom-color:var(--blue)}
.subtabs button:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.subtabs .count{font-size:10.5px; color:var(--ink-3); background:var(--canvas); border:0.5px solid var(--line); border-radius:999px; padding:1px 7px}
.subtabs button.on .count{background:var(--blue-tint); border-color:var(--blue-line); color:var(--blue-deep)}
/* The Setup tabpanel is NOT a card: it already sits inside the tab chrome, and
   filling it white made every nested list/row/detail card white-on-white with
   hairlines as the only separation. Scoped with .flat so the real cards on
   Results and Levers keep .panel (and their own h3 sizing) untouched. */
.panel.flat{background:transparent; border:none; border-radius:0; padding:0}
/* A segment body is already inside the .sec card, so the panel inside it must
   add no second card — but it keeps the section's own padding. */
/* One collapsible idiom for the option groups INSIDE a tab: registry lists,
   request-type sections, queue KPI families, Defaults groups. Collapse is
   CSS-driven so the fields stay mounted and a half-typed value survives a
   toggle. */
.drw{width:100%; border:0.5px solid var(--line); border-radius:11px; background:#fff; margin-bottom:8px}
.drwhead{display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; font:inherit;
  text-align:left; padding:10px 13px; cursor:pointer; border-radius:11px}
.drwhead:hover b{color:var(--blue-deep)}
.drwhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.drwhead b{font-size:13px; font-weight:600}
.drwhead small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400; margin-top:1px}
.drwhead .count{margin-left:auto; font-size:10.5px; color:var(--ink-3); background:var(--canvas);
  border:0.5px solid var(--line); border-radius:999px; padding:1px 8px; white-space:nowrap}
.drwhead .chev{font-size:8px; color:var(--ink-3); transition:transform 0.12s}
.drw.open>.drwhead .chev{transform:rotate(180deg)}
.usagenote{cursor:help; border-bottom:0.5px dotted var(--line)}
.usage-none{opacity:0.75; font-style:italic}
.prodbrand{font-size:11.5px; padding:3px 7px; border:0.5px solid var(--line); border-radius:7px; background:#fff; font-family:inherit}
.info{display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex:none;
  border-radius:50%; border:0.5px solid var(--line); background:var(--canvas); color:var(--ink-3);
  font-size:9.5px; font-weight:700; cursor:help; margin-left:6px; vertical-align:1px}
.info:hover{border-color:var(--blue-line); background:var(--blue-tint); color:var(--blue-deep)}
.tabnote{font-size:12px; color:var(--ink-2); background:var(--canvas); border:0.5px solid var(--line);
  border-radius:9px; padding:8px 12px; margin:0 0 14px}
.drwbody{display:none; padding:2px 13px 12px}
.drw.open>.drwbody{display:block}
.panel.flat h3{font-size:15px; font-weight:600; margin-bottom:2px}
.panel.flat>.hint{margin-bottom:12px}
.phase-note{font-size:11.5px; color:var(--ink-3); border-top:0.5px dashed var(--line); margin-top:16px; padding-top:8px}
.reglist{border:0.5px solid var(--line); border-radius:10px; background:#fff; padding:10px 12px; margin-bottom:8px}
.reghead{display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:6px}
.reghead .count{font-size:10.5px; color:var(--ink-3); background:var(--canvas); border:0.5px solid var(--line); border-radius:999px; padding:1px 7px}
.regchips{display:flex; gap:6px; flex-wrap:wrap}
.regchips .chip small{color:inherit; opacity:0.7; font-size:10px}
.regrow{border-top:0.5px dashed var(--line); padding:4px 0}
.regrow:first-of-type{border-top:none}
.regmain{display:flex; align-items:center; gap:8px; flex-wrap:wrap; row-gap:4px}
.regmain input{flex:0 1 260px; min-width:0; border:0.5px solid transparent; border-radius:7px; padding:4px 7px; font:inherit; font-size:12.5px; background:transparent}
.regmain input:hover{border-color:var(--line); background:#fff}
.regmain input:focus{border-color:var(--blue); background:#fff; outline:none}
/* Touch has no hover, so the rename field would be invisible on the very
   layout the owner flagged — reveal it where hover cannot. */
@media(hover:none){ .regmain input{border-color:var(--line); background:#fff} }
.regdel{margin-left:auto; border:none; background:none; color:var(--ink-3); font:inherit; font-size:12px; cursor:pointer; padding:2px 6px; border-radius:6px}
.regdel:hover{color:var(--red-ink); background:var(--red-bg)}
.blocked{margin-left:auto; min-width:0; color:var(--amber-ink)}
.regoff{display:flex; gap:6px; flex-wrap:wrap; margin-top:8px}
.chdefaults{margin:4px 0 8px; padding:10px 12px; border:0.5px solid var(--line); border-radius:10px; background:var(--canvas)}
.glyph.err{color:var(--red-ink)}
.rtrow small{display:block}
.proc{border:0.5px solid var(--line); border-radius:10px; background:var(--canvas); padding:10px 12px; margin-bottom:8px}
.prochead{display:flex; align-items:center; gap:8px; margin-bottom:6px}
.prochead .regdel{margin-left:auto}
.termlab{display:flex; align-items:center; gap:4px; white-space:nowrap}
.rework{white-space:nowrap; color:var(--purple)}
.chipx{border:none; background:none; color:inherit; font:inherit; font-size:10px; cursor:pointer; padding:0 0 0 4px; opacity:0.7}
.chipx:hover{opacity:1; color:var(--red-ink)}
.outin{border:0.5px solid var(--line); border-radius:7px; padding:4px 8px; font:inherit; font-size:11.5px; width:120px}
.applies{margin-top:8px}
.v3banner{display:flex; align-items:center; gap:14px; border:0.5px solid var(--blue-line); background:var(--blue-tint);
  border-radius:12px; padding:12px 16px; margin-bottom:16px}
.v3banner b{font-size:13px; color:var(--blue-deep)}
.v3banner p{font-size:12px; color:var(--ink-2); margin-top:2px}
.v3banner .btn{margin-left:auto; white-space:nowrap}
.structgrid{display:block}
/* The step grid's own columns need 478px (550px with a sampling column), which
   overflows the detail pane at every window width — so it must be its own
   scroll container at ALL widths, not just on a phone. Making .steps a scroll
   container is the load-bearing half: it zeroes the automatic minimum size the
   grid would otherwise force onto .mddetail and out to the page. */
.steps{margin-top:2px; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch}
.steprow{display:grid; grid-template-columns:44px minmax(150px,1.4fr) 64px 44px minmax(110px,1fr) 26px; gap:8px; align-items:center; padding:3px 0; min-width:min-content}
.steps.with-sample .steprow{grid-template-columns:44px minmax(150px,1.4fr) 64px 64px 44px minmax(110px,1fr) 26px}
.steprow.head span{font-size:10.5px; color:var(--ink-3); font-weight:600}
.steprow.head{border-bottom:0.5px solid var(--line); padding-bottom:3px; margin-bottom:2px}
.stepno{font-size:11px; color:var(--ink-3)}
.stepdash{color:var(--ink-3); text-align:center; font-size:11px}
.steprow input[type="checkbox"]{justify-self:start; margin:0}
.scrollx{overflow-x:auto}
.mdgroup{margin-bottom:10px}
.mdgrouplab{font-size:10.5px; color:var(--ink-3); font-weight:600; margin:2px 0 4px}
.fam-sec{border-top:0.5px solid var(--line); padding:0; margin-top:0}
.famhead{display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; font:inherit;
  text-align:left; padding:11px 2px; cursor:pointer}
.famhead .chev{margin-left:auto; font-size:8px; color:var(--ink-3); transition:transform 0.12s}
.fam-sec.open .famhead .chev{transform:rotate(180deg)}
.famhead:hover b{color:var(--blue-deep)}
.famhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
/* Collapse via CSS, not conditional rendering: the fields stay mounted so a
   half-typed value survives a toggle. */
.fambody{display:none; padding:0 2px 12px}
.fam-sec.open .fambody{display:block}
.famhead b{font-size:12.5px}
.derived-strip{margin:6px 0 4px}
.volgrid{min-width:560px}
.volrow{display:grid; grid-template-columns:minmax(220px,1fr) 90px 100px 90px; gap:10px; align-items:center; padding:3px 0; border-bottom:0.5px dashed var(--line)}
.volrow.head{border-bottom:0.5px solid var(--line)}
.volrow.head span{font-size:10.5px; color:var(--ink-3); font-weight:600}
/* Weight must decrease with depth, or the request type outranks the brand that
   contains it while being indented further — indent and weight disagreeing
   about the same tree is why the grid was hard to read. */
.volrow.lvl0 .volname{font-weight:600}
.volrow.lvl1 .volname{font-weight:600}
.volrow.lvl2 .volname{font-weight:500}
.volname{font-size:12.5px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  padding-left:calc(var(--lvl,0) * 18px)}
/* The cascade and step grids were the only inputs in the stylesheet never given
   a skin — they rendered as raw UA widgets next to styled siblings. Written as
   one block with the alignment so the two rules cannot drift apart. Base-block
   font-size on purpose: the phone block (later in source) raises it to 16px. */
.volrow input,.steprow input:not([type="checkbox"]),.steprow select{
  width:100%; font:inherit; font-size:13px; padding:6px 8px;
  border:0.5px solid var(--line); border-radius:8px; background:#fff}
.field input.num,.volrow input,.steprow input:not([type="checkbox"]){text-align:right}
.volrow.head span:nth-child(2),.steprow.head span:nth-child(3){text-align:right}
.steps.with-sample .steprow.head span:nth-child(4){text-align:right}
.prov{font-size:10.5px; border-radius:999px; padding:1px 8px; text-align:center; white-space:nowrap}
.prov.entered{background:var(--blue-tint); color:var(--blue-deep); font-weight:600}
/* equal/sum are the automatic majority — de-chromed so the two badges worth
   finding (a human number, and a reconciliation) are the only ones that carry
   fill. Flagging fails when every row shouts equally (REVIEW-SETUP §3.4 V5). */
.prov.equal{color:var(--ink-3)}
.prov.sum{color:var(--ink-3)}
.prov.scaled{background:var(--amber-bg); color:var(--amber-ink); font-weight:600}
.prov.none{color:var(--ink-3)}
.shapecell{text-align:left; font-size:11px}
.shapecell.set{color:var(--purple); font-weight:600}
.shapebox{grid-column:1/-1; border:0.5px solid var(--line); border-radius:10px; background:var(--canvas); padding:10px 12px; margin:6px 0}
.shapebox textarea{width:100%; border:0.5px solid var(--line); border-radius:8px; font:inherit; font-size:11.5px; padding:6px 8px; margin:8px 0}
.mapsvg{display:block}
.mnode:not(.team) rect{cursor:pointer}
.mnode rect{fill:#fff; stroke:var(--line); stroke-width:1}
.mnode.on rect{stroke:var(--blue); fill:var(--blue-tint)}
.mnode.team rect{fill:var(--canvas); stroke:var(--purple)}
.mnode .mname{font-size:11.5px; font-weight:600; fill:var(--ink); pointer-events:none}
.mnode .mmeta{font-size:9.5px; fill:var(--ink-3); pointer-events:none}
.medge line{stroke:var(--ink-3); stroke-width:1}
.medge.cap line{stroke:var(--purple)}
.medge text{font-size:9px; fill:var(--ink-3); text-anchor:middle}
.medge.cap text{fill:var(--purple)}

/* Focus rings for every control the six-tab Setup introduced. Grouped so a new
   control cannot ship without one — keyboard users get the same visible focus
   the v2.4 surfaces already had. */
.linkbtn:focus-visible,.chip:focus-visible,.regdel:focus-visible,.chipx:focus-visible,
.mdlist button:focus-visible,.shapecell:focus-visible,.outin:focus-visible,
.volrow input:focus-visible,.steprow input:focus-visible,.steprow select:focus-visible,
.regmain input:focus-visible,.shapebox textarea:focus-visible,.famhead button:focus-visible{
  outline:2px solid var(--blue); outline-offset:2px; border-radius:6px}
.mnode:focus-visible{outline:none}
.mnode:focus-visible rect{stroke:var(--blue); stroke-width:2}
.mnode rect{transition:stroke 0.12s}
/* Team nodes are not selectable — they must not advertise that they are. */
.mnode:not(.team):hover rect{stroke:var(--blue-mid)}

.md{display:grid; grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr); gap:12px; align-items:start}
.mdlist{display:flex; flex-direction:column; gap:4px}
.mdlist button{display:grid; grid-template-columns:1fr auto; gap:1px 8px; text-align:left; border:0.5px solid var(--line);
  background:#fff; border-radius:10px; padding:8px 11px; font:inherit; cursor:pointer}
.mdlist button b{font-size:12.5px; font-weight:600}
.mdlist button small{grid-column:1; font-size:10.5px; color:var(--ink-3)}
.mdlist button .qstats{grid-row:1/3; align-self:center; font-size:11px; color:var(--ink-2)}
.mdlist button.on{border-color:var(--blue); background:var(--blue-tint)}
.mdlist button.on small{color:var(--ink-2)}
/* :not(.on) — a bare hover rule has the same specificity as .mdlist button.on
   and, placed after it, would silently clobber the selected row's blue border. */
.mdlist button:not(.on):hover{border-color:var(--blue-line)}
.chip.off:hover,.chip.on-toggle:hover{background:var(--blue-tint); color:var(--blue-deep)}
.subtabs button:hover{color:var(--blue-deep)}
.mddetail{border:0.5px solid var(--line); border-radius:12px; background:#fff; padding:14px 16px}
.mddetail h4{font-size:14px; font-weight:600}
.mddetail>.hint{margin-bottom:10px}
.kv{display:flex; justify-content:space-between; gap:10px; font-size:12.5px; padding:5px 0; border-bottom:0.5px dashed var(--line)}
.kv span{color:var(--ink-2)}
.usage{font-size:12px; color:var(--ink-2); margin-top:8px}
.rtcard{border:0.5px solid var(--line); border-radius:12px; background:#fff; padding:12px 14px; margin-bottom:8px}
.rthead{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px}
.rthead b{font-size:13px}
.procline{display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; padding:5px 0; border-top:0.5px dashed var(--line)}
.procline .chain{color:var(--ink-2)}
.vtable{width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border:0.5px solid var(--line); border-radius:10px}
.vtable th{text-align:left; font-size:11px; color:var(--ink-3); font-weight:600; padding:7px 10px; border-bottom:0.5px solid var(--line)}
.vtable th.num,.vtable td.num{text-align:right}
.vtable td{padding:7px 10px; border-bottom:0.5px dashed var(--line)}
.valpanel{border:0.5px solid var(--line); border-radius:10px; background:#fff; padding:10px 12px; margin-top:10px}
.okmsg{font-size:12.5px; color:var(--green-ink)}
.errmsg{font-size:12.5px; color:var(--red-ink)}

/* ==== phone layout ===========================================================
   MUST stay last in this stylesheet: these are max-width overrides with the
   same specificity as the base rules, so source order decides. (An earlier
   pass placed this block mid-file, where the later base rules silently beat
   half of it — the master–detail rows never actually restacked.) */
@media(max-width:640px){
  .shell{padding:0 12px 44px}
  header.top{flex-wrap:wrap; row-gap:6px; padding:10px 0; margin-bottom:12px}
  .tabs{overflow-x:auto; max-width:100%}
  h2{font-size:18px}
  .v3banner{flex-direction:column; align-items:stretch; gap:8px}
  .v3banner .btn{margin-left:0}
  .pstrip{flex-wrap:wrap}
  .pstrip .btn{margin-left:0}
  .subtabs{gap:0; margin-bottom:14px}
  .subtabs button{padding:9px 10px; font-size:12.5px}
  .regmain input{flex:1 1 auto; min-width:0}
  .blocked{white-space:normal; margin-left:0; flex:1 1 100%}
  .md{grid-template-columns:1fr}
  .mdlist button{grid-template-columns:1fr}
  .mdlist button .qstats{grid-row:auto; grid-column:1; margin-top:1px}
  .mddetail{padding:12px}
  .volgrid{min-width:0}
  .volrow{grid-template-columns:1fr 74px 84px; grid-template-areas:"name val prov" "shape shape shape"; gap:6px 8px; padding:6px 0}
  .volrow>.volname{grid-area:name}
  .volrow>input{grid-area:val}
  .volrow>.prov{grid-area:prov}
  .volrow>.shapecell{grid-area:shape; padding-left:0}
  /* The header row is the ONLY place the unit "Daily" appears — hiding it on
     the contributor's own tab invites weekly figures in a per-day box. */
  .volrow.head>span:nth-child(4){grid-area:shape; padding-left:0}
  .volname{padding-left:calc(var(--lvl,0) * 9px)}
  .fam-sec{padding:8px 0 10px}
  .mddetail{scroll-margin-top:12px}
  .panel.flat h3{flex-wrap:wrap; gap:2px 10px; align-items:baseline}

  /* iOS Safari auto-zooms on focus for any control under 16px and never zooms
     back out — one tap on any field would leave the page horizontally scrolled
     for the rest of the session. This is the single most disruptive phone bug
     on the surface, so every control is raised together. */
  .field input,.field select,.regmain input,.mixrow input,.mixrow select,
  .outin,.shapebox textarea,.volrow input,.steprow input,.steprow select{font-size:16px}
  .outin{width:100%; flex:1 1 140px}

  /* Comfortable touch targets. button.chip, not .chip — several .chip are
     non-interactive spans here and on Home, and inflating those adds chrome. */
  .regdel,.chipx{min-width:32px; min-height:32px; display:inline-flex; align-items:center; justify-content:center}
  .steprow .regdel{min-width:0}
  button.chip{min-height:38px}
  .btn.sm{padding:7px 11px}
  .linkbtn{padding:10px 8px; display:inline-block}
  .steprow input[type="checkbox"]{width:20px; height:20px; min-height:24px}
}
@media(max-width:400px){
  /* One field per row: two 150px columns inside a padded card is unreadable
     once labels are as long as "Cross-skill proficiency (%)". */
  .fields{grid-template-columns:1fr}
}
`;
