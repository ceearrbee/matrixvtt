/**
 * Shared EmptyState helper.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { h } from 'preact';
import { EmptyState } from '../ui/EmptyState.jsx';
import { emptyStateHtml } from '../ui/empty-state-html.js';

function mount(node) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(node, host);
  return host;
}

describe('EmptyState component', () => {
  it('renders the message with no button when cta is omitted', () => {
    const host = mount(h(EmptyState, { message: 'No skills defined' }));
    expect(host.querySelector('.empty-state__msg')?.textContent).toBe('No skills defined');
    expect(host.querySelector('button')).toBeNull();
  });

  it('renders the CTA button and fires onClick', () => {
    const onClick = vi.fn();
    const host = mount(h(EmptyState, { message: 'No skills', cta: { label: '+ Add Skill', onClick } }));
    const btn = host.querySelector('button');
    expect(btn?.textContent).toBe('+ Add Skill');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses role=status so screen readers announce the empty state', () => {
    const host = mount(h(EmptyState, { message: 'No notes' }));
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });
});

describe('EmptyState - Notion-pattern hero form (glyph + title + secondary)', () => {
  it('renders glyph + title + body + primary CTA', () => {
    const host = mount(h(EmptyState, {
      glyph: '🎬',
      title: 'No scenes yet',
      body: 'Start a scene to thread chat into a story beat.',
      cta: { label: 'Start a scene', onClick: () => {} },
    }));
    expect(host.querySelector('.empty-state__glyph').textContent).toBe('🎬');
    expect(host.querySelector('.empty-state__title').textContent).toBe('No scenes yet');
    expect(host.textContent).toContain('Start a scene to thread chat');
    expect(host.querySelector('.empty-state__cta').textContent).toBe('Start a scene');
  });

  it('secondary button is wired and fires its onClick', () => {
    const sec = vi.fn();
    const host = mount(h(EmptyState, {
      title: 'Welcome',
      cta: { label: 'Get started', onClick: () => {} },
      secondary: { label: 'Take the tour', onClick: sec },
    }));
    const secondary = host.querySelector('.empty-state__secondary');
    expect(secondary).not.toBeNull();
    secondary.click();
    expect(sec).toHaveBeenCalledOnce();
  });

  it('renders with only a glyph + title (no body, no CTA)', () => {
    const host = mount(h(EmptyState, { glyph: '✨', title: 'Quiet here' }));
    expect(host.querySelector('.empty-state__glyph').textContent).toBe('✨');
    expect(host.querySelector('.empty-state__title').textContent).toBe('Quiet here');
    expect(host.querySelector('button')).toBeNull();
  });
});

describe('emptyStateHtml string helper', () => {
  it('renders the message only when no CTA', () => {
    const html = emptyStateHtml('No skills defined');
    expect(html).toMatch(/No skills defined/);
    expect(html).not.toMatch(/<button/);
  });

  it('renders a CTA button with data-empty-cta action attribute', () => {
    const html = emptyStateHtml('No skills', { label: '+ Add Skill', action: 'add-skill' });
    expect(html).toMatch(/<button[^>]*data-empty-cta="add-skill"[^>]*>\+ Add Skill<\/button>/);
  });

  it('escapes user-provided strings', () => {
    const html = emptyStateHtml('<script>x</script>', { label: '"evil"', action: '<x>' });
    expect(html).not.toMatch(/<script>/);
    expect(html).toMatch(/&quot;evil&quot;/);
    expect(html).toMatch(/data-empty-cta="&lt;x&gt;"/);
  });
});
