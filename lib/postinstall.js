/**
 * Postinstall message — printed after `npm install mendeley-cli`.
 *
 * This module is intentionally side-effect free when imported (it only
 * writes to stdout when run directly via `node lib/postinstall.js`), so
 * the message text is unit-testable through {@link postinstallMessage}.
 *
 * It never throws: a postinstall script that throws breaks `npm install`.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const require = createRequire(import.meta.url);
// Resolves to the published package.json (cwd-relative at install time).
const pkg = require('../package.json');

const REPO_URL = 'https://github.com/VictorTomaili/mendeley-cli';

/**
 * Build the postinstall announcement text (no leading/trailing newline).
 *
 * @returns {string}
 */
export function postinstallMessage() {
  return [
    `mendeley-cli v${pkg.version} installed.`,
    ``,
    `This is an unofficial, community-maintained CLI and is not`,
    `affiliated with, endorsed by, or sponsored by Mendeley Ltd. or`,
    `Elsevier.`,
    ``,
    `Quick start:`,
    `  mendeley --help              list all commands`,
    `  mendeley auth login          sign in with your Mendeley account`,
    `  mendeley catalog search "X"  search the public catalog`,
    ``,
    `Docs & source: ${REPO_URL}`,
    `Issues:        ${REPO_URL}/issues`,
    ``,
    `⭐  Found this useful? Star mendeley-cli on GitHub:`,
    `    ${REPO_URL}`,
  ].join('\n');
}

// Only print when invoked directly as `node lib/postinstall.js`.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write('\n' + postinstallMessage() + '\n');
  } catch {
    // Never let the postinstall script fail the install.
  }
}
