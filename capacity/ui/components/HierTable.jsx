import { Fragment } from "react";
import { hierarchy } from "../views.js";

/* Shared Brand → Voice / Digital / Support → queue grouped table (SPEC §20
   rollup). One renderer used by the Summary queue rollup and the Plan hiring
   summary so both carry the same hierarchy with channel and brand subtotal
   rows. Callers supply `metric(queue)` returning a flat object of accumulator
   fields, `aggregate(list)` merging a set of those objects into a subtotal, and
   `columns` whose `fmt(metricObj)` renders each cell. Brand and channel subtotal
   rows carry stable testids so the grouping is assertable. */
export function HierTable({ config, testid, columns, metric, aggregate, firstLabel = "Queue" }) {
  const rows = hierarchy(config);
  const allLeaf = [];
  const cellsFor = (m) => columns.map((c) => (
    <td key={c.key} className={c.cls ? c.cls(m) : undefined} style={c.align ? { textAlign: c.align } : undefined}>{c.fmt(m)}</td>
  ));
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid={testid}>
        <thead>
          <tr><th>{firstLabel}</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const brandLeaf = [];
            const brandBody = row.channels.map((ch) => {
              const ms = ch.queues.map((q) => ({ q, m: metric(q) }));
              ms.forEach((x) => { brandLeaf.push(x.m); allLeaf.push(x.m); });
              return (
                <Fragment key={ch.key}>
                  {ms.map(({ q, m }) => (
                    <tr key={q.id}>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>{q.name}{q.resourcing && q.resourcing !== "dedicated" && q.resourcing !== "resourced" ? ` (${q.resourcing})` : ""}</td>
                      {cellsFor(m)}
                    </tr>
                  ))}
                  <tr className="grp sub-chan" data-testid={`hier-chan-${row.brand.id}-${ch.key}`}>
                    <td style={{ textAlign: "left" }}>{ch.label} subtotal</td>
                    {cellsFor(aggregate(ms.map((x) => x.m)))}
                  </tr>
                </Fragment>
              );
            });
            return (
              <Fragment key={row.brand.id}>
                {brandBody}
                <tr className="grp sub-brand" data-testid={`hier-brand-${row.brand.id}`}>
                  <td style={{ textAlign: "left" }}>{row.brand.name} — total</td>
                  {cellsFor(aggregate(brandLeaf))}
                </tr>
              </Fragment>
            );
          })}
          <tr className="grp total">
            <td style={{ textAlign: "left" }}>Total</td>
            {cellsFor(aggregate(allLeaf))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
