# Live Playtest Checklist

This guide is for the GM running a real session against the deployed site as the final test of a release. It assumes the deploy pipeline is green; the point here is to confirm the things automation cannot: real players, real homeservers, real networks that drop.

Work through Before the session once, keep During the session open at the table, and finish with After the session before calling the release good.

## Before the session

### Verify the deployment

From a checkout of the released version:

```sh
npm run verify:deploy
```

Every check must pass. It confirms the live site serves this version, every script and stylesheet the entry pages reference resolves, and the PWA and crawler metadata is intact. If you deployed to your own domain, pass the URL: `node scripts/verify-deploy.mjs https://vtt.example.com/`.

Then open the app URL in a private window and confirm:

- The login screen paints with no browser console errors.
- The build version in Settings > About matches the release.
- Sign in, open a room, sign out. Signing out returns you to the login screen with the session gone.

### Set up each player

For every player, before game night:

- They have a Matrix account and know which homeserver it lives on. Accounts on different homeservers than yours are fine and worth having in the mix: federation is part of what this session tests.
- Send the Matrix ID invite first, then the invite link. The link routes invited players straight in; without the invite it cannot.
- Ask each player which device and browser they will bring. Aim to cover at least one phone or tablet and two different desktop browsers across the group.

### Room setup

- Create the session room fresh on the deployed site, not reused from testing. Run the setup wizard end to end: ruleset, map, characters.
- Confirm each player can claim their character and open its sheet.
- Accessibility spot check while everyone is connected: tab through the composer, dice bar, and one modal; confirm focus is always visible. Have one player run a non-default theme (Settings > Appearance) for the whole session.

## During the session

Play the game. The checklist below is what to consciously exercise while it happens; none of it requires stopping play.

### Sync under real conditions

- **Token convergence.** Early on, have two players drag tokens at the same time. Everyone's map must settle to the same positions within a few seconds.
- **Rate-limit burst.** Upload a map image or paste in several compendium entries back to back. If the homeserver rate-limits, the sync chip must show the queued count and a retry countdown, and every queued change must land once it clears. Nothing may be silently lost.
- **Airplane mode.** Ask one player to kill their connection for a minute mid-scene while they keep making edits (move their token, adjust HP). On reconnect their buffered edits must arrive and their client must catch up on what it missed.
- **Reload mid-outage.** Have the same player, or another, reload the tab while offline with unsent edits pending. After the reload and reconnect, the pending edits must still send. This exercises the durable send buffer.
- **Peer healing.** At some point a player who dropped should rejoin while you, the GM, do nothing. Their client must converge from the other connected peers via differential sync, without waiting for a GM snapshot.
- **GM tab discipline.** Keep your own tab open until the sync chip goes idle before walking away at breaks. You are the most likely publisher of snapshots; closing mid-flush risks leaving the last edits unpersisted for latecomers.

### Interface under real conditions

- **Mobile and tablet.** The phone or tablet player runs the whole session on it: tab bar navigation, sheet, dice, token moves via long-press. Note anything that needs a desktop rescue.
- **Chat backfill.** Scroll the chronicle to the top. Older history must either load or end with the explicit "older messages are unavailable" notice, never a silent stop.
- **Dice and combat.** Run at least one full combat: initiative order, turn advancement, HP changes, a condition applied and removed. Everyone must see the same state at each step.
- **Keyboard-only interlude.** Spend one of your GM turns without the mouse: command palette, dice roll, token select. Note anywhere you got stuck.

Keep a note of every rough edge, even ones you work around in the moment. The workaround is data.

## After the session

- **Snapshot pruning.** In a spare tab, check the room's state events (Settings > About > diagnostics, or your Matrix client's dev tools) for `com.matrixvtt.yjs.snapshot` events. Old snapshot generations must be cleared down to the two most recent complete ones; unbounded growth here means tombstoning is not firing.
- **Console sweep.** Before closing your GM tab, open the browser console. There should be no errors and no repeated warnings from the session.
- **Player debrief.** Ask each player two questions: where did you get lost, and where did you have to wait for the game. First-funnel confusion and sync stalls are the two failure classes this playtest exists to find.
- File what you found. Anything that lost data or blocked play is a release blocker; anything else becomes a tracked issue.

## Scope notes

One known limit, deliberate for this release:

- In-app registration (Create account on the login screen) covers servers whose sign-up needs no CAPTCHA: open registration, terms, registration token, or email verification. matrix.org requires a CAPTCHA this app cannot run, so it still sends players to element.io to sign up.

Rooms created with the "request to join" option let anyone holding the invite link knock; approve or deny each request from the party roster. Rooms created without it (including rooms from before the option existed) still require the Matrix ID invite before the link works.
