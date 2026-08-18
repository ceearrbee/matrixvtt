import { defineConfig } from 'vite';
import { resolve } from 'path';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';
import preact from '@preact/preset-vite';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

const LOG_FILE = resolve(__dirname, 'vtt-dev.log');
const MANUAL_CHUNKS = [
  ['matrix-widget', ['@matrix-widget-toolkit/api', 'matrix-widget-api']],
  ['matrix-sdk', ['matrix-js-sdk', 'matrix-events-sdk', 'oidc-client-ts', 'sdp-transform', 'loglevel', 'jwt-decode', 'base-x', 'bs58', 'unhomoglyph', '@babel/runtime']],
  ['rxjs', ['rxjs']],
  ['konva', ['konva']],
  ['preact', ['preact', '@preact/signals', 'preact/hooks', 'preact/compat']],
  ['sonner', ['sonner']],
  ['marked', ['marked']],
  ['fuse', ['fuse.js']],
  ['driver', ['driver.js']],
  ['dnd-kit', ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']],
  ['tinykeys', ['tinykeys']],
  ['focus-trap', ['focus-trap']],
  ['p-retry', ['p-retry']],
  ['valibot', ['valibot']],
  ['dompurify', ['dompurify']],
  ['idb-keyval', ['idb-keyval']],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHUNK_GROUPS = MANUAL_CHUNKS.map(([name, packages]) => ({
  name,
  test: new RegExp(packages.map((p) => `/node_modules/${escapeRe(p)}/`).join('|')),
}));

// Custom plugin for remote logging from browser
function remoteLoggingPlugin() {
  return {
    name: 'remote-logging',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && req.url === '/log') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const logData = JSON.parse(body);
              handleLogMessage(logData);
            } catch (error) {
              console.error('[LOG] Failed to parse log message:', error);
            }
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: true }));
          });
        } else {
          next();
        }
      });
    }
  };
}

function handleLogMessage(logData) {
  const { level, prefix, message, args } = logData;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  // Plain-text line for the log file (no ANSI codes). Errors arrive
  // pre-unpacked by remoteLogger as `{ __error: true, name, message, stack }`;
  // render the message + first stack frame inline so failures don't show
  // up as opaque `{}`.
  const renderArg = (a) => {
    if (a && typeof a === 'object' && a.__error) {
      const firstFrame = (a.stack || '').split('\n')[1]?.trim() ?? '';
      return `${a.name || 'Error'}: ${a.message || '(no message)'}` +
             (firstFrame ? ` ${firstFrame}` : '');
    }
    return typeof a === 'object' ? JSON.stringify(a) : String(a);
  };
  const argsPlain = (args && args.length > 0)
    ? ' ' + args.map(renderArg).join(' ')
    : '';
  try {
    appendFileSync(LOG_FILE, `${timestamp} [${level.toUpperCase()}] ${prefix} ${message}${argsPlain}\n`);
  } catch (err) {
    console.error(`[Vite] Failed to write to ${LOG_FILE}:`, err.message);
  }
}

/**
 * Injects `<meta name="build-version" content="…">` into every
 * entry HTML at build time. Bug reports from end users can include
 * the meta tag's value so triage knows exactly which build is
 * affected, without needing to dig into Settings → diagnostics.
 */
function buildVersionMetaPlugin() {
  return {
    name: 'matrixvtt-build-version-meta',
    transformIndexHtml(html) {
      return html.replace(
        /<head>/,
        `<head>\n  <meta name="build-version" content="${pkg.version}">`,
      );
    },
  };
}

/**
 * Dev-only: widen the CSP meta tag so the local design-preview helper at
 * http://localhost:8400 can load its client script and be reached over
 * fetch. `apply: 'serve'` means this never runs for `vite build`, so the
 * committed HTML and the production CSP stay clean.
 */
function liveCspDevPlugin() {
  const ORIGIN = 'http://localhost:8400';
  return {
    name: 'matrixvtt-live-csp-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace(
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
          `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${ORIGIN}`,
        )
        .replace(
          "connect-src 'self' https: wss:",
          `connect-src 'self' https: wss: ${ORIGIN}`,
        );
    },
  };
}

/**
 * Substitute deploy placeholders in the static metadata copied from
 * `public/` into `dist/`: `__BUILD_VERSION__` (sw.js cache key, so
 * every deploy invalidates the previous shell cache automatically),
 * `__BASE_URL__` (the Vite base, so PWA/crawler paths track own-domain
 * deploys made through scripts/package.sh), and `__SITE_ORIGIN__`
 * (absolute URLs for robots.txt and sitemap.xml).
 *
 * Runs at `writeBundle` (after Vite has copied public/ into dist/)
 * so the files are rewritten in place; public/ keeps the placeholders
 * and dev serves them verbatim, which is harmless because the SW
 * self-destructs on localhost and crawlers never see a dev server.
 */
