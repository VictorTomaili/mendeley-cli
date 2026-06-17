/**
 * Tests for issues #115 / #116 / #135: File model field names.
 *
 * The live Mendeley API returns the flat field shape
 * (`filename`, `content_type`, `filehash`, `created`) — this was
 * confirmed by production testing for the v0.2.x releases and is
 * what `File.fields()` targets.
 *
 * The static API reference at dev.mendeley.com/methods/ describes
 * a different (nested) shape: a top-level `filename`/`name` and a
 * `content_details` object with `sha256_hash`, `content_type`,
 * `created_date`, etc.  The flat and nested shapes do not match
 * what the live API returns for the documented endpoint, so the
 * code follows the live shape, not the static docs (#135).
 *
 * As a resilience measure (#135) File.toJSON() and the download
 * filename fallback also recognise the documented-but-unused
 * alternate names (`file_name`, `mime_type`, `sha256_hash`,
 * `created_date`) and map them onto the canonical fields.  The
 * canonical name always wins when both are present.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { File } from '../../src/models/files.js';

test('File.fields() uses canonical API names (no file_name/mime_type) (#115)', () => {
  const fields = File.fields();
  assert.ok(fields.includes('filename'), `expected 'filename' in ${JSON.stringify(fields)}`);
  assert.ok(
    fields.includes('content_type'),
    `expected 'content_type' in ${JSON.stringify(fields)}`,
  );
  assert.ok(!fields.includes('file_name'), `'file_name' must be removed (API uses 'filename')`);
  assert.ok(!fields.includes('mime_type'), `'mime_type' must be removed (API uses 'content_type')`);
});

test('File.fields() exposes document_id, extension, created (#115)', () => {
  const fields = File.fields();
  assert.ok(fields.includes('document_id'));
  assert.ok(fields.includes('extension'));
  assert.ok(fields.includes('created'));
});

test('File.toJSON serializes filename and content_type when present (#115)', () => {
  // Simulate the exact shape the real Mendeley API returns.
  const f = new File(
    { get: async () => {} },
    {
      id: 'file-1',
      filename: 'attention.pdf',
      content_type: 'application/pdf',
      size: 1024,
      filehash: 'abc',
      document_id: 'doc-1',
      extension: 'pdf',
      created: '2024-01-01T00:00:00Z',
    },
  );
  const json = f.toJSON();
  assert.equal(json.filename, 'attention.pdf');
  assert.equal(json.content_type, 'application/pdf');
  assert.equal(json.document_id, 'doc-1');
  assert.equal(json.extension, 'pdf');
  assert.equal(json.created, '2024-01-01T00:00:00Z');
  assert.equal(json.size, 1024);
  assert.equal(json.filehash, 'abc');
});

test('File.toJSON no longer drops filename when the API uses the canonical name (#115)', () => {
  const f = new File(
    { get: async () => {} },
    { id: 'f', filename: 'paper.pdf', content_type: 'application/pdf', size: 1, filehash: 'h' },
  );
  const json = f.toJSON();
  // The old bug: filename would be undefined and stripped.
  assert.ok(json.filename, `filename must survive toJSON, got ${JSON.stringify(json)}`);
});

test('File.download uses the metadata filename when no Content-Disposition (#116)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-115-dl-'));
  try {
    const f = new File(
      {
        get: async () => new Response(new Blob(['bytes']), {}),
      },
      {
        id: 'file-9',
        filename: 'real-name.pdf', // canonical API field
        content_type: 'application/pdf',
        size: 5,
        filehash: 'h',
      },
    );
    const path = await f.download(dir);
    assert.ok(path.endsWith('real-name.pdf'), `expected real-name.pdf in path, got ${path}`);
    assert.ok(existsSync(join(dir, 'real-name.pdf')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('File.download still falls back to file-<id> when neither header nor metadata (#116)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-115-fb-'));
  try {
    const f = new File(
      {
        get: async () => new Response(new Blob(['x']), {}),
      },
      { id: 'abc-123' }, // no filename field at all
    );
    const path = await f.download(dir);
    assert.ok(path.endsWith('file-abc-123'), `expected file-abc-123, got ${path}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ── alias mapping (#135) ──────────────────────────────────────────── */

test('File.toJSON maps the file_name alias onto filename (#135)', () => {
  const f = new File(
    { get: async () => {} },
    { id: 'f-1', file_name: 'via-alias.pdf', size: 1, filehash: 'h' },
  );
  const json = f.toJSON();
  assert.equal(json.filename, 'via-alias.pdf');
  // The alias key must NOT leak into the output.
  assert.equal(json.file_name, undefined);
});

test('File.toJSON canonical name wins over alias (#135)', () => {
  const f = new File(
    { get: async () => {} },
    { id: 'f-1', filename: 'canonical.pdf', file_name: 'alias.pdf' },
  );
  const json = f.toJSON();
  assert.equal(json.filename, 'canonical.pdf');
});

test('File.toJSON maps mime_type → content_type, sha256_hash → filehash, created_date → created (#135)', () => {
  const f = new File(
    { get: async () => {} },
    {
      id: 'f-1',
      size: 7,
      mime_type: 'application/pdf',
      sha256_hash: 'deadbeef',
      created_date: '2024-06-01T00:00:00Z',
      document_id: 'd-1',
    },
  );
  const json = f.toJSON();
  assert.equal(json.content_type, 'application/pdf');
  assert.equal(json.filehash, 'deadbeef');
  assert.equal(json.created, '2024-06-01T00:00:00Z');
  // No alias keys leak.
  assert.equal(json.mime_type, undefined);
  assert.equal(json.sha256_hash, undefined);
  assert.equal(json.created_date, undefined);
});

test('File.download falls back to the file_name alias when no filename is set (#135)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendeley-135-alias-dl-'));
  try {
    const f = new File(
      {
        get: async () => new Response(new Blob(['bytes']), {}),
      },
      { id: 'f-2', file_name: 'alias-name.pdf', size: 5, filehash: 'h' },
    );
    const path = await f.download(dir);
    assert.ok(path.endsWith('alias-name.pdf'), `expected alias-name.pdf, got ${path}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
