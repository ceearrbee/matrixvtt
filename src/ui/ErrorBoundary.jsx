/**
 * Preact error boundary for the standalone shell.
 *
 * Without this, any uncaught render error inside the shell blanks
 * the entire page - the user sees the loading spinner forever and
 * has no path back to a working state. The boundary catches the
 * throw, logs the error with the build version (so bug reports
 * include the deploy that failed), and renders a recovery card
 * that offers a Reload and a Reset (clear local storage, then
 * reload) action.
 *
 * Used by `StandaloneShell.jsx` to wrap the screen-router.
 */
import { Component, h } from 'preact';
import { logger } from '../utils/logger.js';
import { BUILD_VERSION } from '../utils/constants.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  componentDidCatch(error, info) {
    this.setState({ error });
    logger.error('ErrorBoundary', `[v${BUILD_VERSION}] uncaught render error:`, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const reload = () => window.location.reload();
    const reset = () => {
      try {
        sessionStorage.clear();
        // Keep localStorage's vtt:accessibility (theme/a11y prefs) so
        // the recovery doesn't reset the user's display preferences.
        const keepKeys = ['vtt:accessibility'];
        const keep = {};
        for (const k of keepKeys) {
          const v = localStorage.getItem(k);
          if (v !== null) keep[k] = v;
        }
        localStorage.clear();
        for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
      } catch { /* private mode etc. */ }
      window.location.reload();
    };

    return h(
      'div',
      {
        role: 'alert',
        style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--font-headline, system-ui);',
      },
      h(
        'div',
        {
          style: 'max-width:480px;text-align:center;background:var(--color-background-secondary,#1f2430);color:var(--color-text-primary,#fff);padding:32px;border-radius:var(--border-radius-lg, 4px);border:1px solid var(--color-border-primary,rgba(255,255,255,0.18));',
        },
        [
          h('h2', { style: 'margin:0 0 12px;' }, 'Something went wrong'),
          h('p', { style: 'margin:0 0 16px;color:var(--color-text-secondary,rgba(200,210,230,0.7));' },
            'MatrixVTT hit an unexpected error and stopped rendering. Reloading usually fixes it; if not, the Reset button clears local session data and starts fresh.'),
          h('p', { style: 'margin:0 0 24px;font-size:12px;color:var(--color-text-tertiary,rgba(200,210,230,0.5));' },
            `Build ${BUILD_VERSION} - error: ${this.state.error?.message || 'unknown'}`),
          h('div', { style: 'display:flex;gap:12px;justify-content:center;' }, [
            h('button', { type: 'button', class: 'dbt btn-primary', onClick: reload }, 'Reload'),
            h('button', { type: 'button', class: 'dbt', onClick: reset }, 'Reset session'),
          ]),
        ],
      ),
    );
  }
}
