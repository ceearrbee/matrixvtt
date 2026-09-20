/**
 * Generate tab: a layout built from a seed, previewed with the same
 * painter the table uses, so what you see here is what everyone sees.
 */

import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GENERATORS } from '../../../map/generators/index.js';
import { PALETTES, DEFAULT_PALETTE } from '../../../map/generators/palettes.js';
import { SEED_PATTERN, randomSeed } from '../../../map/generators/rng.js';
import { getGeneratedCanvas } from '../../../map/generators/cache.js';

const PREVIEW_CELL_PX = 14;
const STYLES = [
  { id: 'textured', label: 'Textured' },
  { id: 'lines', label: 'Plain' },
];

export function GenerateTab({ mapSize, onChoose }) {
  const [generator, setGenerator] = useState('dungeon');
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [style, setStyle] = useState('textured');
  const [seed, setSeed] = useState(() => randomSeed());
  const [params, setParams] = useState(() => ({ ...GENERATORS.dungeon.defaults }));
  const [seedError, setSeedError] = useState(null);

  const spec = GENERATORS[generator];
  const seedOk = SEED_PATTERN.test(seed);

  const chooseGenerator = (id) => {
    setGenerator(id);
    setParams({ ...GENERATORS[id].defaults });
  };

  const confirm = () => {
    if (!seedOk) {
      setSeedError('A seed is up to 32 characters of lowercase letters, digits and dashes.');
      return;
    }
    onChoose({ kind: 'generated', generator, seed, palette, style, params });
  };

  return h('div', { class: 'bg-picker__pane bg-picker__generate' }, [
    h('div', { class: 'bg-picker__controls' }, [
      field('bg-generator', 'Layout', h('select', {
        class: 'form-select', id: 'bg-generator', value: generator,
        onChange: (e) => chooseGenerator(e.target.value),
      }, Object.values(GENERATORS).map((g) =>
        h('option', { key: g.id, value: g.id, selected: g.id === generator }, g.label)))),

      field('bg-palette', 'Materials', h('select', {
        class: 'form-select', id: 'bg-palette', value: palette,
        onChange: (e) => setPalette(e.target.value),
      }, Object.values(PALETTES).map((p) =>
        h('option', { key: p.id, value: p.id, selected: p.id === palette }, p.label)))),

      field('bg-seed', 'Seed', h('div', { class: 'row-sm' }, [
        h('input', {
          type: 'text', class: 'form-input flex-1', id: 'bg-seed', value: seed,
          onInput: (e) => { setSeed(e.target.value); setSeedError(null); },
        }),
        h('button', { type: 'button', class: 'dbt dbt--sm', onClick: () => { setSeed(randomSeed()); setSeedError(null); } }, 'Reroll'),
      ])),

      h('div', { class: 'form-group' }, [
        h('span', { class: 'form-label' }, 'Style'),
        h('div', { class: 'bg-picker__chips' }, STYLES.map((s) => h('button', {
          key: s.id,
          type: 'button',
          class: `dbt dbt--sm${style === s.id ? ' is-active' : ''}`,
          'aria-pressed': String(style === s.id),
          onClick: () => setStyle(s.id),
        }, s.label))),
      ]),

      h('div', { class: 'bg-picker__params' }, spec.params.map((p) => h('label', {
        key: p.key, class: 'bg-picker__param',
      }, [
        h('span', null, p.label),
        h('input', {
          type: 'number', class: 'form-input', 'data-param': p.key,
          'aria-label': `${p.label}, between ${p.min} and ${p.max}`,
          min: p.min, max: p.max, value: params[p.key],
          onInput: (e) => setParams({ ...params, [p.key]: Number(e.target.value) }),
        }),
      ]))),
    ]),

    h('div', { class: 'bg-picker__side' }, [
      h(Preview, { mapSize, generator, seed: seedOk ? seed : null, palette, style, params }),
      seedError && h('p', { class: 'bg-picker__seed-error' }, seedError),
      h('button', { type: 'button', class: 'dbt btn-primary w-full', onClick: confirm }, 'Use this map'),
    ]),
  ]);
}

function field(id, label, control) {
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: id }, label),
    control,
  ]);
}

/**
 * Paints through the shared generator cache, so the preview and the
 * table cannot drift, then blits onto a canvas sized for the panel.
 */
function Preview({ mapSize, generator, seed, palette, style, params }) {
  const ref = useRef(null);
  const host = useMemo(() => ({ _tokenImages: new Map() }), []);
  const [revision, setRevision] = useState(0);

  const width = mapSize?.width_cells ?? 20;
  const height = mapSize?.height_cells ?? 15;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!seed) return;
    const painted = getGeneratedCanvas(
      host,
      {
        width_cells: width, height_cells: height, cell_px: PREVIEW_CELL_PX,
        background: { kind: 'generated', generator, seed, palette, style, params },
      },
      () => setRevision((n) => n + 1),
    );
    if (painted) ctx.drawImage(painted, 0, 0, canvas.width, canvas.height);
  }, [host, width, height, generator, seed, palette, style, params, revision]);

  return h('div', { class: 'bg-picker__preview' }, h('canvas', {
    ref,
    width: width * PREVIEW_CELL_PX,
    height: height * PREVIEW_CELL_PX,
    role: 'img',
    'aria-label': seed ? `Preview of the ${generator} layout, seed ${seed}` : 'No preview: the seed is not usable',
  }));
}
