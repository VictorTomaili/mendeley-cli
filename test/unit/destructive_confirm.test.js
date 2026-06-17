/**
 * Regression tests for destructive-action confirmation (issue #188).
 *
 * Irreversible delete commands (documents, files, folders, annotations,
 * trash) must require `--yes` and refuse with exit code 2 before any
 * network call.  This prevents accidental data loss.
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

function createEnv(host) {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-destructive-'));
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
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      MENDELEY_CONFIG: configFile,
      MENDELEY_TOKEN_FILE: join(root, 'token.json'),
    },
  };
}

function runCli(args, { env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: env.env,
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

const commands = [
  ['documents', 'delete', 'id-1'],
  ['files', 'delete', 'id-1'],
  ['folders', 'delete', 'id-1'],
  ['annotations', 'delete', 'id-1'],
  ['trash', 'delete', 'id-1'],
];

for (const [group, sub, id] of commands) {
  test(`${group} ${sub} refuses without --yes (JSON envelope, exit 2)`, async () => {
    // Point at an unreachable host; if the refusal works, no request fires.
    const { env } = createEnv('http://127.0.0.1:1');
    const result = await runCli(['--format', 'json', group, sub, id], { env });
    assert.equal(result.code, 2, `expected exit 2, got ${result.code}`);
    const out = JSON.parse(result.stdout);
    assert.equal(out.ok, false);
    assert.match(out.error, /without --yes/);
  });

  test(`${group} ${sub} refuses without --yes (text error to stderr, exit 2)`, async () => {
    const { env } = createEnv('http://127.0.0.1:1');
    const result = await runCli([group, sub, id], { env });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /^error: .* --yes/);
    assert.equal(result.stdout, '');
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
