import { h } from 'preact';

function formatDamageEntry(e) {
  const ts = new Date(e.ts || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sign = e.kind === 'heal' ? '+' : '−';
  const mag = Math.abs(e.delta || 0);
  const tgt = e.target_name || e.target_id || '?';
  const src = e.source ? ` - ${e.source}` : '';
  return `${ts}  ${tgt}  ${sign}${mag}${src}`;
}

/** @param {{ ui: any, gm?: any }} props */
export function DamageLogPanel(props) {
  const { ui } = props;
  const entries = ui.state?.damageLog || [];
  if (entries.length === 0) {
    return h(
      'div',
      {
        class: 'gm-panel gm-panel--damage',
        style: 'padding:12px;font-size:11px;color:var(--color-text-tertiary);',
      },
      'No damage recorded yet'
    );
  }
  const recent = entries.slice(-20).reverse();
  return h(
    'div',
    {
      class: 'gm-panel gm-panel--damage',
      style:
        'padding:12px;max-height:240px;overflow-y:auto;font-family:var(--font-mono, monospace);font-size:11px;line-height:1.5;',
    },
    recent.map((e, i) =>
      h(
        'div',
        {
          key: `${e.ts}-${i}`,
          style:
            e.kind === 'heal'
              ? 'color:var(--color-text-success, #7a7)'
              : 'color:var(--color-text-danger, #c66)',
        },
        formatDamageEntry(e)
      )
    )
  );
}
