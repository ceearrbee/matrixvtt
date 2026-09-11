/**
 * `useMediaQuery(query)` - Preact hook returning whether a CSS media
 * query currently matches, and re-rendering when that changes.
 *
 * Used where a layout decision has to be made in JS rather than CSS
 * (picking which variant of a component to mount, so only one mounts).
 * Returns false where matchMedia is unavailable, which keeps
 * server-free static rendering and the test environment predictable.
 */
import { useEffect, useState } from 'preact/hooks';

function matches(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query) {
  const [on, setOn] = useState(() => matches(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setOn(mql.matches);
    setOn(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return on;
}
