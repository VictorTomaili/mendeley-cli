/**
 * Tests for issue #105: Windows invocation documentation.
 *
 * The CLI's `auth login` flow is headless and the CLI is
 * positioned for AI-agent and scripting workflows. Many of those
 * use a Python (or other-language) orchestrator that drives the
 * CLI via `subprocess`. On Windows, `subprocess.run(["mendeley",
 * ...])` fails with FileNotFoundError because npm installs a
 * `.CMD` shim that CreateProcess does not auto-execute.
 *
 * The minimum fix (#105) is documentation: a README section +
 * a note in `mendeley --help` pointing users at the workaround.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/mendeley.js', import.meta.url));
const README = fileURLToPath(new URL('../../README.md', import.meta.url));

function createEnv() {
  const root = mkdtempSync(join(tmpdir(), 'mendeley-win-'));
  const home = join(root, 'home');
  mkdirSync(join(home, '.mendeley'), { recursive: true });
  const configFile = join(root, 'credentials.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      clientId: 'CLIENT_ID',
      redirectUri: 'http://localhost:11595',
      host: 'http://127.0.0.1:1',
    }),
  );
  const tokenFile = join(root, 'token.json');
  writeFileSync(
    tokenFile,
    JSON.stringify({ access_token: 'A', refresh_token: 'R', expires_in: 3600 }),
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
  delete env.MENDELEY_ACCESS_TOKEN;
  delete env.MENDELEY_REFRESH_TOKEN;
  return env;
}

function runCli(args, { env, timeoutMs = 10000 } = {}) {
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
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end();
  });
}

test('README has a "Calling mendeley from another language on Windows" section (#105)', () => {
  const readme = readFileSync(README, 'utf8');
  assert.match(
    readme,
    /Calling `mendeley` from another language.*Windows/i,
    'README must document the Windows invocation workaround',
  );
});

test('README mentions CreateProcess / .CMD / subprocess (#105)', () => {
  const readme = readFileSync(README, 'utf8');
  assert.match(readme, /\.CMD/i);
  assert.match(readme, /CreateProcess/i);
  assert.match(readme, /subprocess/i);
});

test('README shows at least one Python workaround (#105)', () => {
  const readme = readFileSync(README, 'utf8');
  // Option A: shutil.which("mendeley.cmd")
  // Option B: shell=True
  // Option C: call node directly
  assert.match(readme, /shutil\.which|shell=True/);
});

test('README mentions this is Windows-only (#105)', () => {
  const readme = readFileSync(README, 'utf8');
  assert.match(readme, /only affects Windows/i);
});

test('mendeley --help mentions the Windows note (#105)', async () => {
  const env = createEnv();
  const result = await runCli(['--help'], { env });
  const output = result.stdout + result.stderr;
  assert.match(output, /Windows/i);
  assert.match(output, /\.CMD|subprocess|shell/i);
});
