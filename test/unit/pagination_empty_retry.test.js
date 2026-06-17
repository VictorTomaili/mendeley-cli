/**
 * Regression tests for pagination silent-data-loss guard (issue #193).
 *
 * The list iterator retries once when a terminal page comes back empty
 * despite a non-zero count.  If the retry *also* returns an empty
 * terminal page while the server still reports count > 0, the iterator
 * must throw rather than silently yield zero results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Folders } from '../../src/resources/folders.js';

function emptyPageResponse(countHeader) {
  const headers = new Headers();
  if (countHeader !== undefined) headers.set('mendeley-count', String(countHeader));
  // No 'next' link → terminal page.
  return new Response(JSON.stringify([]), { status: 200, headers });
}

describe('ListResource.iter double-empty-page guard', () => {
  it('throws when count > 0 but two terminal pages are both empty', async () => {
    let calls = 0;
    const session = {
      async get() {
        calls++;
        // Every list() call returns an empty terminal page but claims
        // mendeley-count=5.
        return emptyPageResponse(5);
      },
    };
    const folders = new Folders(session);
    await assert.rejects(async () => {
      for await (const _ of folders.iter()) {
        // should never yield
      }
    }, /empty terminal page twice/);
    assert.equal(calls, 2, 'should have retried exactly once');
  });

  it('yields nothing (no throw) when count is explicitly 0', async () => {
    const session = {
      async get() {
        return emptyPageResponse(0);
      },
    };
    const folders = new Folders(session);
    const results = [];
    for await (const item of folders.iter()) results.push(item);
    assert.equal(results.length, 0);
  });

  it('recovers normally after a single transient empty page', async () => {
    let calls = 0;
    const session = {
      async get() {
        calls++;
        if (calls === 1) {
          // First call: transient empty page with count=2.
          return emptyPageResponse(2);
        }
        // Retry: returns the real data.
        const headers = new Headers({ 'mendeley-count': '2' });
        return new Response(JSON.stringify([{ id: 'a' }, { id: 'b' }]), {
          status: 200,
          headers,
        });
      },
    };
    const folders = new Folders(session);
    const results = [];
    for await (const item of folders.iter()) results.push(item);
    assert.equal(results.length, 2);
  });
});
