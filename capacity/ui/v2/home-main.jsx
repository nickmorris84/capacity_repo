/* v2.4 rebuild — standalone mount for the Home page (Step 5). Seeds the
 * simulations list from the migrated default config, computing each card's
 * headline chips from a real (cheap) engine run and its services count from the
 * model. The Ecosystem overlay renders the derived volume Sankey.
 */
import { createRoot } from "react-dom/client";
import HomePage from "./HomePage.jsx";
import { CSS } from "./tokens.js";
import { makeDefaultConfig } from "../../engine/engine.js";
import { migrateV1ToV2 } from "../../model/migrate.js";
import { quickHeadline } from "./compute.js";

export const OWNER = "nick_morris";

export function defaultSimulations() {
  const model = migrateV1ToV2(makeDefaultConfig());
  return [{
    id: "sim_full", name: (model.brands[0] && model.brands[0].name) + " — full estate",
    scope: "Whole ecosystem", updated: "2 h ago", runs: 3,
    model, services: model.services.length, headline: quickHeadline(model),
  }];
}

function injectStyle() {
  if (typeof document === "undefined" || document.getElementById("capacity-v2-style")) return;
  const el = document.createElement("style");
  el.id = "capacity-v2-style";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function mount(container, opts = {}) {
  injectStyle();
  const root = createRoot(container);
  root.render(<HomePage simulations={opts.simulations || defaultSimulations()} />);
  return root;
}

export { HomePage };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default HomePage;
