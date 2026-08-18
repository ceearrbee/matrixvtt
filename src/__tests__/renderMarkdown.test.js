/**
 * renderMarkdown - lightweight Markdown → HTML for handout display
 *
 * Supports: headings (# / ## / ###), bold (**), italic (*),
 * unordered lists (- / *), horizontal rules (---), paragraphs,
 * and inline line breaks. All input is HTML-escaped before processing.
 */

import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../utils/renderMarkdown.js';

describe('renderMarkdown', () => {
  it('renders # as <h1>', () => {
    expect(renderMarkdown('# Hello')).toContain('<h1>Hello</h1>');
  });

  it('renders ## as <h2>', () => {
    expect(renderMarkdown('## Sub')).toContain('<h2>Sub</h2>');
  });

  it('renders ### as <h3>', () => {
    expect(renderMarkdown('### Small')).toContain('<h3>Small</h3>');
  });

  it('renders **text** as <strong>', () => {
    expect(renderMarkdown('This is **bold** text')).toContain('<strong>bold</strong>');
  });

  it('renders *text* as <em>', () => {
    expect(renderMarkdown('This is *italic* text')).toContain('<em>italic</em>');
  });

  it('renders - list items as <ul><li>', () => {
    const html = renderMarkdown('- Apples\n- Oranges');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Apples</li>');
    expect(html).toContain('<li>Oranges</li>');
  });

  it('renders --- as <hr>', () => {
    // micromark emits self-closing <hr />; both browsers parse identically.
    expect(renderMarkdown('---')).toMatch(/<hr\s*\/?>/);
  });

  it('wraps plain paragraphs in <p>', () => {
    const html = renderMarkdown('Hello world');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('escapes HTML in input (XSS protection)', () => {
    const html = renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('strips javascript: link targets (DOMPurify layer)', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('strips event handlers and scripts DOMPurify is given directly', async () => {
    // Canary for the sanitizer itself: dompurify 3.4.8-3.4.11 pass
    // markup through nearly untouched. Pin stays at 3.4.3 until a
    // release makes this pass again.
    const { default: DOMPurify } = await import('dompurify');
    expect(DOMPurify.sanitize('<p>hi</p><img src=x onerror=alert(1)>')).not.toContain('onerror');
    expect(DOMPurify.sanitize('a <b>b</b> <script>alert(1)</script>')).not.toContain('<script>');
  });

  it('double newlines create separate paragraphs', () => {
    const html = renderMarkdown('First\n\nSecond');
    expect(html).toContain('<p>First</p>');
    expect(html).toContain('<p>Second</p>');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});
