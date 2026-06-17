/**
 * Tests for the postinstall announcement (`lib/postinstall.js`).
 *
 * The script prints a friendly message after `npm install mendeley-cli`
 * with the version, the unofficial disclaimer, quick-start commands,
 * and links. It must never throw (a throwing postinstall breaks the
 * install), and it must keep the disclaimer prominent (#87).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { postinstallMessage } from '../../lib/postinstall.js';
import { VERSION } from '../../src/index.js';

test('postinstall message includes the current package version', () => {
  const msg = postinstallMessage();
  assert.ok(msg.includes(`v${VERSION}`), `message should mention v${VERSION}; got:\n${msg}`);
});

test('postinstall message keeps the unofficial disclaimer prominent', () => {
  const msg = postinstallMessage();
  assert.match(msg, /unofficial/i);
  assert.match(msg, /not affiliated|Mendeley Ltd/i);
  assert.match(msg, /Elsevier/);
});

test('postinstall message shows quick-start commands', () => {
  const msg = postinstallMessage();
  assert.match(msg, /mendeley --help/);
  assert.match(msg, /mendeley auth login/);
  assert.match(msg, /mendeley catalog search/);
});

test('postinstall message links to the repo and issues', () => {
  const msg = postinstallMessage();
  assert.match(msg, /github.com\/VictorTomaili\/mendeley-cli/);
  assert.match(msg, /\/issues/);
});

test('postinstall message has no leading or trailing newline (caller formats)', () => {
  const msg = postinstallMessage();
  assert.equal(msg[0], 'm', 'should start with "mendeley-cli", no leading newline');
  assert.equal(msg.at(-1), 's', 'should end without a trailing newline');
});
