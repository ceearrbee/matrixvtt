/**
 * Imperative entry point for Preact modals. Many callers live in event
 * handlers outside the component tree (map actions, command palette, GM
 * ops), so they open a modal by calling `openModal` with a render function
 * and get back a `close` disposer. The render function receives `close` so
 * footer buttons can tear the modal down.
 */
import { render } from 'preact';

// Tracks the live close disposer for each currently-open modal, keyed by the
// rendered overlay id. Lets `openModal` enforce single-instance-per-id (the
// behavior the old ModalFactory had via `getElementById(id)?.remove()`) and
// lets `closeAllOpenModals` tear every modal down through its real disposer.
const openById = new Map();

export function openModal(renderFn) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let closed = false;
  let id = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (id && openById.get(id) === close) openById.delete(id);
    render(null, container);
    container.remove();
  };
  render(renderFn(close), container);

  id = container.querySelector('.modal-overlay')?.id || null;
  if (id) {
    const prev = openById.get(id);
    if (prev && prev !== close) prev();
    openById.set(id, close);
  }
  return close;
}

/** Close every modal opened via `openModal`, each through its own disposer. */
export function closeAllOpenModals() {
  for (const close of [...openById.values()]) close();
}
