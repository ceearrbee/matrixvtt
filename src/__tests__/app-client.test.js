import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MatrixVTTClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.ui = null;
    // app-client.js calls `logger.log('MatrixVTT', 'Initialized')` on the
    // happy path. In Vitest, console output is forwarded to the host over
    // RPC; if the worker tears down before that message round-trips it
    // surfaces as `EnvironmentTeardownError: Closing rpc while
    // "onUserConsoleLog" was pending`. Silence console during these
    // tests - none of them assert on stdout.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.ui = null;
  });

  it('initializes the standalone client stack with the selected room credentials', async () => {
    const setCredentials = vi.fn();
    const clientInit = vi.fn().mockResolvedValue(undefined);
    const stateInit = vi.fn().mockResolvedValue(undefined);
    const chatInit = vi.fn();
    const render = vi.fn();

    vi.doMock('../client/ClientManager.js', () => ({
      ClientManager: class {
        setCredentials(...args) { setCredentials(...args); }
        async init() { return clientInit(); }
      }
    }));
    vi.doMock('../state/StateManager.js', () => ({
      StateManager: class {
        constructor(clientManager) {
          this.clientManager = clientManager;
          this.maps = new Map([['existing-map', { id: 'existing-map' }]]);
          this.activeMapId = 'existing-map';
        }
        async init() { return stateInit(); }
      }
    }));
    vi.doMock('../ui/ui-methods.js', () => ({
      createUI: (state, clientManager, chat) => ({
        state, clientManager, chat,
        render: () => { render(); },
        destroy: () => {},
      })
    }));
    vi.doMock('../chat-integrator.js', () => ({
      ChatIntegrator: class {
        constructor(clientManager, state, diceRoller) {
          this.clientManager = clientManager;
          this.state = state;
          this.diceRoller = diceRoller;
        }
        init() { chatInit(); }
        destroy() {}
      }
    }));
    vi.doMock('../dice-roller.js', () => ({
      DiceRoller: class {
        constructor(state) {
          this.state = state;
        }
      }
    }));

    const { MatrixVTTClient } = await import('../app-client.js');
    const client = new MatrixVTTClient();

    await client.initVTT('https://matrix.example.com', 'secret', '@user:example.com', '!room:example.com', true);

    expect(setCredentials).toHaveBeenCalledWith(
      'https://matrix.example.com',
      'secret',
      '@user:example.com',
      '!room:example.com'
    );
    expect(clientInit).toHaveBeenCalledTimes(1);
    expect(stateInit).toHaveBeenCalledTimes(1);
    expect(chatInit).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    // forceWizard no longer clears server-loaded state locally - the
    // wizard itself now offers Resume/Blank and tombstones explicitly
    // when the user opts to start fresh. The flag is threaded onto the UI
    // only when the server lacks a com.vtt.settings event (mock returns
    // nothing, so the flag is forced in this case).
    expect(client.ui._forceWizard).toBe(true);
    expect(client.state.maps.size).toBe(1);
    expect(client.state.activeMapId).toBe('existing-map');
    expect(window.ui).toBe(client.ui);
  });

  it('does NOT force the wizard when the server already has a Yjs snapshot', async () => {
    vi.doMock('../client/ClientManager.js', () => ({
      ClientManager: class {
        setCredentials() {}
        async init() {}
        async getRoomState() {
          return [
            { type: 'com.matrixvtt.yjs.snapshot', state_key: '', content: { data: 'AA==', marker: 1 } },
          ];
        }
      }
    }));
    vi.doMock('../state/StateManager.js', () => ({
      StateManager: class {
        constructor() { this.maps = new Map(); this.activeMapId = null; }
        async init() {}
      }
    }));
    vi.doMock('../ui/ui-methods.js', () => ({
      createUI: (state, clientManager, chat) => ({
        state, clientManager, chat,
        render: () => {},
        destroy: () => {},
      })
    }));
    vi.doMock('../chat-integrator.js', () => ({
      ChatIntegrator: class { constructor() {} init() {} destroy() {} }
    }));
    vi.doMock('../dice-roller.js', () => ({
      DiceRoller: class { constructor() {} }
    }));

    const { MatrixVTTClient } = await import('../app-client.js');
    const client = new MatrixVTTClient();
    // Pass forceWizard=true to simulate the fresh-join detection signal.
    // The settings-probe should override and NOT set _forceWizard, because
    // the room already has an active VTT campaign.
    await client.initVTT('https://matrix.example.com', 'secret', '@me:s', '!room:s', true);

    expect(client.ui._forceWizard).toBeFalsy();
  });

  it('rethrows initialization errors from the client stack', async () => {
    vi.doMock('../client/ClientManager.js', () => ({
      ClientManager: class {
        setCredentials() {}
        async init() {
          throw new Error('login failed');
        }
      }
    }));
    vi.doMock('../state/StateManager.js', () => ({
      StateManager: class {}
    }));
    vi.doMock('../ui/ui-methods.js', () => ({
      createUI: () => ({ render: () => {}, destroy: () => {} })
    }));
    vi.doMock('../chat-integrator.js', () => ({
      ChatIntegrator: class {}
    }));
    vi.doMock('../dice-roller.js', () => ({
      DiceRoller: class {}
    }));

    const { MatrixVTTClient } = await import('../app-client.js');
    const client = new MatrixVTTClient();

    await expect(
      client.initVTT('https://matrix.example.com', 'secret', '@user:example.com', '!room:example.com')
    ).rejects.toThrow('login failed');
  });

  it('does not call console.error directly on init failure (caller handles it)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../client/ClientManager.js', () => ({
      ClientManager: class {
        setCredentials() {}
        async init() { throw new Error('boom'); }
      }
    }));
    vi.doMock('../state/StateManager.js', () => ({ StateManager: class {} }));
    vi.doMock('../ui/ui-methods.js', () => ({ createUI: () => ({ render: () => {}, destroy: () => {} }) }));
    vi.doMock('../chat-integrator.js', () => ({ ChatIntegrator: class {} }));
    vi.doMock('../dice-roller.js', () => ({ DiceRoller: class {} }));

    const { MatrixVTTClient } = await import('../app-client.js');
    const client = new MatrixVTTClient();

    await expect(
      client.initVTT('https://matrix.example.com', 'tok', '@u:h.com', '!r:h.com')
    ).rejects.toThrow('boom');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('destroys active controllers and clears the exported UI reference', async () => {
    const destroyUi = vi.fn();
    const destroyState = vi.fn();
    const destroyChat = vi.fn();
    const destroyClientManager = vi.fn();

    vi.doMock('../client/ClientManager.js', () => ({
      ClientManager: class {
        destroy() { destroyClientManager(); }
      }
    }));
    vi.doMock('../state/StateManager.js', () => ({
      StateManager: class {
        _clearAllState() {}
        destroy() { destroyState(); }
      }
    }));
    vi.doMock('../ui/ui-methods.js', () => ({
      createUI: () => ({ destroy: () => { destroyUi(); } })
    }));
    vi.doMock('../chat-integrator.js', () => ({
      ChatIntegrator: class {
        destroy() { destroyChat(); }
      }
    }));
    vi.doMock('../dice-roller.js', () => ({
      DiceRoller: class {}
    }));

    const { MatrixVTTClient } = await import('../app-client.js');
    const { ClientManager } = await import('../client/ClientManager.js');
    const { StateManager } = await import('../state/StateManager.js');
    const { createUI } = await import('../ui/ui-methods.js');
    const { ChatIntegrator } = await import('../chat-integrator.js');
    const client = new MatrixVTTClient();

    client.clientManager = new ClientManager();
    client.state = new StateManager();
    client.ui = createUI();
    client.chat = new ChatIntegrator();
    window.ui = client.ui;

    client.destroy();

    expect(destroyUi).toHaveBeenCalledTimes(1);
    expect(destroyState).toHaveBeenCalledTimes(1);
    expect(destroyChat).toHaveBeenCalledTimes(1);
    expect(destroyClientManager).toHaveBeenCalledTimes(1);
    expect(window.ui).toBeNull();
    expect(client.clientManager).toBeNull();
    expect(client.state).toBeNull();
    expect(client.ui).toBeNull();
    expect(client.chat).toBeNull();
  });
});
