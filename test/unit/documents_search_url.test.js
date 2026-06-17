/**
 * Tests for #134: `documents search` / `advanced-search` rely on the
 * `/search/documents` endpoint. That endpoint is live and functional but
 * is NOT in the static OpenAPI reference (api.mendeley.com/apidocs); it
 * is inherited from the official Mendeley Python SDK and confirmed
 * working by real API consumers.
 *
 * These tests pin the URL construction so that a future refactor cannot
 * silently change the search endpoint, and document the source of truth
 * (official Python SDK + live API, not the static docs).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build a session whose GET captures the request URL.
function capturingSession() {
  const calls = [];
  const session = {
    host: 'https://api.mendeley.com',
    async get(url, _opts) {
      calls.push({ method: 'GET', url });
      // A minimal page-shaped response: empty list, no next link.
      return {
        json: async () => [],
        headers: new Map([['mendeley-count', '0']]),
      };
    },
  };
  return { session, calls };
}

test('documents.search() targets /search/documents (live endpoint, #134)', async () => {
  const { session, calls } = capturingSession();
  const { Documents } = await import('../../src/resources/documents.js');
  const resource = new Documents(session);
  const page = await resource.search('attention', { view: 'all' }).list();
  await page.items;
  const get = calls.find((c) => c.url.includes('/search/documents'));
  assert.ok(get, `expected a GET to /search/documents; got ${JSON.stringify(calls)}`);
  assert.ok(
    get.url.startsWith('/search/documents'),
    `url should start with /search/documents: ${get.url}`,
  );
  // The query term must be carried as a param.
  assert.match(get.url, /query=attention/);
  assert.match(get.url, /view=all/);
});

test('documents.advancedSearch() carries field params on /search/documents (#134)', async () => {
  const { session, calls } = capturingSession();
  const { Documents } = await import('../../src/resources/documents.js');
  const resource = new Documents(session);
  // Match real CLI usage: field params go to advancedSearch(), page
  // size goes to .list({ pageSize }) which ListResource maps to `limit`.
  const page = await resource.advancedSearch({ title: 'ONTOLOGY', view: 'all' }).list({
    pageSize: 25,
  });
  await page.items;
  const get = calls.find((c) => c.url.includes('/search/documents'));
  assert.ok(get, `expected a GET to /search/documents; got ${JSON.stringify(calls)}`);
  assert.match(get.url, /title=ONTOLOGY/);
  assert.match(get.url, /view=all/);
  // pageSize maps to the `limit` query param (ListResource.list).
  assert.match(get.url, /limit=25/);
});

test('documents.search() does NOT target a trailing-slash or /documents URL (#134)', async () => {
  const { session, calls } = capturingSession();
  const { Documents } = await import('../../src/resources/documents.js');
  const resource = new Documents(session);
  const page = await resource.search('x').list();
  await page.items;
  const get = calls.find((c) => c.method === 'GET');
  assert.ok(get);
  // Must be the dedicated search endpoint, not a plain /documents list.
  assert.ok(get.url.includes('/search/documents'), `expected /search/documents in url: ${get.url}`);
  assert.ok(!/\/$/.test(get.url.split('?')[0]), 'path should not end with /');
});
