
export function dispatchSections(kindsMap, sections, buildArgs, decorate) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const out = [];
  for (let i = 0; i < sections.length; i++) {
    const cfg = sections[i];
    const fn = kindsMap[cfg?.kind];
    if (!fn) continue;
    const result = fn(buildArgs(cfg, i));
    if (result == null || result === '') continue;
    out.push(decorate ? decorate(result, cfg, i) : result);
  }
  return out;
}
