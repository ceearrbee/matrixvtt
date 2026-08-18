// Synthetic stable keys for list-editor rows. Stripped at save time -
// reorder/insert/delete won't bleed input state into the wrong row.
let counter = 0;
export function rowKey() {
  counter += 1;
  return `r${counter}`;
}
