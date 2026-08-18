/**
 * invite-polling.js - long-poll /sync for invite state so the Pending
 * Invites section updates without the user reloading the discovery
 * screen. Seeded with the current sync token so we only see new
 * invites from the poll's start, not every existing one.
 */

const INVITE_SYNC_FILTER = JSON.stringify({
  room: {
    invite_state: { types: ['m.room.name', 'm.room.member', 'm.room.join_rules'] },
    timeline: { limit: 0 },
    state: { types: [] },
  },
  presence: { types: [] },
  account_data: { types: [] },
});

const RETRY_BACKOFF_MS = 10000;

/**
 * Start the invite long-poll. `onInvites` fires when new invites
 * arrive so the caller can re-render the invites section.
 * `app.inviteAbort` holds the AbortController; `stopInvitePolling`
 * aborts and detaches.
 */
export function startInvitePolling(app, client, onInvites) {
  const controller = new AbortController();
  app.inviteAbort = controller;

  (async () => {
    let since;
    try {
      const first = await client.sync(null, 0, INVITE_SYNC_FILTER, controller.signal);
      since = first?.next_batch || null;
    } catch {
      return; // aborted or failed; bail silently.
    }

    while (!controller.signal.aborted) {
      try {
        const data = await client.sync(since, 30000, INVITE_SYNC_FILTER, controller.signal);
        since = data?.next_batch || since;
        const invites = data?.rooms?.invite || {};
        if (Object.keys(invites).length > 0 && !controller.signal.aborted) {
          onInvites();
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        app.appLog.add('warn', `invite poll error: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
      }
    }
  })();
}

export function stopInvitePolling(app) {
  app.inviteAbort?.abort();
  app.inviteAbort = null;
}
