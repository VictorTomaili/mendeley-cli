/**
 * Tests for issue #118: add-sticky-note flag consistency.
 *
 * `files add-sticky-note` previously used only --text/--xpos/--ypos/--page,
 * while `files add-highlight` used --positions/--color. The API uses the
 * same `positions` array model for both, so the asymmetry was surprising.
 *
 * Now (#118): add-sticky-note also accepts --positions <json> and
 * --color <json>, matching add-highlight. The --xpos/--ypos/--page
 * flags remain as a convenience that builds a single-point positions
 * array when --positions is absent.
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
  const root = mkdtempSync(join(tmpdir(), 'mendeley-sticky-'));
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

test('add-sticky-note --help documents --positions and --color (#118)', async () => {
  const env = createEnv();
  const result = await runCli(['files', 'add-sticky-note', '--help'], { env });
  const output = result.stdout + result.stderr;
  assert.match(output, /--positions/);
  assert.match(output, /--color/);
  // The convenience flags are still there.
  assert.match(output, /--xpos/);
  assert.match(output, /--ypos/);
  assert.match(output, /--page/);
  assert.match(output, /--text/);
});

test('add-sticky-note and add-highlight share the same --positions description', async () => {
  const env = createEnv();
  const sticky = await runCli(['files', 'add-sticky-note', '--help'], { env });
  const highlight = await runCli(['files', 'add-highlight', '--help'], { env });
  const stickyPos = (sticky.stdout + sticky.stderr).match(/--positions <json>\s+(.+)$/m);
  const hlPos = (highlight.stdout + highlight.stderr).match(/--positions <json>\s+(.+)$/m);
  assert.ok(stickyPos, 'add-sticky-note must document --positions');
  assert.ok(hlPos, 'add-highlight must document --positions');
  // Both should mention "bounding boxes".
  assert.match(stickyPos[1], /bounding boxes/i);
  assert.match(hlPos[1], /bounding boxes/i);
});

test('add-sticky-note rejects when neither --positions nor all of --xpos/--ypos/--page is given', async () => {
  const env = createEnv();
  // Only --text, no coordinates of either kind.
  const result = await runCli(['files', 'add-sticky-note', 'file-x', '--text', 'hi'], { env });
  assert.equal(result.code, 1);
  const output = result.stdout + result.stderr;
  assert.match(output, /--positions|--xpos|--ypos|--page/i);
});
