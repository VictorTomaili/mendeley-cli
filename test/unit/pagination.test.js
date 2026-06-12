/**
 * Unit tests for the `Page` class.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Page } from '../../src/pagination.js';
import { SessionResponseObject } from '../../src/response.js';

class Sample extends SessionResponseObject {
  static fields() {
    return ['id', 'title'];
  }
}

function rsp(body, opts = {}) {
  const headers = new Headers(opts.headers || {});
  return new Response(JSON.stringify(body), { status: 200, headers });
}

test('Page.items materialises the items', async () => {
  const session = {};
  const r = rsp([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], {
    headers: { 'mendeley-count': '2' },
  });
  const p = new Page(session, r, Sample);
  const items = await p.items;
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'a');
  assert.equal(items[0].title, 'A');
  assert.equal(p.count, 2);
});

test('Page.next_page follows the link header', async () => {
  const session = {
    async get(url) {
      assert.equal(url, '/foo?page=2');
      return rsp([{ id: 'c', title: 'C' }]);
    },
  };
  const r = rsp([{ id: 'a' }, { id: 'b' }], {
    headers: { link: '</foo?page=2>; rel="next"' },
  });
  const p = new Page(session, r, Sample);
  const next = await p.next_page;
  const items = await next.items;
  assert.equal(items[0].id, 'c');
});

test('Page.next_page returns null when there is no next link', async () => {
  const session = {};
  const p = new Page(session, rsp([{ id: 'a' }]), Sample);
  const next = await p.next_page;
  assert.equal(next, null);
});

test('Page.all walks the entire collection', async () => {
  const session = {
    async get(url) {
      if (url === '/p2') return rsp([{ id: 'c' }], { headers: { link: '</p3>; rel="next"' } });
      if (url === '/p3') return rsp([{ id: 'd' }]);
      throw new Error('unexpected ' + url);
    },
  };
  const p = new Page(
    session,
    rsp([{ id: 'a' }, { id: 'b' }], { headers: { link: '</p2>; rel="next"' } }),
    Sample
  );
  const all = await p.all();
  assert.deepEqual(all.map((i) => i.id), ['a', 'b', 'c', 'd']);
});
