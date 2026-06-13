/**
 * Unit tests for the CLI credentials helper.
 *
 * Regression coverage for the bug where `loadCredentials()` ignored
 * `token.json`, leaving `buildSession()` to fall back to the
 * client-credentials flow.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadCredentials } from '../../lib/cli/credentials.js';

describe('loadCredentials', () => {
  let tmp;
  let savedConfig;
  let savedToken;
  let savedEnv;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mendeley-cred-'));
    savedConfig = process.env.MENDELEY_CONFIG;
    savedToken = process.env.MENDELEY_TOKEN_FILE;
    savedEnv = { ...process.env };
  });

  after(() => {
    if (savedConfig === undefined) delete process.env.MENDELEY_CONFIG;
    else process.env.MENDELEY_CONFIG = savedConfig;
    if (savedToken === undefined) delete process.env.MENDELEY_TOKEN_FILE;
    else process.env.MENDELEY_TOKEN_FILE = savedToken;
  });

  it('merges access/refresh token from token.json when not in credentials.json', () => {
    mkdirSync(join(tmp, 'a'), { recursive: true });
    const cfgPath = join(tmp, 'a', 'credentials.json');
    const tokPath = join(tmp, 'a', 'token.json');
    writeFileSync(cfgPath, JSON.stringify({ clientId: '12345' }));
    writeFileSync(tokPath, JSON.stringify({
      access_token: 'AT_FROM_FILE',
      refresh_token: 'RT_FROM_FILE',
    }));
    process.env.MENDELEY_CONFIG = cfgPath;
    process.env.MENDELEY_TOKEN_FILE = tokPath;
    // Wipe env-var overrides so we know the values came from the files.
    delete process.env.MENDELEY_ACCESS_TOKEN;
    delete process.env.MENDELEY_REFRESH_TOKEN;

    const c = loadCredentials();
    assert.equal(c.clientId, '12345');
    assert.equal(c.accessToken, 'AT_FROM_FILE');
    assert.equal(c.refreshToken, 'RT_FROM_FILE');
  });

  it('env vars still take precedence over token.json', () => {
    mkdirSync(join(tmp, 'b'), { recursive: true });
    const cfgPath = join(tmp, 'b', 'credentials.json');
    const tokPath = join(tmp, 'b', 'token.json');
    writeFileSync(cfgPath, JSON.stringify({ clientId: '999' }));
    writeFileSync(tokPath, JSON.stringify({
      access_token: 'AT_FILE',
      refresh_token: 'RT_FILE',
    }));
    process.env.MENDELEY_CONFIG = cfgPath;
    process.env.MENDELEY_TOKEN_FILE = tokPath;
    process.env.MENDELEY_ACCESS_TOKEN = 'AT_ENV';
    process.env.MENDELEY_REFRESH_TOKEN = 'RT_ENV';

    const c = loadCredentials();
    assert.equal(c.accessToken, 'AT_ENV');
    assert.equal(c.refreshToken, 'RT_ENV');
  });

  it('credentials.json values are not overwritten by missing token.json', () => {
    mkdirSync(join(tmp, 'c'), { recursive: true });
    const cfgPath = join(tmp, 'c', 'credentials.json');
    const tokPath = join(tmp, 'c', 'token.json');
    writeFileSync(cfgPath, JSON.stringify({
      clientId: '555',
      accessToken: 'AT_CFG',
      refreshToken: 'RT_CFG',
    }));
    process.env.MENDELEY_CONFIG = cfgPath;
    process.env.MENDELEY_TOKEN_FILE = tokPath;
    delete process.env.MENDELEY_ACCESS_TOKEN;
    delete process.env.MENDELEY_REFRESH_TOKEN;

    const c = loadCredentials();
    assert.equal(c.accessToken, 'AT_CFG');
    assert.equal(c.refreshToken, 'RT_CFG');
  });
});
