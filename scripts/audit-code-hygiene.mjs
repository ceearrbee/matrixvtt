#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const TEXT_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.md', '.mjs', '.cjs']);

const PROHIBITED_COMMENT_PATTERNS = [
  /\bCrucial for\b/i,
  /\bNote that we\b/i,
  /\bThis is important because\b/i,
  /\bHelper function to\b/i,
  /\bHelper to\b/i,
  /\bFor now, (?:we|let's)\b/i,
  /\btemp hack\b/i,
  /\bplaceholder hack\b/i,
  /[=]{5,}|\u2500{5,}/,
];

function scanDir(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      scanDir(full, out);
    } else if (TEXT_EXTS.has(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

const targetDirs = ['src', 'scripts', 'tests']
  .map((d) => resolve(repoRoot, d))
  .filter((d) => {
    try { return statSync(d).isDirectory(); } catch { return false; }
  });

const files = [
  ...targetDirs.flatMap((d) => scanDir(d)),
  resolve(repoRoot, 'index.html'),
  resolve(repoRoot, 'app.html'),
].filter((f) => {
  try { return statSync(f).isFile(); } catch { return false; }
});
let errors = 0;

for (const f of files) {
  const content = readFileSync(f, 'utf8');
  const rel = relative(repoRoot, f);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for em dashes (Unicode U+2014) and en dashes (Unicode U+2013)
    if (rel !== 'src/utils/format.js' && (line.includes('\u2014') || line.includes('\u2013'))) {
      console.error(`[DASH] ${rel}:${idx + 1}: contains dash (\\u2013 or \\u2014)`);
      errors++;
    }

    // Check for obvious AI-ism filler comments and decorative banners
    if (line.includes('//') || line.includes('/*') || line.trim().startsWith('*')) {
      for (const pattern of PROHIBITED_COMMENT_PATTERNS) {
        if (pattern.test(line)) {
          console.error(`[AI COMMENT] ${rel}:${idx + 1}: contains pattern ${pattern}`);
          errors++;
        }
      }
    }
  });
}

if (errors > 0) {
  console.error(`\nFound ${errors} code hygiene violation(s).`);
  process.exit(1);
} else {
  console.log('Code hygiene scan clean: 0 violations.');
}
