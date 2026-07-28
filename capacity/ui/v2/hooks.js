/* v2.4 rebuild — deferred compute (integration polish). Runs an expensive pure
 * compute AFTER paint so an edit updates the screen immediately and a
 * "recalculating…" state can show, instead of the input freezing while the
 * engine matrix runs. The compute stays a plain function (compute.js) so a real
 * Web Worker is a drop-in behind the same shape — this hook is the seam.
 */
import { useState, useEffect, useRef } from "react";

export function useDeferred(input, compute) {
  const [value, setValue] = useState(() => compute(input));
  const [pending, setPending] = useState(false);
  const seen = useRef(input);
  useEffect(() => {
    if (input === seen.current) return;
    seen.current = input;
    setPending(true);
    // setTimeout(0) yields to the browser to paint the pending state first.
    const id = setTimeout(() => { setValue(compute(input)); setPending(false); }, 0);
    return () => clearTimeout(id);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  return { value, pending };
}
