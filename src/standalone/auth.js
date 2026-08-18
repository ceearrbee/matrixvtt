/**
 * SSO login flow for the standalone client.
 *
 * Password and token login live in AuthScreen.jsx; sign-out lives in
 * StandaloneShell.jsx. The SSO flow has to live outside the component
 * tree because it spans a full page redirect: startSSOLogin leaves the
 * app, and finishSSOLogin runs from bootstrap() when the IdP sends the
 * browser back with a loginToken. Both ends route through the hooks the
 * shell installs on the app (completeLogin, setLoginError, showScreen)
 * so SSO and form login share one code path from there on.
 */

import { describeAuthError } from './auth-errors.js';
import { isLocalHost } from '../utils/local-host.js';

const SSO_HS_KEY = 'mxvtt:sso-in-flight-hs';

/**
 * Accept bare-domain homeservers (e.g. `matrix.org`) by prepending
 * `https://`. An explicit `http://` survives only for local
 * development hosts; everything else is upgraded to https so
 * credentials never travel plaintext. Returns `null` for empty input.
 */
export function normalizeHomeserver(input) {
  const trimmed = String(input || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const explicitHttp = /^http:\/\//i.test(trimmed);
  const host = trimmed.replace(/^https?[:/]+/i, '');
  const scheme = explicitHttp && isLocalHost(host) ? 'http' : 'https';
  return `${scheme}://${host}`;
}

export async function finishSSOLogin(app, homeserver, loginToken) {
  try {
    const authResult = await app.MatrixClient.loginWithSSOToken(homeserver, loginToken);
    const client = new app.MatrixClient({
      homeserver,
      accessToken: authResult.access_token,
      userId: authResult.user_id,
    });
    const profile = await client.getProfile(authResult.user_id).catch(() => ({}));
    app.completeLogin({
      homeserver,
      accessToken: authResult.access_token,
      userId: authResult.user_id,
      displayName: profile.displayname || authResult.user_id,
      client,
    });
  } catch (err) {
    app.showScreen('login');
    app.setLoginError(describeAuthError(err, { context: 'sso' }));
  } finally {
    try { sessionStorage.removeItem(SSO_HS_KEY); } catch { /* private mode */ }
  }
}

export function startSSOLogin(app) {
  const hs = app.resolvedHs || normalizeHomeserver(app.doc.getElementById('hs-url').value);
  if (!hs) return app.setLoginError('Homeserver URL is required.');
  // Persist the in-flight homeserver so the SSO callback can recover
  // it even if the redirect strips the `hs` URL parameter (some IdPs
  // do).
  try { sessionStorage.setItem(SSO_HS_KEY, hs); } catch { /* private mode */ }
  const callbackUrl =
    app.location.origin + app.location.pathname + '?hs=' + encodeURIComponent(hs);
  app.location.href = app.MatrixClient.getSSORedirectURL(hs, callbackUrl);
}

/**
 * Look up the in-flight homeserver from sessionStorage, written by
 * `startSSOLogin` before the redirect. The bootstrap path uses this
 * when the SSO callback's URL is missing or has an invalid `hs`
 * param.
 */
export function recoverInFlightHomeserver() {
  try { return sessionStorage.getItem(SSO_HS_KEY); } catch { return null; }
}

/**
 * Resolve the homeserver to use when finishing SSO. Trust only the
 * homeserver we stashed in sessionStorage right before the redirect -
 * the `?hs=` URL parameter is attacker-controllable, so we accept it
 * only when it matches the stashed value (and reject otherwise so a
 * crafted callback URL cannot point the login at a malicious server).
 */
export function resolveSSOHomeserver(urlHs, sessionHs) {
  if (!sessionHs || !/^https:\/\/.+/i.test(sessionHs)) return null;
  if (urlHs && urlHs !== sessionHs) return null;
  return sessionHs;
}
