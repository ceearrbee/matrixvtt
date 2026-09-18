/**
 * usePanelDrag - the drag mechanics shared by the two resizable panels.
 *
 * Pointer events rather than mouse events, so a touch or pen drag
 * works, with capture so the drag survives the pointer leaving the
 * handle. Listeners go on `window`, because a fast drag outstrips the
 * handle and the events would otherwise stop arriving.
 *
 * The committed value is tracked locally rather than read back from
 * render state: a commit that depends on a re-render having happened
 * loses the last few pixels of every drag.
 *
 * Returns handlers for a `role="separator"` element. The keyboard half
 * is not optional: a resizer only a mouse can reach is a control the
 * rest of the shell would not ship.
 */

import { useEffect, useRef } from 'preact/hooks';

const NUDGE = 16;
const FAR = 100000;

/**
 * @param {{
 *   axis: 'x' | 'y',
 *   invert?: boolean,
 *   startValue: () => number,
 *   clamp: (n: number) => number | null,
 *   onPreview: (n: number | null) => void,
 *   onCommit: (n: number) => void,
 *   dragClass: string,
 * }} config
 */
export function usePanelDrag(config) {
  const { axis, invert = false, startValue, clamp, onPreview, onCommit, dragClass } = config;
  const cleanupRef = useRef(null);

  useEffect(() => () => {
    if (cleanupRef.current) cleanupRef.current();
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    // A second pointerdown before the previous drag's pointerup would
    // otherwise pile up listeners.
    if (cleanupRef.current) cleanupRef.current();

    const origin = axis === 'x' ? e.clientX : e.clientY;
    const from = startValue();
    const target = e.currentTarget;
    try { target.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    target.classList.add(dragClass);

    let lastClamped = from;
    const onMove = (ev) => {
      const now = axis === 'x' ? ev.clientX : ev.clientY;
      const delta = invert ? origin - now : now - origin;
      const next = clamp(from + delta);
      if (next != null) {
        lastClamped = next;
        onPreview(next);
      }
    };
    const cleanup = (commit) => {
      target.classList.remove(dragClass);
      try { target.releasePointerCapture?.(e.pointerId); } catch { /* not supported */ }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      cleanupRef.current = null;
      onPreview(null);
      if (commit) onCommit(lastClamped);
    };
    const onUp = () => cleanup(true);
    cleanupRef.current = () => cleanup(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (e) => {
    const grow = axis === 'x' ? 'ArrowLeft' : 'ArrowDown';
    const shrink = axis === 'x' ? 'ArrowRight' : 'ArrowUp';
    let next = null;
    if (e.key === grow) next = clamp(startValue() + (invert ? NUDGE : -NUDGE));
    else if (e.key === shrink) next = clamp(startValue() + (invert ? -NUDGE : NUDGE));
    else if (e.key === 'Home') next = clamp(0);
    else if (e.key === 'End') next = clamp(FAR);
    if (next == null) return;
    e.preventDefault();
    onCommit(next);
  };

  return { onPointerDown, onKeyDown };
}
