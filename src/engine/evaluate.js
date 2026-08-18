/**
 * Safe JSON-AST formula evaluator. Rulesets express derived values
 * ("spell save DC", "passive perception", etc.) as expression trees like:
 *
 *   { $: '+', args: [8, { $: 'lookup', args: ['pb', '@level'] }, '@cast.mod'] }
 *
 * Values:
 *   - Numbers, booleans, null, plain strings → returned as-is.
 *   - Strings starting with '@' → resolved as dot-paths through `context`.
 *   - Objects with a `$` key → operator dispatch; `args` is the operand list.
 *
 * No eval/new Function, no string-formula parsing. Unknown operators and
 * unresolved paths return `null` so composed expressions degrade cleanly.
 */

const OPS = {
  '+': (xs) => xs.reduce((a, b) => num(a) + num(b), 0),
  '-': (xs) => xs.length === 0 ? 0 : xs.slice(1).reduce((a, b) => a - num(b), num(xs[0])),
  '*': (xs) => xs.reduce((a, b) => num(a) * num(b), 1),
  '/': (xs) => xs.length === 0 ? 0 : xs.slice(1).reduce((a, b) => {
    const d = num(b);
    return d === 0 ? 0 : a / d;
  }, num(xs[0])),
  floor: ([x]) => Math.floor(num(x)),
  ceil:  ([x]) => Math.ceil(num(x)),
  max:   (xs) => xs.length === 0 ? 0 : Math.max(...xs.map(num)),
  min:   (xs) => xs.length === 0 ? 0 : Math.min(...xs.map(num)),
  eq:    ([a, b]) => a === b,
  lt:    ([a, b]) => num(a) < num(b),
  gt:    ([a, b]) => num(a) > num(b),
  if:    ([c, t, e]) => c ? t : e,
  lookup: ([tableName, key], ctx) => {
    const t = ctx?.tables?.[tableName];
    if (!t) return null;
    const k = String(key);
    return t[k] ?? t[key] ?? null;
  },
  sum_items: ([field, filterField, multiplyField], ctx) => {
    const inv = ctx?.inventory;
    if (!Array.isArray(inv)) return 0;
    let total = 0;
    for (const item of inv) {
      if (filterField && !item?.[filterField]) continue;
      const value = Number(item?.[field] ?? 0) || 0;
      const mult = multiplyField ? (Number(item?.[multiplyField] ?? 1) || 0) : 1;
      total += value * mult;
    }
    return total;
  },
};

function num(v) {
  return typeof v === 'number' ? v : (Number.isFinite(Number(v)) ? Number(v) : 0);
}

// Block walking into prototype / constructor chains via ruleset paths.
// Rulesets are user-authored JSON and a malicious one shouldn't be able
// to reach Object.prototype or read the constructor.
const UNSAFE_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function resolvePath(path, context) {
  const parts = path.slice(1).split('.');
  let cur = context;
  for (const p of parts) {
    if (cur == null) return null;
    if (UNSAFE_PATH_KEYS.has(p)) return null;
    cur = cur[p];
  }
  return cur ?? null;
}

export function evaluate(node, context) {
  if (node === null || node === undefined) return null;
  if (typeof node === 'number' || typeof node === 'boolean') return node;
  if (typeof node === 'string') {
    return node.startsWith('@') ? resolvePath(node, context) : node;
  }
  if (typeof node !== 'object' || !('$' in node)) return null;

  const op = OPS[node.$];
  if (!op) return null;

  // Malformed AST guard: args, when present, must be an array. A
  // typo'd ruleset that passes a string or object should degrade to
  // null rather than throw mid-render.
  if (node.args !== undefined && !Array.isArray(node.args)) return null;
  const rawArgs = node.args ?? [];

  // $if is lazy - we must evaluate the condition first, then only the chosen branch
  if (node.$ === 'if') {
    const [cond, thenBranch, elseBranch] = rawArgs;
    return evaluate(cond, context)
      ? evaluate(thenBranch, context)
      : evaluate(elseBranch, context);
  }

  // $lookup and $sum_items need the context (for tables / inventory)
  if (node.$ === 'lookup' || node.$ === 'sum_items') {
    const evaluated = rawArgs.map((a) => evaluate(a, context));
    return op(evaluated, context);
  }

  const evaluated = rawArgs.map((a) => evaluate(a, context));
  return op(evaluated);
}
