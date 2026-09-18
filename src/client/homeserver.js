/**
 * homeserver.js - everything the app does with a homeserver string
 * before it has a session: URL normalisation, well-known discovery,
 * login flows, SSO redirect, the UIA registration round, and the three
 * login shapes.
 *
 * None of it touches a MatrixClient instance. `MatrixClient` keeps
 * statics that forward here because `app.MatrixClient.X` is the seam
 * the e2e fake client overrides.
 */

import * as sdk from 'matrix-js-sdk';
import { isLocalHost } from '../utils/local-host.js';

export function normalizeHomeserver(server) {
  let s = String(server || '').trim();
  // Strip any number of leading `https://` / `http:/` prefixes. A single
  // non-nested regex avoids the ReDoS risk of `^(https?[:/]+)+`.
  let prev;
  do {
    prev = s;
    s = s.replace(/^https?[:/]+/i, '');
  } while (s !== prev);
  return s.replace(/\/+$/, '');
}

export function homeserverBaseUrl(server) {
  const host = normalizeHomeserver(server);
  if (!host) return '';
  // Explicit http:// survives for local development homeservers only
  // (mirrors standalone/auth.js normalizeHomeserver).
  const explicitHttp = /^http:\/\//i.test(String(server || '').trim());
  const scheme = explicitHttp && isLocalHost(host) ? 'http' : 'https';
  return `${scheme}://${host}`;
}

export async function discoverHomeserver(server) {
  const host = normalizeHomeserver(server);
  if (!host) return '';
  try {
    const result = await sdk.AutoDiscovery.findClientConfig(host);
    const baseUrl = result?.['m.homeserver']?.base_url;
    return baseUrl?.replace(/\/+$/, '') || homeserverBaseUrl(server);
  } catch {
    return homeserverBaseUrl(server);
  }
}

export async function getLoginFlows(server) {
  const base = homeserverBaseUrl(server);
  if (!base) return [];
  const client = sdk.createClient({ baseUrl: base });
  const { flows } = await client.loginFlows();
  return flows ?? [];
}

export function getSSORedirectURL(server, redirectUrl) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server) });
  return client.getSsoLoginUrl(redirectUrl);
}

/**
 * One /register round of the UIA dance. A 401 with a session is the
 * server's stage challenge, not a failure; everything else throws.
 * @returns {Promise<{done: true, credentials: any} | {done: false, uia: any}>}
 */
export async function register(server, body) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server) });
  try {
    const credentials = await /** @type {any} */ (client).registerRequest(body);
    return { done: true, credentials };
  } catch (err) {
    const e = /** @type {any} */ (err);
    if (e?.httpStatus === 401 && e?.data?.session) {
      return { done: false, uia: e.data };
    }
    throw err;
  }
}

export async function requestRegisterEmailToken(server, email, clientSecret, sendAttempt) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server) });
  return /** @type {any} */ (client).requestRegisterEmailToken(email, clientSecret, sendAttempt);
}

export async function login(server, identifier, password) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server) });
  return client.login('m.login.password', {
    identifier: { type: 'm.id.user', user: identifier },
    password,
  });
}

export async function loginWithToken(server, accessToken) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server), accessToken });
  const { user_id } = await client.whoami();
  return { access_token: accessToken, user_id };
}

export async function loginWithSSOToken(server, loginToken) {
  const client = sdk.createClient({ baseUrl: homeserverBaseUrl(server) });
  return client.login('m.login.token', { token: loginToken });
}
