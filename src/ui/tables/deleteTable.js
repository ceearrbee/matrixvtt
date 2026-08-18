/**
 * deleteTable - confirmation modal then state removal. GM-only.
 */
import { h } from 'preact';
import { confirm } from '../confirm-dialogs.jsx';

export function deleteTable(ui, id) {
  if (!ui.state.isGM()) return;
  const table = ui.state.tables.get(id);
  const name = table?.name || 'this table';
  const entryCount = table?.entries?.length ?? 0;
  const scope = entryCount > 0 ? ` (${entryCount} entr${entryCount === 1 ? 'y' : 'ies'})` : '';
  confirm(h('span', null, ['Delete table ', h('strong', null, name), `${scope}?`]), async () => {
    await ui.state.removeTable(id);
  });
}
