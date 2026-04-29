import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * no changes. Used on search inputs to avoid firing an API request on every
 * keystroke — the query only runs once the user pauses typing.
 *
 * The 300ms default balances responsiveness with request reduction: fast
 * typists skip intermediate queries while slow typists see results quickly.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
