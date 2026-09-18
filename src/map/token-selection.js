/**
 * The set of tokens a gesture acts on.
 *
 * A selection keeps insertion order, and its last member is the
 * primary: the one every existing reader already asks about, so the
 * sheet panels and the token action bar keep working unchanged when
 * exactly one token is selected.
 *
 * Every operation returns a new set rather than mutating, because the
 * selection is signal-backed and an in-place change wakes nobody.
 */

export function emptySelection() {
  return new Set();
}

export function selectOne(_selection, id) {
  return id ? new Set([id]) : new Set();
}

export function selectMany(_selection, ids) {
  return new Set((ids ?? []).filter(Boolean));
}

export function toggleInSelection(selection, id) {
  if (!id) return new Set(selection);
  const next = new Set(selection);
  // Delete then re-add so an added token becomes the primary, and a
  // removed one hands the role to whatever was selected before it.
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function primaryOf(selection) {
  let last = null;
  for (const id of selection) last = id;
  return last;
}

export function isSelected(selection, id) {
  return selection.has(id);
}

export function selectionSize(selection) {
  return selection.size;
}
