/**
 * Security regression tests for the local OAuth callback server in
 * src/login.js.
 *
 * The callback echoes query-string values (`error`, `state`) back into
 * an HTML page. Before the fix, these were interpolated raw, enabling a
 * reflected-XSS attack: an attacker could craft a redirect like
 *   http://localhost:PORT/?error=<script>...</script>
 * and the payload would execute in the victim's browser. CodeQL flagged
 * this as high-severity (js/reflected-xss) at login.js:50 and :71.
 *
 * The fix HTML-escapes every attacker-controllable value before it is
 * interpolated into the page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listenForCode } from '../../src/login.js';

async function hit(port, path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: await res.text() };
}

test('login callback escapes the `error` query param (no reflected XSS)', async () => {
  const server = await listenForCode(0, 'EXPECTED');
  // Swallow the expected rejection (OAuth error) so it does not
  // surface as an unhandled rejection.
  server.captured.catch(() => {});
  try {
    const payload = '<script>alert(1)</script>';
    // Include the expected state so the callback reaches the error path
    // rather than the state-mismatch path.
    const { body } = await hit(
      server.port,
      `/?state=EXPECTED&error=${encodeURIComponent(payload)}`,
    );
    // The raw payload must NOT appear verbatim in the HTML.
    assert.ok(!body.includes(payload), `raw <script> payload leaked into page:\n${body}`);
    // The escaped form must be present instead.
    assert.ok(body.includes('&lt;script&gt;'), `escaped form missing:\n${body}`);
  } finally {
    server.close();
  }
});

test('login callback escapes the `state` query param (no reflected XSS)', async () => {
  const server = await listenForCode(0, 'EXPECTED');
  // Swallow the expected rejection (state mismatch) so it does not
  // surface as an unhandled rejection.
  server.captured.catch(() => {});
  try {
    // Send a code + a mismatched, malicious state.
    const evil = `'><img src=x onerror=alert(1)>`;
    const { body } = await hit(server.port, `/?code=CODE&state=${encodeURIComponent(evil)}`);
    assert.ok(!body.includes(evil), `raw payload leaked into page:\n${body}`);
    assert.ok(!body.includes('<img'), `unescaped tag leaked into page:\n${body}`);
    assert.ok(body.includes('&#39;'), `escaped quote missing:\n${body}`);
  } finally {
    server.close();
  }
});

test('login callback still renders a readable (escaped) error message', async () => {
  const server = await listenForCode(0, 'EXPECTED');
  server.captured.catch(() => {});
  try {
    const { body } = await hit(server.port, '/?state=EXPECTED&error=access_denied');
    // Plain ASCII is unchanged; only HTML-special chars are escaped.
    assert.ok(body.includes('access_denied'), `readable message missing:\n${body}`);
  } finally {
    server.close();
  }
});
