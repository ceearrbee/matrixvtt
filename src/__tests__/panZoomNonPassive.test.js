/**
 * The canvas owns wheel and
 * two-finger gestures, so its listeners must register with
 * `{ passive: false }` and call preventDefault. Konva's `stage.on`
 * route attaches passive listeners on touch by default; rely on a
 * direct addEventListener for the gestures we own.
 */
import { describe, it, expect, vi } from 'vitest';
import { setupPanZoom } from '../map/input/pan-zoom.js';

function makeStubStage() {
  const container = document.createElement('div');
  const addSpy = vi.spyOn(container, 'addEventListener');
  const stage = {
    on: vi.fn(),
    off: vi.fn(),
    container: () => container,
  };
  return { stage, container, addSpy };
}

function makeMr(stage) {
  return { stage, zoom: 1, panX: 0, panY: 0, render: vi.fn() };
}

describe('pan-zoom - non-passive listeners on owned gestures', () => {
  it('registers wheel and touchmove with { passive: false }', () => {
    const { stage, addSpy } = makeStubStage();
    setupPanZoom(makeMr(stage));

    const calls = addSpy.mock.calls;
    const wheelCall = calls.find((c) => c[0] === 'wheel');
    const touchMoveCall = calls.find((c) => c[0] === 'touchmove');
    expect(wheelCall, 'wheel listener must be registered directly').toBeTruthy();
    expect(wheelCall[2]).toMatchObject({ passive: false });
    expect(touchMoveCall, 'touchmove listener must be registered directly').toBeTruthy();
    expect(touchMoveCall[2]).toMatchObject({ passive: false });
  });

  it('preventDefault fires on two-finger touchmove', () => {
    const { stage, container } = makeStubStage();
    setupPanZoom(makeMr(stage));

    const ev = new Event('touchmove', { cancelable: true, bubbles: true });
    Object.defineProperty(ev, 'touches', {
      value: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 100 },
      ],
    });
    const pd = vi.spyOn(ev, 'preventDefault');
    container.dispatchEvent(ev);
    expect(pd).toHaveBeenCalled();
  });
});
