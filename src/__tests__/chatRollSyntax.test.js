/**
 * /roll syntax in chat - parseRollCommand
 *
 * When a player types "/roll d20+5" (or "/roll 2d6") as their chat message,
 * parseRollCommand extracts the formula so sendChat can execute it and post
 * both the text and the roll result.
 */

import { describe, it, expect } from 'vitest';
import { parseRollCommand } from '../ui/chat-helpers.js';

describe('parseRollCommand', () => {
  it('returns null for plain text messages', () => {
    expect(parseRollCommand('Hello world')).toBeNull();
  });

  it('extracts formula from /roll <formula>', () => {
    const result = parseRollCommand('/roll d20+5');
    expect(result).not.toBeNull();
    expect(result.formula).toBe('d20+5');
    expect(result.text).toBe('');
  });

  it('extracts formula and trailing text from /roll <formula> <text>', () => {
    const result = parseRollCommand('/roll 2d6 fire damage');
    expect(result).not.toBeNull();
    expect(result.formula).toBe('2d6');
    expect(result.text).toBe('fire damage');
  });

  it('handles /roll with no modifier', () => {
    const result = parseRollCommand('/roll 1d8');
    expect(result?.formula).toBe('1d8');
  });

  it('is case-insensitive for /ROLL', () => {
    const result = parseRollCommand('/ROLL d20');
    expect(result?.formula).toBe('d20');
  });
});
