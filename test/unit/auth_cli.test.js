/**
 * Unit tests for the auth CLI command surface.
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));
const ACCESS_TOKEN = 'ACCESS_SECRET_SHOULD_NOT_PRINT';
const REFRESH_TOKEN = 'REFRESH_SECRET_SHOULD_NOT_PRINT';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

test('auth exchange saves tokens without printing bearer material', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env, home, tokenFile } = createAuthEnv(host);
  const pendingDir = join(home, '.mendeley');
  mkdirSync(pendingDir, { recursive: true });
  writeFileSync(
    join(pendingDir, 'pending_auth.json'),
    JSON.stringify({
      code_verifier: 'A'.repeat(64),
      state: 'EXPECTED_STATE',
      redirect_uri: 'http://localhost:11595',
      created_at: new Date().toISOString(),
    }),
  );

  const result = await runCli(['--format', 'json', 'auth', 'exchange', 'AUTH_CODE'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(result.stdout, new RegExp(REFRESH_TOKEN));

  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.expires_in, 3600);
  assert.equal(output.token_file, tokenFile);
  assert.equal(output.access_token, undefined);
  assert.equal(output.refresh_token, undefined);

  const saved = JSON.parse(readFileSync(tokenFile, 'utf8'));
  assert.equal(saved.access_token, ACCESS_TOKEN);
  assert.equal(saved.refresh_token, REFRESH_TOKEN);
});

test('auth login saves tokens without printing bearer material', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env, tokenFile } = createAuthEnv(host);

  // Bare code (no URL state) — this test is about token redaction, not
  // state validation. See the dedicated state-mismatch tests for the
  // state-validation behavior.
  const result = await runCli(['--format', 'json', 'auth', 'login'], {
    env,
    input: 'AUTH_CODE\n',
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(result.stdout, new RegExp(REFRESH_TOKEN));

  const output = parseTrailingJson(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.expires_in, 3600);
  assert.equal(output.token_file, tokenFile);
  assert.equal(output.access_token, undefined);
  assert.equal(output.refresh_token, undefined);
  assert.equal(output.profile.id, 'profile-1');

  const saved = JSON.parse(readFileSync(tokenFile, 'utf8'));
  assert.equal(saved.access_token, ACCESS_TOKEN);
  assert.equal(saved.refresh_token, REFRESH_TOKEN);
});

test('auth login prints ordered browser-handoff instructions (#53)', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env } = createAuthEnv(host);

  const result = await runCli(['auth', 'login'], {
    env,
    input: 'AUTH_CODE\n',
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);

  // Numbered, ordered steps.
  assert.match(result.stdout, /Step 1/);
  assert.match(result.stdout, /Step 2/);
  assert.match(result.stdout, /Step 3/);
  assert.match(result.stdout, /Step 4/);

  // The authorisation URL is present and visually distinct (indented
  // under Step 1). We just check it's there.
  assert.match(result.stdout, /oauth\/authorize/);

  // The prompt explicitly asks for the full redirect URL and shows
  // the expected localhost host.
  assert.match(result.stdout, /Redirect URL \(http:\/\/localhost:11595/);

  // The copy does NOT imply the CLI opens a browser or runs a
  // callback server — instead it explicitly says it does not.
  assert.match(result.stdout, /does not run a callback server/);
  assert.match(result.stdout, /browser redirects to a/);
  // Mentions that the localhost error page is normal.
  assert.match(result.stdout, /normal/);
});

test('auth login rejects a redirect URL whose state does not match the saved state', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env, tokenFile } = createAuthEnv(host);

  const result = await runCli(['auth', 'login'], {
    env,
    // Pasting a redirect with a state that doesn't match the one the
    // CLI just generated. The token server should never be hit.
    input: 'http://localhost:11595/?code=AUTH_CODE&state=ATTACKER_STATE\n',
  });

  assert.notEqual(result.code, 0, 'CLI should fail on state mismatch');
  assert.match(result.stdout + result.stderr, /OAuth state mismatch/);

  // No token file should be written on mismatch.
  try {
    readFileSync(tokenFile, 'utf8');
    assert.fail('token file should not exist after a state-mismatch failure');
  } catch (err) {
    assert.match(err.code, /ENOENT/);
  }
});

test('auth exchange rejects a redirect URL whose state does not match pending state', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env, home, tokenFile } = createAuthEnv(host);
  const pendingDir = join(home, '.mendeley');
  mkdirSync(pendingDir, { recursive: true });
  writeFileSync(
    join(pendingDir, 'pending_auth.json'),
    JSON.stringify({
      code_verifier: 'A'.repeat(64),
      state: 'EXPECTED_STATE',
      redirect_uri: 'http://localhost:11595',
      created_at: new Date().toISOString(),
    }),
  );

  const result = await runCli(
    ['auth', 'exchange', 'http://localhost:11595/?code=AUTH_CODE&state=ATTACKER_STATE'],
    { env },
  );

  assert.notEqual(result.code, 0, 'CLI should fail on state mismatch');
  assert.match(result.stdout + result.stderr, /OAuth state mismatch/);
  try {
    readFileSync(tokenFile, 'utf8');
    assert.fail('token file should not exist after a state-mismatch failure');
  } catch (err) {
    assert.match(err.code, /ENOENT/);
  }
});

test('auth exchange accepts a bare code (documented escape hatch) when pending state exists', async () => {
  const { server, host } = await startAuthServer();
  servers.push(server);
  const { env, home, tokenFile } = createAuthEnv(host);
  const pendingDir = join(home, '.mendeley');
  mkdirSync(pendingDir, { recursive: true });
  writeFileSync(
    join(pendingDir, 'pending_auth.json'),
    JSON.stringify({
      code_verifier: 'A'.repeat(64),
      state: 'EXPECTED_STATE',
      redirect_uri: 'http://localhost:11595',
      created_at: new Date().toISOString(),
    }),
  );

  const result = await runCli(['auth', 'exchange', 'BARE_CODE_VALUE'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const saved = JSON.parse(readFileSync(tokenFile, 'utf8'));
  assert.equal(saved.access_token, ACCESS_TOKEN);
});

test('auth url saves PKCE verifier to disk without printing it', async () => {
  // No OAuth server needed: `auth url` only generates a verifier + state
  // locally and never hits the network.
  const { env, home } = createAuthEnv('http://api.test.invalid');

  const result = await runCli(['--format', 'json', 'auth', 'url'], { env });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  // The verifier (a 43-128 char string) must not appear anywhere in stdout.
  assert.doesNotMatch(result.stdout, /code_verifier/);

  const output = JSON.parse(result.stdout);
  assert.equal(typeof output.login_url, 'string');
  assert.ok(output.login_url.includes('oauth/authorize'));
  assert.equal(typeof output.state, 'string');
  assert.equal(output.code_verifier, undefined);

  // The verifier must still be saved on disk for the subsequent
  // `auth exchange` step.
  const pendingPath = join(home, '.mendeley', 'pending_auth.json');
  const saved = JSON.parse(readFileSync(pendingPath, 'utf8'));
  assert.equal(typeof saved.code_verifier, 'string');
  assert.ok(
    saved.code_verifier.length >= 43 && saved.code_verifier.length <= 128,
    `PKCE verifier length out of spec: ${saved.code_verifier.length}`,
  );
  assert.equal(saved.state, output.state);
  assert.equal(saved.redirect_uri, 'http://localhost:11595');
});

/* ── auth set / auth unset: no token leakage into credentials.json ───────── */

