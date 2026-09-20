# Map backgrounds

A map needs something under the grid. You can upload a battle map image, but you do not have to: MatrixVTT ships terrain textures and can generate a dungeon or cavern layout from a seed, neither of which uploads anything.

Everything here is GM-only and lives in the **Maps manager**: the global menu, or `Ctrl+K` and "Open the maps manager".

## The four sources

Open a map for editing and pick one under **Source**:

| Source | What it is |
|---|---|
| **Built-in background** | A bundled terrain texture, or a layout generated from a seed. Nothing is uploaded. |
| **Upload File** | Your own image. Shrunk to fit your homeserver's limit before sending. |
| **Image URL** | An image already on the web, or one already uploaded to this room. |
| **Grid Only** | A flat floor in your theme colour. |

Whatever you choose, the map's **Layers** stack still draws on top, so you can overlay a transparent PNG on a generated floor.

## Textures

`Built-in background` → **Choose…** → **Textures**.

Sixteen seamless textures, filterable by material: stone, wood, earth, cold, and hot. They tile under the grid at any map size and any cell size, so there is nothing to line up.

They are photographic scans from [ambientCG](https://ambientcg.com), released under CC0, which is a public domain dedication (see [Bundled Content](/licences/third-party)). You owe nobody an attribution for using them. Each tile's source is credited in the picker and in `backgrounds/LICENSE.txt` alongside the app anyway, because recording where art came from is the only thing that keeps the claim checkable.

## Generated layouts

`Built-in background` → **Choose…** → **Generate**.

Set the map's **Width**, **Height** and **Cell PX** first. The layout is generated *at* your grid, so it always fits, but changing the size afterwards produces a different layout from the same seed.

Then:

- **Layout**: *Dungeon* carves rectangular chambers joined by corridors. *Cavern* smooths natural chambers out of noise, with the occasional pool.
- **Materials**: which textures paint the floor, rubble and water. Dungeon stone, Crypt tile, Damp cavern, Forest floor, Desert sand, Frozen waste.
- **Seed**: six characters. Type one, or press **Reroll** until you like the preview.
- **Style**: *Textured* paints with the tiles above. *Plain* is a flat plan view with outlined walls and loads no images at all.
- The sliders below vary by layout: room count and size, corridor width and rubble for a dungeon; rock density, smoothing and pools for a cavern.

The preview is painted by the same code that paints the table, so what you see is what everyone sees. Press **Use this map**, then **✓ Save Map**.

### Why the seed matters

A generated map stores its seed, not its picture: about 160 bytes of room state instead of a megabyte of image. Every player's browser paints the same dungeon from it. That also means a seed is portable: read `q6ttnj` out to another GM with the same layout, materials and map size, and they get your exact map.

## Line-of-sight walls

Save a map with a generated layout, reopen it, and an **Add walls for line of sight** button appears next to the background.

It traces the layout's boundary into wall segments, so fog and token vision work without you drawing anything. A 20×20 dungeon produces about forty segments, because straight runs are merged rather than one segment per cell edge.

It is a button rather than something that happens on save, because walls are real state with a real cost and browsing seeds should not leave hundreds of them behind. Two consequences:

- **Reroll the seed and the walls are stale** until you press it again.
- Pressing it again **replaces only the walls it made before**. Walls you drew by hand are left alone.

## Putting people on a new map

A map switch does not move anybody. Tokens belong to a map, so a map you
have just made starts empty even though the party exists.

Right-click an empty cell and choose **Place Tokens Here**, or press
`Ctrl+K` and run "Place tokens from another map on this one". You get
every token that is not on this map, split into player characters and
everyone else, with a **Select the party** shortcut for the common case.
The ones you tick move to the cell you right-clicked, spread outward so
nobody lands stacked or off the edge of a smaller map.

This moves the existing tokens rather than making new ones, so they keep
their HP, conditions, colour, portrait and character sheet.

Two things follow from tokens belonging to a map:

- **Combat follows you, unless you say otherwise.** If you started
  combat on the previous map, the initiative order carries across, so a
  running fight can move rooms. Turn off *Combat follows the party
  between maps* in Settings if you would rather a map switch ended
  combat instead.
- **Travel pins are the automatic version.** Put a pin either side of a
  doorway, point one at the other, and moving the party through it
  switches everyone to that map and places them on the arrival pin. Use
  pins for a route the party will take more than once; use Place Tokens
  Here for a one-off.

## Reusing what you have uploaded

`Built-in background` → **Choose…** → **Uploaded**.

Every image uploaded into this room, map backgrounds and token portraits alike, is listed here newest first. Picking one reuses the original upload rather than sending it again, so a battle map is uploaded once and available on every map afterwards.

The list holds references, not copies, and is capped at the most recent 200. If an old entry drops off, the maps using it are unaffected: they keep their own copy of the link, only the browse entry goes.

## Uploading your own image

`Upload File` still does what it always did, and is the right answer for a battle map you bought or drew.

Images are shrunk to 2048 pixels on the longest edge before sending, because homeservers cap upload size and a 4000-pixel map crosses the smaller ones. If your server still refuses it, you are offered a retry at half that. If it refuses again, host the image somewhere else and paste the link into **Image URL**.

::: tip Authenticated media
Matrix moved media behind an authenticated endpoint and recent Synapse versions enforce it, so an image URL cannot simply be handed to the browser any more. The standalone app fetches media with your access token. Running MatrixVTT as a widget, where there is no such token, it asks the host client to fetch on its behalf, which needs the host to grant the media capabilities it is asked for at startup. If uploads or images fail in a widget, that grant is the first thing to check.
:::
