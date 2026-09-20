/**
 * Pure validation + manifest derivation for the bundled terrain tiles.
 *
 * Lives here rather than in src/ because both `build-backgrounds.mjs`
 * and the provenance test import it, and neither wants a DOM or a Vite
 * base URL. Keeping one implementation is the point: the build and the
 * CI gate cannot disagree about what a valid licence row is.
 */

export const ALLOWED_LICENSES = Object.freeze(['CC0-1.0']);

const MAX_TILE_BYTES = 200_000;
const MAX_PACK_BYTES = 1_500_000;
const REQUIRED = ['id', 'file', 'label', 'material', 'title', 'author', 'source_url', 'license', 'retrieved'];
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @param {{ tiles?: Array<object> }} sources - parsed sources.json
 * @param {Array<{ file: string, bytes: number }>} files - what is on disk
 * @returns {{ manifest: object, licenseText: string, errors: string[] }}
 */
export function buildBackgroundManifest(sources, files) {
  const rows = Array.isArray(sources?.tiles) ? sources.tiles : [];
  const errors = [];
  const byFile = new Map(files.map((f) => [f.file, f]));
  const seen = new Set();

  for (const row of rows) {
    const id = row?.id ?? '(unnamed row)';
    for (const key of REQUIRED) {
      if (!row?.[key]) errors.push(`${id}: missing ${key}`);
    }
    if (row?.id && !SLUG.test(row.id)) errors.push(`${id}: id is not a slug`);
    if (row?.id && seen.has(row.id)) errors.push(`${id}: duplicate id`);
    if (row?.id) seen.add(row.id);
    if (row?.license && !ALLOWED_LICENSES.includes(row.license)) {
      errors.push(`${id}: licence ${row.license} is not in the allowlist`);
    }
    if (row?.file && !byFile.has(row.file)) errors.push(`${id}: no file at tiles/${row.file}`);
    const onDisk = byFile.get(row?.file);
    if (onDisk && onDisk.bytes > MAX_TILE_BYTES) {
      errors.push(`${id}: ${row.file} is too large (${onDisk.bytes} > ${MAX_TILE_BYTES} bytes)`);
    }
  }

  const claimed = new Set(rows.map((r) => r?.file));
  for (const f of files) {
    if (!claimed.has(f.file)) errors.push(`tiles/${f.file} ships with no licence row in sources.json`);
  }

  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > MAX_PACK_BYTES) {
    errors.push(`pack budget exceeded: ${total} > ${MAX_PACK_BYTES} bytes`);
  }

  return { manifest: manifestFrom(rows), licenseText: licenseTextFrom(rows), errors };
}

function manifestFrom(rows) {
  const tiles = rows.map((r) => ({
    id: r.id, file: r.file, label: r.label, material: r.material,
    title: r.title, author: r.author, source_url: r.source_url, license: r.license,
  }));
  return { version: 1, materials: [...new Set(tiles.map((t) => t.material))].sort(), tiles };
}

function licenseTextFrom(rows) {
  const head = [
    'Terrain tiles bundled with MatrixVTT',
    '',
    'Every tile below is public-domain-equivalent. No attribution is legally',
    'required by CC0, but each source is credited here and in the app because',
    'naming where art came from is the only way the claim stays checkable.',
    '',
  ];
  const blocks = rows.map((r) => [
    `${r.label} (tiles/${r.file})`,
    `  Title:    ${r.title}`,
    `  Author:   ${r.author}`,
    `  Source:   ${r.source_url}`,
    `  Licence:  ${r.license}`,
    `  Retrieved: ${r.retrieved}`,
    r.notes ? `  Notes:    ${r.notes}` : null,
  ].filter(Boolean).join('\n'));
  return `${head.join('\n')}\n${blocks.join('\n\n')}\n`;
}
