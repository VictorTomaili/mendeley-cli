/**
 * Regression tests for CLI input validation:
 *   - #191: `files add-highlight` must reject missing/invalid --positions
 *   - #192: `folders update` must require --name
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));

function createEnv(host) {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-val-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({ clientId: 'CLIENT_ID', redirectUri: 'http://localhost:1', host }),
  );
  writeFileSync(
    join(root, 'token.json'),
    JSON.stringify({ access_token: 'T', refresh_token: 'R', expires_in: 3600 }),
  );
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    MENDELEY_CONFIG: configFile,
    MENDELEY_TOKEN_FILE: join(root, 'token.json'),
  };
}

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timed out: ${args.join(' ')}`));
    }, 10000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.stdin.end();
  });
}

/* ── #191: add-highlight requires --positions ──────────────────────────── */

test('#191: files add-highlight without --positions fails before any network call', async () => {
  const env = createEnv('http://127.0.0.1:1');
  const result = await runCli(['--format', 'json', 'files', 'add-highlight', 'file-1'], env);
  assert.equal(result.code, 1);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /--positions/);
});

test('#191: files add-highlight with an empty positions array fails', async () => {
  const env = createEnv('http://127.0.0.1:1');
  const result = await runCli(
    ['--format', 'json', 'files', 'add-highlight', 'file-1', '--positions', '[]'],
    env,
  );
  assert.equal(result.code, 1);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /non-empty/);
});

test('#191: files add-highlight with a box missing required keys fails', async () => {
  const env = createEnv('http://127.0.0.1:1');
  const result = await runCli(
    ['--format', 'json', 'files', 'add-highlight', 'file-1', '--positions', '[{"page":1}]'],
    env,
  );
  assert.equal(result.code, 1);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /top_left/);
});

/* ── #192: folders update requires --name ──────────────────────────────── */

test('#192: folders update without --name fails before any network call', async () => {
  const env = createEnv('http://127.0.0.1:1');
  const result = await runCli(['--format', 'json', 'folders', 'update', 'folder-1'], env);
  assert.equal(result.code, 1);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /--name/);
});

test('#192: folders update with --name parses past validation (reaches network)', async () => {
  // An unreachable host — we only assert it gets *past* the validation
  // gate and attempts a network call (failure, not a validation refusal).
  const env = createEnv('http://127.0.0.1:1');
  const result = await runCli(
    ['--format', 'json', 'folders', 'update', 'folder-1', '--name', 'New'],
    env,
  );
  assert.notEqual(result.code, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  // Must NOT be the validation message.
  assert.doesNotMatch(out.error, /requires --name/);
});
