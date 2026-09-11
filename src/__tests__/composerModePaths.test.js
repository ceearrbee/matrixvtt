/**
 * There were four ways to change speaking mode: the composer pills, the
 * QuickTray IC/OOC toggle, the ModePopup behind Menu > "Chat helpers",
 * and the slash commands. The pills and the slash grammar survive -
 * slash costs no chrome and keyboard-help teaches it. The other two go.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import fs from 'node:fs';
import path from 'node:path';
import { QuickTray } from '../ui/QuickTray.jsx';
import { buildGlobalMenuItems } from '../ui/global-menu-items.js';
import { chatModeSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('speaking-mode entry points', () => {
  beforeEach(() => {
    chatModeSignal.value = 'say';
    initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  });
  afterEach(cleanup);

  it('QuickTray keeps the roll and turn actions but not a mode toggle', () => {
    const { container } = render(h(QuickTray, { ui: /** @type {any} */ ({}) }));
    expect(container.querySelector('[data-quick="d20"]')).not.toBeNull();
    expect(container.querySelector('[data-quick="next-turn"]')).not.toBeNull();
    expect(container.querySelector('[data-quick="mode-toggle"]')).toBeNull();
  });

  it('ModePopup and its menu entry are gone', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/ui/ModePopup.jsx'))).toBe(false);
    expect(read('src/ui/LegacyChatPopups.jsx')).not.toMatch(/ModePopup/);
    const keys = buildGlobalMenuItems(/** @type {any} */ ({}), { isGM: false, canLeave: false })
      .map((i) => i.key);
    expect(keys).not.toContain('chatHelpers');
  });

  it('keeps the slash grammar, which costs no chrome', () => {
    expect(read('src/ui/keyboard-help.js')).toMatch(/\/as Name/);
    expect(read('src/ui/keyboard-help.js')).toMatch(/\/w @user/);
  });
});

describe('composer dice controls are declared once', () => {
  it('the shared module owns the dice faces and the speaking modes', () => {
    const shared = read('src/ui/composer/dice-controls.jsx');
    expect(shared).toMatch(/export const DICE/);
    expect(shared).toMatch(/export const CHAT_MODES/);
  });

  it('neither the strip nor the mobile popover redeclares them', () => {
    for (const f of ['src/ui/DiceBar.jsx', 'src/ui/ComposerActionsPopover.jsx']) {
      expect(read(f), f).not.toMatch(/^const DICE = /m);
      expect(read(f), f).not.toMatch(/^const CHAT_MODES = /m);
      expect(read(f), f).toMatch(/from '\.\.?\/?(ui\/)?composer\/dice-controls\.jsx'|from '\.\/composer\/dice-controls\.jsx'/);
    }
  });
});
