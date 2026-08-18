/**
 * The theme control (now a row in the consolidated GlobalMenu) must name
 * the current theme in its visible label and say what the next click
 * switches to in its tooltip (title attribute). Cycle: auto → light →
 * dark → high-contrast → nondescript → auto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { GlobalMenu } from '../ui/GlobalMenu.jsx';
import { themeSignal } from '../state/ui-signals.js';

async function flush() { await Promise.resolve(); await Promise.resolve(); }

function makeUi() {
  return {
    state: { isGM: () => false },
    widgetManager: {},
    toggleTheme: vi.fn(),
    openSettings: vi.fn(),
    openMapsPanel: vi.fn(),
  };
}

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return root;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  themeSignal.value = 'auto';
});

const themeBtn = (root) => root.querySelector('[data-menu-item="theme"]');

describe('theme menu row names the current theme', () => {
  it('default (auto) shows "Theme: Auto (system)" and next is Light', () => {
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    const btn = themeBtn(root);
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Auto/);
    expect(btn.getAttribute('title')).toMatch(/Light/);
  });

  it('light theme names "Light" and next is Dark', () => {
    themeSignal.value = 'light';
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    const btn = themeBtn(root);
    expect(btn.textContent).toMatch(/Light/);
    expect(btn.getAttribute('title')).toMatch(/Dark/);
  });

  it('dark theme names "Dark" and next is High contrast', () => {
    themeSignal.value = 'dark';
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    const btn = themeBtn(root);
    expect(btn.textContent).toMatch(/Dark/);
    expect(btn.getAttribute('title')).toMatch(/High contrast/);
  });

  it('high-contrast cycles forward to Nondescript', () => {
    themeSignal.value = 'high-contrast';
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    const btn = themeBtn(root);
    expect(btn.textContent).toMatch(/High contrast/);
    expect(btn.getAttribute('title')).toMatch(/Nondescript/);
  });

  it('nondescript cycles back to Auto', () => {
    themeSignal.value = 'nondescript';
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    const btn = themeBtn(root);
    expect(btn.textContent).toMatch(/Nondescript/);
    expect(btn.getAttribute('title')).toMatch(/Auto/);
  });

  it('label updates reactively when themeSignal changes mid-mount', async () => {
    themeSignal.value = 'auto';
    const root = mount(h(GlobalMenu, { ui: makeUi() }));
    expect(themeBtn(root).textContent).toMatch(/Auto/);

    themeSignal.value = 'dark';
    await flush();
    expect(themeBtn(root).textContent).toMatch(/Dark/);
    expect(themeBtn(root).textContent).not.toMatch(/Auto/);

    themeSignal.value = 'high-contrast';
    await flush();
    expect(themeBtn(root).textContent).toMatch(/High contrast/);
  });

  it('clicking the row cycles the theme via ui.toggleTheme', () => {
    const ui = makeUi();
    const root = mount(h(GlobalMenu, { ui }));
    themeBtn(root).click();
    expect(ui.toggleTheme).toHaveBeenCalledOnce();
  });
});
