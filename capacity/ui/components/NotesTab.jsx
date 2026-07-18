import { Card } from "./primitives.jsx";

/* Model notes (SPEC §13): E1–E3 explained in plain language so a reader trusts
   the numbers and knows the modelling assumptions. */
export function NotesTab() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="How the model works" sub="plain-language notes on the engine">
        <p className="note" style={{ marginBottom: 16 }}>
          This tool simulates a call centre week by week across the horizon. Below is what the engine actually does, in plain terms — the same three ideas that make its numbers trustworthy rather than optimistic.
        </p>

        <h4 style={{ margin: "0 0 6px" }}>E1 — Callers abandon (Erlang A, not Erlang C)</h4>
        <p style={{ marginTop: 0 }}>
          The classic Erlang C formula assumes every caller waits forever. That makes predicted waits explode as a queue gets busy, which never happens in reality — real callers hang up. We use <strong>Erlang A</strong>, which models patience: some callers abandon, and because an abandoned call is never handled, it lightens the load on the agents who remain. The engine solves this self-consistently (the abandonment rate and the served load depend on each other) so the predicted speed-of-answer stays realistic and bounded by caller patience. In quiet conditions it matches the textbook Erlang C answer exactly; in heavy overload it falls back to simple flow conservation (roughly one-minus-agents-over-demand abandon).
        </p>

        <h4 style={{ margin: "16px 0 6px" }}>E2 — Staff follow the requirement curve, not the demand curve</h4>
        <p style={{ marginTop: 0 }}>
          Queues enjoy economies of scale: a busy interval needs proportionally <em>fewer</em> agents per call than a quiet one. So spreading available hours in proportion to call volume would starve the quiet intervals and invent abandonment that wouldn't really occur. Instead the engine computes the agents <strong>required</strong> in each interval and lays the available hours along that shape. Coverage then becomes one honest number: 100% means SLA is met in every interval; 90% means you are uniformly about 10% short. This is a best-case rostering assumption — real rosters are lumpier — and is stated as such.
        </p>

        <h4 style={{ margin: "16px 0 6px" }}>E3 — Digital is a fluid backlog, not a phone queue</h4>
        <p style={{ marginTop: 0 }}>
          Chat and messaging don't block like a phone line — contacts wait in a backlog and agents handle several at once. The engine models the backlog as a fluid that fills and drains: within each interval, arrivals come in steadily and the wait a contact sees rises or falls linearly with the backlog, which is how the in-SLA share is derived. Backlog carries across intervals, days and weeks. There is no Erlang scale effect here — required capacity is simply demand divided by concurrency and the occupancy ceiling. When a digital backlog runs over its limit, a share of it deflects into next-day voice volume.
        </p>

        <hr className="sep" style={{ margin: "18px 0" }} />
        <h4 style={{ margin: "0 0 6px" }}>Other mechanics worth knowing</h4>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>New hires take req-to-start weeks to begin, then train (full salary, zero output), then ramp up their learning curve before counting as fully productive.</li>
          <li>Attrition erodes trained and ramping staff (never trainees); a burnout index builds while occupancy sits above threshold, lifting attrition and absence.</li>
          <li>Abandoned callers redial (solved as a capped fixed point) and over-limit digital backlog deflects to voice — both shown as distinct volume segments.</li>
          <li>Poor experience converts to churn (abandonment, long waits, digital breaches) at editable rates, priced per lost customer, and weighed against idle pay.</li>
          <li>All four hiring strategies run every change; the active one drives the dashboard. A global weekly hiring cap is rationed to the queue with the greatest churn cost averted per hire when it binds.</li>
        </ul>
      </Card>
    </div>
  );
}
