/**
 * Camera follow - panToToken
 *
 * panToToken(mr, tokenId) centres the canvas viewport on the given token.
 * It updates mr.panX/panY so the token appears at the centre of the canvas.
 */

import { describe, it, expect } from 'vitest';
import { panToToken } from '../map/layers/tokens.js';

function makeMr({ token, canvasW = 800, canvasH = 600, zoom = 1 }) {
  return {
    panX: 0,
    panY: 0,
    zoom,
    canvas: { width: canvasW, height: canvasH },
    state: {
      tokens: new Map(token ? [['tok-1', token]] : []),
    },
    render: () => {},
  };
}

describe('panToToken', () => {
  it('centres the viewport on the token position', () => {
    const mr = makeMr({ token: { x: 400, y: 300 } });
    panToToken(mr, 'tok-1');
    // After pan: canvas centre = (400, 300) in world coords
    // panX = canvasW/2 - token.x * zoom = 400 - 400 = 0
    expect(mr.panX).toBeCloseTo(0);
    expect(mr.panY).toBeCloseTo(0);
  });

  it('accounts for zoom level', () => {
    const mr = makeMr({ token: { x: 200, y: 100 }, zoom: 2 });
    panToToken(mr, 'tok-1');
    // panX = 800/2 - 200*2 = 400 - 400 = 0
    // panY = 600/2 - 100*2 = 300 - 200 = 100
    expect(mr.panX).toBeCloseTo(0);
    expect(mr.panY).toBeCloseTo(100);
  });

  it('does nothing when token does not exist', () => {
    const mr = makeMr({ token: null });
    mr.panX = 50; mr.panY = 75;
    panToToken(mr, 'no-such-token');
    expect(mr.panX).toBe(50);
    expect(mr.panY).toBe(75);
  });

  it('calls mr.render() after updating pan', () => {
    let rendered = false;
    const mr = makeMr({ token: { x: 100, y: 100 } });
    mr.render = () => { rendered = true; };
    panToToken(mr, 'tok-1');
    expect(rendered).toBe(true);
  });
});