test('auth set does not copy token.json material into credentials.json', async () => {
  const { env, configFile, tokenFile } = createAuthEnv('http://api.test.invalid');
  // Pre-populate token.json as if `auth login` had just completed.
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN }),
  );
  // Also set the token env vars that loadCredentials() merges in.
  env.MENDELEY_ACCESS_TOKEN = ACCESS_TOKEN;
  env.MENDELEY_REFRESH_TOKEN = REFRESH_TOKEN;

  const result = await runCli(['auth', 'set', 'clientId', 'NEW_CLIENT_ID'], { env });
  assert.equal(result.code, 0, result.stderr || result.stdout);

  const written = JSON.parse(readFileSync(configFile, 'utf8'));

  // The newly set key is present.
  assert.equal(written.clientId, 'NEW_CLIENT_ID');
  // No token material leaked from token.json or env vars.
  assert.equal(written.accessToken, undefined);
  assert.equal(written.refreshToken, undefined);
  assert.equal(written.access_token, undefined);
  assert.equal(written.refresh_token, undefined);
  // And as raw text, the bearer material must not appear.
  const raw = readFileSync(configFile, 'utf8');
  assert.doesNotMatch(raw, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(raw, new RegExp(REFRESH_TOKEN));
});

test('auth set strips legacy token keys already present in credentials.json', async () => {
  const { env, configFile } = createAuthEnv('http://api.test.invalid');
  // Simulate a credentials.json from a pre-fix version that has token
  // keys persisted. auth set should write back without them.
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'OLD_CLIENT_ID',
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      host: 'https://api.mendeley.com',
    }),
  );

  const result = await runCli(['auth', 'set', 'redirectUri', 'http://localhost:11595'], {
    env,
  });
  assert.equal(result.code, 0, result.stderr || result.stdout);

  const written = JSON.parse(readFileSync(configFile, 'utf8'));
  assert.equal(written.clientId, 'OLD_CLIENT_ID');
  assert.equal(written.host, 'https://api.mendeley.com');
  assert.equal(written.redirectUri, 'http://localhost:11595');
  assert.equal(written.accessToken, undefined);
  assert.equal(written.refreshToken, undefined);
});

