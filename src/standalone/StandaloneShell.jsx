
import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { AuthScreen } from './AuthScreen.jsx';
import { DiscoveryScreen } from './DiscoveryScreen.jsx';
import { saveAuthSession, loadAuthSession, saveActiveRoom, loadActiveRoom } from './sessionStore.js';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';
import { closeAllModals } from '../utils/modal-helpers.js';
import { getAccessibilitySettings, setAccessibilitySetting } from '../ui/settings-helpers.js';
import { docsHref } from '../utils/docs-link.js';

const TAGLINE =
  'A browser-only virtual tabletop. Your campaigns live in Matrix rooms: no server to run, no data to lose.';

const PITCH = [
  'Your campaigns live in Matrix rooms.',
  'No server to run, no data to lose.',
  'Open source, runs entirely in your browser.',
];

// A user needing a different theme or reduced motion must not have to
// get through login and discovery first; the in-app panel writes the
// same vtt:accessibility contract these controls do.
function SidebarA11yControls() {
  const [settings, setSettings] = useState(getAccessibilitySettings());
  const set = (key, value) => {
    setAccessibilitySetting(key, value);
    setSettings({ ...settings, [key]: value });
  };
  return h('div', { class: 'sidebar-a11y', role: 'group', 'aria-label': 'Display preferences' }, [
    h('label', { for: 'sidebar-theme' }, 'Theme'),
    h('select', {
      id: 'sidebar-theme', class: 'form-select', value: settings.theme,
      onChange: (e) => set('theme', e.target.value),
    }, [
      h('option', { value: 'auto' }, 'Auto (follow system)'),
      h('option', { value: 'dark' }, 'Dark'),
      h('option', { value: 'light' }, 'Light'),
      h('option', { value: 'high-contrast' }, 'High contrast'),
      h('option', { value: 'nondescript' }, 'Nondescript'),
    ]),
    h('label', { class: 'sidebar-a11y__toggle' }, [
      h('input', {
        type: 'checkbox', id: 'sidebar-reduced-motion', checked: settings.reduced_motion,
        onChange: () => set('reduced_motion', !settings.reduced_motion),
      }),
      ' Reduced motion',
    ]),
  ]);
}

function StandaloneSidebar({ screen, onSignOut, onFactoryReset }) {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return h('aside', { class: 'standalone-sidebar', 'aria-label': 'MatrixVTT navigation' }, [
    h('div', { class: 'standalone-brand' }, [
      h('img', {
        src: `${baseUrl}icon.svg`,
        alt: '',
        'aria-hidden': 'true',
        class: 'standalone-logo',
      }),
      h('h1', { class: 'standalone-title' }, 'MatrixVTT'),
      h('p', { class: 'standalone-tagline' }, TAGLINE),
      h('ul', { class: 'standalone-pitch', 'aria-label': 'What MatrixVTT is' },
        PITCH.map((line) => h('li', null, line))),
    ]),
    screen === 'discovery' && h('div', { class: 'standalone-sidebar-actions' }, [
      h('button', {
        type: 'button',
        id: 'signout-btn',
        class: 'standalone-side-btn',
        onClick: onSignOut,
      }, 'Sign out'),
      h('button', {
        type: 'button',
        id: 'factory-reset-btn',
        class: 'standalone-side-btn standalone-side-btn--danger',
        title: 'Permanently delete ALL local data and logout',
        onClick: onFactoryReset,
      }, 'Factory reset'),
    ]),
    screen === 'login' && h('details', { class: 'sidebar-epilogue' }, [
      h('summary', null, 'How is my data stored?'),
      h('p', null,
        'Your Matrix homeserver stores all session data (maps, tokens, characters) natively within Matrix room state. MatrixVTT requires no third-party databases.'),
      h('p', null,
        'Because MatrixVTT syncs in real-time, heavy actions may trigger your homeserver’s API rate limits. MatrixVTT automatically queues and retries events when rate-limited.'),
    ]),
    h(SidebarA11yControls, null),
    h('nav', { class: 'standalone-sidenav', 'aria-label': 'Reference links' }, [
      h('a', {
        href: docsHref(),
        target: '_blank',
        rel: 'noopener',
      }, 'Documentation'),
      h('a', {
        href: 'https://github.com/ceearrbee/matrixvtt',
        target: '_blank',
        rel: 'noopener',
      }, 'Source code'),
    ]),
  ]);
}

