/**
 * Arrow-key movement along a tablist.
 *
 * The companion tabs already carry a roving tabindex: the active tab
 * is 0 and the rest are -1, which is correct and which is exactly what
 * makes the missing handler a trap. A keyboard user tabs in, lands on
 * the active tab, and has no way to reach any other, because the
 * others are deliberately not in the tab order.
 *
 * Activation follows focus, which is the right pattern for tabs whose
 * panels are already mounted: moving is the same act as choosing.
 */

const BACK = new Set(['ArrowLeft', 'ArrowUp']);
const FORWARD = new Set(['ArrowRight', 'ArrowDown']);

/**
 * Where a key should move within a strip, or null when it should not.
 *
 * @param {string} key
 * @param {number} current
 * @param {number} count
 * @returns {number|null}
 */
export function nextTabIndex(key, current, count) {
  if (count <= 0) return null;
  if (FORWARD.has(key)) return (current + 1) % count;
  if (BACK.has(key)) return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * Handler for the tablist container. Reads its own tabs from the DOM
 * so a strip whose tabs are conditional (Combat appears only while
 * initiative runs) needs no separate list to keep in step.
 */
export function onTablistKeyDown(event) {
  const strip = event.currentTarget;
  const tabs = [...strip.querySelectorAll('[role="tab"]')];
  const current = Math.max(0, tabs.indexOf(document.activeElement));
  const target = nextTabIndex(event.key, current, tabs.length);
  if (target == null) return;
  event.preventDefault();
  const tab = tabs[target];
  if (!tab) return;
  tab.focus();
  tab.click();
}
