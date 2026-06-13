/**
 * Unit tests for the tiny argument parser.
 *
 * Regression coverage for the bug where `--format` (or any flag) placed
 * before the subcommand was eaten and the subcommand ended up as a
 * positional argument.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../../lib/cli/argparse.js';

describe('argparse', () => {
  it('parses a simple command', () => {
    const r = parse(['auth', 'status']);
    assert.equal(r.command, 'auth');
    assert.deepEqual(r.args, ['status']);
    assert.deepEqual(r.flags, {});
  });

  it('parses a command with flags', () => {
    const r = parse(['catalog', 'search', 'ml', '--limit', '10']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', 'ml']);
    assert.equal(r.flags.limit, '10');
  });

  it('parses --key=value form', () => {
    const r = parse(['catalog', 'search', 'ml', '--limit=10']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', 'ml']);
    assert.equal(r.flags.limit, '10');
  });

  it('parses boolean flags', () => {
    const r = parse(['folders', 'list', '--all']);
    assert.equal(r.command, 'folders');
    assert.deepEqual(r.args, ['list']);
    assert.equal(r.flags.all, true);
  });

  it('parses --no- prefix as false', () => {
    const r = parse(['files', 'list', '--no-color']);
    assert.equal(r.flags.color, false);
  });

  it('rejects short flags', () => {
    assert.throws(() => parse(['catalog', 'search', '-x']), /short flags/);
  });

  // ── regression tests for the --format-before-command bug ──────────

  it('parses flags placed before the subcommand', () => {
    const r = parse(['--format', 'text', 'catalog', 'search', 'ml']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', 'ml']);
    assert.equal(r.flags.format, 'text');
  });

  it('parses --key=value placed before the subcommand', () => {
    const r = parse(['--format=text', 'catalog', 'search', 'ml']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', 'ml']);
    assert.equal(r.flags.format, 'text');
  });

  it('parses --no-X placed before the subcommand', () => {
    const r = parse(['--no-color', 'files', 'list']);
    assert.equal(r.command, 'files');
    assert.deepEqual(r.args, ['list']);
    assert.equal(r.flags.color, false);
  });

  it('parses mixed flags before AND after the subcommand', () => {
    const r = parse(['--format', 'ids', 'catalog', 'search', 'ml', '--limit', '5']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', 'ml']);
    assert.equal(r.flags.format, 'ids');
    assert.equal(r.flags.limit, '5');
  });

  it('treats --flag with no value as a boolean even with no following token', () => {
    const r = parse(['--quiet', 'auth', 'status']);
    assert.equal(r.command, 'auth');
    assert.deepEqual(r.args, ['status']);
    assert.equal(r.flags.quiet, true);
  });

  it('parses -- as the end-of-flags marker', () => {
    const r = parse(['catalog', 'search', '--', '--not-a-flag']);
    assert.equal(r.command, 'catalog');
    assert.deepEqual(r.args, ['search', '--not-a-flag']);
  });
});
