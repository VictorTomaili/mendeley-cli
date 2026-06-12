/**
 * Unit tests for the base resource helpers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addQueryParams } from '../../src/resources/base.js';

test('addQueryParams appends parameters to a relative URL', () => {
  assert.equal(addQueryParams('/documents', { view: 'all' }), '/documents?view=all');
});

test('addQueryParams preserves existing query parameters', () => {
  assert.equal(
    addQueryParams('/documents?view=all', { limit: 50 }),
    '/documents?view=all&limit=50'
  );
});

test('addQueryParams replaces existing values', () => {
  assert.equal(addQueryParams('/documents?view=all', { view: 'bib' }), '/documents?view=bib');
});

test('addQueryParams skips undefined and empty values', () => {
  assert.equal(
    addQueryParams('/documents', { view: 'all', sort: undefined, order: null, extra: '' }),
    '/documents?view=all'
  );
});

test('addQueryParams supports absolute URLs', () => {
  assert.equal(
    addQueryParams('https://example.com/x', { a: '1' }),
    'https://example.com/x?a=1'
  );
});

test('addQueryParams supports array values', () => {
  const out = addQueryParams('/x', { ids: ['a', 'b', 'c'] });
  const u = new URL(out, 'http://_');
  assert.equal(u.searchParams.getAll('ids').join(','), 'a,b,c');
});

test('addQueryParams preserves the fragment', () => {
  assert.equal(addQueryParams('/x#frag', { a: '1' }), '/x?a=1#frag');
});
