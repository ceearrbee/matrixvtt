import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderFatalError } from '../utils/appErrorView.js';

describe('renderFatalError', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders attacker-controlled message as text, not markup', () => {
    const app = document.createElement('div');
    document.body.appendChild(app);

    renderFatalError(app, 'Bad: <img src=x onerror=alert(1)>');

    expect(app.querySelector('img')).toBeNull();
    expect(app.innerHTML).toContain('&lt;img');
    expect(app.textContent).toContain('Bad: <img src=x onerror=alert(1)>');
  });

  it('wires the reload button through an event listener', () => {
    const app = document.createElement('div');
    const onReload = vi.fn();
    document.body.appendChild(app);

    renderFatalError(app, 'Nope', onReload);
    app.querySelector('[data-reload-app]')?.click();

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders a structured {title, lines} error with real markup, each part escaped', () => {
    const app = document.createElement('div');
    document.body.appendChild(app);

    renderFatalError(app, {
      title: 'Widget permissions denied',
      lines: [
        'org.matrix.msc2762.send.event:com.vtt.token',
        '<img src=x onerror=alert(1)>',
      ],
      hint: 'Reopen the widget and accept all permission prompts.',
    });

    expect(app.textContent).toContain('Widget permissions denied');
    expect(app.querySelectorAll('li')).toHaveLength(2);
    expect(app.querySelector('img')).toBeNull();
    expect(app.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(app.textContent).toContain('Reopen the widget');
  });

  it('the widget fatal paths pass structured errors, never markup strings', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(`${process.cwd()}/src/app.js`, 'utf8');
    const fatalCalls = src.match(/renderFatalError\([^;]*\)/gs) ?? [];
    expect(fatalCalls.length).toBeGreaterThan(0);
    for (const call of fatalCalls) {
      expect(call, 'markup strings get escaped into visible tags').not.toMatch(/<br>|<strong>|<ul|<li|<code>/);
    }
  });
});
