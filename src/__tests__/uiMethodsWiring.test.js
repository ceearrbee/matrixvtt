/**
 * uiMethodsWiring - asserts that the delegated bindings
 * (import/export helpers, speak-as setter, core lifecycle) are actually
 * attached as functions after attachUIMethods. Guards against ghost
 * bindings: call sites and named exports existing while nothing
 * wires them onto `ui`.
 */

import { describe, it, expect } from 'vitest';
import { attachUIMethods } from '../ui/ui-methods.js';

const BINDINGS = [
  'exportCharactersMarkdown',
  'exportNPCsMarkdown',
  'importMarkdown',
  'importCharacterFromMarkdown',
  'importNPCFromMarkdown',
  'importRuleset',
  'exportRuleset',
  'characterToMarkdown',
  'npcToMarkdown',
  'setSpeakAs',
  'rollMyInitiative',
  'rollInitiative',
];

describe('attachUIMethods - wiring', () => {
  it.each(BINDINGS)('wires ui.%s as a function', (name) => {
    const ui = attachUIMethods({});
    expect(typeof ui[name]).toBe('function');
  });
});
