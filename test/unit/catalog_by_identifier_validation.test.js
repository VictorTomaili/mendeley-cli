/**
 * Tests for issue #126: catalog by-identifier CLI validation.
 *
 * The CLI help says exactly one identifier flag must be supplied, but
 * neither the CLI nor SDK enforced that rule. Now both layers validate
 * exactly one identifier and emit a clean JSON-mode error before any
 * network call.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));

function createEnv() {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-cat126-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'CLIENT_ID',
      redirectUri: 'http://localhost:11595',
      // Point at a dead port so any stray network call surfaces loudly.
      host: 'http://127.0.0.1:1',
    }),
  );
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: 'A', refresh_token: 'R', expires_in: 3600 }),
  );
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    MENDELEY_CONFIG: configFile,
    MENDELEY_TOKEN_FILE: tokenFile,
  };
  delete env.MENDELEY_CLIENT_ID;
  delete env.MENDELEY_CLIENT_SECRET;
  delete env.MENDELEY_ACCESS_TOKEN;
  delete env.MENDELEY_REFRESH_TOKEN;
  return env;
}

function runCli(args, { env, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end();
  });
}

test('catalog by-identifier with no flags fails with a clean JSON error (#126)', async () => {
  const env = createEnv();
  const result = await runCli(['catalog', 'by-identifier'], { env });
  assert.notEqual(result.code, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /exactly one/i);
  assert.match(out.error, /--doi|--arxiv/i);
});

test('catalog by-identifier with multiple flags fails cleanly (#126)', async () => {
  const env = createEnv();
  const result = await runCli(
    ['catalog', 'by-identifier', '--doi', '10.1/x', '--arxiv', '1706.03762'],
    { env },
  );
  assert.notEqual(result.code, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /exactly one/i);
});

test('catalog by-identifier error does not attempt a network call (#126)', async () => {
  const env = createEnv();
  const result = await runCli(['catalog', 'by-identifier'], { env });
  // The host points at a dead port. If a network call were attempted we
  // would see a "Network request failed" / ECONNREFUSED-style message,
  // not the clean validation error.
  const out = JSON.parse(result.stdout);
  assert.match(out.error, /exactly one/i);
  assert.doesNotMatch(out.error, /Network request failed|fetch failed|ECONNREFUSED/i);
});
