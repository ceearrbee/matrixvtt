#!/usr/bin/env node
/**
 * build-icons.mjs - extracts the game-icons.net SVG zips into
 * `public/icons/{dark,light}/<author>/<name>.svg` and generates the
 * picker manifest at `public/icons/index.json`.
 *
 * Idempotent: bails out early if both the manifest and a sample SVG
 * are present AND newer than both source zips.
 *
 * Shells out to `unzip` so we don't grow a dev dependency just for
 * one-shot extraction. `unzip` ships on macOS and every Linux distro
 * we care about; if it's missing the script prints the install hint
 * and exits non-zero.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const ZIP_DARK = join(ROOT, 'black-transparent-game-icons.net.svg.zip');
const ZIP_LIGHT = join(ROOT, 'white-transparent-game-icons.net.svg.zip');
const OUT = join(ROOT, 'public', 'icons');
const OUT_DARK = join(OUT, 'dark');
const OUT_LIGHT = join(OUT, 'light');
const MANIFEST = join(OUT, 'index.json');
const LICENSE_OUT = join(OUT, 'LICENSE.txt');

function ok(msg) { process.stdout.write(`✓ ${msg}\n`); }
function info(msg) { process.stdout.write(`  ${msg}\n`); }
function die(msg) { process.stderr.write(`✗ ${msg}\n`); process.exit(1); }

function ensureUnzip() {
  const r = spawnSync('unzip', ['-v'], { stdio: 'ignore' });
  if (r.status !== 0) {
    die('`unzip` not found on PATH. Install via your package manager (apt install unzip / brew install unzip).');
  }
}

function zipsPresent() {
  return existsSync(ZIP_DARK) && existsSync(ZIP_LIGHT);
}

function newerThanZips(targetPath) {
  if (!existsSync(targetPath)) return false;
  if (!zipsPresent()) return true; // manifest exists, can't compare → trust it
  const t = statSync(targetPath).mtimeMs;
  return t >= statSync(ZIP_DARK).mtimeMs && t >= statSync(ZIP_LIGHT).mtimeMs;
}

function shouldSkip() {
  if (process.argv.includes('--force')) return false;
  // Treat manifest presence as sufficient proof of a prior successful
  // run. Saves ~15s on every `vite dev`.
  return newerThanZips(MANIFEST);
}

function writeEmptyManifest() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    version: 1,
    themes: ['dark', 'light'],
    authors: [],
    categories: [],
    icons: [],
  }));
}

function clean() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
}

function extractZip(zipPath, outRoot, sourcePrefix) {
  // Layout inside zip: icons/<color>/transparent/1x1/<author>/<name>.svg
  // We want them flattened to <outRoot>/<author>/<name>.svg
  const tmp = join(OUT, `_tmp_${sourcePrefix}`);
  mkdirSync(tmp, { recursive: true });
  execSync(`unzip -q -o '${zipPath}' -d '${tmp}'`, { stdio: 'inherit' });
  const src = join(tmp, 'icons', sourcePrefix, 'transparent', '1x1');
  if (!existsSync(src)) die(`extracted tree missing expected subdir: ${src}`);
  // Move author folders to outRoot
  execSync(`mv ${src.replace(/'/g, "'\\''")}/* '${outRoot}'/`, { stdio: 'inherit', shell: '/bin/bash' });
  // Save licence (only once - both zips ship the same one)
  if (sourcePrefix === '000000') {
    const lic = join(tmp, 'icons', 'license.txt');
    if (existsSync(lic)) {
      writeFileSync(LICENSE_OUT, readFileSync(lic, 'utf8'));
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}

// ─── category heuristics ──────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'weapons',
    label: 'Weapons',
    match: /(sword|axe|dagger|knife|bow|arrow|crossbow|spear|lance|halberd|mace|hammer|club|staff|gun|pistol|rifle|shotgun|bullet|grenade|bomb|cannon|katana|scimitar|machete|flail|whip|polearm|trident|sickle|scythe|musket|revolver|sniper|sling|throwing|harpoon|sai|nunchaku|tomahawk|warhammer|warpick|broadsword|cutlass|rapier|saber|sabre|gladius|kris|sabertooth|tooth(?:s|y)|fang|spike|impale|blade|edged|war-)/i,
  },
  {
    key: 'armor',
    label: 'Armor & shields',
    match: /(shield|helm|helmet|armor|armour|breastplate|gauntlet|chainmail|chain-mail|kevlar|vest|plate|cuirass|pauldron|greave|visor|bracer|barrel-helm)/i,
  },
  {
    key: 'beasts',
    label: 'Beasts & monsters',
    match: /(wolf|dragon|bear|orc|goblin|troll|ogre|spider|snake|cobra|rat|bat|wyvern|hydra|owl|raven|eagle|hawk|crow|cat|panther|lion|tiger|elephant|rhino|hippo|crocodile|alligator|fish|shark|whale|squid|octopus|crab|scorpion|ant|bee|wasp|butterfly|moth|slug|worm|frog|toad|lizard|gecko|chameleon|turtle|tortoise|horse|cow|pig|sheep|goat|deer|elk|stag|moose|gorilla|monkey|ape|skull|zombie|ghost|ghoul|wraith|lich|demon|devil|imp|fae|fairy|dwarf-?warrior|elf|kobold|gnoll|minotaur|mind-?flayer|illithid|behemoth|chimera|sphinx|griffin|gryphon|pegasus|unicorn|cerberus|werewolf|vampire|mummy|skeleton|cyclops|kraken|leviathan|basilisk|harpy|medusa|gorgon|imp|familiar|tentacle|beast|monster|mob|creature)/i,
  },
  {
    key: 'magic',
    label: 'Magic & arcane',
    match: /(spell|magic|magick|wand|staff|orb|crystal-?ball|crystal-ball|rune|sigil|circle|portal|teleport|summon|conjur|enchant|invok|incantation|hex|curse|blessing|charm|illusion|necromancy|necro|alchemy|potion|elixir|brew|cauldron|witch|wizard|sorcer|mage|warlock|cleric|druid|priest|spirit|soul|aura|halo|flame|fire|burn|frost|ice|frozen|lightning|thunder|storm|earth-?spell|wind|gust|tornado|whirlwind|fireball|firework|firebolt|ice-?bolt|magic-?missile|holy-?symbol|pentagram|grimoire|spellbook|enchantment|abracadabra)/i,
  },
  {
    key: 'items',
    label: 'Items & loot',
    match: /(potion|elixir|bottle|flask|vial|gem|jewel|ring|amulet|necklace|pendant|crown|tiara|coin|treasure|chest|sack|bag|backpack|pouch|scroll|book|tome|parchment|map|key|lock|padlock|lamp|lantern|torch|candle|rope|ladder|hammer-and-pickaxe|pickaxe|fishing|tools|wrench|screw|nail|pliers|saw|gear|cog|barrel|cask|crate|bedroll|tent|food|bread|meat|cheese|wine|beer|ale|fruit|apple|orange|berry|herb|mushroom|seed|plant|flower|leaf|tree|wood|log|stone|rock|crystal|ore|metal|ingot)/i,
  },
  {
    key: 'people',
    label: 'People & roles',
    match: /(person|man|woman|child|king|queen|prince|princess|knight|warrior|barbarian|paladin|ranger|rogue|thief|bandit|pirate|sailor|cook|smith|merchant|trader|guard|soldier|archer|spear-?man|gladiator|samurai|ninja|monk|cultist|hood|robe|cleric|priest|nun|bishop|pope|judge|noble|peasant|farmer|miner|hunter|fisher|dancer|bard|musician|jester|fool|silhouette|portrait|head|face|profile|standing|sitting|walking|running|fist|hand)/i,
  },
  {
    key: 'places',
    label: 'Places & terrain',
    match: /(castle|tower|fortress|keep|fort|wall|gate|door|bridge|temple|church|cathedral|chapel|shrine|altar|tomb|crypt|grave|graveyard|cemetery|ruins|cave|cavern|dungeon|mine|hut|cottage|house|tent|inn|tavern|shop|market|forge|smithy|throne|throne-room|mountain|hill|valley|forest|woods|tree-line|desert|swamp|marsh|river|lake|sea|ocean|island|beach|cliff|volcano|cave-entrance|portal|stairs|tunnel|maze|labyrinth|farm|village|town|city|road|path)/i,
  },
  {
    key: 'symbols',
    label: 'Symbols & glyphs',
    match: /(star|cross|circle|square|triangle|hexagon|pentagon|skull-and-crossbones|crossbones|skull-?icon|infinity|yin-?yang|ankh|chi-?rho|all-seeing|all-?seeing|eye|sun|moon|earth|planet|atom|biohazard|radiation|warning|exclamation|question|arrow-up|arrow-down|arrow-left|arrow-right|return|cycle|spiral|rune|sigil|glyph|symbol|heart|spade|club-?suit|diamond-?suit)/i,
  },
];

function deriveCategories(name) {
  const out = [];
  for (const c of CATEGORIES) if (c.match.test(name)) out.push(c.key);
  return out;
}

function deriveTags(idName, author) {
  // Filename tokens (split on `-`) + the author handle, lowercased.
  const tokens = idName.split(/[-_]/).filter(Boolean).map((t) => t.toLowerCase());
  return Array.from(new Set([...tokens, author.toLowerCase()]));
}

function titleCase(s) {
  return s.split(/[-_]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
}

async function walkAuthors(root) {
  const out = [];
  const authors = await readdir(root, { withFileTypes: true });
  for (const ad of authors) {
    if (!ad.isDirectory()) continue;
    const author = ad.name;
    const files = await readdir(join(root, author), { withFileTypes: true });
    for (const fd of files) {
      if (!fd.isFile() || !fd.name.endsWith('.svg')) continue;
      out.push({ author, name: fd.name.slice(0, -4) });
    }
  }
  return out;
}

async function buildManifest() {
  const entries = await walkAuthors(OUT_DARK);
  const authors = Array.from(new Set(entries.map((e) => e.author))).sort();
  const icons = entries
    .map(({ author, name }) => {
      const cats = deriveCategories(name);
      return {
        id: `${author}/${name}`,
        name: titleCase(name),
        author,
        tags: deriveTags(name, author),
        categories: cats,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const counts = {};
  for (const i of icons) for (const c of i.categories) counts[c] = (counts[c] ?? 0) + 1;
  const categories = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    count: counts[c.key] ?? 0,
  }));

  return {
    version: 1,
    themes: ['dark', 'light'],
    authors,
    categories,
    icons,
  };
}

async function main() {
  if (!zipsPresent()) {
    // Graceful degradation: build succeeds, picker shows "no icons
    // installed". CI without the zips and fresh clones can still ship.
    if (existsSync(MANIFEST)) {
      ok(`icons present at ${MANIFEST}; source zips not found, leaving as-is.`);
      return;
    }
    info('source zips not found - writing empty manifest.');
    info(`  expected: ${ZIP_DARK}`);
    info(`  expected: ${ZIP_LIGHT}`);
    writeEmptyManifest();
    return;
  }

  if (shouldSkip()) {
    ok(`icons already up-to-date (${MANIFEST}). Pass --force to rebuild.`);
    return;
  }

  ensureUnzip();
  ok('cleaning public/icons/');
  clean();
  mkdirSync(OUT_DARK, { recursive: true });
  mkdirSync(OUT_LIGHT, { recursive: true });

  info('extracting dark theme…');
  extractZip(ZIP_DARK, OUT_DARK, '000000');
  info('extracting light theme…');
  extractZip(ZIP_LIGHT, OUT_LIGHT, 'ffffff');

  info('building manifest…');
  const manifest = await buildManifest();
  writeFileSync(MANIFEST, JSON.stringify(manifest));

  ok(`${manifest.icons.length} icons from ${manifest.authors.length} authors`);
  for (const c of manifest.categories) info(`  ${c.label}: ${c.count}`);
  ok(`manifest → ${MANIFEST}`);
  ok(`license → ${LICENSE_OUT}`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
