/**
 * Playwright fixture for specs that need a logged-in VTT shell.
 *
 * Each test:
 *  1. Installs `tests/e2e/fixtures/fake-matrix-client.js` via
 *     `addInitScript` so the app picks up the fake before any of its
 *     own scripts run (the inline bootstrap in app.html reads
 *     window.__VTT_E2E_MATRIX_CLIENT_CLASS).
 *  2. Seeds localStorage with valid auth + active-room records (the
 *     store the app actually persists to; see sessionStore.js), so
 *     StandaloneShell's restore path skips the login screen entirely.
 *
 * Use the exported `test` from this module instead of the bare
 * `@playwright/test` import for any spec that needs to land in the
 * VTT shell.
 */
import { test as base, expect } from '@playwright/test';
import { resolve } from 'path';
import * as Y from 'yjs';

const FAKE_SCRIPT = resolve(import.meta.dirname, 'fake-matrix-client.js');

// `com.vtt.*` event type → Y.Map name in the runtime Y.Doc. Mirrors the
// collection list in src/state/YjsManager.js. Settings is the only
// singleton (keyed by ''); everything else uses `state_key` as the key.
// Update when YjsManager gains a new collection AND a spec needs to
// seed it.
const COLLECTION_BY_EVENT_TYPE = {
  'com.vtt.settings':  { map: 'settings',   singleton: true },
  'com.vtt.map':       { map: 'maps' },
  'com.vtt.character': { map: 'characters' },
  'com.vtt.npc':       { map: 'npcs' },
  'com.vtt.token':     { map: 'tokens' },
  'com.vtt.item':      { map: 'items' },
  'com.vtt.spell':     { map: 'spells' },
  'com.vtt.handout':   { map: 'handouts' },
  'com.vtt.table':     { map: 'tables' },
  'com.vtt.wall':      { map: 'walls' },
  'com.vtt.light':     { map: 'lights' },
  'com.vtt.pin':       { map: 'pins' },
  'com.vtt.template':  { map: 'templates' },
};

/**
 * Encode the fixture's seed events into a base64-encoded Yjs update
 * that the fake-matrix-client serves as `com.matrixvtt.yjs.snapshot`.
 *
 * Post-Yjs-migration, `syncer.handleStateEvent` ignores every raw
 * entity state event - the only entity source on join is the Yjs
 * snapshot loaded by `loadLatestSnapshot`. Building the snapshot here
 * keeps the existing `SEED_INITIAL_STATE` shape as the fixture API
 * while routing through the production load path.
 */
function buildYjsSnapshotBase64(initialState) {
  const doc = new Y.Doc();
  for (const evt of initialState) {
    const route = COLLECTION_BY_EVENT_TYPE[evt.type];
    if (!route || !evt.content) continue;
    const key = route.singleton ? '' : (evt.state_key ?? '');
    doc.getMap(route.map).set(key, evt.content);
  }
  const bytes = Y.encodeStateAsUpdate(doc);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, 'binary').toString('base64');
}

const SEED_AUTH = {
  homeserver: 'https://fake.matrix.test',
  accessToken: 'fake_access_token_e2e',
  userId: '@playwright:fake.matrix.test',
  displayName: 'Playwright User',
};
const SEED_ACTIVE_ROOM = {
  roomId: '!playwright-room:fake.matrix.test',
  roomName: 'Playwright Test Room',
};

// Seed enough room state that the welcome / setup wizard doesn't auto-
// open. The render-policy opens the wizard when `noMap` is true or
// when `_forceWizard && residual === 0`. Seeding a map + settings event
// with the test user as a GM gives us a "live campaign" room.
const SEED_INITIAL_STATE = [
  // isGM reads m.room.power_levels, not gm_user_ids; the test user is
  // the room creator (PL 100), as createRoom would set up.
  {
    type: 'm.room.power_levels',
    state_key: '',
    content: {
      users: { '@playwright:fake.matrix.test': 100 },
      users_default: 0,
      state_default: 50,
    },
  },
  {
    type: 'com.vtt.settings',
    state_key: '',
    content: {
      name: 'Playwright Campaign',
      system: 'generic',
      gm_user_ids: ['@playwright:fake.matrix.test'],
      grid_px: 50,
      // Mirror production: settings carries which map is active. Without
      // this, sm.activeMapId stays null and any spec that touches the
      // map renderer hits a null-active-map branch.
      active_map_id: 'playwright-map',
    },
  },
  {
    type: 'com.vtt.map',
    state_key: 'playwright-map',
    // Entities round-trip with their state_key as the id field in
    // production writes (see src/state/writers/world-writers.js).
    content: {
      id: 'playwright-map',
      name: 'Playwright Map',
      width_cells: 20, height_cells: 20, cell_px: 50,
      image_url: null,
    },
  },
  // One character + one NPC so the sheet-open specs have something to
  // click. Schemas live in src/utils/schemas/actors.js - required
  // fields: id, name, type. Everything else is optional.
  {
    type: 'com.vtt.character',
    state_key: 'chr-aria',
    content: {
      id: 'chr-aria',
      name: 'Aria Blackwood',
      type: 'pc',
      hp_max: 30, hp_current: 30, ac: 14, speed: 30,
      class_level: 'Wizard 3',
      species: 'Half-elf',
    },
  },
  {
    type: 'com.vtt.npc',
    state_key: 'npc-orc',
    content: {
      id: 'npc-orc',
      name: 'Orc War Boss',
      type: 'npc',
      hp_max: 25, hp_current: 25, ac: 13, speed: 30,
      cr: '2',
      size_category: 'Medium',
    },
  },
  // Two tokens on the seeded map so map / combat specs have something
  // to select and fight with. Schema (src/utils/schemas/actors.js)
  // requires id, map_id, sheet_id (nullable), col, row.
  {
    type: 'com.vtt.token',
    state_key: 'tok-aria',
    content: {
      id: 'tok-aria', name: 'Aria Blackwood', type: 'pc',
      map_id: 'playwright-map', sheet_id: 'chr-aria',
      col: 5, row: 5, size: 1, visible: true,
      hp_max: 30, hp_current: 30,
      owner_user_id: '@playwright:fake.matrix.test',
    },
  },
  {
    type: 'com.vtt.token',
    state_key: 'tok-orc',
    content: {
      id: 'tok-orc', name: 'Orc War Boss', type: 'npc',
      map_id: 'playwright-map', sheet_id: 'npc-orc',
      col: 8, row: 5, size: 1, visible: true,
      hp_max: 25, hp_current: 25,
    },
  },
];

