/**
 * Generic dice-notation roller for the rules engine.
 *
 * Grammar (case-insensitive):
 *   GROUPED  := '{' NOTATION ('|' NOTATION)+ '}' [MOD]
 *               (roll each group, keep the highest group total, then MOD)
 *   NOTATION := COUNT 'd' DIE [EXPLODE|WILD] [REROLL] [KEEP|DROP] [SUCCESS] [MOD]
 *   COUNT    := integer (default 1)
 *   DIE      := integer | 'F'    (F = fudge die, values -1/0/+1)
 *   EXPLODE  := '!'              (every die explodes on max)
 *   WILD     := 'w'              (OpenD6: first die explodes on max,
 *                                 flags `complication: true` on a 1)
 *   REROLL   := 'r' integer      (reroll once any die ≤ N)
 *   KEEP     := 'kh' integer | 'kl' integer
 *   DROP     := 'dh' integer | 'dl' integer
 *   SUCCESS  := '>' integer | '>=' integer
 *   MOD      := ('+' | '-') integer
 *
 * Result shape: {notation, rolls, kept?, modifier, total, successes?, complication?}.
 * For success-counting notations, `total` is the count (not the sum).
 */

// eslint-disable-next-line security/detect-unsafe-regex -- dice grammar: anchored, no overlapping alternations; pathological input is bounded by parseNotation's count/sides caps
const NOTATION = /^(\d*)d(f|\d+)(!)?(w)?(?:r(\d+))?(?:(kh|kl|dh|dl)(\d+))?(?:(>=|>)(\d+))?([+-]\d+)?$/i;

// eslint-disable-next-line security/detect-unsafe-regex -- anchored, single non-nested quantifier over a negated class; no backtracking blowup
const GROUPED = /^\{([^{}]+)\}([+-]\d+)?$/;

// 0 is a valid pool size in dice-pool systems (an empty Risus cliché,
// a zero-bonus pool template): rolls nothing, total = modifier.
const MIN_COUNT = 0;
const MAX_COUNT = 100;
const MIN_SIDES = 2;
const MAX_SIDES = 1000;

export function rollNotation(notation, { rng = Math.random, maxExplosions = 100 } = {}) {
  if (typeof notation === 'string') {
    const grouped = notation.replace(/\s+/g, '').toLowerCase().match(GROUPED);
    if (grouped) return rollGroupsKeepHighest(grouped, { rng, maxExplosions });
  }

  const parsed = parseNotation(notation);

  const { rolls, complication } = rollPool(parsed, rng, maxExplosions);
  const effective = applyReroll(rolls, parsed, rng);
  const kept = applyKeepDrop(effective, parsed);

  return summarise({ parsed, rolls, kept, complication });
}

/**
 * `{A|B}` rolls each pipe-separated group with the single-pool grammar
 * above and keeps the highest group total; a trailing modifier is added
 * once, after the winner is chosen. Covers trait-die-plus-wild-die
 * systems (Savage Worlds) where the competing dice have different sizes.
 * Groups cannot nest - the regex forbids braces inside the body.
 */
function rollGroupsKeepHighest(match, options) {
  const [, body, mod] = match;
  const parts = body.split('|');
  if (parts.length < 2) {
    throw new Error(`grouped notation needs at least two groups: {${body}}`);
  }

  const groups = parts.map((part) => rollNotation(part, options));
  const best = groups.reduce((a, b) => (b.total > a.total ? b : a));
  const modifier = mod ? parseInt(mod, 10) : 0;

  const result = {
    notation: `{${body}}${mod ?? ''}`,
    groups,
    rolls: groups.flatMap((g) => g.rolls),
    kept: best.kept ?? best.rolls,
    modifier,
    total: best.total + modifier,
  };
  if (groups.some((g) => g.complication)) result.complication = true;
  return result;
}

