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
  --red:#E24B4A; --red-bg:#FCEBEB; --red-ink:#791F1F;
  --ink:#1a1a1a; --ink-2:#5c5a54; --ink-3:#8a887f;
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
.btn.primary{background:var(--blue); border-color:var(--blue); color:#fff}
.btn.sm{padding:4px 9px; font-size:11.5px}
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

.importbox{margin-top:4px; border:1.5px dashed var(--blue-line); border-radius:12px; padding:12px 14px;
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
`;
