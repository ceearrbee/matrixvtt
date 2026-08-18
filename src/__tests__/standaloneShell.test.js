import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

describe('standalone shell markup', () => {
  it('uses a unique standalone skip target instead of duplicating main-content', () => {
    const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');

    expect(appHtml).toContain('href="#vtt-root-anchor"');
    expect(appHtml).toContain('id="vtt-root-anchor"');
    expect(appHtml).not.toContain('id="main-content" tabindex="-1"');
  });

  it('keeps main-content reserved for the rendered VTT main landmark', () => {
    const mapShell = fs.readFileSync(path.join(ROOT, 'src/ui/MapStrip.jsx'), 'utf8');

    expect(mapShell).toMatch(/id:\s*['"]main-content['"]|id="main-content"/);
  });

  it('stores auth in sessionStorage and keeps recent sessions metadata-only in localStorage', () => {
    const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
    const sessionStore = fs.readFileSync(path.join(ROOT, 'src/standalone/sessionStore.js'), 'utf8');

    expect(appHtml).toContain("import { bootstrapStandaloneApp } from '/src/standalone/bootstrap.js'");
    expect(sessionStore).toContain("const AUTH_SESSION_KEY = STORAGE_KEYS.AUTH_SESSION;");
    expect(sessionStore).toContain('storage.setItem(AUTH_SESSION_KEY');
    expect(sessionStore).toContain('const storedEntry = {');
    expect(sessionStore).not.toContain('accessToken: entry.accessToken');
  });
});
