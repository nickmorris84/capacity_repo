import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CSS } from "./style.js";

// Inject the stylesheet once. Idempotent so repeated mounts (e.g. re-requiring
// this module under test) don't duplicate <style> tags.
function injectStyle() {
  if (document.getElementById("capacity-sim-style")) return;
  const el = document.createElement("style");
  el.id = "capacity-sim-style";
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Mount into an explicit container. Exported so tests (and the P5 standalone
// bundle) can drive mounting deliberately instead of relying on a side effect.
export function mount(container) {
  injectStyle();
  const root = createRoot(container);
  root.render(<App />);
  return root;
}

// Browser convenience: auto-mount into #root if present at load time.
const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export { App };
export default App;
