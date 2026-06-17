/**
 * Regression tests for credential/token file permissions (issue #194).
 *
 * `writePrivateJson()` must set owner-only permissions (0o600) where the
 * platform supports POSIX permissions.  On Windows/NTFS the chmod is a
 * no-op, so we skip the mode assertion there.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writePrivateJson, saveToken } from '../../lib/cli/credentials.js';

const isWindows = process.platform === 'win32';

test('writePrivateJson creates a file with 0o600 on POSIX', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-perms-'));
  const file = join(dir, 'secrets.json');
  writePrivateJson(file, { access_token: 'SECRET' });
  const mode = statSync(file).mode;
  if (!isWindows) {
    assert.equal(mode & 0o777, 0o600, `expected 0o600, got 0o${(mode & 0o777).toString(8)}`);
  }
  // On all platforms the file must exist and contain the JSON.
  assert.ok(statSync(file).size > 0);
});

test('writePrivateJson tightens permissions on an existing 0o644 file', () => {
  if (isWindows) return; // chmod mode bits are not meaningful on Windows
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-perms-'));
  const file = join(dir, 'secrets.json');
  // Create with broad perms first.
  writeFileSync(file, '{}', { mode: 0o644 });
  chmodSync(file, 0o644);
  assert.equal(statSync(file).mode & 0o777, 0o644);
  // writePrivateJson must tighten it.
  writePrivateJson(file, { access_token: 'SECRET' });
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('saveToken uses writePrivateJson (0o600 on POSIX)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-token-perms-'));
  const file = join(dir, 'token.json');
  saveToken({ access_token: 'A', refresh_token: 'R', expires_in: 3600 }, file);
  const mode = statSync(file).mode;
  if (!isWindows) {
    assert.equal(mode & 0o777, 0o600);
  }
});
