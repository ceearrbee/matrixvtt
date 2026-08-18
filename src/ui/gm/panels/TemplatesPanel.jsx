import { h } from 'preact';
import { npcTemplates } from '../../gm-controls.js';

/** @param {{ ui?: any, gm: any }} props */
export function TemplatesPanel(props) {
  const { gm } = props;
  const onTemplate = async name => {
    const tmpl = npcTemplates().find(t => t.name === name);
    if (!tmpl) return;
    await gm.createNPCFromTemplate(tmpl);
  };
  return h(
    'div',
    { class: 'gm-panel gm-panel--templates', style: 'padding:12px;' },
    h(
      'div',
      { class: 'row-sm row--wrap' },
      npcTemplates().map(t =>
        h(
          'button',
          {
            key: t.name,
            class: 'dbt dbt--sm',
            'aria-label': `Create ${t.name} from template`,
            title: `Create ${t.name}`,
            onClick: () => onTemplate(t.name),
          },
          t.name
        )
      )
    )
  );
}
