/**
 * Resolve a Matrix user ID from the widget OpenID credentials.
 *
 * Widget API `requestOpenIDConnectToken()` only returns an access token and
 * server name, so we hit the homeserver's federation userinfo endpoint to get
 * the `sub` claim and normalize it to a fully-qualified MXID.
 */

import { logger } from '../utils/logger.js';

export async function fetchUserIdFromOpenID(credentials) {
  try {
    const url =
      `https://${credentials.matrix_server_name}/_matrix/federation/v1/openid/userinfo` +
      `?access_token=${encodeURIComponent(credentials.access_token)}`;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      logger.error('WidgetManager', 'Userinfo endpoint failed:', response.status, response.statusText);
      return null;
    }
    const userinfo = await response.json();
    if (!userinfo?.sub) {
      logger.error('WidgetManager', 'Userinfo missing sub field:', userinfo);
      return null;
    }
    return userinfo.sub.startsWith('@')
      ? userinfo.sub
      : `@${userinfo.sub}:${credentials.matrix_server_name}`;
  } catch (error) {
    logger.error('WidgetManager', 'Failed to fetch userinfo:', error);
    return null;
  }
}
