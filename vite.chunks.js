export const MANUAL_CHUNKS = [
  ['matrix-widget', ['@matrix-widget-toolkit/api', 'matrix-widget-api']],
  ['matrix-sdk', ['matrix-js-sdk', 'matrix-events-sdk', 'oidc-client-ts', 'sdp-transform', 'loglevel', 'jwt-decode', 'base-x', 'bs58', 'unhomoglyph', '@babel/runtime']],
  ['yjs-runtime', ['yjs', 'lib0', 'y-protocols']],
  ['rxjs', ['rxjs']],
  ['konva', ['konva']],
  ['preact', ['preact', '@preact/signals', 'preact/hooks', 'preact/compat']],
  ['sonner', ['sonner']],
  ['marked', ['marked']],
  ['fuse', ['fuse.js']],
  ['driver', ['driver.js']],
  ['dnd-kit', ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']],
  ['tinykeys', ['tinykeys']],
  ['focus-trap', ['focus-trap']],
  ['p-retry', ['p-retry']],
  ['valibot', ['valibot']],
  ['dompurify', ['dompurify']],
  ['idb-keyval', ['idb-keyval']],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CHUNK_GROUPS = MANUAL_CHUNKS.map(([name, packages]) => ({
  name,
  test: new RegExp(packages.map((p) => `/node_modules/${escapeRe(p)}/`).join('|')),
}));
