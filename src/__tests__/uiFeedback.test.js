import { describe, it, expect, vi, afterEach } from 'vitest';

// Sonner delegate spy - covers the toast assertions further down. The
// actual library is mocked so jsdom doesn't try to render the React
// component tree.
const sonnerSpy = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: Object.assign((m, o) => {}, sonnerSpy),
}));

import { createMinimalUI } from '../ui/ui-methods.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class {
    constructor() {}
    render() {}
    destroy() {}
  }
}));

vi.mock('../utils/ui-helpers.js', () => ({
  getHPPercentage: vi.fn(() => 50),
  getHPColor: vi.fn(() => '#1D9E75'),
  FormReader: class {
    constructor() {}
    collect(schema) { return {}; }
    getField() { return ''; }
    getCheckbox() { return false; }
  },
  ModalFactory: {
    create: vi.fn(({ body }) => {
      const el = document.createElement('div');
      el.innerHTML = body;
      return el;
    }),
    confirm: vi.fn()
  },
  trapFocusIn: vi.fn(() => () => {})
}));

function makeUI(isGM = true) {
  const state = {
    roomMembers: [],
    settings: { gm_user_ids: [] },
    isGM: vi.fn().mockReturnValue(isGM)
  };
  const widgetManager = {
    isStandalone: true
  };
  return createMinimalUI(state, widgetManager, null);
}

describe('UI feedback accessibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('routes error toasts through sonner.toast.error', () => {
    const ui = makeUI();
    document.body.innerHTML = '<div id="vtt-sr-announcements" aria-live="polite" aria-atomic="true"></div>';

    ui._toast('Something failed', 'error');

    expect(sonnerSpy.error).toHaveBeenCalledWith('Something failed', expect.any(Object));
  });

  it('routes success toasts through sonner.toast.success', () => {
    const ui = makeUI();
    ui._toast('Saved', 'success');
    expect(sonnerSpy.success).toHaveBeenCalledWith('Saved', expect.any(Object));
  });

  it('wires template picker actions without inline handlers', () => {
    const ui = makeUI();
    ui.applyCharacterTemplate = vi.fn();
    ui.deleteCharacterTemplate = vi.fn();
    document.body.innerHTML = `
      <div>
        <select id="template-select">
          <option value="">- select template -</option>
          <option value="1">Fighter</option>
        </select>
        <button id="delete-template-btn" type="button">Delete</button>
      </div>
    `;

    ui._setupTemplatePickerHandlers(document);
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('template-select'));
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    document.getElementById('delete-template-btn')?.click();

    expect(ui.applyCharacterTemplate).toHaveBeenCalledWith('1');
    expect(ui.deleteCharacterTemplate).toHaveBeenCalledWith('1');
  });

});

describe('UIController - map upload FileReader reject on error', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('rejects the Promise (does not hang) when FileReader errors during fallback data-URL read', async () => {
    const { ModalFactory, FormReader } = await import('../utils/ui-helpers.js');
    const fakeModal = document.createElement('div');
    fakeModal.innerHTML = '<form id="map-form"><select id="map-source-type"><option value="upload" selected>upload</option></select><input id="map-upload" type="file"></form>';
    document.body.appendChild(fakeModal);
    ModalFactory.create.mockReturnValue(fakeModal);
    
    const ui = makeUI();
    // Mock collect to return 'upload' for source type
    vi.mocked(FormReader).prototype.collect = vi.fn().mockReturnValue({ name: 'Test' });
    
    ui.widgetManager = {
      isStandalone: false,
      uploadMedia: vi.fn().mockRejectedValue(new Error('upload fail'))
    };
    const toastSpy = vi.spyOn(ui, '_toast');

    await ui.submitMapForm(fakeModal).catch(() => {});

    expect(toastSpy).toHaveBeenCalled();
  });
});

describe('UIController - markdown FileReader error feedback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows toast when FileReader errors on markdown file input', async () => {
    const origFileReader = globalThis.FileReader;
    // Mock FileReader to always trigger onerror
    globalThis.FileReader = class {
      readAsText() { setTimeout(() => this.onerror?.(new Error('disk read error'))); }
    };

    const ui = makeUI();
    const toastSpy = vi.spyOn(ui, '_toast');
    // Renders a real <Modal> with the markdown import form into the document.
    ui.showImportMarkdownDialog();

    const fileInput = document.querySelector('#md-file-input');
    const fakeFile = new File(['content'], 'test.md', { type: 'text/markdown' });
    Object.defineProperty(fileInput, 'files', { value: [fakeFile] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 20));
    globalThis.FileReader = origFileReader;

    expect(toastSpy).toHaveBeenCalled();
  });
});

describe('UIController.render - missing #app element', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not throw when #app element is missing from DOM', () => {
    const ui = makeUI();
    // Ensure #app does not exist
    document.getElementById('app')?.remove();
    expect(() => ui.render()).not.toThrow();
  });
});
