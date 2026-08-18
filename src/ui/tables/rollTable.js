/**
 * rollTable - pick a weighted entry from a table, log it, broadcast it,
 * and surface the loot-action prompt every time so the GM can award or
 * place the result regardless of whether the entry was pre-linked to
 * an item. When `entry.item_id` resolves, the prompt acts on that
 * item; otherwise the prompt synthesises an ad-hoc item from the
 * rolled text.
 *
 * Single canonical entry point used by:
 *   - TablesPanel 🎲 button (`src/ui/gm/panels/TablesPanel.jsx`)
 *   - `[[roll:<id>]]` wikilinks (via `dispatchRollWikilink`)
 *   - command palette (future)
 *
 * Tables are *not* a sub-domain of handouts - their logic lives here,
 * not in `handouts-panel.js`.
 */

import { esc } from '../../utils/component.js';
import { describeNetworkError } from '../../utils/errorHandling.js';
import { showLootActionPrompt } from './loot-actions.js';

export function rollTable(ui, id) {
  const table = ui.state.tables.get(id);
  if (!table || !Array.isArray(table.entries) || table.entries.length === 0) return;

  const totalWeight = table.entries.reduce((sum, e) => sum + (e.weight || 1), 0);
  let r = Math.random() * totalWeight;
  let result = table.entries[table.entries.length - 1];
  for (const entry of table.entries) {
    r -= entry.weight || 1;
    if (r <= 0) {
      result = entry;
      break;
    }
  }

  // When an entry references an item with no other text, fall back to
  // the item's name so the log row isn't blank.
  const linkedItem = result.item_id ? ui.state.items?.get?.(result.item_id) : null;
  const displayText = result.text?.trim() || linkedItem?.name || '(no result)';

  ui._log('🎲', `<b>${esc(table.name)}</b> - ${esc(displayText)}`);
  // Surface the result immediately so the GM sees feedback regardless
  // of which tab they're on. Without this, rolling from inside the GM
  // modal looks like "nothing happened" - the log entry lives behind
  // the modal and the chat send is fire-and-forget.
  ui._toast?.(`${table.name} - ${displayText}`, 'info');

  if (ui.chat) {
    // Em-dash, never a colon - `**Name**:` trips shortcode autocomplete
    // in some Matrix hosts.
    ui.chat._send(`🎲 **${table.name}** - ${displayText}`).catch(err => {
      console.error('[UI] Failed to broadcast table roll:', err);
      ui._toast?.(`Couldn't send the table roll to chat. ${describeNetworkError(err)}`, 'error');
    });
  }

  showLootActionPrompt(ui, {
    tableName: table.name,
    entryText: displayText,
    itemId: linkedItem ? result.item_id : null,
  });
}
