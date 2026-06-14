/**
 * Tests for issue #14: missing flag values leak raw V8/Node internal errors.
 *
 * Value-options (--file, --data) that require an argument but receive none
 * should produce a clean CLI error, not a raw fs/V8 internal error.
 * Invalid JSON should produce a clean error, not a raw SyntaxError.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJson } from '../../lib/cli/output.js';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));

/* ── Unit tests for parseJson helper ────────────────────────────── */

test('parseJson returns parsed value for valid JSON', () => {
  assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJson('[1,2,3]'), [1, 2, 3]);
  assert.equal(parseJson('42'), 42);
});

test('parseJson throws clean error for invalid JSON', () => {
  assert.throws(() => parseJson('invalid json'), /is not valid JSON/);
});

test('parseJson uses custom flag name in error', () => {
  assert.throws(() => parseJson('{bad', '--file'), /--file is not valid JSON/);
});

/* ── CLI tests: missing flag values ─────────────────────────────── */

function createEnv() {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-flags-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'CLIENT_ID',
      redirectUri: 'http://localhost:11595',
      host: 'http://127.0.0.1:1',
    }),
  );
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: 'ACCESS_TOKEN', refresh_token: 'REFRESH', expires_in: 3600 }),
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

function runCli(args, { env }) {
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
    }, 10000);
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

test('--file with no value produces a clean CLI error (#14)', async () => {
  const env = createEnv();
  const result = await runCli(['documents', 'create', '--file'], { env });
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /--file requires a <path> argument/);
  // Must NOT contain a raw Node fs internal error.
  assert.doesNotMatch(output, /path.*argument must be of type string/i);
});

test('--data with no value produces a clean CLI error (#14)', async () => {
  const env = createEnv();
  const result = await runCli(['documents', 'create', '--data'], { env });
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /--data requires a <json> argument/);
});

test('invalid JSON in --data produces a clean CLI error (#14)', async () => {
  const env = createEnv();
  const result = await runCli(['documents', 'create', '--data', 'not json'], { env });
  assert.notEqual(result.code, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /not valid JSON/);
  // Must NOT contain a raw V8 SyntaxError stack.
  assert.doesNotMatch(output, /SyntaxError: Unexpected token/);
});
