
import { VTT_EVENTS } from '../utils/constants.js';

/**
 * Open a progress card.
 * @param {{title: string, total: number}} opts
 * @returns {{
 *   update: (done: number, detail?: string) => void,
 *   setTotal: (total: number) => void,
 *   setTitle: (title: string) => void,
 *   fail: (errSummary?: string) => void,
 *   close: () => void,
 * }}
 */
export function openProgress({ title, total }) {
  const card = document.createElement('div');
  card.className = 'progress-card';
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="progress-card__title"></div>
    <div class="progress-card__count">0 / ${String(total)}</div>
    <div class="progress-bar"><div class="progress-bar__fill" style="width:0%"></div></div>
    <div class="progress-card__detail" style="display:none;"></div>
    <div class="progress-card__rate-limit" style="display:none;"></div>
  `;
  const titleEl = card.querySelector('.progress-card__title');
  const countEl = card.querySelector('.progress-card__count');
  const fillEl  = card.querySelector('.progress-bar__fill');
  const detailEl = card.querySelector('.progress-card__detail');
  const rateLimitEl = card.querySelector('.progress-card__rate-limit');

  titleEl.textContent = title;
  document.body.appendChild(card);

  let currentTitle = title;
  let currentTotal = total;
  let currentDone = 0;

  const renderRateLimit = (seconds) => {
    if (seconds > 0) {
      const remaining = Math.max(0, currentTotal - currentDone);
      rateLimitEl.textContent =
        `Server rate limit reached - ${currentTitle}: ${remaining} write${remaining === 1 ? '' : 's'} left, resuming in ${seconds}s`;
      rateLimitEl.style.display = '';
    } else {
      rateLimitEl.style.display = 'none';
    }
  };

  let pendingSeconds = 0;
  const onRateLimited = (e) => {
    pendingSeconds = Math.ceil((e.detail?.retryAfter ?? 0) / 1000);
    renderRateLimit(pendingSeconds);
  };
  window.addEventListener(VTT_EVENTS.RATE_LIMITED, onRateLimited);

  function update(done, detail) {
    currentDone = done;
    countEl.textContent = `${done} / ${currentTotal}`;
    const pct = currentTotal > 0 ? Math.min(100, (done / currentTotal) * 100) : 0;
    fillEl.style.width = `${pct}%`;
    if (detail) {
      detailEl.textContent = detail;
      detailEl.style.display = '';
    }
    // Keep the rate-limit sub-line in sync if it's still visible -
    // the "N writes left" count should tick down as writes complete.
    if (pendingSeconds > 0) renderRateLimit(pendingSeconds);
  }

  function setTotal(n) {
    currentTotal = n;
    currentDone = 0;
    countEl.textContent = `0 / ${n}`;
    fillEl.style.width = '0%';
  }

  function setTitle(t) {
    currentTitle = t;
    titleEl.textContent = t;
  }

  function cleanup() {
    window.removeEventListener(VTT_EVENTS.RATE_LIMITED, onRateLimited);
  }

  function close() {
    cleanup();
    card.remove();
  }

  function fail(errSummary) {
    cleanup();
    card.classList.add('progress-card--failed');
    if (errSummary) {
      detailEl.textContent = errSummary;
      detailEl.style.display = '';
    }
    const dismiss = document.createElement('button');
    dismiss.className = 'dbt dbt--sm';
    dismiss.style.marginTop = 'var(--space-md)';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => card.remove());
    card.appendChild(dismiss);
  }

  return { update, setTotal, setTitle, fail, close };
}

/**
 * Orchestrate a sequence of phases behind one progress card.
 * Each phase: { title, total, run(onProgress, setTotal) }.
 * The card is created up-front using the first phase's title+total,
 * swapped between phases, and closed on success or marked failed on throw.
 *
 * `setTotal` is exposed to phases whose total is only known at runtime -
 * e.g. a queue-drain phase that measures depth after the previous phase
 * finishes writing.
 */
export async function runWithProgress(phases) {
  if (!phases?.length) return;
  const progress = openProgress({ title: phases[0].title, total: phases[0].total });
  try {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (i > 0) {
        progress.setTitle(phase.title);
        progress.setTotal(phase.total);
      }
      progress.update(0);
      await phase.run(
        (done, detail) => progress.update(done, detail),
        (n) => progress.setTotal(n)
      );
    }
    progress.close();
  } catch (error) {
    progress.fail(error?.message || 'Operation failed');
    throw error;
  }
}

/**
 * Block until every 429-parked retry has landed on the server, updating
 * the surrounding progress card as the queue drains. `awaitQueueDrain`
 * resolves with `'timeout'` when its own bounded wait elapses, so this
 * helper loops until the queue actually reports `drained` / `empty`.
 *
 * Use as a final phase in `runWithProgress` after bulk-write sequences
 * where the state manager has a retry queue (settings-panel delete-session,
 * first-time-setup wizard campaign save). Without this block, closing the
 * surrounding flow mid-drain loses the queued writes - destroy() clears
 * the drain timer.
 *
 * Requires `state.awaitQueueDrain` + `state._retryQueue`. A state object
 * without them (e.g. widget mode with no retry plumbing) resolves
 * immediately.
 */
export async function waitForQueueDrain(state, onProgress, setTotal, pollMs = 10000) {
  if (!state?.awaitQueueDrain) return;
  const startSize = state._retryQueue?.size ?? 0;
  if (startSize === 0) {
    // Give the drain one quick chance - covers the case where a write
    // was queued a millisecond before we got here.
    const result = await state.awaitQueueDrain(pollMs);
    if (result !== 'timeout') return;
  }
  const initialDepth = state._retryQueue?.size ?? 0;
  setTotal?.(initialDepth);
  onProgress?.(0, `${initialDepth} write${initialDepth === 1 ? '' : 's'} queued behind rate limit`);
  while (true) {
    const result = await state.awaitQueueDrain(pollMs);
    if (result !== 'timeout') return;
    const remaining = state._retryQueue?.size ?? 0;
    if (remaining === 0) return;
    const done = Math.max(0, initialDepth - remaining);
    onProgress?.(done, `${remaining} write${remaining === 1 ? '' : 's'} still queued - waiting for rate limit to clear`);
  }
}
