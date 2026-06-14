/**
 * Tests for issue #15: --limit validation is inconsistent across commands.
 *
 * parseLimit() validates the --limit / page-size value consistently:
 * returns undefined for empty input (API default applies), throws for
 * 0, negative, or non-numeric values.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLimit } from '../../lib/cli/output.js';
import { ArgvError } from '../../lib/cli/argparse.js';

describe('parseLimit', () => {
  test('returns undefined for empty input', () => {
    assert.equal(parseLimit(undefined), undefined);
    assert.equal(parseLimit(null), undefined);
    assert.equal(parseLimit(''), undefined);
  });

  test('returns a positive integer for valid input', () => {
    assert.equal(parseLimit('1'), 1);
    assert.equal(parseLimit('50'), 50);
    assert.equal(parseLimit('100'), 100);
  });

  test('accepts numeric input', () => {
    assert.equal(parseLimit(25), 25);
  });

  test('rejects 0', () => {
    assert.throws(() => parseLimit('0'), ArgvError);
    assert.throws(() => parseLimit('0'), /positive integer/);
  });

  test('rejects negative numbers', () => {
    assert.throws(() => parseLimit('-1'), ArgvError);
    assert.throws(() => parseLimit('-5'), /positive integer/);
  });

  test('rejects non-numeric strings', () => {
    assert.throws(() => parseLimit('abc'), ArgvError);
    assert.throws(() => parseLimit('abc'), /got "abc"/);
  });

  test('rejects floats', () => {
    assert.throws(() => parseLimit('1.5'), ArgvError);
  });

  test('uses custom flag name in error', () => {
    assert.throws(() => parseLimit('0', 'page-size'), /--page-size/);
  });
});
