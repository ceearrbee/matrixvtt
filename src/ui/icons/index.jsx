/**
 * icons/index.jsx - line-stroke SVG icons in the marketing page's
 * vocabulary (see site/matrixvtt.html). Every icon:
 *
 *   - inherits colour via `stroke="currentColor"`
 *   - sizes to 1em so it inherits the parent's font-size
 *   - uses `aria-hidden="true"`; semantics live on the parent button
 *     via its existing `aria-label` and `title`
 *
 * Replaces ~30 emoji glyphs in app chrome. Emoji that are *content*
 * - condition pills on tokens, chat-message bodies, the scene 🎬
 * banner inside a chat thread - intentionally keep their emoji
 * (warm content, austere chrome).
 */

import { h } from 'preact';

function Svg({ children = null, viewBox = '0 0 16 16' }) {
  return h(
    'svg',
    {
      width: '1em',
      height: '1em',
      viewBox,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children,
  );
}


export const MapsIcon = () => h(Svg, {}, [
  h('path', { d: 'M 2 4 L 6 2 L 10 4 L 14 2 L 14 12 L 10 14 L 6 12 L 2 14 Z' }),
  h('line', { x1: 6, y1: 2, x2: 6, y2: 12 }),
  h('line', { x1: 10, y1: 4, x2: 10, y2: 14 }),
]);


export const LeaveIcon = () => h(Svg, {}, [
  h('path', { d: 'M 10 4 L 6 8 L 10 12' }),
  h('line', { x1: 6, y1: 8, x2: 14, y2: 8 }),
]);

// ── Sheet tabs ──────────────────────────────────────────────────────
export const CombatIcon = () => h(Svg, {}, [
  // Two crossed swords - diagonal lines with small hilts at the bottom.
  h('line', { x1: 3, y1: 3, x2: 11, y2: 11 }),
  h('line', { x1: 13, y1: 3, x2: 5, y2: 11 }),
  h('line', { x1: 9, y1: 9, x2: 11, y2: 11 }),
  h('line', { x1: 5, y1: 11, x2: 7, y2: 9 }),
]);

// Base draw-tool glyphs (pointer, pencil, line, rect, circle, cone,
// measure) intentionally NOT exported here - the existing Unicode
// glyphs in `TOOLS` (↖ ✏ ╱ ▭ ◯ 📏) are already stroke-thin and fit
// the same editorial vocabulary. If a future ruleset needs richer
// SVG variants, add them back at that point - knip will flag any
// that go unused.

export const EraseIcon = () => h(Svg, {}, [
  h('path', { d: 'M 4 11 L 9 6 L 12 9 L 7 14 L 4 14 Z' }),
  h('line', { x1: 9, y1: 6, x2: 12, y2: 9 }),
]);

export const WallIcon = () => h(Svg, {}, [
  h('rect', { x: 2, y: 5, width: 5, height: 3 }),
  h('rect', { x: 7, y: 5, width: 7, height: 3 }),
  h('rect', { x: 2, y: 8, width: 7, height: 3 }),
  h('rect', { x: 9, y: 8, width: 5, height: 3 }),
]);

export const EyeIcon = () => h(Svg, {}, [
  h('path', { d: 'M1.5 8 C 4 3.5, 12 3.5, 14.5 8 C 12 12.5, 4 12.5, 1.5 8 Z' }),
  h('circle', { cx: 8, cy: 8, r: 2 }),
]);

export const LightIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 7, r: 3.5 }),
  h('line', { x1: 8, y1: 1, x2: 8, y2: 2.5 }),
  h('line', { x1: 13, y1: 3, x2: 12, y2: 4 }),
  h('line', { x1: 3, y1: 3, x2: 4, y2: 4 }),
  h('line', { x1: 6.5, y1: 12, x2: 9.5, y2: 12 }),
  h('line', { x1: 7, y1: 14.5, x2: 9, y2: 14.5 }),
]);

export const TemplateIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 5 }),
  h('circle', { cx: 8, cy: 8, r: 2 }),
  h('line', { x1: 8, y1: 1, x2: 8, y2: 4 }),
  h('line', { x1: 8, y1: 12, x2: 8, y2: 15 }),
  h('line', { x1: 1, y1: 8, x2: 4, y2: 8 }),
  h('line', { x1: 12, y1: 8, x2: 15, y2: 8 }),
]);

