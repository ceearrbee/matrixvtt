/**
 * Pure fact extractors for the library detail pane. Each returns an
 * ordered list of `{ label, value }` rows for kinds that have no
 * ruleset-driven sheet preview (rulesets, maps) or as a last-resort
 * fallback for any entity whose fields don't map to sheet sections.
 */

function pushIf(rows, label, value) {
  if (value !== undefined && value !== null && value !== '') {
    rows.push({ label, value: String(value) });
  }
}

const RULESET_COUNTS = [
  ['attributes', 'Attributes'],
  ['skills', 'Skills'],
  ['conditions', 'Conditions'],
  ['saves', 'Saves'],
  ['damage_types', 'Damage types'],
  ['item_kinds', 'Item kinds'],
];

export function rulesetFacts(data = {}) {
  const rows = [];
  pushIf(rows, 'System', data.system);
  pushIf(rows, 'Version', data.version);
  pushIf(rows, 'Author', data.author);
  pushIf(rows, 'License', data.license);
  for (const [key, label] of RULESET_COUNTS) {
    const value = data[key];
    const count = Array.isArray(value) ? value.length
      : value && typeof value === 'object' ? Object.keys(value).length : 0;
    if (count > 0) rows.push({ label, value: String(count) });
  }
  return rows;
}

export function mapFacts(data = {}) {
  const rows = [];
  const w = data.width_cells;
  const h = data.height_cells;
  if (w && h) rows.push({ label: 'Grid', value: `${w} × ${h} cells` });
  pushIf(rows, 'Cell size', data.grid_px ? `${data.grid_px}px` : '');
  rows.push({ label: 'Image', value: data.image_url ? 'Yes' : 'No' });
  return rows;
}

const SKIP_FIELDS = new Set(['id', 'notes', 'image_url']);

export function genericFacts(data = {}) {
  const rows = [];
  for (const [key, value] of Object.entries(data)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') continue;
    rows.push({ label: key, value: String(value) });
  }
  return rows;
}
