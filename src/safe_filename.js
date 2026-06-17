/**
 * Validation helpers for filenames used by file download / stream-to-file
 * paths.  Shared between the SDK (src/models/files.js) and the CLI
 * (lib/cli/file_helper.js) so the same security rules apply at both
 * layers.
 *
 * Threat model: the Mendeley API response (or an attacker-controlled
 * compatible API) can set Content-Disposition to any filename.  If we
 * naively join that with the user-supplied destination directory, a
 * name like `../../etc/passwd` writes outside the directory.  Absolute
 * paths and reserved names are similarly dangerous.
 */

import { isAbsolute, resolve, sep } from 'node:path';

/** @type {TextEncoder} */
const _encoder = new TextEncoder();

/**
 * Percent-encode a single character (possibly multi-byte) as UTF-8 for
 * use in an RFC 5987 `filename*` ext-value.
 * @param {string} ch
 * @returns {string}
 */
function pctEncodeUtf8(ch) {
  return Array.from(_encoder.encode(ch))
    .map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

// RFC 5987 attr-char: ALPHA / DIGIT / "-" / "." / "_" / "~".
// These are the only characters allowed unencoded in an ext-value.
const ATTR_CHAR = /[A-Za-z0-9\-._~]/;

/**
 * Build a standards-compliant `Content-Disposition: attachment` value
 * for a filename (#140).
 *
 * Always emits BOTH:
 *   - a quoted ASCII fallback  `filename="..."`  (RFC 6266), with
 *     `"` and `\` backslash-escaped and non-ASCII / control chars
 *     replaced by `_`, so legacy parsers that only read `filename=`
 *     still get a safe value; and
 *   - a UTF-8 percent-encoded  `filename*=UTF-8''...`  (RFC 5987), so
 *     filenames with spaces, quotes, semicolons, or non-ASCII
 *     characters round-trip exactly on RFC-compliant servers.
 *
 * @param {string} filename
 * @returns {string} e.g. `attachment; filename="my_file.pdf"; filename*=UTF-8''my%20file.pdf`
 */
export function formatContentDisposition(filename) {
  const raw = String(filename ?? '');
  const asciiFallback = raw
    .replace(/[\u0000-\u001F\u007F]/g, '_') // control chars
    .replace(/[^\x20-\x7E]/g, '_') // non-ASCII → '_'
    .replace(/(["\\])/g, '\\$1'); // escape " and \
  const extValue = Array.from(raw)
    .map((ch) => (ATTR_CHAR.test(ch) ? ch : pctEncodeUtf8(ch)))
    .join('');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${extValue}`;
}

/**
 * Validate that `filename` is safe to use as a basename within a target
 * directory.  Throws on any rejection.  Returns the basename unchanged
 * on success.
 *
 * Rules:
 * - Must be a non-empty string.
 * - Must not contain a path separator ('/' or '\').
 * - Must not be an absolute path.
 * - Must not be a reserved name ('.' or '..').
 * - Must not contain a NUL byte.
 *
 * @param {unknown} filename
 * @returns {string}
 */
export function safeFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('Invalid filename: must be a non-empty string');
  }
  if (filename.includes('\0')) {
    throw new Error(`Invalid filename: contains NUL byte: ${JSON.stringify(filename)}`);
  }
  if (isAbsolute(filename)) {
    throw new Error(
      `Invalid filename: absolute paths are not allowed: ${JSON.stringify(filename)}`,
    );
  }
  if (filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Invalid filename: contains path separator: ${JSON.stringify(filename)}`);
  }
  if (filename === '.' || filename === '..') {
    throw new Error(`Invalid filename: reserved name: ${JSON.stringify(filename)}`);
  }
  return filename;
}

/**
 * Parse a `filename=...` value from a Content-Disposition header.
 * Returns the raw extracted name (which still needs to be passed
 * through `safeFilename` before use).
 *
 * Handles both the plain form (`filename=foo.txt`) and the RFC 5987
 * form (`filename*=UTF-8''foo%20bar.txt`).
 *
 * @param {string|null|undefined} headerValue
 * @returns {string|null}
 */
export function parseContentDispositionFilename(headerValue) {
  if (!headerValue) return null;
  // RFC 5987: filename*=UTF-8''<percent-encoded> — preferred when present.
  const ext = headerValue.match(/filename\*=UTF-8''([^;\r\n]+)/i);
  if (ext) {
    try {
      return decodeURIComponent(ext[1].trim());
    } catch {
      return null;
    }
  }
  // Plain: filename="foo.txt" or filename=foo.txt
  const plain = headerValue.match(/filename="?([^";\r\n]+)"?/i);
  return plain ? plain[1].trim() : null;
}

/**
 * Join `filename` with `directory` and verify the result stays inside
 * `directory`.  Throws if it doesn't.
 *
 * @param {string} directory
 * @param {string} filename  (must already pass safeFilename)
 * @returns {string} the resolved full path
 */
export function safeJoin(directory, filename) {
  const safe = safeFilename(filename);
  const dirResolved = resolve(directory);
  const fullPath = resolve(dirResolved, safe);
  if (fullPath !== dirResolved && !fullPath.startsWith(dirResolved + sep)) {
    throw new Error(
      `Resolved path escapes target directory: directory=${JSON.stringify(directory)} ` +
        `filename=${JSON.stringify(filename)} resolved=${JSON.stringify(fullPath)}`,
    );
  }
  return fullPath;
}
