/**
 * Tests for issue #89: --version reports wrong version.
 *
 * VERSION must stay in sync with package.json. Previously it was a
 * hardcoded constant that drifted to 1.0.0 while package.json was 0.1.x.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { VERSION } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

test('VERSION export matches package.json version (#89)', () => {
  assert.equal(VERSION, pkg.version, 'src/index.js VERSION must match package.json');
});

test('VERSION is not the stale 1.0.0 (#89)', () => {
  assert.notEqual(VERSION, '1.0.0', 'VERSION must not be the hardcoded stale value');
});