function deployMetaPlugin() {
  const rawBase = process.env.VITE_BASE || '/matrixvtt/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const origin = (process.env.SITE_ORIGIN || 'https://ceearrbee.github.io').replace(/\/$/, '');
  const files = ['sw.js', 'manifest.json', 'robots.txt', 'sitemap.xml', '404.html'];
  return {
    name: 'matrixvtt-deploy-meta',
    writeBundle({ dir }) {
      for (const file of files) {
        const path = resolve(dir || 'dist', file);
        if (!existsSync(path)) continue;
        const src = readFileSync(path, 'utf8');
        const next = src
          .replaceAll('__BUILD_VERSION__', pkg.version)
          .replaceAll('__SITE_ORIGIN__', origin)
          .replaceAll('__BASE_URL__', base);
        if (next !== src) writeFileSync(path, next);
      }
    },
  };
}

/**
 * Emit a `health.json` into the built `dist/` so external monitors
 * (uptime checks, GitHub Actions post-deploy verification, etc.) can
 * fetch a deterministic non-HTML response that confirms the deploy
 * is alive and report which version they're hitting.
 */
function healthJsonPlugin() {
  return {
    name: 'matrixvtt-health-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'health.json',
        source: JSON.stringify({
          status: 'ok',
          name: pkg.name,
          version: pkg.version,
          built_at: new Date().toISOString(),
        }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    preact(),
    basicSsl(),
    remoteLoggingPlugin(),
    liveCspDevPlugin(),
    buildVersionMetaPlugin(),
    healthJsonPlugin(),
    deployMetaPlugin(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Default to /matrixvtt/ for the GitHub Pages project-page deploy.
  // Override with VITE_BASE=/ for a root-domain deploy or VITE_BASE=/foo/
  // for a different subpath without forking the config.
  base: process.env.VITE_BASE || '/matrixvtt/',

  resolve: {
    alias: {
      // React-targeted libraries (sonner today; @radix-ui/* later) resolve
      // to preact/compat so we don't ship two virtual DOMs.
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
      // In production, replace dev-only utilities with no-ops to ensure they are excluded from the bundle
      ...(process.env.NODE_ENV === 'production' ? {
        './utils/remoteLogger.js': resolve(__dirname, 'src/utils/no-op.js'),
        'src/remote-logger.js': resolve(__dirname, 'src/utils/no-op.js'),
        'src/matrix-widget-stub.js': resolve(__dirname, 'src/utils/no-op.js')
      } : {})
    }
  },

  build: {
    // Output to dist/
    outDir: 'dist',

    // Source maps in production too - the codebase is OSS on GitHub
    // so there's no source to "expose," and maps make production
    // stack traces in bug reports actionable. If a deploy needs to
    // hide them from DevTools, switch to 'hidden' (still generated,
    // not referenced from the bundles).
    sourcemap: true,

    // Optimize for production. esbuild minification (vs terser) tolerates
    // non-ASCII identifiers in matrix-js-sdk's pre-minified crypto chunk;
    // terser rejects them with "Unexpected character 'ࢶ'".
    minify: 'esbuild',

    rollupOptions: {
      input: {
        widget: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html')
      },
      output: {
        // Split the heavy npm-source libraries into their own chunks so
        // they cache independently of the app code. Rolldown (Vite 8)
        // ignores rollupOptions' manualChunks function; codeSplitting
        // groups are its equivalent.
        codeSplitting: { groups: CHUNK_GROUPS }
      }
    }
  },

  server: {
    // Vite dev server configuration
    port: 5173,
    strictPort: false,

    // HTTPS enabled via basicSsl plugin

    // CORS headers for widget embedding
    cors: true,

    // Explicit HMR config so the WebSocket URL is deterministic inside an iframe.
    // Without this, Vite infers the URL from window.location which can fail when
    // the widget is embedded by Element Web.
//    hmr: {
//      protocol: 'wss',
//      host: 'localhost',
//      port: 5173,
//      clientPort: 5173
//    },

    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  },

  preview: {
    // Preview server for testing production build
    port: 4173,
    strictPort: false,
    // HTTPS enabled via basicSsl plugin
    cors: true
  }
});
