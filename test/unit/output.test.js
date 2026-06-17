/**
 * Unit tests for the Output helper.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Output } from '../../lib/cli/output.js';

describe('Output', () => {
  it('accepts the four known formats', () => {
    for (const fmt of ['json', 'text', 'tsv', 'ids']) {
      const out = new Output(fmt);
      assert.equal(out.format, fmt);
    }
  });

  it('rejects unknown formats', () => {
    assert.throws(() => new Output('xml'), /unknown --format/);
    assert.throws(() => new Output('yaml'), /unknown --format/);
    assert.throws(() => new Output(''), /unknown --format/);
  });

  it('defaults to text', () => {
    const out = new Output();
    assert.equal(out.format, 'text');
  });
});
