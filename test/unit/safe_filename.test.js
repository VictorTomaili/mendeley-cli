/**
 * Unit tests for the shared safe-filename helper used by file
 * download / stream-to-file paths.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import {
  formatContentDisposition,
  parseContentDispositionFilename,
  safeFilename,
  safeJoin,
} from '../../src/safe_filename.js';

test('safeFilename accepts a plain basename', () => {
  assert.equal(safeFilename('paper.pdf'), 'paper.pdf');
  assert.equal(safeFilename('2024-06-13_report.txt'), '2024-06-13_report.txt');
});

test('safeFilename rejects empty / non-string inputs', () => {
  assert.throws(() => safeFilename(''), /non-empty string/);
  assert.throws(() => safeFilename(null), /non-empty string/);
  assert.throws(() => safeFilename(undefined), /non-empty string/);
  assert.throws(() => safeFilename(123), /non-empty string/);
});

test('safeFilename rejects path separators', () => {
  assert.throws(() => safeFilename('../etc/passwd'), /path separator/);
  assert.throws(() => safeFilename('foo/bar.txt'), /path separator/);
  assert.throws(() => safeFilename('foo\\bar.txt'), /path separator/);
});

test('safeFilename rejects absolute paths', () => {
  // node:path.isAbsolute is platform-specific: '/etc/passwd' is absolute
  // on POSIX (Linux/macOS) but not on Windows, and 'C:\\Windows\\System32'
  // is the reverse. Pick the path that is actually absolute on the running
  // platform so the test exercises the absolute-path branch of safeFilename.
  const posixAbs = '/etc/passwd';
  const win32Abs = 'C:\\Windows\\System32';
  const absPath = isAbsolute(posixAbs) ? posixAbs : win32Abs;
  assert.throws(() => safeFilename(absPath), /absolute path/);
});

test('safeFilename rejects reserved names', () => {
  assert.throws(() => safeFilename('.'), /reserved/);
  assert.throws(() => safeFilename('..'), /reserved/);
});

test('safeFilename rejects NUL bytes', () => {
  assert.throws(() => safeFilename('foo\0bar'), /NUL byte/);
});

test('parseContentDispositionFilename parses plain form', () => {
  assert.equal(parseContentDispositionFilename('attachment; filename="paper.pdf"'), 'paper.pdf');
  assert.equal(parseContentDispositionFilename('attachment; filename=paper.pdf'), 'paper.pdf');
  assert.equal(parseContentDispositionFilename('filename="report.txt"'), 'report.txt');
});

test('parseContentDispositionFilename prefers RFC 5987 form', () => {
  // RFC 5987 should win when both are present.
  const header = 'attachment; filename="fallback.txt"; filename*=UTF-8\'\'proper%20name.pdf';
  assert.equal(parseContentDispositionFilename(header), 'proper name.pdf');
});

test('parseContentDispositionFilename returns null when missing or invalid', () => {
  assert.equal(parseContentDispositionFilename(null), null);
  assert.equal(parseContentDispositionFilename(''), null);
  assert.equal(parseContentDispositionFilename('attachment'), null);
  assert.equal(parseContentDispositionFilename('attachment; size=12345'), null);
});

test('safeJoin returns the resolved path when inside directory', () => {
  const dir = join(tmpdir(), 'mendeley-test-safe-join');
  const p = safeJoin(dir, 'paper.pdf');
  assert.ok(p.startsWith(dir));
  assert.ok(p.endsWith('paper.pdf'));
});

test('safeJoin throws when the filename would escape the directory', () => {
  // safeFilename already rejects '..', so the only way to escape is via
  // a path that the safe filename check missed — verify the defence
  // in depth path manually.
  const dir = join(tmpdir(), 'mendeley-test-escape');
  assert.throws(() => safeJoin(dir, '../escape.txt'), /path separator/);
});

/* ── formatContentDisposition (#140) ─────────────────────────────────────── */

test('formatContentDisposition quotes an ASCII filename (#140)', () => {
  assert.equal(
    formatContentDisposition('paper.pdf'),
    'attachment; filename="paper.pdf"; filename*=UTF-8\'\'paper.pdf',
  );
});

test('formatContentDisposition percent-encodes spaces in filename* (#140)', () => {
  const cd = formatContentDisposition('my file.pdf');
  assert.match(cd, /filename="my file\.pdf"/); // ASCII fallback keeps the space
  assert.match(cd, /filename\*=UTF-8''my%20file\.pdf/);
});

test('formatContentDisposition encodes semicolons so they cannot split the header (#140)', () => {
  // A raw ';' in the filename would terminate the filename parameter
  // for naive unquoted parsers. Two protections:
  //  - the ASCII fallback QUOTES the value, so ';' is harmless inside
  //    the quotes; and
  //  - the filename* form percent-encodes it as %3B.
  const cd = formatContentDisposition('a;b.pdf');
  assert.match(cd, /filename="a;b\.pdf";/); // quoted → safe
  assert.match(cd, /filename\*=UTF-8''a%3Bb\.pdf/); // encoded → safe
});

test('formatContentDisposition escapes embedded quotes in the ASCII fallback (#140)', () => {
  const cd = formatContentDisposition('quote"weird.pdf');
  // Embedded " must be backslash-escaped inside the quoted fallback.
  assert.match(cd, /filename="quote\\"weird\.pdf"/);
  assert.match(cd, /filename\*=UTF-8''quote%22weird\.pdf/);
});

test('formatContentDisposition emits UTF-8 percent-encoding for non-ASCII (#140)', () => {
  const cd = formatContentDisposition('Ünïcödé.pdf');
  // ASCII fallback replaces non-ASCII with '_'; filename* carries the
  // exact UTF-8 bytes percent-encoded.
  assert.match(cd, /filename="_+n_+c_+d_+\.pdf"/);
  assert.match(cd, /filename\*=UTF-8''%C3%9Cn%C3%AFc%C3%B6d%C3%A9\.pdf/);
});

test('formatContentDisposition round-trips through the parser (#140)', () => {
  // A header we generate must parse back to the original filename.
  for (const f of ['paper.pdf', 'my file.pdf', 'Ünïcödé.pdf', 'quote"x.pdf']) {
    const cd = formatContentDisposition(f);
    assert.equal(parseContentDispositionFilename(cd), f, `round-trip failed for ${f}`);
  }
});