test('auth set rejects keys outside the allowlist', async () => {
  const { env } = createAuthEnv('http://api.test.invalid');
  const result = await runCli(['auth', 'set', 'accessToken', 'something'], { env });
  assert.notEqual(result.code, 0, 'auth set should reject non-allowlisted keys');
  assert.match(result.stdout + result.stderr, /Unknown credential key/);
});

test('auth unset does not copy token.json material into credentials.json', async () => {
  const { env, configFile, tokenFile } = createAuthEnv('http://api.test.invalid');
  // Pre-populate token.json + env vars.
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN }),
  );
  env.MENDELEY_ACCESS_TOKEN = ACCESS_TOKEN;
  env.MENDELEY_REFRESH_TOKEN = REFRESH_TOKEN;
  // And a credentials.json with a real key to remove.
  writeFileSync(
    configFile,
    JSON.stringify({ clientId: 'TO_REMOVE', redirectUri: 'http://localhost:11595' }),
  );

  const result = await runCli(['auth', 'unset', 'clientId'], { env });
  assert.equal(result.code, 0, result.stderr || result.stdout);

  const written = JSON.parse(readFileSync(configFile, 'utf8'));
  assert.equal(written.clientId, undefined);
  assert.equal(written.redirectUri, 'http://localhost:11595');
  assert.equal(written.accessToken, undefined);
  assert.equal(written.refreshToken, undefined);
  const raw = readFileSync(configFile, 'utf8');
  assert.doesNotMatch(raw, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(raw, new RegExp(REFRESH_TOKEN));
});

function createAuthEnv(host) {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-auth-cli-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });

  const configFile = join(root, 'credentials.json');
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'CLIENT_ID',
      redirectUri: 'http://localhost:11595',
      host,
    }),
  );

  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    MENDELEY_CONFIG: configFile,
    MENDELEY_TOKEN_FILE: tokenFile,
  };
  delete env.MENDELEY_CLIENT_ID;
  delete env.MENDELEY_CLIENT_SECRET;
  delete env.MENDELEY_REDIRECT_URI;
  delete env.MENDELEY_ACCESS_TOKEN;
  delete env.MENDELEY_REFRESH_TOKEN;

  return { env, home, configFile, tokenFile };
}

async function startAuthServer() {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/oauth/token') {
      req.resume();
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_in: 3600,
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/profiles/me') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: 'profile-1', display_name: 'Test User' }));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    host: `http://127.0.0.1:${server.address().port}`,
  };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
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

function parseTrailingJson(stdout) {
  const start = stdout.lastIndexOf('\n{');
  assert.notEqual(start, -1, `stdout did not contain trailing JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start + 1));
}