function parseNotation(notation) {
  if (typeof notation !== 'string') throw new Error(`bad notation: ${notation}`);
  const clean = notation.replace(/\s+/g, '').toLowerCase();
  const m = clean.match(NOTATION);
  if (!m) throw new Error(`unparseable notation: ${notation}`);

  const count = parseInt(m[1] || '1', 10);
  if (count < MIN_COUNT || count > MAX_COUNT) {
    throw new Error(`count out of range: ${count}`);
  }

  const dieSpec = m[2];
  const fudge = dieSpec === 'f';
  const sides = fudge ? 3 : parseInt(dieSpec, 10);
  if (!fudge && (sides < MIN_SIDES || sides > MAX_SIDES)) {
    throw new Error(`die sides out of range: ${sides}`);
  }

  return {
    clean,
    count,
    sides,
    fudge,
    explodeAll: m[3] === '!',
    wild:       m[4] === 'w',
    rerollThreshold: m[5] !== undefined ? parseInt(m[5], 10) : null,
    keepDropKind:    m[6] || null,
    keepDropN:       m[6] ? parseInt(m[7], 10) : null,
    successOp:       m[8] || null,
    successThreshold: m[8] ? parseInt(m[9], 10) : null,
    modifier:        m[10] ? parseInt(m[10], 10) : 0,
  };
}

/**
 * Roll every die in the pool. Handles both "explode all" (`!`) and wild-
 * die (`w`). Returns the full roll history plus a complication flag when
 * the wild die rolled a 1.
 */
function rollPool({ count, sides, fudge, explodeAll, wild }, rng, maxExplosions) {
  const rolls = [];
  let complication = false;

  for (let i = 0; i < count; i++) {
    const isWildDie = wild && i === 0;
    let value = rollOne(sides, rng, fudge);
    rolls.push(value);

    // Wild die rolled 1 - one-shot flag. Subsequent explosions fire only
    // on max, so they can't remove the 1 afterwards.
    if (isWildDie && value === 1) complication = true;

    // Explode either when the whole pool is marked `!` or when this
    // specific die is the wild die (wild dice always explode on max).
    const shouldExplode = !fudge && (explodeAll || isWildDie);
    if (!shouldExplode) continue;

    let explosions = 0;
    while (value === sides && explosions < maxExplosions) {
      value = rollOne(sides, rng, false);
      rolls.push(value);
      explosions += 1;
    }
  }

  return { rolls, complication };
}

/**
 * Replace any die at or below the reroll threshold with a single new
 * roll. Both the original and the replacement stay in `rolls` for
 * display; the returned `effective` array is what summation uses.
 */
function applyReroll(rolls, { rerollThreshold, sides, fudge }, rng) {
  const effective = [...rolls];
  if (rerollThreshold === null || fudge) return effective;
  for (let i = 0; i < effective.length; i++) {
    if (effective[i] > rerollThreshold) continue;
    const replacement = rollOne(sides, rng, false);
    rolls.push(replacement);
    effective[i] = replacement;
  }
  return effective;
}

/**
 * Keep or drop the highest/lowest N dice. Returns a filtered copy that
 * preserves the original chronological order of surviving dice.
 */
function applyKeepDrop(effective, { keepDropKind, keepDropN }) {
  if (!keepDropKind) return effective;

  const indexed = effective.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  let surviving;
  if (keepDropKind === 'kh')      surviving = indexed.slice(-keepDropN);
  else if (keepDropKind === 'kl') surviving = indexed.slice(0, keepDropN);
  else if (keepDropKind === 'dh') surviving = indexed.slice(0, -keepDropN);
  else if (keepDropKind === 'dl') surviving = indexed.slice(keepDropN);

  const keepSet = new Set(surviving.map((x) => x.index));
  return effective.filter((_, index) => keepSet.has(index));
}

/**
 * Turn the post-processed dice pool into the public result shape.
 * Success-counting replaces the sum with a count; the modifier is
 * ignored in that mode because pool dice have no bonus.
 */
function summarise({ parsed, rolls, kept, complication }) {
  const base = {
    notation: parsed.clean,
    rolls,
    kept: parsed.keepDropKind ? kept : undefined,
  };
  if (complication) base.complication = true;

  if (parsed.successOp) {
    const successes = kept.filter((v) =>
      parsed.successOp === '>=' ? v >= parsed.successThreshold : v > parsed.successThreshold,
    ).length;
    return { ...base, modifier: 0, successes, total: successes };
  }

  const sum = kept.reduce((a, b) => a + b, 0);
  return { ...base, modifier: parsed.modifier, total: sum + parsed.modifier };
}

function rollOne(sides, rng, fudge) {
  const raw = Math.floor(rng() * sides) + 1;
  return fudge ? raw - 2 : raw;
}
