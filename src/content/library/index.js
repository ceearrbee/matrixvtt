/**
 * Bundled community-library registry. The catalog is a static JSON file
 * contributed via GitHub pull requests; it loads through dynamic import so
 * Vite splits it into a chunk fetched only when the library UI opens.
 */

export async function loadCommunityLibrary() {
  const mod = await import('./community.json', { with: { type: 'json' } });
  return mod.default?.entries ?? [];
}