export const PingIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 2, fill: 'currentColor' }),
  h('circle', { cx: 8, cy: 8, r: 5 }),
]);

export const UndoIcon = () => h(Svg, {}, [
  h('path', { d: 'M 7 5 L 3 5 L 3 9' }),
  h('path', { d: 'M 3 5 Q 9 5 11 9 Q 13 13 8 13' }),
]);

export const RedoIcon = () => h(Svg, {}, [
  h('path', { d: 'M 9 5 L 13 5 L 13 9' }),
  h('path', { d: 'M 13 5 Q 7 5 5 9 Q 3 13 8 13' }),
]);

export const EditIcon = () => h(Svg, {}, [
  h('path', { d: 'M11 2.5 L13.5 5 L5.5 13 L2.5 13.5 L3 10.5 Z' }),
  h('line', { x1: 9.5, y1: 4, x2: 12, y2: 6.5 }),
]);

export const TrashIcon = () => h(Svg, {}, [
  h('path', { d: 'M 3 5 L 13 5' }),
  h('path', { d: 'M 6 5 L 6 3 L 10 3 L 10 5' }),
  h('path', { d: 'M 4 5 L 5 13 L 11 13 L 12 5' }),
  h('line', { x1: 7, y1: 7, x2: 7, y2: 11 }),
  h('line', { x1: 9, y1: 7, x2: 9, y2: 11 }),
]);

// ── Chat / dice bar ─────────────────────────────────────────────────
export const SceneIcon = () => h(Svg, {}, [
  // Film-frame rectangle with perforation dots.
  h('rect', { x: 3, y: 4, width: 10, height: 8 }),
  h('circle', { cx: 5, cy: 6.5, r: 0.4, fill: 'currentColor' }),
  h('circle', { cx: 5, cy: 9.5, r: 0.4, fill: 'currentColor' }),
  h('circle', { cx: 11, cy: 6.5, r: 0.4, fill: 'currentColor' }),
  h('circle', { cx: 11, cy: 9.5, r: 0.4, fill: 'currentColor' }),
]);

export const LongPostIcon = () => h(Svg, {}, [
  // Same pencil glyph as the drawing tool - visually consistent.
  h('path', { d: 'M 3 13 L 5 13 L 13 5 L 11 3 Z' }),
  h('line', { x1: 10, y1: 4, x2: 12, y2: 6 }),
]);

// ── Initiative panel ────────────────────────────────────────────────
export const StartCombatIcon = () => h(Svg, {}, [
  // Same crossed-swords as the Combat tab but at slightly larger
  // scale; the start button is verb-heavier so we let it breathe.
  h('line', { x1: 3, y1: 3, x2: 11, y2: 11 }),
  h('line', { x1: 13, y1: 3, x2: 5, y2: 11 }),
]);

export const EndCombatIcon = () => h(Svg, {}, [
  h('rect', { x: 4, y: 4, width: 8, height: 8, fill: 'currentColor' }),
]);

// ── Left index / rail navigation ────────────────────────────────────
export const BookIcon = () => h(Svg, {}, [
  h('path', { d: 'M 8 3.5 Q 5.5 2 3 3 L 3 12.5 Q 5.5 11.5 8 13 Q 10.5 11.5 13 12.5 L 13 3 Q 10.5 2 8 3.5 Z' }),
  h('line', { x1: 8, y1: 3.5, x2: 8, y2: 13 }),
]);

export const PersonIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 5.5, r: 2.5 }),
  h('path', { d: 'M 3.5 13.5 Q 3.5 9.5 8 9.5 Q 12.5 9.5 12.5 13.5' }),
]);

export const BoxIcon = () => h(Svg, {}, [
  h('path', { d: 'M 3 5 L 8 2.5 L 13 5 L 13 11 L 8 13.5 L 3 11 Z' }),
  h('path', { d: 'M 3 5 L 8 7.5 L 13 5' }),
  h('line', { x1: 8, y1: 7.5, x2: 8, y2: 13.5 }),
]);

export const ChatIcon = () => h(Svg, {}, [
  h('path', { d: 'M 2.5 3.5 L 13.5 3.5 L 13.5 10.5 L 7 10.5 L 4 13 L 4 10.5 L 2.5 10.5 Z' }),
]);

