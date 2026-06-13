/**
 * Unit tests for the response-object base classes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LazyResponseObject, ResponseObject, SessionResponseObject } from '../../src/response.js';

class Sample extends ResponseObject {
  static fields() {
    return ['id', 'title', 'type'];
  }
}

test('ResponseObject exposes JSON fields via getter accessors', () => {
  const obj = new Sample({ id: 'abc', title: 'Quantum mechanics', type: 'journal' });
  assert.equal(obj.id, 'abc');
  assert.equal(obj.title, 'Quantum mechanics');
  assert.equal(obj.type, 'journal');
});

test('ResponseObject.toJSON returns a plain object', () => {
  const obj = new Sample({ id: 'abc', title: 'T', type: 'journal', extra: 'ignore' });
  const json = obj.toJSON();
  assert.deepEqual(json, { id: 'abc', title: 'T', type: 'journal' });
  assert.equal('extra' in json, false);
});

test('ResponseObject is enumerable via Object.keys', () => {
  const obj = new Sample({ id: 'abc', title: 'T', type: 'journal' });
  const keys = Object.keys(obj);
  assert.ok(keys.includes('id'));
  assert.ok(keys.includes('title'));
  assert.ok(keys.includes('type'));
});

test('ResponseObject has / has-not semantics', () => {
  const obj = new Sample({ id: 'abc', title: 'T', type: 'journal' });
  assert.equal('id' in obj, true);
  assert.equal('unknown' in obj, false);
});

test('SessionResponseObject stores the session', () => {
  const session = { host: 'x' };
  const obj = new SessionResponseObject(session, { id: '1', title: 'T', type: 'journal' });
  assert.equal(obj.session, session);
  assert.equal(obj.json.id, '1');
});

test('LazyResponseObject loads on demand', async () => {
  const session = {};
  let calls = 0;
  const loader = () => {
    calls += 1;
    return Promise.resolve(new Sample({ id: 'abc', title: 'T', type: 'journal' }));
  };
  const lazy = new LazyResponseObject(session, 'abc', Sample, loader);
  assert.equal(calls, 0);
  const loaded = await lazy._load();
  assert.equal(loaded.title, 'T');
  assert.equal(calls, 1);
  const loaded2 = await lazy._load();
  assert.equal(loaded2.title, 'T');
  assert.equal(calls, 1); // cached
});

test('LazyResponseObject is thenable', async () => {
  const loader = () => Promise.resolve(new Sample({ id: '1', title: 'T', type: 'j' }));
  const lazy = new LazyResponseObject({}, '1', Sample, loader);
  const result = await lazy;
  assert.equal(result.id, '1');
});
