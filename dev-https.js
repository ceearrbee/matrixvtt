#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8443;
const HOST = 'localhost';

// Paths for certificate files
const CERT_DIR = path.join(__dirname, '.ssl');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

/**
 * Generate self-signed certificate using OpenSSL
 */
function generateCertificate() {

  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR);
  }

  // Generate self-signed certificate valid for 365 days
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes ` +
      `-keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 ` +
      `-subj "/C=US/ST=Dev/L=Dev/O=MatrixVTT/CN=localhost"`,
      { stdio: 'inherit' }
    );
  } catch {
    console.error('[HTTPS] Failed to generate certificate. Make sure OpenSSL is installed.');
    console.error('[HTTPS] Install with: sudo apt install openssl (Linux) or brew install openssl (Mac)');
    process.exit(1);
  }
}

/**
 * Ensure certificate exists
 */
function ensureCertificate() {
  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
    generateCertificate();
  }
}

/**
 * Get MIME type for file
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Serve static files
 */
function serveStaticFile(req, res) {
  let filePath = req.url === '/' ? '/index-production.html' : req.url;

  filePath = filePath.split('?')[0];

  // Construct absolute path
  const absolutePath = path.join(__dirname, filePath);

  // Security check: ensure path is within project directory
  if (!absolutePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Read and serve file
    fs.readFile(absolutePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        console.error(`[500] ${req.url}:`, err);
        return;
      }

      const mimeType = getMimeType(absolutePath);

      // For HTML files, inject cache-busting timestamp
      let responseData = data;
      if (mimeType === 'text/html') {
        const timestamp = Date.now();
        responseData = data.toString()
          .replace(/src="([^"]+\.js)"/g, `src="$1?v=${timestamp}"`)
          .replace(/src='([^']+\.js)'/g, `src='$1?v=${timestamp}'`);
      }

      // Set CORS headers for widget embedding with aggressive cache-busting
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.end(responseData);
    });
  });
}

/**
 * Handle log message from widget
 */
function handleLogMessage(logData) {
  const { prefix, message, args } = logData;

  const timestamp = new Date().toISOString().substr(11, 12);

  // Also write to log file
  const logFilePath = path.join(__dirname, 'widget.log');
  const plainTextLog = `${timestamp} [${prefix}] ${message}${args && args.length > 0 ? ' ' + JSON.stringify(args) : ''}\n`;
  fs.appendFileSync(logFilePath, plainTextLog);
}

/**
 * Start HTTPS server
 */
function startServer() {
  ensureCertificate();

  const options = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
  };

  const server = https.createServer(options, (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

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
      return;
    }

    serveStaticFile(req, res);
  });

  server.listen(PORT, HOST, () => {
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${PORT} is already in use`);
      console.error(`        Try: lsof -ti:${PORT} | xargs kill`);
    } else {
      console.error('[ERROR]', error);
    }
    process.exit(1);
  });
}

process.on('SIGINT', () => {
  process.exit(0);
});

startServer();
