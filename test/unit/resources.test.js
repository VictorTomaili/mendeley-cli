/**
 * Unit tests for the Folders, Groups, and Annotations resources.
 *
 * Regression coverage for the bug where these classes extended
 * `GetByIdResource` (which has no `list()`) but called `super.list()`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Folders } from '../../src/resources/folders.js';
import { Groups } from '../../src/resources/groups.js';
import { Annotations } from '../../src/resources/annotations.js';

function makeFakeSession(responses) {
  return {
    responses: [...responses],
    calls: [],
    async get(url, opts = {}) {
      this.calls.push({ method: 'GET', url, opts });
      if (this.responses.length === 0) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'out of responses' }),
        };
      }
      const body = this.responses.shift();
      return {
        ok: true,
        status: 200,
        headers: { get: (k) => (k === 'content-type' ? 'application/json' : null) },
        json: async () => body,
      };
    },
  };
}

const emptyPage = { embedded: {}, total: 0 };

describe('Folders resource', () => {
  it('list() returns a Page (does not throw "super.list is not a function")', async () => {
    const session = makeFakeSession([emptyPage]);
    const folders = new Folders(session);
    const page = await folders.list();
    assert.ok(page);
    assert.equal(typeof page.count, 'number');
    assert.deepEqual(session.calls[0].url, '/folders');
  });
});

describe('Groups resource', () => {
  it('list() returns a Page (does not throw "list is not a function")', async () => {
    const session = makeFakeSession([emptyPage]);
    const groups = new Groups(session);
    const page = await groups.list();
    assert.ok(page);
    assert.equal(typeof page.count, 'number');
    assert.deepEqual(session.calls[0].url, '/groups');
  });
});

describe('Annotations resource', () => {
  it('list() returns a Page (does not throw "super.list is not a function")', async () => {
    const session = makeFakeSession([emptyPage]);
    const annotations = new Annotations(session);
    const page = await annotations.list();
    assert.ok(page);
    assert.equal(typeof page.count, 'number');
    assert.deepEqual(session.calls[0].url, '/annotations');
  });
});
