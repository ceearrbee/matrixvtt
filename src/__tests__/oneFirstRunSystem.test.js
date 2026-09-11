/**
 * One first-run system, not seven. The 12-step spotlight tour fired on
 * a freshly-blank room, so its map and token steps described an empty
 * canvas; steps whose selectors were unmounted were silently dropped;
 * and it had already broken once against a deleted shell. The player
 * welcome, the map help card and the suggested-mode banner overlapped
 * it. The NextSteps checklist is what remains.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

describe('the spotlight tour is gone', () => {
  it('takes its modules with it', () => {
    for (const f of ['src/ui/onboarding-tour.js', 'src/ui/onboarding-tour.css', 'src/ui/tour-runtime.js']) {
      expect(exists(f), f).toBe(false);
    }
  });

  it('drops the driver.js dependency it existed for', () => {
    const pkg = JSON.parse(read('package.json'));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('driver.js');
  });

  it('leaves no restart entry point behind', () => {
    for (const f of [
      'src/ui/global-menu-items.js',
      'src/ui/Settings.jsx',
      'src/ui/keyboard-help.js',
      'src/ui/gm/panels/ImportExportPanel.jsx',
      'src/ui/render-policy.js',
      'src/ui/SetupWizard.jsx',
      'src/ui/setup/save-flow.js',
    ]) {
      expect(read(f), f).not.toMatch(/onboarding-tour|OnboardingTour|restart.?tour/i);
    }
  });
});

describe('the overlapping first-run surfaces are gone', () => {
  it('drops the player welcome modal', () => {
    expect(read('src/ui/WelcomeModals.jsx')).not.toMatch(/PlayerWelcome/);
    expect(read('src/ui/first-time-setup.js')).not.toMatch(/showPlayerWelcome/);
  });

  it('drops the dismissible map help card', () => {
    const src = read('src/ui/MapStrip.jsx');
    expect(src).not.toMatch(/MapHelp|HIDE_MAP_HELP/);
  });

  it('drops the suggested-mode chain, whose only broadcaster was retired', () => {
    expect(exists('src/ui/SuggestedModeBanner.jsx')).toBe(false);
    expect(read('src/state/writers/session-writers.js')).not.toMatch(/broadcastSuggestedMode/);
    expect(read('src/state/syncer.js')).not.toMatch(/suggestedMode/);
  });
});
