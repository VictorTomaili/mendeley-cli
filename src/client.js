/**
 * The top-level Mendeley client.
 *
 * Instantiate this with your app's client ID, optional client secret,
 * and (for the user-flows) a redirect URI.  Then call one of
 * `startClientCredentialsFlow`, `startAuthorizationCodeFlow` or
 * `startImplicitGrantFlow` to begin authenticating.
 */

import {
  AuthorizationCodeAuthenticator,
  ClientCredentialsAuthenticator,
  DefaultStateGenerator,
  ImplicitGrantAuthenticator,
  deriveCodeChallenge,
  generateCodeVerifier,
  isLocalhost,
} from './auth.js';

export class Mendeley {
  /**
   * @param {object} options
   * @param {string} options.clientId
   * @param {string} [options.clientSecret]
   * @param {string} [options.redirectUri]
   * @param {string} [options.host] default: 'https://api.mendeley.com'
   * @param {object} [options.stateGenerator]
   * @param {object} [options.tokenStore] token persistence helper
   */
  constructor({
    clientId,
    clientSecret,
    redirectUri,
    host = 'https://api.mendeley.com',
    stateGenerator,
    tokenStore,
  } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.host = host;
    this.stateGenerator = stateGenerator || new DefaultStateGenerator();
    this.tokenStore = tokenStore || null;

    if (isLocalhost(redirectUri)) {
      process.env.OAUTHLIB_INSECURE_TRANSPORT = '1';
    }
  }

  /**
   * Begin the **client credentials** flow.  Resolves to a
   * {@link ClientCredentialsAuthenticator}; call `authenticate()` on it
   * to obtain a session.
   */
  startClientCredentialsFlow() {
    return new ClientCredentialsAuthenticator(this);
  }

  /**
   * Begin the **authorization code** flow.  Resolves to an
   * {@link AuthorizationCodeAuthenticator}.
   *
   * @param {string} [state] - CSRF state value
   */
  startAuthorizationCodeFlow(state) {
    return new AuthorizationCodeAuthenticator(this, state || this.stateGenerator.generateState());
  }

  /**
   * Async version of {@link startAuthorizationCodeFlow} that supports PKCE.
   *
   * @param {object} [options]
   * @param {string} [options.state]
   * @param {boolean} [options.usePkce=false]
   */
  async startAuthorizationCodeFlowAsync({ state, usePkce = false } = {}) {
    const finalState = state || this.stateGenerator.generateState();
    if (usePkce) {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await deriveCodeChallenge(codeVerifier);
      return new AuthorizationCodeAuthenticator(this, finalState, {
        codeVerifier,
        codeChallenge,
      });
    }
    return new AuthorizationCodeAuthenticator(this, finalState);
  }

  /**
   * Begin the **implicit grant** flow.  Resolves to an
   * {@link ImplicitGrantAuthenticator}.
   */
  startImplicitGrantFlow({ state } = {}) {
    return new ImplicitGrantAuthenticator(this, state || this.stateGenerator.generateState());
  }
}
