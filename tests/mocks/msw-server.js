/**
 * MSW Node server - used in Vitest (Node/happy-dom environment).
 *
 * Import this in any test that makes real fetch() calls:
 *
 *   import { server } from '../../tests/mocks/msw-server.js';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * Or add the lifecycle calls to vitest.config.js setupFiles if you want
 * MSW active for every test suite automatically.
 */

import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers.js';

export const server = setupServer(...handlers);
