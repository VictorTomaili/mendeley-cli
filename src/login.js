/**
 * Helper utilities for the **authorization code** flow used by the CLI.
 *
 * Provides:
 *  - {@link listenForCode} - start a local HTTP server that captures the
 *    `?code=...&state=...` query string from a browser redirect and
 *    resolves with it.
 */

import { createServer } from 'node:http';

/**
 * Start a one-shot HTTP server on the given port (or a free port if
 * `port === 0`) and resolve when a single request is received.
 *
 * @typedef {Object} CapturedCode
 * @property {string} code the authorization code
 * @property {string} state the state value returned by the server
 * @property {string} redirectUri the actual redirect_uri used
 *
 * @param {number} [port=0] port to listen on (0 = pick a free one)
 * @param {string} [expectedState] if provided, reject if the callback
 *   state doesn't match
 * @returns {Promise<{port: number, captured: Promise<CapturedCode>, close: Function, setState: Function}>}
 */
export function listenForCode(port = 0, expectedState) {
  let capturedResolve;
  let capturedReject;
  const captured = new Promise((res, rej) => {
    capturedResolve = res;
    capturedReject = rej;
  });

  // Mutable so we can set it after the server has started.
  let _expectedState = expectedState;
  // Reject redirects older than 5 minutes (prevents stale/replay redirects).
  const _startTime = Date.now();
  const MAX_AGE_MS = 5 * 60 * 1000;

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        if (!isExpectedState(state, _expectedState)) {
          rejectCallback(res, stateMismatchMessage(_expectedState, state));
          return;
        }
        res.statusCode = 400;
        res.setHeader('content-type', 'text/html');
        res.end(errorPage(`Authentication failed: ${escapeHtml(error)}`));
        capturedReject(new Error(`OAuth error: ${error}`));
        server.close();
        return;
      }

      if (code) {
        // Reject stale redirects (older than 5 minutes).
        if (Date.now() - _startTime > MAX_AGE_MS) {
          res.statusCode = 400;
          res.setHeader('content-type', 'text/html');
          res.end(errorPage('Redirect expired. Please run `mendeley auth login` again.'));
          capturedReject(new Error('Redirect expired'));
          server.close();
          return;
        }

        if (!isExpectedState(state, _expectedState)) {
          rejectCallback(res, stateMismatchMessage(_expectedState, state));
          return;
        }

        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(successPage());
        capturedResolve({ code, state, redirectUri: `http://localhost:${server.address().port}` });
        server.close();
        return;
      }

      // Page reload before the redirect arrives.
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html');
      res.end(errorPage('Waiting for the Mendeley redirect...'));
    } catch (err) {
      capturedReject(err);
      server.close();
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        captured,
        close: () => server.close(),
        /** Set the expected state after the server has started. */
        setState(state) {
          _expectedState = state;
        },
      });
    });
  });
}

function isExpectedState(state, expectedState) {
  return Boolean(expectedState) && state === expectedState;
}

function stateMismatchMessage(expectedState, state) {
  if (!expectedState) {
    return 'OAuth state is not ready yet. Please use the newest login URL from the CLI.';
  }
  return (
    `State mismatch. Expected: ${escapeHtml(expectedState)}, got: ${escapeHtml(state || '(none)')}. ` +
    'This may mean you visited an old login URL. Please use the newest login URL from the CLI.'
  );
}

function rejectCallback(res, message) {
  res.statusCode = 400;
  res.setHeader('content-type', 'text/html');
  res.end(errorPage(message));
}

function successPage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Mendeley</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2em; text-align: center;">
<h1 style="color:#3a8;">You're signed in!</h1>
<p>You can close this tab and return to the terminal.</p>
</body></html>`;
}

function errorPage(message) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Mendeley</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2em; text-align: center;">
<h1 style="color:#c33;">${message}</h1>
</body></html>`;
}

/**
 * Escape HTML-special characters for safe interpolation into the
 * callback pages. Prevents reflected XSS when an attacker-controlled
 * value (e.g. a crafted `?error=` or `?state=` query param) is echoed
 * back to the browser.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}
