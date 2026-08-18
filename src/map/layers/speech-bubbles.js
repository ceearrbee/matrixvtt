/**
 * src/map/layers/speech-bubbles.js - Konva speech-bubble layer.
 *
 * Mirrors the pings-layer shape: own a Konva.Layer, expose
 * `addBubble(x, y, body)`. Each bubble is a Konva.Label (bg + text)
 * positioned above the supplied world coordinates; a Konva.Tween
 * holds it visible for a length-proportional duration, then fades
 * opacity to 0 and destroys.
 *
 * Wired via MapRenderer.showSpeechBubble(tokenId, body) - the
 * dispatcher resolves the token's centre via tokenCentre() and
 * forwards to the layer's addBubble.
 *
 * Colours come from the active theme via `mr._colors` (bubbleBg /
 * bubbleBorder / bubbleText) so the bubble follows light / dark /
 * high-contrast palettes instead of the previous hardcoded near-black.
 */

import Konva from 'konva';
import { prefersReducedMotion } from '../../utils/reduced-motion.js';

const BUBBLE_LIFETIME_MIN_MS = 5000;
const BUBBLE_MS_PER_CHAR = 90;
const BUBBLE_FADE_MS = 600;
const BUBBLE_MAX_CHARS = 80;
const BUBBLE_PADDING = 8;
const BUBBLE_FONT_SIZE = 14;
const BUBBLE_OFFSET_Y = 32; // pixels above the token centre

/**
 * Length-proportional lifetime so short remarks ("Hi!") get a generous
 * 5 s read while long roleplay lines get the time they need.
 *
 * @param {string|null|undefined} body
 * @returns {number} milliseconds the bubble stays at full opacity
 */
export function computeBubbleLifetime(body) {
  const len = (body == null ? '' : String(body)).length;
  return Math.max(BUBBLE_LIFETIME_MIN_MS, len * BUBBLE_MS_PER_CHAR);
}

function truncate(body) {
  const trimmed = String(body ?? '').trim();
  if (trimmed.length <= BUBBLE_MAX_CHARS) return trimmed;
  return trimmed.slice(0, BUBBLE_MAX_CHARS - 1) + '…';
}

export function createSpeechBubblesLayer(stage, mr) {
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  function addBubble(x, y, body) {
    const text = truncate(body);
    if (!text) return;

    const colors = mr?._colors || {};
    const fill = colors.bubbleBg || 'rgba(0, 0, 0, 0.78)';
    const stroke = colors.bubbleBorder || 'rgba(255, 255, 255, 0.5)';
    const textFill = colors.bubbleText || '#ffffff';

    const label = new Konva.Label({
      x,
      y: y - BUBBLE_OFFSET_Y,
      opacity: 1,
      listening: false,
    });
    label.add(new Konva.Tag({
      fill,
      stroke,
      strokeWidth: 1,
      cornerRadius: 4,
      pointerDirection: 'down',
      pointerWidth: 8,
      pointerHeight: 6,
      lineJoin: 'round',
    }));
    label.add(new Konva.Text({
      text,
      fontSize: BUBBLE_FONT_SIZE,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: BUBBLE_PADDING,
      fill: textFill,
    }));

    // Centre the label horizontally on the token; the pointer-down
    // tag handles the visual anchor.
    const width = label.getWidth();
    label.offsetX(width / 2);
    layer.add(label);

    const lifetimeMs = computeBubbleLifetime(body);
    setTimeout(() => {
      if (prefersReducedMotion()) {
        label.destroy();
        layer.batchDraw();
        return;
      }
      const fade = new Konva.Tween({
        node: label,
        duration: BUBBLE_FADE_MS / 1000,
        opacity: 0,
        onFinish: () => {
          fade.destroy();
          label.destroy();
          layer.batchDraw();
        },
      });
      fade.play();
    }, lifetimeMs - BUBBLE_FADE_MS);

    layer.batchDraw();
  }

  function destroy() {
    layer.destroy();
  }

  return { layer, addBubble, destroy };
}