export function StandaloneShell({ app }) {
  const [screen, setScreen] = useState('loading');
  const [auth, setAuth] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');

  // Wire up app-level screen changes.
  app.showScreen = (name) => {
    setScreen((currentScreen) => {
      if (currentScreen !== name) {
        closeAllModals();
        if (name === 'discovery') setTimeout(() => app.loadDiscovery(), 0);
      }
      return name;
    });
  };

  // Login hooks for code that runs outside the component tree (the SSO
  // callback in bootstrap.js / auth.js). completeLogin is the same path
  // AuthScreen's form submit takes; setLoginError renders inside
  // AuthScreen, which only exists when the login screen is showing.
  app.setLoginError = setLoginError;

  useEffect(() => {
    // Initial bootstrap
    const savedAuth = loadAuthSession();
    if (!savedAuth?.homeserver || !savedAuth?.accessToken || !savedAuth?.userId) {
      app.showScreen('login');
      return;
    }

    const client = new app.MatrixClient({
      homeserver: savedAuth.homeserver,
      accessToken: savedAuth.accessToken,
      userId: savedAuth.userId,
    });
    const authObj = {
      homeserver: savedAuth.homeserver,
      accessToken: savedAuth.accessToken,
      userId: savedAuth.userId,
      displayName: savedAuth.displayName || savedAuth.userId,
      client,
    };
    setAuth(authObj);
    app.auth = authObj;

    const activeRoom = loadActiveRoom();
    if (activeRoom?.roomId) {
      app.enterRoom(activeRoom.roomId, activeRoom.roomName);
    } else {
      app.showScreen('discovery');
    }
  }, []);

  const onLogin = (newAuth) => {
    setAuth(newAuth);
    app.auth = newAuth;
    const persisted = saveAuthSession(newAuth);
    setStorageNotice(persisted
      ? ''
      : 'This browser is blocking storage (private browsing?), so you will need to sign in again next time.');
    setLoginError('');
    app.showScreen('discovery');
  };
  app.completeLogin = onLogin;

  const onSignOut = async () => {
    if (auth?.client) await auth.client.logout().catch(() => {});
    app.matrixVTTClient?.destroy();
    saveAuthSession(null);
    saveActiveRoom(null);
    setAuth(null);
    app.auth = null;
    app.currentSession = null;
    setScreen('login');
  };

  const onFactoryReset = () => {
    app.handleFactoryReset?.();
  };

  if (screen === 'vtt') {
    return h('div', { id: 'screen-vtt', class: 'screen active' }, [
      h('div', { id: 'app' }, [
        h('div', { class: 'vtt-loading' }, [
          h('div', { class: 'loading-spinner' }),
          h('p', null, 'Connecting…'),
          h('div', { class: 'vtt-loading__bar', 'aria-hidden': 'true' },
            h('div', { class: 'vtt-loading__bar-fill' })),
        ]),
      ]),
    ]);
  }

  return h('div', { class: 'standalone-shell' }, [
    h(StandaloneSidebar, { screen, onSignOut, onFactoryReset }),
    h('main', { class: 'standalone-main' }, [
      screen === 'login' && h(AuthScreen, { app, onLogin, externalError: loginError }),
      screen === 'discovery' && storageNotice && h('div', {
        id: 'storage-notice', class: 'auth-hint', role: 'status',
      }, [
        storageNotice, ' ',
        h('button', {
          type: 'button', class: 'auth-hint__retry',
          onClick: () => setStorageNotice(''),
        }, 'Dismiss'),
      ]),
      screen === 'discovery' && h(DiscoveryScreen, { app }),
      screen === 'loading' && h('div', { class: 'vtt-loading' }, [
        h('div', { class: 'loading-spinner' }),
        h('p', null, 'Restoring session…'),
        h('div', { class: 'vtt-loading__bar', 'aria-hidden': 'true' },
          h('div', { class: 'vtt-loading__bar-fill' })),
      ]),
    ]),
  ]);
}

export function mountStandaloneShell(container, app) {
  // The container ships a static pre-hydration loading shell; Preact
  // diffs against existing children, so clear it before mounting.
  container.replaceChildren();
  render(h(ErrorBoundary, null, h(StandaloneShell, { app })), container);
}
