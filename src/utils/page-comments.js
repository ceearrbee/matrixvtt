/**
 * Lazy-anchor helper for the Pages comments thread.
 *
 * Pages don't get a thread root event when they're created - that
 * would burn a message-event slot on every page even if nobody ever
 * comments. Instead the root is allocated on the first time a user
 * opens the comments section: we post a synthetic m.notice anchor,
 * write the resulting event_id back into the page's state, and from
 * then on every reply uses that root via m.thread relations.
 *
 * The write-once invariant lives in `setPageThreadRoot` (entity
 * writer) - this function is the read-or-create side.
 */

/**
 * @param {import('../state/StateManager.js').StateManager} state
 * @param {string} pageId
 * @returns {Promise<string>} the thread root event id (existing or new)
 */
export async function ensurePageThreadRoot(state, pageId) {
  const page = state.yjs.pagesMap.get(pageId);
  if (!page) throw new Error(`ensurePageThreadRoot: unknown page ${pageId}`);
  if (page.thread_root_event_id) return page.thread_root_event_id;
  const res = await state.sendRoomEvent('m.room.message', {
    msgtype: 'm.notice',
    body: `Comments on: ${page.title}`,
    'com.vtt.page_thread_root': pageId,
  });
  const id = res?.event_id;
  if (!id) throw new Error('ensurePageThreadRoot: sendRoomEvent returned no event_id');
  await state.setPageThreadRoot(pageId, id);
  return id;
}
