/**
 * Unit tests for the MIME helper.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { guessMime } from '../../src/mime.js';

test('guessMime recognises common academic formats', () => {
  assert.equal(guessMime('paper.pdf'), 'application/pdf');
  assert.equal(guessMime('paper.PDF'), 'application/pdf');
  assert.equal(
    guessMime('chapter.docx'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  assert.equal(guessMime('ref.bib'), 'application/x-bibtex');
  assert.equal(guessMime('notes.tex'), 'application/x-tex');
});

test('guessMime falls back to octet-stream', () => {
  assert.equal(guessMime('foo.unknown'), 'application/octet-stream');
  assert.equal(guessMime('noext'), 'application/octet-stream');
  assert.equal(guessMime(''), 'application/octet-stream');
});
