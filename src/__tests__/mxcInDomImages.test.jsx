/**
 * Every DOM <img> that can be handed an entity portrait must resolve
 * mxc:// first. These all passed the raw URI into `src`, so an uploaded
 * portrait was invisible everywhere outside the Konva canvas.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/preact';
import { h } from 'preact';
import { Avatar } from '../ui/Avatar.jsx';
import { PortraitUploader } from '../ui/token-form/PortraitUploader.jsx';
import { PortraitField } from '../ui/entity-form/PortraitField.jsx';
import { homeserverSignal } from '../state/ui-signals.js';

const MXC = 'mxc://hs.example/abc123';
const RESOLVED = 'https://hs.example/_matrix/media/v3/download/hs.example/abc123';

beforeEach(() => { homeserverSignal.value = 'https://hs.example'; });
afterEach(() => { homeserverSignal.value = null; });

describe('Avatar', () => {
  it('resolves an mxc portrait', () => {
    const { container } = render(h(Avatar, { imageUrl: MXC, name: 'Aria' }));
    expect(container.querySelector('img').getAttribute('src')).toBe(RESOLVED);
  });

  it('leaves an https portrait alone', () => {
    const { container } = render(h(Avatar, { imageUrl: 'https://cdn.example/a.png', name: 'Aria' }));
    expect(container.querySelector('img').getAttribute('src')).toBe('https://cdn.example/a.png');
  });

  it('still falls back to a monogram with no portrait', () => {
    const { container } = render(h(Avatar, { imageUrl: null, name: 'Aria Blackwood' }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('AB');
  });
});

describe('token portrait preview', () => {
  it('resolves an mxc portrait', () => {
    const { container } = render(h(PortraitUploader, {
      ui: { widgetManager: { canUploadMedia: true } },
      portraitUrl: MXC,
      setPortraitUrl: () => {},
      onPortraitFile: () => {},
    }));
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(RESOLVED);
  });
});

describe('entity portrait field', () => {
  it('resolves an mxc portrait', () => {
    const { container } = render(h(PortraitField, { initial: MXC }));
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(RESOLVED);
  });
});
