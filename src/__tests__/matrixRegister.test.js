/**
 * MatrixClient registration statics: UIA-aware /register wrapper and
 * the email requestToken passthrough. Statics ride app.MatrixClient
 * so the e2e fake can substitute them wholesale.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const __mockClients = [];
let __createClientImpl = null;

vi.mock('matrix-js-sdk', () => ({
  createClient: vi.fn((opts) => {
    const c = __createClientImpl(opts);
    __mockClients.push(c);
    return c;
  }),
  Preset: { PrivateChat: 'private_chat' },
  AutoDiscovery: { findClientConfig: vi.fn().mockResolvedValue(null) },
}));

import { MatrixClient } from '../client/MatrixClient.js';

beforeEach(() => {
  __mockClients.length = 0;
  __createClientImpl = null;
});

describe('MatrixClient.register', () => {
  it('returns the UIA body on a 401 challenge', async () => {
    const uia = { session: 's1', flows: [{ stages: ['m.login.dummy'] }], params: {} };
    __createClientImpl = () => ({
      registerRequest: vi.fn().mockRejectedValue(Object.assign(new Error('401'), {
        httpStatus: 401, data: uia,
      })),
    });
    expect(await MatrixClient.register('matrix.example', {})).toEqual({ done: false, uia });
  });

  it('returns credentials when registration completes', async () => {
    const credentials = { user_id: '@new:hs', access_token: 'tok', device_id: 'DEV' };
    __createClientImpl = () => ({
      registerRequest: vi.fn().mockResolvedValue(credentials),
    });
    expect(await MatrixClient.register('matrix.example', { username: 'new' }))
      .toEqual({ done: true, credentials });
  });

  it('rethrows non-UIA errors', async () => {
    __createClientImpl = () => ({
      registerRequest: vi.fn().mockRejectedValue(Object.assign(new Error('nope'), {
        httpStatus: 403, errcode: 'M_FORBIDDEN',
      })),
    });
    await expect(MatrixClient.register('matrix.example', {})).rejects.toThrow('nope');
  });
});

describe('MatrixClient.requestRegisterEmailToken', () => {
  it('delegates to the sdk with email, secret, and attempt', async () => {
    const requestRegisterEmailToken = vi.fn().mockResolvedValue({ sid: 'sid1' });
    __createClientImpl = () => ({ requestRegisterEmailToken });
    const res = await MatrixClient.requestRegisterEmailToken('matrix.example', 'a@b.c', 'secret', 2);
    expect(res).toEqual({ sid: 'sid1' });
    expect(requestRegisterEmailToken).toHaveBeenCalledWith('a@b.c', 'secret', 2);
  });
});
