# Running Your First Game

This guide is for game masters and players, not developers. It walks from zero to a live session in the standalone app. Nothing here requires installing software; everything runs in the browser.

## What you need

- A modern browser (desktop or tablet; phones work with a compact layout).
- A Matrix account. Matrix is the open chat network MatrixVTT stores your game in. If you do not have an account, create a free one at [element.io](https://app.element.io/#/register) on the default `matrix.org` server, then come back.
- The MatrixVTT app URL for your instance (for the public deployment, the `app.html` page).

MatrixVTT itself stores nothing on any server of its own. Your campaign lives in a Matrix room on the homeserver you sign in to, and everyone in that room can read all of it. See [Who can read your game](#who-can-read-your-game).

## 1. Sign in

Open the app. The homeserver field is prefilled with `https://matrix.org`; change it only if your account lives elsewhere. Sign in with your Matrix username and password, or the single sign-on button if your server offers one.

You stay signed in on this device until you use Sign Out. Signing out ends the session on the server and removes everything stored in this browser.

## 2. Create the game room

On the discovery screen, enter a name under Create Room and confirm. You become the room creator, which makes you the GM: GM authority follows Matrix room power levels, so the person who created the room (or anyone later promoted to moderator) gets the GM tools.

### Using a room you already have

Paste the room's ID, alias or `matrix.to` link into the Join field, or pick it from **Show all joined rooms**. A room with no campaign opens straight to its chat: you can read and post as normal, and MatrixVTT adds nothing else to the room. When you want a campaign there, choose **Set up a campaign** in the Next steps row. Players who open the room before then see that there is no campaign yet, and their chat works as normal.

Encrypted rooms are not supported. MatrixVTT will not open them; keep using those in Element or another Matrix app.

## 3. Pick a ruleset

The first-time setup wizard asks which game system the campaign runs. Nine systems ship built in:

- **D&D 5e** comes with the full SRD 5.1 chassis (skills, conditions, saving throws, rules tables) plus a compendium of 319 spells, 334 monsters, and 578 items you can add from inside the game.
- **Fate, Risus, Old-School Essentials, OpenD6, and PbtA** ship with openly licensed skills, classes, moves, or spell lists at varying depth.
- **GURPS, World of Darkness, and Savage Worlds** ship dice mechanics and sheet layouts only, because those systems have no open content license. Bring your own content.

You can also import a custom ruleset file if your table runs something else.

## 4. Invite your players

Open **Invite players** from the GM tools and use **Copy player link**. That link opens MatrixVTT, walks the player through signing in or creating a Matrix account, and drops them into your session. **Copy invite message** gives you the link plus a line of explanation, ready to paste into Discord or any chat.

The dialog also states who can currently get in:

- *Anyone with this link can ask to join* means the link is all a player needs; approve each request from the party roster.
- *Only players you invite by Matrix ID can use this link* means the room is invite-only. Use **Let anyone with the link request to join** to change that, or invite each player by Matrix ID under **Invite a specific Matrix user**.

**Matrix link** under the dialog's disclosure is the `matrix.to` form, for players who already run a Matrix client. Raw room IDs and aliases still work in the Join field on the discovery screen.

## 5. Players claim characters

When a player enters the room, a short welcome points them at the sheet panel: clicking a character there claims it. Create the characters yourself first (Create Character or the character wizard), or let players build their own from the sheet tab. The character sheet is generated from the ruleset, so every system gets the right attributes, skills, and trackers.

## 6. Run a scene

Everything below syncs live to every player in the room:

- **Map**: give the map a background and drop tokens for characters and monsters. You can upload a battle map image, tile one of the bundled terrain textures, or generate a dungeon or cavern from a seed without uploading anything - see [Map Backgrounds](/guide/map-backgrounds).
- **Moving between maps**: a new map starts empty. Right-click it and choose Place Tokens Here to bring the party and anything waiting for them across, keeping their HP and sheets. See [Map Backgrounds](/guide/map-backgrounds).
- **Fog of war**: reveal areas as the party explores. Walls and lights control what token vision exposes.
- **Initiative**: start combat to build an initiative order and step through turns; HP and conditions live on the tokens.
- **Dice**: the dice bar rolls with one click, and rolls post to the room chat. Each ruleset brings its own dice (d20, dice pools, Fate dice, exploding dice).
- **Compendium**: in a D&D 5e campaign, the SRD buttons on the Spells, Items, and NPC tabs search the compendium and add entries straight into the campaign.
- **Handouts and journals**: share images, notes, and wiki-linked pages with the table.
- **Travel pins**: drop a pin on each side of a doorway and set one to travel to the other. Moving the party through it switches everyone to that map and puts their tokens on the arrival pin.

## Who can read your game

Treat your game room as public to everyone in it.

- Everything MatrixVTT stores in the room can be read by every member, from MatrixVTT or from any other Matrix app: maps, sheets, hidden tokens, GM notes, private and GM-visible pages, and whispers. "Private" and "GM-visible" only hide things inside MatrixVTT.
- A whisper (`/w @player message`) is an ordinary room message. MatrixVTT shows it only to the two of you, but anyone in the room can read it in Element.
- A public room adds anyone who joins. MatrixVTT marks those rooms **Public room** on the room list and in the header.
- For something that really must stay private, use a separate room: a direct message for a whisper, or a room with only your GMs for secret prep.
- Secret rolls are the exception: they stay on your device and are never posted to the room.

## Getting help in the app

- Press `Ctrl+K` (`Cmd+K` on a Mac) to search everything in the campaign and run any command by name. It works from the chat box, so it is always one keystroke away.
- Press `?` for the keyboard shortcut reference.
- Theme, high contrast, and reduced motion options live in the accessibility settings.

## If something goes wrong

- Matrix servers rate-limit bursts of changes. The app queues and retries automatically; a progress bar appears for large imports.
- If the connection drops, the app shows a reconnect screen and recovers on its own once the network returns.
- If a player cannot join, the room is probably invite-only: open **Invite players** and either allow join requests or invite them by Matrix ID.
