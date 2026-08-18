/**
 * A floating doc whose backing handout/page disappears must close
 * itself once it has resolved at least once (deletion mid-session);
 * a doc that has never resolved keeps the "Document missing"
 * placeholder, and that placeholder must be dismissable (close
 * button and Escape) like the normal panel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, render } from 'preact';
import { FloatingDocs, openDoc, closeAllDocs } from '../ui/FloatingDoc.jsx';
import { openDocsSignal } from '../state/ui-signals.js';
import { handoutsSignal, pagesSignal } from '../state/signals.js';

function makeUi(handouts = new Map()) {
  return /** @type {any} */ ({
    state: { handouts, pages: new Map() },
    closeDoc: vi.fn((key) => {
      openDocsSignal.value = openDocsSignal.value.filter((d) => d.key !== key);
    }),
    bringDocToFront: vi.fn(),
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

describe('FloatingDocs missing-document behavior', () => {
  beforeEach(() => {
    closeAllDocs();
    handoutsSignal.value = new Map();
    pagesSignal.value = new Map();
    document.body.innerHTML = '';
  });

  it('auto-closes a doc that resolved once and was then deleted', async () => {
    const handouts = new Map([['h1', { id: 'h1', title: 'An invitation', body: 'x' }]]);
    const ui = makeUi(handouts);
    const host = document.createElement('div');
    document.body.appendChild(host);

    openDoc('handout', 'h1');
    render(h(FloatingDocs, { ui }), host);
    await flush();
    expect(host.textContent).toContain('An invitation');

    handouts.delete('h1');
    handoutsSignal.value = new Map();
    render(h(FloatingDocs, { ui }), host);
    await flush();

    expect(openDocsSignal.value).toHaveLength(0);
    expect(host.textContent).not.toContain('Document missing');
  });

  it('does not auto-close while a sync refresh has the collections emptied', async () => {
    const handouts = new Map([['h1', { id: 'h1', title: 'An invitation', body: 'x' }]]);
    const ui = makeUi(handouts);
    const host = document.createElement('div');
    document.body.appendChild(host);

    openDoc('handout', 'h1');
    render(h(FloatingDocs, { ui }), host);
    await flush();

    ui.state.refreshing = true;
    handouts.delete('h1');
    handoutsSignal.value = new Map();
    render(h(FloatingDocs, { ui }), host);
    await flush();
    expect(openDocsSignal.value).toHaveLength(1);

    handouts.set('h1', { id: 'h1', title: 'An invitation', body: 'x' });
    ui.state.refreshing = false;
    handoutsSignal.value = new Map(handouts);
    render(h(FloatingDocs, { ui }), host);
    await flush();
    expect(openDocsSignal.value).toHaveLength(1);
    expect(host.textContent).toContain('An invitation');
  });

  it('keeps the placeholder for a never-resolved doc, dismissable via its close button', async () => {
    const ui = makeUi();
    const host = document.createElement('div');
    document.body.appendChild(host);

    openDoc('handout', 'h-unknown');
    render(h(FloatingDocs, { ui }), host);
    await flush();

    expect(host.textContent).toContain('Document missing');
    host.querySelector('.floating-doc__close').click();
    expect(ui.closeDoc).toHaveBeenCalledWith('handout:h-unknown');
  });

  it('the placeholder closes on Escape like the normal panel', async () => {
    const ui = makeUi();
    const host = document.createElement('div');
    document.body.appendChild(host);

    openDoc('handout', 'h-unknown');
    render(h(FloatingDocs, { ui }), host);
    await flush();

    const panel = host.querySelector('.floating-doc');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ui.closeDoc).toHaveBeenCalledWith('handout:h-unknown');
  });
});
