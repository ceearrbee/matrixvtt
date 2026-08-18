/**
 * Lock-in: `showTokenForm` builds its modal via `innerHTML`, interpolating
 * Matrix-backed token fields (name, color, image_url, aura_color) into
 * attribute contexts. Every persisted-user-data interpolation must route
 * through `esc()` so a token with quote- or tag-shaped values can't break
 * out of the attribute and inject markup.
 *
 * Finding 8 of `fix.md` flagged `src/ui/tokens-panel.js:28-38` specifically;
 * this test asserts the resulting DOM stays inert for adversarial inputs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showTokenForm } from '../ui/tokens-panel.js';

function mkUi(token) {
  return {
    state: {
      isGM: () => true,
      tokens: new Map([[token.id, token]]),
      canEditEntity: () => true,
      getCurrentCharacterId: () => null,
      getCurrentCharacter: () => null,
      settings: { systemConfig: null },
    },
    widgetManager: { userId: '@me:s' },
    _toast: vi.fn(),
  };
}

describe('showTokenForm - attribute-context escape', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('XSS-shaped name does not inject a <script> tag', () => {
    const token = {
      id: 'tok-1', name: '"><script>alert(1)</script>',
      type: 'npc', size: 1, hp_current: 10, hp_max: 10, ac: 10,
      col: 3, row: 3, color: '#185FA5', image_url: null, aura_radius: 0,
    };
    showTokenForm(mkUi(token), 'tok-1');
    const modal = document.getElementById('token-form-modal');
    expect(modal).toBeTruthy();
    expect(modal.querySelectorAll('script')).toHaveLength(0);
    const nameInput = modal.querySelector('#token-name');
    expect(nameInput.value).toBe('"><script>alert(1)</script>');
  });

  it('XSS-shaped image_url does not break out of the value attribute', () => {
    const token = {
      id: 'tok-2', name: 'Goblin',
      type: 'npc', size: 1, hp_current: 10, hp_max: 10, ac: 10,
      col: 3, row: 3, color: '#185FA5',
      image_url: '"><img src=x onerror=alert(1)>',
      aura_radius: 0,
    };
    showTokenForm(mkUi(token), 'tok-2');
    const modal = document.getElementById('token-form-modal');
    expect(modal.querySelectorAll('img[onerror]')).toHaveLength(0);
    for (const el of modal.querySelectorAll('*')) {
      for (const attr of el.attributes ?? []) {
        expect(attr.name).not.toMatch(/^on/);
      }
    }
  });

  it('XSS-shaped color does not escape the hidden input attribute', () => {
    const token = {
      id: 'tok-3', name: 'Goblin',
      type: 'npc', size: 1, hp_current: 10, hp_max: 10, ac: 10,
      col: 3, row: 3, color: '"><svg/onload=alert(1)>',
      image_url: null, aura_radius: 0,
    };
    showTokenForm(mkUi(token), 'tok-3');
    const modal = document.getElementById('token-form-modal');
    expect(modal.querySelectorAll('svg')).toHaveLength(0);
    const hidden = modal.querySelector('#token-color');
    expect(hidden.value).toBe('"><svg/onload=alert(1)>');
  });

  it('XSS-shaped aura_color does not inject markup', () => {
    const token = {
      id: 'tok-4', name: 'Goblin',
      type: 'npc', size: 1, hp_current: 10, hp_max: 10, ac: 10,
      col: 3, row: 3, color: '#185FA5', image_url: null,
      aura_radius: 2, aura_color: '"><script>x</script>',
    };
    showTokenForm(mkUi(token), 'tok-4');
    const modal = document.getElementById('token-form-modal');
    expect(modal.querySelectorAll('script')).toHaveLength(0);
  });
});
