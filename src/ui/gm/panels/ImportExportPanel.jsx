import { h } from 'preact';

/** @param {{ ui: any, gm?: any }} props */
export function ImportExportPanel(props) {
  const { ui } = props;
  return h('div', { class: 'gm-panel gm-panel--io', style: 'padding:var(--space-xl);' }, [
    h('div', { class: 'button-group', style: 'margin-bottom:var(--space-lg);' }, [
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Export all characters as Markdown',
          title: 'Export characters (MD)',
          onClick: () => ui.exportCharactersMarkdown(),
        },
        'Export Characters (MD)'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Export all NPCs as Markdown',
          title: 'Export NPCs (MD)',
          onClick: () => ui.exportNPCsMarkdown(),
        },
        'Export NPCs (MD)'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Import entities from Markdown text',
          title: 'Import from Markdown',
          onClick: () => ui.showImportMarkdownDialog(),
        },
        'Import from Markdown'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Export campaign state to JSON',
          title: 'Export campaign',
          onClick: () => ui.exportState(),
        },
        'Export State'
      ),
    ]),
  ]);
}
