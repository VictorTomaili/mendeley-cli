/**
 * Regression test for #137: `auth` help misdescribed the
 * client-credentials flow as "for the developer's own library".
 * Per https://dev.mendeley.com/reference/topics/authorization_client_credentials.html
 * client-credentials tokens are **read-only catalog** access and
 * cannot read user-library resources (documents, files, folders,
 * annotations, profiles). Users who chose the flow expecting
 * own-library access got 403 scope errors.
 *
 * The fix changes the help to document the read-only-catalog scope.
 * This test spawns the CLI and asserts the new wording + absence of
 * the misleading "own library" phrasing.
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
  const root = mkdtempSync(join(tmpdir(), 'mendeley-auth-help-'));
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

test('auth help documents client-credentials as read-only catalog (#137)', async () => {
  const { env } = createEnv();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'auth', '--help'], {
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
  // The help must describe client-credentials as read-only catalog.
  // The renderer may wrap at ~100 cols, so allow whitespace between
  // 'read-only' and 'catalog'.
  assert.match(
    result.stdout,
    /read-only\s+catalog access/i,
    `help must document read-only-catalog scope; got: ${result.stdout}`,
  );
  // The misleading "own library" framing must be gone.
  assert.doesNotMatch(
    result.stdout,
    /developer's own library/,
    `help must not advertise client-credentials as own-library access; got: ${result.stdout}`,
  );
});
