/**
 * Whisper / private chat
 *
 * A whisper is a chat message that carries a `whisper_to` field containing
 * the target userId.  On receipt, messages are only displayed when the
 * viewer is the sender OR the recipient.
 *
 * Parsing: `/w @alice:example.com <message>` extracts recipient and text.
 * Formatting: whisper messages render with a "whisper" indicator.
 */

import { describe, it, expect } from 'vitest';
import { parseWhisperCommand, isWhisperVisible } from '../ui/chat-helpers.js';

describe('parseWhisperCommand', () => {
  it('returns null for a normal message', () => {
    expect(parseWhisperCommand('hello world')).toBeNull();
  });

  it('parses /w userId message', () => {
    const result = parseWhisperCommand('/w @alice:example.com Hello there');
    expect(result).toEqual({
      to: '@alice:example.com',
      text: 'Hello there',
    });
  });

  it('parses /whisper userId message (long form)', () => {
    const result = parseWhisperCommand('/whisper @bob:home.org Secret plan');
    expect(result).toEqual({
      to: '@bob:home.org',
      text: 'Secret plan',
    });
  });

  it('returns null when no message body is provided', () => {
    expect(parseWhisperCommand('/w @alice:example.com')).toBeNull();
  });

  it('is case-insensitive for the command keyword', () => {
    const result = parseWhisperCommand('/W @alice:example.com Hi');
    expect(result?.to).toBe('@alice:example.com');
  });
});

describe('isWhisperVisible', () => {
  const myUserId = '@me:home.org';

  it('always shows non-whisper messages', () => {
    expect(isWhisperVisible({ body: 'hello' }, myUserId)).toBe(true);
  });

  it('shows whisper when I am the sender', () => {
    expect(isWhisperVisible(
      { body: 'secret', sender: myUserId, whisper_to: '@alice:home.org' },
      myUserId
    )).toBe(true);
  });

  it('shows whisper when I am the recipient', () => {
    expect(isWhisperVisible(
      { body: 'secret', sender: '@alice:home.org', whisper_to: myUserId },
      myUserId
    )).toBe(true);
  });

  it('hides whisper when I am neither sender nor recipient', () => {
    expect(isWhisperVisible(
      { body: 'secret', sender: '@alice:home.org', whisper_to: '@bob:home.org' },
      myUserId
    )).toBe(false);
  });
});
