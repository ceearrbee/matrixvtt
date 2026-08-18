/**
 * chat-tones.js - preset speaking-tone list + body-prefix helper.
 *
 * When the user picks a tone (other than Neutral) for a Say-mode message,
 * the outgoing body is prefixed with `[ToneName]`. A `com.vtt.tone` field
 * on the event content additionally carries an optional colour so clients
 * can render a coloured chip; if a client doesn't recognise the field, the
 * bracket prefix in the body is still readable.
 *
 * The list mirrors the rolegate.com preset set (~50 tones). The `Custom`
 * entry is appended last so the picker's "+ Custom" affordance has a
 * stable position.
 */

export const CHAT_TONES = [
  { name: 'Neutral' },
  { name: 'Admiring' },
  { name: 'Affectionate' },
  { name: 'Alarmed' },
  { name: 'Amused' },
  { name: 'Angry' },
  { name: 'Annoyed' },
  { name: 'Anxious' },
  { name: 'Apologetic' },
  { name: 'Baffled' },
  { name: 'Brooding' },
  { name: 'Cheerful' },
  { name: 'Cold' },
  { name: 'Concerned' },
  { name: 'Confident' },
  { name: 'Confused' },
  { name: 'Curious' },
  { name: 'Defiant' },
  { name: 'Determined' },
  { name: 'Disappointed' },
  { name: 'Doubtful' },
  { name: 'Eager' },
  { name: 'Embarrassed' },
  { name: 'Excited' },
  { name: 'Exhausted' },
  { name: 'Fearful' },
  { name: 'Flirty' },
  { name: 'Frustrated' },
  { name: 'Gentle' },
  { name: 'Grateful' },
  { name: 'Grim' },
  { name: 'Hopeful' },
  { name: 'Hurt' },
  { name: 'Mocking' },
  { name: 'Nervous' },
  { name: 'Pleading' },
  { name: 'Proud' },
  { name: 'Reluctant' },
  { name: 'Sad' },
  { name: 'Sarcastic' },
  { name: 'Serious' },
  { name: 'Shouted' },
  { name: 'Sincere' },
  { name: 'Smug' },
  { name: 'Suspicious' },
  { name: 'Sympathetic' },
  { name: 'Teasing' },
  { name: 'Thoughtful' },
  { name: 'Tired' },
  { name: 'Whispered' },
  { name: 'Worried' },
];

/**
 * Prefix a chat body with the chosen tone. Neutral and null are no-ops.
 * The body is otherwise unchanged - the consumer (chat-send, log
 * renderer) is responsible for HTML-escaping.
 *
 * @param {{ name: string, color?: string } | null | undefined} tone
 * @param {string} body
 * @returns {string}
 */
export function formatToneBody(tone, body) {
  if (!tone || tone.name === 'Neutral') return body;
  return `[${tone.name}] ${body}`;
}
