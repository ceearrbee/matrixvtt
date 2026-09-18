/**
 * useIsMobile - subscribes to the ≤768px breakpoint via matchMedia.
 *
 * CSS owns all visual layout via @media queries; this hook exists only for
 * the rare cases where JS needs the same answer (e.g. choosing to mount a
 * mobile-only popover instead of an inline strip, or keeping the map mounted
 * on mobile even when Narrative mode would otherwise unmount it on desktop).
 */
import { useEffect, useState } from 'preact/hooks';

const QUERY = '(max-width: 768px)';

/** One-shot read, for code outside a component that needs the same answer. */
export function isMobileViewport() {
  return typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false;
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileViewport);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return mobile;
}
