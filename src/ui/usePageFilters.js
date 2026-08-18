export function applyPageFilters(pages, opts = {}) {
  const { kind = 'all', search = '', sort = 'recent', visibility = 'all', me = null } = opts;
  const needle = search.trim().toLowerCase();
  let out = pages.filter((p) => {
    if (kind !== 'all' && p.kind !== kind) return false;
    if (needle) {
      const hay = `${p.title ?? ''}\n${p.body ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (visibility === 'mine') {
      if (p.author !== me) return false;
    } else if (visibility === 'private') {
      if (p.visibility !== 'private' || p.author !== me) return false;
    } else if (visibility !== 'all') {
      if (p.visibility !== visibility) return false;
    }
    return true;
  });
  if (sort === 'title') {
    out = out.slice().sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  } else {
    out = out.slice().sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
  }
  return out;
}
