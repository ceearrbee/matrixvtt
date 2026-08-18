/**
 * I/O wiring - export/import methods pulled out of ui-methods.js so
 * both the tests and the callers can find them in one place. Each
 * method is a thin adapter onto a pure function in import-export.js
 * or markdown-parsers.js; this test locks in the delegation shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/import-export.js', () => ({
  showImportMarkdownDialog: vi.fn(),
  exportCharactersMarkdown: vi.fn(),
  exportNPCsMarkdown: vi.fn(),
  characterToMarkdown: vi.fn(),
  npcToMarkdown: vi.fn(),
  exportRuleset: vi.fn(),
  importRuleset: vi.fn(),
  importMarkdown: vi.fn(),
}));

vi.mock('../ui/gm-ops.js', () => ({
  exportState: vi.fn(),
}));

vi.mock('../ui/markdown-parsers.js', () => ({
  importCharacterFromMarkdown: vi.fn(),
  importNPCFromMarkdown: vi.fn(),
}));

import { attachIOMethods } from '../ui/io-wiring.js';
import * as importExport from '../ui/import-export.js';
import * as gmOps from '../ui/gm-ops.js';
import * as markdownParsers from '../ui/markdown-parsers.js';

function makeUI() {
  return {
    _toast: vi.fn(),
    state: {
      addWall: vi.fn().mockResolvedValue(undefined),
      addLight: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('attachIOMethods(ui)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exportState forwards to gm-ops.exportState(ui)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    ui.exportState();
    expect(gmOps.exportState).toHaveBeenCalledWith(ui);
  });

  it('characterToMarkdown forwards (ui, character, id)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const c = { name: 'Aria' };
    ui.characterToMarkdown(c, 'chr-aria');
    expect(importExport.characterToMarkdown).toHaveBeenCalledWith(ui, c, 'chr-aria');
  });

  it('npcToMarkdown forwards (ui, npc, id)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const n = { name: 'Orc Guard' };
    ui.npcToMarkdown(n, 'npc-orc1');
    expect(importExport.npcToMarkdown).toHaveBeenCalledWith(ui, n, 'npc-orc1');
  });

  it('exportCharactersMarkdown / exportNPCsMarkdown / exportRuleset forward (ui)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    ui.exportCharactersMarkdown();
    ui.exportNPCsMarkdown();
    ui.exportRuleset();
    expect(importExport.exportCharactersMarkdown).toHaveBeenCalledWith(ui);
    expect(importExport.exportNPCsMarkdown).toHaveBeenCalledWith(ui);
    expect(importExport.exportRuleset).toHaveBeenCalledWith(ui);
  });

  it('importRuleset forwards (ui, file)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const file = new Blob(['{}'], { type: 'application/json' });
    ui.importRuleset(file);
    expect(importExport.importRuleset).toHaveBeenCalledWith(ui, file);
  });

  it('showImportMarkdownDialog forwards (ui)', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    ui.showImportMarkdownDialog();
    expect(importExport.showImportMarkdownDialog).toHaveBeenCalledWith(ui);
  });

  it('importMarkdown/importCharacterFromMarkdown/importNPCFromMarkdown forward', () => {
    const ui = makeUI();
    attachIOMethods(ui);
    ui.importMarkdown('## content');
    ui.importCharacterFromMarkdown('char section');
    ui.importNPCFromMarkdown('npc section');
    expect(importExport.importMarkdown).toHaveBeenCalledWith(ui, '## content');
    expect(markdownParsers.importCharacterFromMarkdown).toHaveBeenCalledWith(ui, 'char section');
    expect(markdownParsers.importNPCFromMarkdown).toHaveBeenCalledWith(ui, 'npc section');
  });

  it('importUvttFile surfaces "no walls or lights" via toast and does not throw', async () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const file = new Blob([JSON.stringify({ line_of_sight: [] })], { type: 'application/json' });
    file.text = async () => JSON.stringify({ line_of_sight: [] });
    await ui.importUvttFile(file);
    expect(ui._toast).toHaveBeenCalledWith('UVTT file contained no walls or lights', 'info');
    expect(ui.state.addWall).not.toHaveBeenCalled();
    expect(ui.state.addLight).not.toHaveBeenCalled();
  });

  it('importUvttFile pushes parsed lights through state.addLight', async () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const payload = {
      resolution: { pixels_per_grid: 10 },
      line_of_sight: [],
      portals: [],
      lights: [
        { position: { x: 1, y: 1 }, range: 5, color: 'ffaa00ff' },
        { position: { x: 2, y: 2 }, range: 3 },
      ],
    };
    const file = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    file.text = async () => JSON.stringify(payload);
    await ui.importUvttFile(file);
    expect(ui.state.addLight).toHaveBeenCalledTimes(2);
    expect(ui._toast).toHaveBeenCalledWith(expect.stringMatching(/Imported 2 lights/), 'success');
  });

  it('importUvttFile pushes portals through state.addWall and reports both counts', async () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const payload = {
      resolution: { pixels_per_grid: 10 },
      line_of_sight: [[{ x: 0, y: 0 }, { x: 1, y: 0 }]],
      portals: [
        { closed: false, bounds: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
      ],
      lights: [
        { position: { x: 0, y: 0 }, range: 5 },
      ],
    };
    const file = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    file.text = async () => JSON.stringify(payload);
    await ui.importUvttFile(file);
    expect(ui.state.addWall).toHaveBeenCalledTimes(2); // one wall + one portal
    expect(ui.state.addLight).toHaveBeenCalledTimes(1);
    expect(ui._toast).toHaveBeenCalledWith(
      expect.stringMatching(/2 wall segments and 1 light/), 'success'
    );
  });

  it('importUvttFile surfaces parse errors via error toast', async () => {
    const ui = makeUI();
    attachIOMethods(ui);
    const file = new Blob(['not json'], { type: 'text/plain' });
    file.text = async () => 'not json';
    await ui.importUvttFile(file);
    expect(ui._toast).toHaveBeenCalledWith(expect.stringMatching(/UVTT import failed/), 'error');
  });
});
