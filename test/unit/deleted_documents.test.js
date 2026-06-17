/**
 * Tests for #133: the `deleted_documents` endpoint.
 *
 * `GET /deleted_documents` returns the ids of permanently deleted
 * documents (the incremental-sync primitive). Content-Type is
 * application/vnd.mendeley-deleted-document.1+json; URL params are
 * `since` (ISO 8601) and `group_id`.
 *
 * These tests cover the model field list, the resource URL construction
 * (user vs group scope), and the CLI `documents deleted` command.
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

import { DeletedDocument } from '../../src/models/deleted_documents.js';
import { DeletedDocuments } from '../../src/resources/deleted_documents.js';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));
const ACCESS_TOKEN = 'ACCESS_TOKEN_FOR_TEST';
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

test('DeletedDocument exposes only id (#133)', () => {
  assert.equal(DeletedDocument.contentType, 'application/vnd.mendeley-deleted-document.1+json');
  assert.deepEqual(DeletedDocument.fields(), ['id']);
});

test('DeletedDocuments targets /deleted_documents with user scope (#133)', async () => {
  const calls = [];
  const session = {
    host: 'https://api.mendeley.com',
    async get(url, _opts) {
      calls.push(url);
      return { json: async () => [{ id: 'doc-1' }, { id: 'doc-2' }], headers: new Map() };
    },
  };
  const resource = new DeletedDocuments(session);
  const page = await resource.list();
  const items = await page.items;
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'doc-1');
  // No group_id in the user-scoped request.
  assert.ok(calls[0].startsWith('/deleted_documents'));
  assert.ok(!calls[0].includes('group_id='));
});

test('DeletedDocuments passes since + group_id params (#133)', async () => {
  const calls = [];
  const session = {
    host: 'https://api.mendeley.com',
    async get(url, _opts) {
      calls.push(url);
      return { json: async () => [], headers: new Map([['mendeley-count', '0']]) };
    },
  };
  const resource = new DeletedDocuments(session, 'group-7');
  await (
    await resource.list({ since: '2024-01-01T00:00:00Z' })
  ).items;
  assert.match(calls[0], /\/deleted_documents/);
  assert.match(calls[0], /group_id=group-7/);
  assert.match(calls[0], /since=2024-01-01T00%3A00%3A00Z/);
});

test('CLI documents deleted lists ids via /deleted_documents (#133)', async () => {
  const captured = { url: null };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'ids', 'documents', 'deleted'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  // --format ids prints one bare id per line.
  const ids = result.stdout.trim().split('\n').sort();
  assert.deepEqual(ids, ['aaa', 'bbb']);
  assert.ok(captured.url.startsWith('/deleted_documents'), `got ${captured.url}`);
});

test('CLI documents deleted --since and --group reach the endpoint (#133)', async () => {
  const captured = { url: null };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(
    [
      '--format',
      'json',
      'documents',
      'deleted',
      '--since',
      '2024-06-01T00:00:00Z',
      '--group',
      'g1',
    ],
    { env },
  );

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(captured.url, /since=2024-06-01/);
  assert.match(captured.url, /group_id=g1/);
  const out = JSON.parse(result.stdout);
  assert.equal(out.count, 2);
  assert.equal(out.items[0].id, 'aaa');
});

/* ── helpers ────────────────────────────────────────────────────────────── */

function startApiServer(captured) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/deleted_documents')) {
      captured.url = req.url;
      res.setHeader('content-type', 'application/vnd.mendeley-deleted-document.1+json');
      res.setHeader('mendeley-count', '2');
      res.writeHead(200);
      res.end(JSON.stringify([{ id: 'aaa' }, { id: 'bbb' }]));
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, host: `http://127.0.0.1:${server.address().port}` });
    });
    server.on('error', reject);
  });
}

function runCli(args, { env, input = '' }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${args.join(' ')}`));
    }, 10000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function createEnv(host) {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-deleted-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({ clientId: 'CLIENT_ID', redirectUri: 'http://localhost:11595', host }),
  );
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    tokenFile,
    JSON.stringify({
      access_token: ACCESS_TOKEN,
      refresh_token: 'REFRESH_TOKEN',
      token_type: 'bearer',
      expires_in: 3600,
    }),
  );
  return {
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      MENDELEY_CONFIG: configFile,
      MENDELEY_TOKEN_FILE: tokenFile,
    },
  };
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
