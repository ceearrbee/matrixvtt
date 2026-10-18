/**
 * MatrixVTT does not support encrypted rooms. In widget mode the check
 * runs before any state loads, so nothing is read from or written to
 * the room, and the widget says why instead of showing the table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const stateManagerCtor = vi.fn();

async function loadApp(access) {
  vi.resetModules();
  window.__MVTT_DISABLE_AUTO_INIT__ = true;
  vi.doMock('../utils/remoteLogger.js', () => ({ initRemoteLogging: () => {} }));
  vi.doMock('../widget/WidgetManager.js', () => ({
    WidgetManager: class {
      async init() {}
      async getRoomAccess() { return access; }
    },
  }));
  vi.doMock('../state/StateManager.js', () => ({
    StateManager: class {
      constructor() { stateManagerCtor(); }
      async init() {}
    },
  }));
  vi.doMock('../ui/ui-methods.js', () => ({ createUI: () => ({ render: () => {} }) }));
  vi.doMock('../chat-integrator.js', () => ({ ChatIntegrator: class { init() {} } }));
  return import('../app.js');
}

beforeEach(() => {
  stateManagerCtor.mockClear();
  document.body.innerHTML = '<div id="app"></div>';
});

describe('widget start-up in an encrypted room', () => {
  it('stops before loading state and explains', async () => {
    const { MatrixVTT } = await loadApp({ encrypted: true, joinRule: 'invite' });
    await new MatrixVTT().init();
    expect(stateManagerCtor).not.toHaveBeenCalled();
    expect(document.getElementById('app').textContent).toMatch(/does not support encrypted rooms/i);
  });

  it('starts as usual in an unencrypted room', async () => {
    const { MatrixVTT } = await loadApp({ encrypted: false, joinRule: 'invite' });
    await new MatrixVTT().init();
    expect(stateManagerCtor).toHaveBeenCalled();
  });
});