// Pre-built once per Node process - the seed is constant, the Y.Doc
// encode is ~1ms but no reason to repeat per test.
const SEED_YJS_SNAPSHOT_B64 = buildYjsSnapshotBase64(SEED_INITIAL_STATE);

// Variant for player-perspective specs: a set-up room (settings + map)
// with no authored actors, so the welcome's empty-room copy fires.
const ACTORLESS_TYPES = new Set(['m.room.power_levels', 'com.vtt.settings', 'com.vtt.map']);
export const SEED_INITIAL_STATE_NO_ACTORS = SEED_INITIAL_STATE.filter((e) => ACTORLESS_TYPES.has(e.type));
export const SEED_YJS_SNAPSHOT_NO_ACTORS_B64 = buildYjsSnapshotBase64(SEED_INITIAL_STATE_NO_ACTORS);

export const test = base.extend({
  loggedIn: [async ({ page }, use) => {
    await page.addInitScript({ path: FAKE_SCRIPT });
    await page.addInitScript(
      ({ auth, activeRoom, initialState, yjsSnapshot }) => {
        localStorage.setItem('vtt-auth-session', JSON.stringify(auth));
        localStorage.setItem('vtt:active-room', JSON.stringify(activeRoom));
        // Mark the tutorial as completed so it doesn't auto-start.
        localStorage.setItem('vtt-tutorial-completed', 'true');
        // Tell the fake what initial Matrix state to advertise (raw
        // entity events are kept for any spec that reads them
        // directly, plus the Yjs snapshot blob that the syncer's
        // loadLatestSnapshot path picks up to hydrate sm.characters
        // / sm.npcs / sm.tokens - the only entity source the runtime
        // honours post-migration).
        window.__VTT_E2E_CONFIG = Object.assign(window.__VTT_E2E_CONFIG || {}, {
          initialState,
          yjsSnapshot,
        });
      },
      {
        auth: SEED_AUTH,
        activeRoom: SEED_ACTIVE_ROOM,
        initialState: SEED_INITIAL_STATE,
        yjsSnapshot: SEED_YJS_SNAPSHOT_B64,
      },
    );
    await use({ auth: SEED_AUTH, activeRoom: SEED_ACTIVE_ROOM });
  }, { auto: true }],
});

export { expect };

/**
 * Wait until the VTT shell has rendered (initVTT resolved and Preact
 * has mounted the screen). The readiness marker is the conversation
 * shell grid itself - `.shell[data-ui-mode]` renders unconditionally in
 * every phase, so it's a phase-agnostic boot signal. (The old
 * ModeSelector group marker was retired with the phase-model refactor.)
 */
export async function waitForVttShell(page) {
  await page.goto('app.html');
  await expect(page.locator('#screen-vtt.active, #screen-vtt')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.shell[data-ui-mode]')).toBeVisible({ timeout: 15_000 });
}

/**
 * Ensure the right-side companion (sheet/combat/party tabs) is reachable.
 * In the almanac shell the right rail is always mounted and visible on
 * desktop in every phase - there's no mode button to click - so this just
 * boots the shell and waits for the rail. The `mode` arg is accepted for
 * backwards-compat with existing specs but is now a no-op.
 */
// eslint-disable-next-line no-unused-vars
export async function openSheetRail(page, { mode = 'narrative' } = {}) {
  await waitForVttShell(page);
  await expect(page.locator('#shell-sheet-drawer')).toBeVisible({ timeout: 5_000 });
}

/** Open the Settings modal (via the lower-left global menu) and wait for the dialog. */
export async function openSettings(page) {
  await waitForVttShell(page);
  await page.locator('.left-index__menu-btn').click();
  await page.locator('[data-menu-item="settings"]').click();
  await expect(page.locator('[role="dialog"][aria-labelledby="settings-modal-title"]')).toBeVisible();
}

/**
 * Wait until `window.matrixVTTClient.state` is non-null - i.e. the
 * post-login VTT runtime is fully bootstrapped. Some specs need to
 * dispatch helpers via the runtime, not just observe DOM.
 */
export async function waitForVttReady(page) {
  await waitForVttShell(page);
  await page.waitForFunction(() => !!window.matrixVTTClient?.state, null, { timeout: 15_000 });
}
