/**
 * Duplication audit F8: the handout and page forms each hand-inlined
 * the same flow - flush the visual editor, read the fields, reject a
 * blank required one with a toast, persist, close. One helper owns it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindModalSubmit } from '../utils/forms.js';

function makeRoot(values = { title: 'Ledger', body: 'text' }) {
  const root = document.createElement('div');
  for (const [id, value] of Object.entries(values)) {
    const input = document.createElement('input');
    input.id = id;
    input.value = value;
    root.appendChild(input);
  }
  return root;
}

describe('bindModalSubmit', () => {
  let toast, persist, onClose, flush;
  beforeEach(() => {
    toast = vi.fn();
    persist = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
    flush = vi.fn();
  });

  const bind = (root, extra = {}) => bindModalSubmit({
    root: () => root,
    fields: { title: 'title', body: 'body' },
    required: { title: 'Title' },
    flush, persist, onClose, toast,
    ...extra,
  });

  it('flushes the editor before reading, so the textarea is current', async () => {
    const root = makeRoot();
    await bind(root)();
    expect(flush).toHaveBeenCalled();
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(persist.mock.invocationCallOrder[0]);
  });

  it('hands the collected values to persist and then closes', async () => {
    await bind(makeRoot())();
    expect(persist).toHaveBeenCalledWith({ title: 'Ledger', body: 'text' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names the blank required field and keeps the modal open', async () => {
    await bind(makeRoot({ title: '   ', body: 'text' }))();
    expect(toast).toHaveBeenCalledWith('Title is required', 'error');
    expect(persist).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open when persist reports failure', async () => {
    await bind(makeRoot(), { persist: vi.fn().mockResolvedValue(false) })();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('works without a flush hook', async () => {
    await bindModalSubmit({
      root: () => makeRoot(),
      fields: { title: 'title' },
      required: { title: 'Title' },
      persist, onClose, toast,
    })();
    expect(onClose).toHaveBeenCalled();
  });
});
