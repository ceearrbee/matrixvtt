/**
 * MSW (Mock Service Worker) request handlers for tests.
 *
 * These intercept real fetch() / XHR calls so tests can run without a live
 * Matrix homeserver. Add handlers here as new HTTP integrations are added to
 * the codebase (e.g. media upload, push gateway, TURN server lookups).
 *
 * Usage in a test file:
 *   import { server } from '../../tests/mocks/msw-server.js';
 *   import { http, HttpResponse } from 'msw';
 *
 *   // Override a handler for one test
 *   server.use(
 *     http.get('/_matrix/media/v3/download/:server/:mediaId', () =>
 *       HttpResponse.json({ error: 'M_NOT_FOUND' }, { status: 404 })
 *     )
 *   );
 */

import { http, HttpResponse } from 'msw';

// ── Matrix homeserver stubs ───────────────────────────────────────────────────

/**
 * Media download (covers mxc:// URI resolution)
 * In practice the widget API handles this, but direct fetch() calls may appear.
 */
const mediaDownload = http.get(
  '/_matrix/media/v3/download/:serverName/:mediaId',
  ({ params }) => {
    return HttpResponse.json(
      { error: 'M_UNKNOWN', errcode: 'M_UNKNOWN', reason: 'Mock: no media uploaded in tests' },
      { status: 404 }
    );
  }
);

/**
 * Catch-all for any unhandled Matrix API call - surfaces in test output
 * instead of silently hanging.
 */
const matrixCatchAll = http.all('/_matrix/*', ({ request }) => {
  console.warn(`[MSW] Unhandled Matrix request: ${request.method} ${request.url}`);
  return HttpResponse.json({ errcode: 'M_UNRECOGNIZED', error: 'Not handled by MSW' }, { status: 400 });
});

export const handlers = [mediaDownload, matrixCatchAll];
