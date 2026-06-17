/**
 * Regression test for #130: `findFileById()` used to call
 * `session.files.list()` once and search only the FIRST page of the
 * user library. Files on later pages were silently reported as
 * "not found", breaking `files get`, `files download`,
 * `files add-highlight`, and `files add-sticky-note` for any library
 * with more than one page of files.
 *
 * Fix (#130): `findFileById()` now traverses every page via the
 * async iterator (`files.iter()`), stopping as soon as the file is
 * found. It also accepts `--document`/`--group`/`--catalog` scope
 * flags.
 *
 * These tests run the real CLI binary against a stub HTTP server that
 * serves the user-library files across TWO pages, then assert that a
 * second-page file is correctly found.
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));
const ACCESS_TOKEN = 'ACCESS_TOKEN_FOR_TEST';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

test('files get finds a file on the SECOND page (#130)', async () => {
  const captured = { listRequests: [] };
  const { server, host } = await startPaginatedApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  // file-2 lives on page 2; before the fix this returned "not found".
  const result = await runCli(['--format', 'json', 'files', 'get', 'file-2'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  assert.equal(out.id, 'file-2');
  assert.equal(out.filename, 'second-page.pdf');
  // The lookup must have followed the next-page link (proving it
  // traversed beyond the first page).
  assert.ok(
    captured.listRequests.some((u) => u.includes('page=2')),
    `must request page 2; got ${JSON.stringify(captured.listRequests)}`,
  );
});

test('files get on a first-page file still works (#130)', async () => {
  const { server, host } = await startPaginatedApiServer({});
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'json', 'files', 'get', 'file-1'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  assert.equal(out.id, 'file-1');
  assert.equal(out.filename, 'first-page.pdf');
});

test('files get reports a clean error for a missing file (#130)', async () => {
  const { server, host } = await startPaginatedApiServer({});
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'json', 'files', 'get', 'does-not-exist'], { env });

  assert.notEqual(result.code, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /File not found/);
});

test('files get respects --document scope (#130)', async () => {
  const captured = { listRequests: [] };
  const { server, host } = await startPaginatedApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(
    ['--format', 'json', 'files', 'get', 'file-2', '--document', 'doc-special'],
    { env },
  );

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  assert.equal(out.id, 'file-2');
  // The document-scoped list request must carry document_id.
  assert.ok(
    captured.listRequests.some((u) => u.includes('document_id=doc-special')),
    `must scope by document_id; got ${JSON.stringify(captured.listRequests)}`,
  );
});

test('files add-highlight finds a second-page file before posting (#130)', async () => {
  const captured = { annotationsPost: null };
  const { server, host } = await startPaginatedApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(
    [
      '--format',
      'json',
      'files',
      'add-highlight',
      'file-2',
      '--positions',
      '[{"top_left":{"x":1,"y":2},"bottom_right":{"x":3,"y":4},"page":1}]',
    ],
    { env },
  );

  assert.equal(result.code, 0, result.stderr || result.stdout);
  // The annotation must have been created against the second-page file's
  // resolved document_id + filehash.
  assert.ok(captured.annotationsPost, 'POST /annotations must be received');
  assert.equal(captured.annotationsPost.document_id, 'doc-2');
  assert.equal(captured.annotationsPost.filehash, 'HASH-2');
});

/* ── helpers ────────────────────────────────────────────────────────────── */

function startPaginatedApiServer(captured) {
  const server = createServer((req, res) => {
    const url = req.url;

    // Capture list-style requests for scope/page assertions.
    if (req.method === 'GET' && url.startsWith('/files')) {
      if (captured.listRequests) captured.listRequests.push(url);

      // Parse out any scope the client sent.
      const sp = new URL(url, 'http://x');
      const documentId = sp.searchParams.get('document_id') || '';
      // Page selection: default to page 1; a marker forces page 2.
      const page2 = sp.searchParams.get('page') === '2' || sp.searchParams.get('marker') === 'p2';

      const file1 = {
        id: 'file-1',
        filename: 'first-page.pdf',
        content_type: 'application/pdf',
        size: 1,
        filehash: 'HASH-1',
        document_id: 'doc-1',
      };
      const file2 = {
        id: 'file-2',
        filename: 'second-page.pdf',
        content_type: 'application/pdf',
        size: 2,
        filehash: 'HASH-2',
        document_id: 'doc-2',
      };

      res.setHeader('content-type', 'application/json');
      res.setHeader('mendeley-count', '2');
      if (!page2) {
        // Page 1: return file-1 and a next-link to page 2.
        res.setHeader('link', `</files?page=2>; rel="next"`);
        res.end(JSON.stringify([file1]));
      } else {
        // Page 2: return file-2, no next link.
        res.end(JSON.stringify([file2]));
      }
      // document_id scope is reflected in captured requests only;
      // the same two-file fixture is used either way so the lookup
      // finds the requested id.
      void documentId;
      return;
    }

    if (req.method === 'POST' && url === '/annotations') {
      let chunks = '';
      req.on('data', (c) => {
        chunks += c;
      });
      req.on('end', () => {
        try {
          captured.annotationsPost = JSON.parse(chunks);
        } catch {
          captured.annotationsPost = { raw: chunks };
        }
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'ann-1',
            document_id: captured.annotationsPost.document_id,
            filehash: captured.annotationsPost.filehash,
            positions: captured.annotationsPost.positions || [],
          }),
        );
      });
      return;
    }

    if (req.method === 'GET' && url.startsWith('/documents/')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: 'doc-2', title: 'Paper' }));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
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
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
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
  const root = mkdtempSync(join(tmpdir(), 'mendeley-files-pg-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'CLIENT_ID',
      redirectUri: 'http://localhost:11595',
      host,
    }),
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
