/**
 * Unit tests for the top-level Mendeley client.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Mendeley } from '../../src/client.js';
import {
  AuthorizationCodeAuthenticator,
  ClientCredentialsAuthenticator,
  ImplicitGrantAuthenticator,
} from '../../src/auth.js';

test('Mendeley requires a client id', () => {
  const m = new Mendeley({ clientId: 'cid' });
  assert.equal(m.clientId, 'cid');
  assert.equal(m.host, 'https://api.mendeley.com');
});

test('Mendeley.startClientCredentialsFlow returns an authenticator', () => {
  const m = new Mendeley({ clientId: 'cid', clientSecret: 'sec' });
  const auth = m.startClientCredentialsFlow();
  assert.ok(auth instanceof ClientCredentialsAuthenticator);
});

test('Mendeley.startAuthorizationCodeFlow returns an authenticator', () => {
  const m = new Mendeley({ clientId: 'cid', redirectUri: 'https://x/cb' });
  const auth = m.startAuthorizationCodeFlow();
  assert.ok(auth instanceof AuthorizationCodeAuthenticator);
});

test('Mendeley.startImplicitGrantFlow returns an authenticator', () => {
  const m = new Mendeley({ clientId: 'cid', redirectUri: 'https://x/cb' });
  const auth = m.startImplicitGrantFlow();
  assert.ok(auth instanceof ImplicitGrantAuthenticator);
});

test('Mendeley.startAuthorizationCodeFlowAsync returns a PKCE-enabled authenticator', async () => {
  const m = new Mendeley({ clientId: 'cid', redirectUri: 'https://x/cb' });
  const auth = await m.startAuthorizationCodeFlowAsync({ usePkce: true });
  assert.ok(auth instanceof AuthorizationCodeAuthenticator);
  assert.ok(auth.codeChallenge);
  assert.ok(auth.codeVerifier);
});
