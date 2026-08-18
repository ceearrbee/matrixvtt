/**
 * Generic search index over any compendium collection (spells, items,
 * monsters, ...). Precomputes lowercase names and facet buckets once
 * per data set instead of rescanning every entry on each keystroke,
 * and memoizes repeated substring queries.
 */

/**
 * @param {object[]} entries
 * @param {{ facetKey?: (entry: object) => unknown }} [options]
 */
export function buildSearchIndex(entries, { facetKey } = {}) {
  const named = entries.map((entry) => ({ entry, lowerName: (entry.name ?? '').toLowerCase() }));
  const facetBuckets = new Map();
  if (facetKey) {
    for (const entry of entries) {
      const value = facetKey(entry);
      if (value === undefined || value === null) continue;
      const key = String(value);
      if (!facetBuckets.has(key)) facetBuckets.set(key, []);
      facetBuckets.get(key).push(entry);
    }
  }
  const searchCache = new Map();

  function searchByName(text) {
    const q = (text ?? '').trim().toLowerCase();
    if (!q) return entries;
    if (searchCache.has(q)) return searchCache.get(q);
    const result = named.filter((n) => n.lowerName.includes(q)).map((n) => n.entry);
    searchCache.set(q, result);
    return result;
  }

  function byFacet(value) {
    if (value === undefined || value === null || value === '') return entries;
    return facetBuckets.get(String(value)) ?? [];
  }

  function query(text, facetValue) {
    const byName = searchByName(text);
    if (facetValue === undefined || facetValue === null || facetValue === '') return byName;
    const bucket = new Set(byFacet(facetValue));
    return byName.filter((entry) => bucket.has(entry));
  }

  return { searchByName, byFacet, query };
}
