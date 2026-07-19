import { useMeasuredWidth, useDisclosure } from "../hooks.js";
import { usePrinting } from "../print.jsx";

// Tap-to-reveal hint. A real button + popover, so it works on touch and by
// keyboard — never a hover-only `title` attribute (SPEC §UI design rule).
export function Hint({ text, label = "More information" }) {
  const { open, toggle, ref } = useDisclosure();
  return (
    <span className="hint" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
      >?</button>
      {open && <span className="pop" role="tooltip">{text}</span>}
    </span>
  );
}

// Labelled numeric input. Emits a Number on change (empty string -> 0).
export function NumField({ label, value, onChange, unit, hint, step = "any", min, max, id }) {
  return (
    <label className="field">
      <span className="lab">
        {label}{unit ? <span className="unit">({unit})</span> : null}
        {hint ? <Hint text={hint} /> : null}
      </span>
      <input
        type="number"
        id={id}
        value={value ?? ""}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? 0 : Number(raw));
        }}
      />
    </label>
  );
}

export function TextField({ label, value, onChange, hint, id }) {
  return (
    <label className="field">
      <span className="lab">{label}{hint ? <Hint text={hint} /> : null}</span>
      <input type="text" id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function SelectField({ label, value, onChange, options, hint, id }) {
  return (
    <label className="field">
      <span className="lab">{label}{hint ? <Hint text={hint} /> : null}</span>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function Card({ title, sub, right, hint, children }) {
  return (
    <section className="card">
      {(title || right) && (
        <div className="card-h">
          {title ? <h3>{title}</h3> : null}
          {sub ? <span className="sub">{sub}</span> : null}
          {hint ? <Hint text={hint} /> : null}
          {right ? <><span className="spacer" />{right}</> : null}
        </div>
      )}
      <div className="card-b">{children}</div>
    </section>
  );
}

// Chart shell that measures its own width and hands (w, h) to a render prop, so
// recharts gets explicit pixel dimensions (never a 0-size ResponsiveContainer).
// While printing (§14.8) it switches to a fixed pixel width so charts render at
// a stable, page-friendly size instead of a collapsed container.
export function Chart({ title, hint, height = 250, children }) {
  const [ref, measured] = useMeasuredWidth(620);
  const { printing, printWidth } = usePrinting();
  const w = printing ? printWidth : Math.max(280, measured - 16);
  return (
    <div className={"chart" + (printing ? " printing" : "")} data-print-w={printing ? printWidth : undefined}>
      <div className="chart-h">
        <h4>{title}</h4>
        {hint ? <Hint text={hint} /> : null}
      </div>
      <div className="chart-b" ref={ref}>
        {children(w, height)}
      </div>
    </div>
  );
}