// ── GM panel sub-navigation ─────────────────────────────────────────
export const DiceIcon = () => h(Svg, {}, [
  h('rect', { x: 3, y: 3, width: 10, height: 10, rx: 1.5 }),
  h('circle', { cx: 6, cy: 6, r: 0.7, fill: 'currentColor', stroke: 'none' }),
  h('circle', { cx: 10, cy: 10, r: 0.7, fill: 'currentColor', stroke: 'none' }),
  h('circle', { cx: 10, cy: 6, r: 0.7, fill: 'currentColor', stroke: 'none' }),
  h('circle', { cx: 6, cy: 10, r: 0.7, fill: 'currentColor', stroke: 'none' }),
]);

export const PlusIcon = () => h(Svg, {}, [
  h('line', { x1: 8, y1: 3, x2: 8, y2: 13 }),
  h('line', { x1: 3, y1: 8, x2: 13, y2: 8 }),
]);

export const FogIcon = () => h(Svg, {}, [
  h('path', { d: 'M 2.5 6 Q 5 4.5 8 6 Q 11 7.5 13.5 6' }),
  h('path', { d: 'M 2.5 9 Q 5 7.5 8 9 Q 11 10.5 13.5 9' }),
  h('path', { d: 'M 2.5 12 Q 5 10.5 8 12 Q 11 13.5 13.5 12' }),
]);

export const EnvironmentIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 7, r: 3 }),
  h('path', { d: 'M 8 1.5 L 8 3 M 8 11 L 8 12.5 M 2.5 7 L 4 7 M 12 7 L 13.5 7 M 4.1 3.1 L 5.2 4.2 M 10.8 9.8 L 11.9 10.9 M 11.9 3.1 L 10.8 4.2' }),
  h('path', { d: 'M 2 14 Q 5 12.5 8 14 Q 11 15.5 14 14' }),
]);

export const PeopleIcon = () => h(Svg, {}, [
  h('circle', { cx: 5.5, cy: 5.5, r: 2 }),
  h('path', { d: 'M 2 12.5 Q 2 9 5.5 9 Q 9 9 9 12.5' }),
  h('circle', { cx: 11, cy: 5, r: 1.6 }),
  h('path', { d: 'M 10.5 8.7 Q 14 8.8 14 12' }),
]);

export const ImportExportIcon = () => h(Svg, {}, [
  h('path', { d: 'M 5 9 L 5 3 M 3 5 L 5 3 L 7 5' }),
  h('path', { d: 'M 11 7 L 11 13 M 9 11 L 11 13 L 13 11' }),
]);

export const DamageIcon = () => h(Svg, {}, [
  // Impact burst - radiating strokes.
  h('path', { d: 'M 8 2 L 8 5 M 8 11 L 8 14 M 2 8 L 5 8 M 11 8 L 14 8' }),
  h('path', { d: 'M 4 4 L 6 6 M 10 10 L 12 12 M 12 4 L 10 6 M 6 10 L 4 12' }),
]);

// ── Combat / initiative chrome ──────────────────────────────────────
export const ShieldIcon = () => h(Svg, {}, [
  h('path', { d: 'M 8 2 L 13 4 L 13 8 Q 13 12 8 14 Q 3 12 3 8 L 3 4 Z' }),
]);

export const RunIcon = () => h(Svg, {}, [
  // Motion chevrons - movement remaining.
  h('path', { d: 'M 4 4 L 8 8 L 4 12' }),
  h('path', { d: 'M 9 4 L 13 8 L 9 12' }),
]);

// ── Popup / presence chrome ─────────────────────────────────────────
export const PinIcon = () => h(Svg, {}, [
  h('path', { d: 'M 6 2.5 L 10 2.5 L 10 7 L 12 9 L 4 9 L 6 7 Z' }),
  h('line', { x1: 8, y1: 9, x2: 8, y2: 13.5 }),
]);

export const MicIcon = () => h(Svg, {}, [
  h('rect', { x: 6, y: 2.5, width: 4, height: 7, rx: 2 }),
  h('path', { d: 'M 4 8 Q 4 11.5 8 11.5 Q 12 11.5 12 8' }),
  h('line', { x1: 8, y1: 11.5, x2: 8, y2: 13.5 }),
]);

