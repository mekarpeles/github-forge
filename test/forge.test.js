'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const forge = require('../forge');

// --- signature verification ------------------------------------------------

test('verify accepts a correct signature', () => {
  const body = Buffer.from('{"a":1}');
  const secret = 's3cret';
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(forge.verify(body, sig, secret), true);
});

test('verify rejects a wrong or missing signature when a secret is set', () => {
  const body = Buffer.from('{"a":1}');
  assert.equal(forge.verify(body, 'sha256=deadbeef', 'sec'), false);
  assert.equal(forge.verify(body, undefined, 'sec'), false);
});

test('verify is open (true) in dev mode with no secret', () => {
  assert.equal(forge.verify(Buffer.from('x'), undefined, ''), true);
});

// --- route resolution ------------------------------------------------------

test('resolve prefers an exact event.action route over the bare event', () => {
  const routes = [
    { on: 'pull_request', run: 'jobs/log.js' },
    { on: 'pull_request.opened', run: 'jobs/log.js' },
  ];
  const hit = forge.resolve(routes, 'pull_request', 'opened');
  assert.ok(hit && hit.file.endsWith(path.join('jobs', 'log.js')));
});

test('resolve falls back to a bare event route', () => {
  const hit = forge.resolve([{ on: 'issues', run: 'jobs/log.js' }], 'issues', 'labeled');
  assert.ok(hit && hit.file.endsWith(path.join('jobs', 'log.js')));
});

test('resolve passes the route config through', () => {
  const routes = [{ on: 'issues.assigned', run: 'jobs/log.js', config: { assignee: 'bot' } }];
  const hit = forge.resolve(routes, 'issues', 'assigned');
  assert.deepEqual(hit.config, { assignee: 'bot' });
});

test('resolve returns null when nothing matches', () => {
  assert.equal(forge.resolve([], 'nonsense', 'nope'), null);
});

// --- config loading --------------------------------------------------------

test('config loads YAML, interpolates ${ENV}, and lets FORGE_REPO override', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-'));
  const cfgPath = path.join(dir, 'forge.yml');
  fs.writeFileSync(cfgPath, 'repo: ${MY_REPO}\nevents: [issues, pull_request]\nroutes: []\n');

  process.env.FORGE_CONFIG = cfgPath;
  process.env.MY_REPO = 'owner/name';
  delete require.cache[require.resolve('../config')];
  const { load } = require('../config');

  const cfg = load();
  assert.equal(cfg.repo, 'owner/name');
  assert.deepEqual(cfg.events, ['issues', 'pull_request']);

  process.env.FORGE_REPO = 'override/repo';
  assert.equal(load().repo, 'override/repo');

  delete process.env.FORGE_CONFIG;
  delete process.env.FORGE_REPO;
  delete process.env.MY_REPO;
});

// --- end-to-end: a signed delivery runs its job ---------------------------

test('a signed delivery is accepted and dispatched (e2e)', async () => {
  const secret = 'e2e-secret';
  process.env.FORGE_SECRET = secret; // createServer's handler uses the default
  // fresh forge + fresh config (so it reads the repo's real forge.yml)
  delete require.cache[require.resolve('../forge')];
  delete require.cache[require.resolve('../config')];
  const f = require('../forge');

  const server = f.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const body = JSON.stringify({
    action: 'opened',
    repository: { full_name: 'you/repo' },
    sender: { login: 'octocat' },
    pull_request: { number: 7, title: 'hello' },
  });
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: 'POST', headers: {
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': sig,
        'Content-Type': 'application/json',
      } },
      (res) => resolve(res.statusCode)
    );
    req.on('error', reject);
    req.end(body);
  });
  assert.equal(status, 200);

  // a bad signature is rejected
  const bad = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: 'POST', headers: {
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': 'sha256=bad',
        'Content-Type': 'application/json',
      } },
      (res) => resolve(res.statusCode)
    );
    req.on('error', reject);
    req.end(body);
  });
  assert.equal(bad, 401);

  await new Promise((r) => server.close(r));
  delete process.env.FORGE_SECRET;
});
