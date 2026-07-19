import { SEASONAL_PRESETS, DEFAULT_PROFILE, uid } from "../engine/engine.js";

/* Intraday arrival-pattern presets (SPEC §1). Each curve has one value per
   30-min interval across the 08:00–20:00 window (24 points). Curves are relative
   shares; the engine normalises them. Apply a preset to a queue, hand-edit the
   per-interval sliders, then "save as new" to add the edited curve to this
   library. Persistence lands in P5; here the library lives in app state. */
const dbl = [...DEFAULT_PROFILE];
export const INTRADAY_PRESETS = [
  { id: "ip_double", name: "Double hump", builtin: true, curve: dbl },
  { id: "ip_morning", name: "Morning-heavy B2B", builtin: true, curve: [0.9, 1.25, 1.5, 1.55, 1.5, 1.35, 1.2, 1.1, 1.0, 0.9, 0.8, 0.75, 0.7, 0.62, 0.55, 0.48, 0.42, 0.36, 0.3, 0.26, 0.22, 0.18, 0.15, 0.12] },
  { id: "ip_evening", name: "Evening consumer", builtin: true, curve: [0.25, 0.3, 0.38, 0.46, 0.55, 0.62, 0.7, 0.78, 0.88, 0.98, 1.05, 1.1, 1.2, 1.32, 1.42, 1.5, 1.55, 1.5, 1.4, 1.25, 1.05, 0.85, 0.6, 0.4] },
  { id: "ip_lunch", name: "Lunchtime spike", builtin: true, curve: [0.5, 0.6, 0.72, 0.82, 0.9, 1.0, 1.25, 1.5, 1.65, 1.5, 1.2, 0.95, 0.85, 0.82, 0.8, 0.78, 0.72, 0.66, 0.6, 0.52, 0.44, 0.36, 0.28, 0.22] },
  { id: "ip_flat", name: "Flat", builtin: true, curve: new Array(24).fill(1) },
  { id: "ip_weekend", name: "Weekend-shifted", builtin: true, curve: [0.3, 0.4, 0.55, 0.7, 0.85, 0.98, 1.08, 1.15, 1.2, 1.22, 1.2, 1.15, 1.12, 1.08, 1.05, 1.0, 0.95, 0.88, 0.8, 0.72, 0.62, 0.52, 0.42, 0.32] },
];

// Seasonality presets — 12 monthly multipliers. Built-ins come from the engine
// (single source of truth for the numbers); users add saved edits.
export const SEASONALITY_PRESETS = Object.entries(SEASONAL_PRESETS).map(([name, months], i) => ({
  id: "sp_" + i,
  name,
  builtin: true,
  months: [...months],
}));

export const makeIntradayPreset = (name, curve) => ({ id: "ip_" + uid(), name, builtin: false, curve: [...curve] });
export const makeSeasonalityPreset = (name, months) => ({ id: "sp_" + uid(), name, builtin: false, months: [...months] });
