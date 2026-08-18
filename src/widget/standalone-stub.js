/**
 * Stub widget API used when the app is loaded outside an Element iframe.
 *
 * Matches the surface the real WidgetApiImpl exposes (send/receive/observe/
 * OpenID) but returns empty results so the UI can render without a Matrix
 * backend. The standalone-mode warning banner is owned by this module.
 */

export function createStandaloneWidgetApi() {
  const mockEventId = () => `$mock_${Date.now()}`;
  const emitInitial = (observer) => {
    if (typeof observer === 'function') observer([]);
    else if (observer?.next) observer.next([]);
  };

  const observable = {
    pipe: () => ({
      subscribe: (observer) => {
        emitInitial(observer);
        return { unsubscribe: () => {} };
      },
    }),
    subscribe: (observer) => {
      emitInitial(observer);
      return { unsubscribe: () => {} };
    },
  };

  return {
    widgetParameters: {},
    sendStateEvent: async () => ({ event_id: mockEventId() }),
    sendRoomEvent: async () => ({ event_id: mockEventId() }),
    redactEvent: async () => ({}),
    // The local user runs their own offline session, so they are the GM.
    receiveStateEvents: async (type) =>
      type === 'm.room.power_levels'
        ? [{ type, content: { users: { '@standalone:localhost': 100 } } }]
        : [],
    observeStateEvents: () => observable,
    requestOpenIDConnectToken: () => Promise.reject(new Error('Not available in standalone mode')),
  };
}

export function showStandaloneWarning() {
  setTimeout(() => {
    const app = document.getElementById('app');
    if (!app) return;
    const warning = document.createElement('div');
    warning.id = 'standalone-warning';
    warning.style.cssText = [
      'position: fixed', 'top: 10px', 'left: 50%', 'transform: translateX(-50%)',
      'background: #ff9800', 'color: white', 'padding: 12px 20px', 'border-radius: 4px',
      'z-index: var(--z-modal)', 'font-weight: bold', 'box-shadow: 0 2px 8px rgba(0,0,0,0.2)',
      'max-width: 90%', 'text-align: center',
    ].join(';');
    warning.innerHTML =
      '⚠️ STANDALONE MODE - No Matrix sync enabled<br>' +
      '<span style="font-size: 0.9em; font-weight: normal;">' +
      'Load as widget in Element Web to enable multiplayer sync</span>';
    app.appendChild(warning);
  }, 1000);
}
