/**
 * Integration tests that exercise the session against a mocked fetch
 * implementation.  These tests mimic the live API but don't talk to it.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { Mendeley } from '../../src/client.js';
import { MendeleySession } from '../../src/session.js';

/**
 * Install a mock fetch that records every call and returns a queue of
 * canned responses.  Each call consumes one response from the queue.
 */
function mockFetch(responses) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    const next = responses.shift();
    if (!next) throw new Error('No mock response for ' + url);
    return next();
  };
  fn.calls = calls;
  return fn;
}

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('session.get returns a parsed response object', async () => {
  globalThis.fetch = mockFetch([() => new Response(JSON.stringify({ ok: 1 }), { status: 200 })]);
  const m = new Mendeley({ clientId: 'cid' });
  const session = new MendeleySession(m, { access_token: 'tok' });
  const rsp = await session.get('/foo');
  assert.equal(rsp.status, 200);
  assert.deepEqual(await rsp.json(), { ok: 1 });
  const { url, opts } = globalThis.fetch.calls[0];
  assert.equal(url, 'https://api.mendeley.com/foo');
  assert.equal(opts.headers.authorization, 'Bearer tok');
});

test('session.post sends a JSON body with correct content type', async () => {
  globalThis.fetch = mockFetch([() => new Response('{}', { status: 200 })]);
  const m = new Mendeley({ clientId: 'cid' });
  const session = new MendeleySession(m, { access_token: 'tok' });
  await session.post('/foo', {
    data: JSON.stringify({ a: 1 }),
    headers: { 'content-type': 'application/json' },
  });
  const { opts } = globalThis.fetch.calls[0];
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['content-type'], 'application/json');
  assert.equal(opts.body, '{"a":1}');
});

test('session.request refreshes the token on a 401 response', async () => {
  const responses = [
    () => new Response('unauthorized', { status: 401 }),
    () => new Response('ok', { status: 200 }),
  ];
  globalThis.fetch = async (url, opts) => {
    return responses.shift()();
  };
  const m = new Mendeley({ clientId: 'cid', clientSecret: 'sec' });
  const refresher = {
    async refresh(session) {
      session.token = { access_token: 'new_tok' };
    },
  };
  const session = new MendeleySession(m, { access_token: 'old' }, null, refresher);
  const rsp = await session.get('/foo');
  assert.equal(rsp.status, 200);
  // The second call should now carry the refreshed token.
  const calls = (await import('../../src/index.js')).USER_AGENT;
  assert.ok(calls);
  // We can verify the second call's headers by mocking fetch to capture them.
  // Re-run with capture.
  let captured;
  const responses2 = [
    () => new Response('unauthorized', { status: 401 }),
    () => new Response('ok', { status: 200 }),
  ];
  globalThis.fetch = async (url, opts) => {
    if (!captured) captured = opts;
    return responses2.shift()();
  };
  const session2 = new MendeleySession(m, { access_token: 'old' }, null, refresher);
  await session2.get('/foo');
  assert.equal(captured.headers.authorization, 'Bearer new_tok');
});

test('documents.iter yields items across pages', async () => {
  let page = 0;
  globalThis.fetch = async (url) => {
    if (url.includes('/documents')) {
      page += 1;
      if (page === 1) {
        return new Response(JSON.stringify([{ id: 'a' }, { id: 'b' }]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            link: '</documents?page=2>; rel="next"',
          },
        });
      }
      return new Response(JSON.stringify([{ id: 'c' }]), { status: 200 });
    }
    throw new Error('unexpected ' + url);
  };
  const m = new Mendeley({ clientId: 'cid' });
  const session = new MendeleySession(m, { access_token: 'tok' });
  const out = [];
  for await (const doc of session.documents.iter()) {
    out.push(doc.id);
  }
  assert.deepEqual(out, ['a', 'b', 'c']);
});
