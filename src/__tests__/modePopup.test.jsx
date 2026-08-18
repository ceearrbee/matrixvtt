/**
 * ModePopup.
 *
 * rpglog-flavored Mode picker: mode radios (Say/Describe/OOC) plus
 * two compose-helper rows:
 *   - Speak as NPC: input + Say / Does buttons that insert /as or
 *     /asd <Name>   prefixes into the chat-input textarea
 *   - Whisper to:   input + Whisper button that inserts /w <user>  prefix
 *
 * Discoverability - the panel surfaces the slash grammar (parser
 * lives in slashCommands.test.js) so users learn it by use.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { ModePopup } from '../ui/ModePopup.jsx';
import { chatModeSignal } from '../state/ui-signals.js';

function mountComposerStub() {
  const ta = document.createElement('textarea');
  ta.id = 'chat-input';
  document.body.appendChild(ta);
  return ta;
}

beforeEach(() => {
  document.body.innerHTML = '';
  chatModeSignal.value = 'say';
});

afterEach(cleanup);

describe('ModePopup - mode radios', () => {
  it('renders Say / Describe / OOC mode radios', () => {
    const { container } = render(h(ModePopup, {}));
    for (const m of ['say', 'describe', 'ooc']) {
      expect(container.querySelector(`[data-mode-radio="${m}"]`), `missing ${m}`)
        .not.toBeNull();
    }
  });

  it('marks the current mode aria-checked', () => {
    chatModeSignal.value = 'describe';
    const { container } = render(h(ModePopup, {}));
    expect(container.querySelector('[data-mode-radio="describe"]').getAttribute('aria-checked'))
      .toBe('true');
    expect(container.querySelector('[data-mode-radio="say"]').getAttribute('aria-checked'))
      .toBe('false');
  });

  it('clicking a mode radio flips chatModeSignal', () => {
    const { container } = render(h(ModePopup, {}));
    fireEvent.click(container.querySelector('[data-mode-radio="ooc"]'));
    expect(chatModeSignal.value).toBe('ooc');
  });
});

describe('ModePopup - Speak as NPC', () => {
  it('renders an NPC name input + Say / Does buttons', () => {
    const { container } = render(h(ModePopup, {}));
    expect(container.querySelector('[data-mode-npc-name]')).not.toBeNull();
    expect(container.querySelector('[data-mode-npc-say]')).not.toBeNull();
    expect(container.querySelector('[data-mode-npc-does]')).not.toBeNull();
  });

  it('Say button prepends "/as <Name> " into the chat input', () => {
    const ta = mountComposerStub();
    const { container } = render(h(ModePopup, {}));
    container.querySelector('[data-mode-npc-name]').value = 'Bartender';
    fireEvent.click(container.querySelector('[data-mode-npc-say]'));
    expect(ta.value).toBe('/as Bartender ');
  });

  it('Does button prepends "/asd <Name> " into the chat input', () => {
    const ta = mountComposerStub();
    const { container } = render(h(ModePopup, {}));
    container.querySelector('[data-mode-npc-name]').value = 'Bartender';
    fireEvent.click(container.querySelector('[data-mode-npc-does]'));
    expect(ta.value).toBe('/asd Bartender ');
  });

  it('wraps a multi-word NPC name in quotes', () => {
    const ta = mountComposerStub();
    const { container } = render(h(ModePopup, {}));
    container.querySelector('[data-mode-npc-name]').value = 'Old Knight';
    fireEvent.click(container.querySelector('[data-mode-npc-say]'));
    expect(ta.value).toBe('/as "Old Knight" ');
  });

  it('empty NPC name is a no-op', () => {
    const ta = mountComposerStub();
    ta.value = 'existing';
    const { container } = render(h(ModePopup, {}));
    fireEvent.click(container.querySelector('[data-mode-npc-say]'));
    expect(ta.value).toBe('existing');
  });
});

describe('ModePopup - Whisper to', () => {
  it('renders a whisper target input + Whisper button', () => {
    const { container } = render(h(ModePopup, {}));
    expect(container.querySelector('[data-mode-whisper-name]')).not.toBeNull();
    expect(container.querySelector('[data-mode-whisper-send]')).not.toBeNull();
  });

  it('Whisper button prepends "/w <user> " into the chat input', () => {
    const ta = mountComposerStub();
    const { container } = render(h(ModePopup, {}));
    container.querySelector('[data-mode-whisper-name]').value = '@sarah';
    fireEvent.click(container.querySelector('[data-mode-whisper-send]'));
    expect(ta.value).toBe('/w @sarah ');
  });

  it('empty whisper target is a no-op', () => {
    const ta = mountComposerStub();
    ta.value = 'existing';
    const { container } = render(h(ModePopup, {}));
    fireEvent.click(container.querySelector('[data-mode-whisper-send]'));
    expect(ta.value).toBe('existing');
  });
});

describe('ModePopup - discoverability hints', () => {
  it('shows the equivalent slash hint somewhere in the rendered popup', () => {
    const { container } = render(h(ModePopup, {}));
    const text = container.textContent;
    expect(text).toMatch(/\/as/);
    expect(text).toMatch(/\/w/);
  });
});
