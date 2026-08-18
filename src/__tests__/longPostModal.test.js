/**
 * LongPostModal: Save-draft writes back through the same chat-draft
 * sessionStorage key the inline composer reads; Send routes through
 * ui.sendChatMessage and clears the draft.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ui/visual-editor-toggle.js', () => ({
  bindVisualEditorToggle: () => ({ flush: () => {}, destroy: () => {} }),
}));

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = '';
});
afterEach(() => { document.body.innerHTML = ''; });

function makeUi() {
  return {
    sendChatMessage: vi.fn(),
    widgetManager: { roomId: '!room:s' },
  };
}

async function open(ui) {
  const { openLongPostModal } = await import('../ui/LongPostModal.js');
  return openLongPostModal({ ui });
}

describe('openLongPostModal', () => {
  it('preloads the existing chat draft into the textarea', async () => {
    sessionStorage.setItem('vtt:chat-draft:!room:s', 'unfinished post');
    await open(makeUi());
    const ta = document.querySelector('#long-post-textarea');
    expect(ta.value).toBe('unfinished post');
  });

  it('Save draft writes the textarea value back to sessionStorage', async () => {
    await open(makeUi());
    const ta = document.querySelector('#long-post-textarea');
    ta.value = 'a long thoughtful reply';
    document.querySelector('[data-long-post-action="save"]').click();
    expect(sessionStorage.getItem('vtt:chat-draft:!room:s')).toBe('a long thoughtful reply');
  });

  it('Send calls ui.sendChatMessage with the textarea body and clears the draft', async () => {
    sessionStorage.setItem('vtt:chat-draft:!room:s', 'old');
    const ui = makeUi();
    await open(ui);
    const ta = document.querySelector('#long-post-textarea');
    ta.value = '## A new post\n\nWith two paragraphs.';
    document.querySelector('[data-long-post-action="send"]').click();
    expect(ui.sendChatMessage).toHaveBeenCalledWith('## A new post\n\nWith two paragraphs.');
    expect(sessionStorage.getItem('vtt:chat-draft:!room:s')).toBeNull();
  });

  it('Send refuses to send a whitespace-only post (still closes)', async () => {
    const ui = makeUi();
    await open(ui);
    const ta = document.querySelector('#long-post-textarea');
    ta.value = '   \n   ';
    document.querySelector('[data-long-post-action="send"]').click();
    expect(ui.sendChatMessage).not.toHaveBeenCalled();
  });
});
