#!/usr/bin/env node
'use strict';

/*
 * forge — run local "actions" in response to GitHub webhooks.
 *
 * It listens on localhost, verifies each delivery's signature, and runs the
 * job wired to that event in forge.yml. Config and jobs are reloaded on every
 * delivery, so you can edit either and the next event picks up the change.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { load } = require('./config');

const PORT = parseInt(process.env.FORGE_PORT || '3000', 10);
const SECRET = process.env.FORGE_SECRET || '';
const ROOT = __dirname;

function log(...a) {
  console.log(`[${new Date().toISOString()}]`, ...a);
}

// GitHub signs the raw body (HMAC-SHA256) as `X-Hub-Signature-256`. With no
// secret we run in open dev mode; with one set, bad/unsigned deliveries are 401.
function verify(raw, sig) {
  if (!SECRET) return true;
  if (!sig) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The object every job receives.
function makeContext(event, action, payload, config) {
  const run = (cmd, args = []) =>
    new Promise((resolve) => {
      execFile(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) =>
        resolve({ code: err ? err.code || 1 : 0, stdout, stderr })
      );
    });

  return {
    event,
    action,
    payload,
    config: config || {}, // this route's `config:` block from forge.yml
    repo: payload.repository && payload.repository.full_name,
    sender: payload.sender && payload.sender.login,
    log: (...a) => log('  ↳', ...a),
    run, // run any local command
    gh: (args) => run('gh', args), // act back on GitHub
  };
}

// Resolve a handler for an event/action: a forge.yml route first (exact
// "event.action", then bare "event"), else the jobs/<event>.<action>.js
// filename convention.
function resolve(routes, event, action) {
  const key = action ? `${event}.${action}` : event;
  const route = routes.find((r) => r.on === key) || routes.find((r) => r.on === event);
  const files = route
    ? [route.run]
    : [path.join('jobs', `${key}.js`), path.join('jobs', `${event}.js`)];
  for (const rel of files) {
    const p = path.join(ROOT, rel);
    if (rel && fs.existsSync(p)) return { file: p, config: route && route.config };
  }
  return null;
}

async function dispatch(event, action, payload) {
  const key = action ? `${event}.${action}` : event;
  const hit = resolve(load().routes, event, action);
  if (!hit) {
    log(`• ${key} — no route, ignored`);
    return;
  }
  log(`▶ ${key} — ${path.relative(ROOT, hit.file)}`);
  try {
    delete require.cache[require.resolve(hit.file)]; // hot reload
    const job = require(hit.file);
    await job(makeContext(event, action, payload, hit.config));
    log(`✓ ${key} — done`);
  } catch (err) {
    log(`✗ ${key} — ${err.stack || err}`);
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (!verify(raw, req.headers['x-hub-signature-256'])) {
      log('✗ signature verification failed — rejected');
      res.writeHead(401).end('bad signature');
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8') || '{}');
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    // Ack immediately, then run the job, so a slow job never trips the timeout.
    res.writeHead(200).end('ok');
    dispatch(req.headers['x-github-event'] || 'unknown', payload.action, payload);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`forge listening on http://127.0.0.1:${PORT}`);
  log(SECRET ? 'signature verification: ON' : 'signature verification: OFF (no FORGE_SECRET)');
});
