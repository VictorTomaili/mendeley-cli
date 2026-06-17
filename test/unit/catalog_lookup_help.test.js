/**
 * Regression test for #138: `catalog lookup` help described the
 * confidence score as "between 0 and 1", but the public Mendeley API
 * defines 100 as very confident (i.e. the score is on a 0–100 scale).
 * Automation that thresholds lookup quality was using the wrong scale.
 *
 * The fix documents the 0–100 scale in the command's long help.
 * This test spawns the CLI and asserts the help output reflects it.
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
  const root = mkdtempSync(join(tmpdir(), 'mendeley-catalog-help-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(configFile, JSON.stringify({ clientId: 'C', redirectUri: 'http://localhost:1' }));
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: 'A', refresh_token: 'R', expires_in: 3600 }),
  );
  return {
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      MENDELEY_CONFIG: configFile,
      MENDELEY_TOKEN_FILE: tokenFile,
    },
  };
}

test('catalog lookup help documents the 0–100 score scale (#138)', async () => {
  const { env } = createEnv();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'catalog', 'lookup', '--help'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout: out }));
    child.stdin.end();
  });

  assert.equal(result.code, 0);
  // The help must mention the 0–100 scale (not the old "0 and 1").
  assert.match(
    result.stdout,
    /confidence score between 0 and 100/i,
    `help must document the 0–100 scale; got: ${result.stdout}`,
  );
  assert.doesNotMatch(
    result.stdout,
    /confidence score between 0 and 1\b/,
    `help must not advertise the wrong 0–1 scale; got: ${result.stdout}`,
  );
});
