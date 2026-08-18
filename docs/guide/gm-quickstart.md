# Running Your First Game

This guide is for game masters and players, not developers. It walks from zero to a live session in the standalone app. Nothing here requires installing software; everything runs in the browser.

## What you need

- A modern browser (desktop or tablet; phones work with a compact layout).
- A Matrix account. Matrix is the open chat network MatrixVTT stores your game in. If you do not have an account, create a free one at [element.io](https://app.element.io/#/register) on the default `matrix.org` server, then come back.
- The MatrixVTT app URL for your instance (for the public deployment, the `app.html` page).

MatrixVTT itself stores nothing on any server of its own. Your campaign lives in a Matrix room on the homeserver you sign in to, and only people you invite can see it.

## 1. Sign in

Open the app. The homeserver field is prefilled with `https://matrix.org`; change it only if your account lives elsewhere. Sign in with your Matrix username and password, or the single sign-on button if your server offers one.

You stay signed in on this device until you use Sign Out. Signing out ends the session on the server and removes everything stored in this browser.

## 2. Create the game room

On the discovery screen, enter a name under Create Room and confirm. You become the room creator, which makes you the GM: GM authority follows Matrix room power levels, so the person who created the room (or anyone later promoted to moderator) gets the GM tools.

## 3. Pick a ruleset

The first-time setup wizard asks which game system the campaign runs. Nine systems ship built in:

- **D&D 5e** comes with the full SRD 5.1 chassis (skills, conditions, saving throws, rules tables) plus a compendium of 319 spells, 334 monsters, and 578 items you can add from inside the game.
- **Fate, Risus, Old-School Essentials, OpenD6, and PbtA** ship with openly licensed skills, classes, moves, or spell lists at varying depth.
- **GURPS, World of Darkness, and Savage Worlds** ship dice mechanics and sheet layouts only, because those systems have no open content license. Bring your own content.

You can also import a custom ruleset file if your table runs something else.

## 4. Invite your players

Open the invite dialog from the GM tools. Two options:

- Enter a player's Matrix ID (`@name:matrix.org`) to invite them directly.
- Use **Copy invite link** and send the link over any channel. Players paste it into the Join field on their own discovery screen. Raw room IDs and aliases work there too.

Players need their own Matrix accounts, same as you.

## 5. Players claim characters

When a player enters the room, a short welcome points them at the sheet panel: clicking a character there claims it. Create the characters yourself first (Create Character or the character wizard), or let players build their own from the sheet tab. The character sheet is generated from the ruleset, so every system gets the right attributes, skills, and trackers.

## 6. Run a scene

Everything below syncs live to every player in the room:

- **Map**: upload a battle map image from the GM tools, set the grid, and drop tokens for characters and monsters.
- **Fog of war**: reveal areas as the party explores. Walls and lights control what token vision exposes.
- **Initiative**: start combat to build an initiative order and step through turns; HP and conditions live on the tokens.
- **Dice**: the dice bar rolls with one click, and rolls post to the room chat. Each ruleset brings its own dice (d20, dice pools, Fate dice, exploding dice).
- **Compendium**: in a D&D 5e campaign, the SRD buttons on the Spells, Items, and NPC tabs search the compendium and add entries straight into the campaign.
- **Handouts and journals**: share images, notes, and wiki-linked pages with the table.

## Getting help in the app

- The guided tour starts automatically on your first campaign and can be replayed any time from the menu in the lower left.
- Press `?` for the keyboard shortcut reference.
- Theme, high contrast, and reduced motion options live in the accessibility settings.

## If something goes wrong

- Matrix servers rate-limit bursts of changes. The app queues and retries automatically; a progress bar appears for large imports.
- If the connection drops, the app shows a reconnect screen and recovers on its own once the network returns.
- If a player cannot join, the room may be invite-only: invite them by Matrix ID first, or share the invite link again after inviting.
