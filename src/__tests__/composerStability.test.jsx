import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { DiceBar } from '../ui/DiceBar.jsx';
import { HelpIcon } from '../ui/HelpIcon.jsx';
import { HELP_TERMS } from '../ui/help-terms.js';
import { chatModeSignal, activeSceneSignal, replyContextSignal, speakAsSignal } from '../state/ui-signals.js';
import { tokensSignal, charactersSignal } from '../state/signals.js';

function mkUi() {
  const tokens = new Map([
    ['t1', { id: 't1', name: 'Aria', sheet_id: 'c1', owner_user_id: '@me:hs' }],
  ]);
  const characters = new Map([
    ['c1', { id: 'c1', name: 'Aria', claimed_by_user_id: '@me:hs' }],
  ]);
  return {
    state: {
      isGM: () => true,
      tokens,
      characters,
      settings: { systemConfig: { rolls: {} } },
      widgetManager: { roomId: '!room:hs' },
    },
    widgetManager: { userId: '@me:hs', isAppClient: true },
    _latestDiceResult: '',
    sendChatMessage: vi.fn(),
    setSpeakAs: vi.fn(),
    rollDice: vi.fn(),
  };
}

describe('Composer stability & HelpIcon popover (Tasks 5 & 6)', () => {
  beforeEach(() => {
    chatModeSignal.value = 'say';
    activeSceneSignal.value = null;
    replyContextSignal.value = null;
    speakAsSignal.value = '';
    tokensSignal.value = new Map();
    charactersSignal.value = new Map();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('Task 5: Stabilize Chat & Dice Composer (No predecessor layout shift)', () => {
    it('focusing #chat-input does not insert predecessor sibling elements in its parent row', () => {
      const { container } = render(h(DiceBar, { ui: mkUi() }));
      const chatInput = container.querySelector('#chat-input');
      expect(chatInput).not.toBeNull();

      const inputRow = chatInput.parentElement;
      expect(inputRow.classList.contains('dice-bar__input-row')).toBe(true);

      const getPredecessors = () => {
        const siblings = Array.from(inputRow.children);
        const idx = siblings.indexOf(chatInput);
        return siblings.slice(0, idx).map((el) => el.className || el.tagName);
      };

      const beforeFocusPredecessors = getPredecessors();

      // Focus #chat-input
      fireEvent.focus(chatInput);

      const afterFocusPredecessors = getPredecessors();

      // Predecessors in the same flex row must not have changed
      expect(afterFocusPredecessors).toEqual(beforeFocusPredecessors);

      // Meta chips (mode pills, scene start) live in .dice-bar__composer-meta above the row
      const metaContainer = container.querySelector('.dice-bar__composer-meta');
      expect(metaContainer).not.toBeNull();
      expect(metaContainer.querySelector('.scene-start-btn')).not.toBeNull();
      expect(inputRow.querySelector('.scene-start-btn')).toBeNull();
    });

    it('blurring #chat-input leaves predecessor siblings in the input row stable', async () => {
      const { container } = render(h(DiceBar, { ui: mkUi() }));
      const chatInput = container.querySelector('#chat-input');
      const inputRow = chatInput.parentElement;

      const getPredecessors = () => {
        const siblings = Array.from(inputRow.children);
        const idx = siblings.indexOf(chatInput);
        return siblings.slice(0, idx).map((el) => el.className || el.tagName);
      };

      fireEvent.focus(chatInput);
      const duringFocusPredecessors = getPredecessors();

      fireEvent.blur(chatInput);
      await new Promise((r) => setTimeout(r, 0));

      const afterBlurPredecessors = getPredecessors();
      expect(afterBlurPredecessors).toEqual(duringFocusPredecessors);
    });
  });

  describe('Task 6: Replace blocking HelpIcon modal with lightweight popover', () => {
    it('opens .help-popover[role="dialog"] without mounting a full-screen .modal-backdrop', () => {
      const { container } = render(h(HelpIcon, { term: 'fog' }));
      const btn = container.querySelector('button.help-icon');
      expect(btn).not.toBeNull();

      expect(container.querySelector('.help-popover')).toBeNull();

      fireEvent.click(btn);

      const popover = container.querySelector('.help-popover');
      expect(popover).not.toBeNull();
      expect(popover.getAttribute('role')).toBe('dialog');
      expect(popover.getAttribute('aria-label')).toBe(HELP_TERMS.fog.title);
      expect(popover.textContent).toContain(HELP_TERMS.fog.long);

      // Must not render full-screen modal backdrop
      expect(document.querySelector('.modal-backdrop')).toBeNull();

      // Has close button
      const closeBtn = popover.querySelector('button.help-popover__close');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close');
    });

    it('closes the help popover when pressing Escape', () => {
      const { container } = render(h(HelpIcon, { term: 'initiative' }));
      const btn = container.querySelector('button.help-icon');
      fireEvent.click(btn);

      expect(container.querySelector('.help-popover')).not.toBeNull();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(container.querySelector('.help-popover')).toBeNull();
    });

    it('closes the help popover on outside mousedown', () => {
      const { container } = render(h(HelpIcon, { term: 'ruleset' }));
      const btn = container.querySelector('button.help-icon');
      fireEvent.click(btn);

      expect(container.querySelector('.help-popover')).not.toBeNull();

      fireEvent.mouseDown(document.body);

      expect(container.querySelector('.help-popover')).toBeNull();
    });

    it('closes the help popover on clicking close button', () => {
      const { container } = render(h(HelpIcon, { term: 'ruleset' }));
      const btn = container.querySelector('button.help-icon');
      fireEvent.click(btn);

      const closeBtn = container.querySelector('button.help-popover__close');
      expect(closeBtn).not.toBeNull();
      fireEvent.click(closeBtn);

      expect(container.querySelector('.help-popover')).toBeNull();
    });
  });
});
