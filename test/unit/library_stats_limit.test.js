/**
 * Regression test for #131: `library stats --limit` advertised itself as
 * "maximum number of documents to scan" but used the value only as the
 * page size and then drained EVERY page via `collect()`. A user asking
 * to sample a large library got a full scan.
 *
 * Fix (#131): `library stats` now stops iteration as soon as the cap is
 * reached (via the `take()` helper), so it never fetches more pages than
 * necessary. The same helper fixes the drain-all-then-slice waste in
 * `library recent`.
 *
 * These tests run the real CLI binary against a stub server that serves
 * 120 documents across pages of 50, then assert that `--limit 2` scans
 * exactly 2 documents and fetches only ONE page.
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

test('library stats --limit scans only the requested number (#131)', async () => {
  const captured = { listRequests: 0 };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'json', 'library', 'stats', '--limit', '2'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  // total must be the cap (2), NOT the full library size (120).
  assert.equal(out.total, 2, `expected total=2, got ${out.total}`);
  // The byType stats must reflect only the 2 scanned docs (journal + journal).
  assert.equal(out.byType.journal, 2);
});

test('library stats --limit does not drain every page (#131)', async () => {
  const captured = { listRequests: 0 };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  await runCli(['--format', 'json', 'library', 'stats', '--limit', '2'], { env });

  // 120 docs in pages of 50 → 3 pages total. With the fix we stop after
  // the first page (we got our 2 docs within page 1), so exactly ONE
  // list request must have been made.
  assert.equal(
    captured.listRequests,
    1,
    `expected 1 list request (early stop), got ${captured.listRequests}`,
  );
});

test('library stats without --limit scans the whole library', async () => {
  const captured = { listRequests: 0 };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'json', 'library', 'stats'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  // No cap → full scan of all 120 docs across 3 pages.
  assert.equal(out.total, 120, `expected total=120, got ${out.total}`);
  assert.equal(captured.listRequests, 3);
});

test('library recent --limit stops after the cap (#131)', async () => {
  const captured = { listRequests: 0 };
  const { server, host } = await startApiServer(captured);
  servers.push(server);
  const { env } = createEnv(host);

  const result = await runCli(['--format', 'json', 'library', 'recent', '--limit', '3'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const out = JSON.parse(result.stdout);
  // Only the 3 most-recent docs, fetched from a single page.
  assert.equal(out.count, 3);
  assert.equal(captured.listRequests, 1);
});

/* ── helpers ────────────────────────────────────────────────────────────── */

// 120 documents served in pages of 50 (the hardcoded stats pageSize).
function startApiServer(captured) {
  const TOTAL = 120;
  const PAGE_SIZE = 50;

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/documents')) {
      captured.listRequests += 1;
      const sp = new URL(req.url, 'http://x');
      const page = parseInt(sp.searchParams.get('page') || '1', 10);
      const start = (page - 1) * PAGE_SIZE;
      const slice = Array.from({ length: Math.min(PAGE_SIZE, TOTAL - start) }, (_, i) => {
        const idx = start + i;
        return {
          id: `doc-${idx}`,
          type: 'journal',
          year: 2020 + (idx % 5),
          tags: idx % 2 === 0 ? ['ml'] : ['stats'],
          created: new Date(Date.UTC(2020, 0, 1) + idx * 1000).toISOString(),
        };
      });
      res.setHeader('content-type', 'application/json');
      res.setHeader('mendeley-count', String(TOTAL));
      if (start + PAGE_SIZE < TOTAL) {
        res.setHeader('link', `</documents?page=${page + 1}>; rel="next"`);
      }
      res.writeHead(200);
      res.end(JSON.stringify(slice));
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
  const root = mkdtempSync(join(tmpdir(), 'mendeley-stats-'));
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