export const KickIcon = () => h(Svg, {}, [
  // Arrow out of a doorway - remove from room.
  h('path', { d: 'M 6 2.5 L 2.5 2.5 L 2.5 13.5 L 6 13.5' }),
  h('path', { d: 'M 10 4.5 L 13.5 8 L 10 11.5' }),
  h('line', { x1: 6, y1: 8, x2: 13.5, y2: 8 }),
]);

export const BanIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 5.5 }),
  h('line', { x1: 4.2, y1: 4.2, x2: 11.8, y2: 11.8 }),
]);

// ── Mode registry (mobile panel tab) ────────────────────────────────
export const SheetIcon = () => h(Svg, {}, [
  h('rect', { x: 3.5, y: 2, width: 9, height: 12, rx: 1 }),
  h('line', { x1: 6, y1: 5.5, x2: 10, y2: 5.5 }),
  h('line', { x1: 6, y1: 8, x2: 10, y2: 8 }),
  h('line', { x1: 6, y1: 10.5, x2: 8.5, y2: 10.5 }),
]);

export const WrenchIcon = () => h(Svg, {}, [
  h('path', { d: 'M 9.5 6.5 L 3 13 L 4.5 14.5 L 11 8 Q 13.5 8.5 14 6 Q 14.3 4.5 13 3.5 L 11 5.5 L 9.5 4 L 11.5 2 Q 9 1.5 8 3.5 Q 7.2 5.2 9.5 6.5 Z' }),
]);

export const GearIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 2.5 }),
  h('path', { d: 'M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4' }),
]);

export const WhisperIcon = () => h(Svg, {}, [
  h('path', { d: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z' }),
  h('path', { d: 'M5 7h6' }),
  h('path', { d: 'M1.5 14.5 14.5 1.5' }),
]);

export const StarIcon = () => h(Svg, {}, [
  h('path', { d: 'M8 1.8 9.9 5.7 14.2 6.3 11.1 9.3 11.8 13.6 8 11.6 4.2 13.6 4.9 9.3 1.8 6.3 6.1 5.7z' }),
]);

export const SelectIcon = () => h(Svg, {}, [
  h('path', { d: 'M4 2.5 12 9l-4 .6 2.2 4-1.8.9-2.2-4L4 13z' }),
]);

export const PencilIcon = () => h(Svg, {}, [
  h('path', { d: 'M11.5 2.5 13.5 4.5 5.5 12.5 2.5 13.5 3.5 10.5z' }),
  h('path', { d: 'M10 4 12 6' }),
]);

export const LineToolIcon = () => h(Svg, {}, [
  h('path', { d: 'M3 13 13 3' }),
]);

export const RectToolIcon = () => h(Svg, {}, [
  h('rect', { x: 3, y: 4.5, width: 10, height: 7 }),
]);

export const CircleToolIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 5 }),
]);

export const RulerIcon = () => h(Svg, {}, [
  h('path', { d: 'M2 11 11 2l3 3-9 9z' }),
  h('path', { d: 'M5.2 7.8l1.2 1.2M7.4 5.6l1.2 1.2M9.6 3.4l1.2 1.2' }),
]);

export const MenuIcon = () => h(Svg, {}, [
  h('path', { d: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11' }),
]);

export const RefreshIcon = () => h(Svg, {}, [
  h('path', { d: 'M13 8a5 5 0 1 1-1.5-3.5' }),
  h('path', { d: 'M13 2v3h-3' }),
]);

export const DotIcon = () => h(Svg, {}, [
  h('circle', { cx: 8, cy: 8, r: 3, fill: 'currentColor', stroke: 'none' }),
]);

export const PanelIcon = () => h(Svg, {}, [
  h('rect', { x: 2.5, y: 3, width: 11, height: 10 }),
  h('path', { d: 'M9.5 3v10' }),
]);

export const PlayIcon = () => h(Svg, {}, [
  h('path', { d: 'M5 3.5 12 8l-7 4.5z' }),
]);

export const CopyIcon = () => h(Svg, {}, [
  h('rect', { x: 5.5, y: 5.5, width: 8, height: 8 }),
  h('path', { d: 'M10.5 5.5v-3h-8v8h3' }),
]);
