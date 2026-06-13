/**
 * Tiny argument parser used by the CLI.  Avoids pulling in a full
 * dependency like `commander` for what is, ultimately, a handful of
 * sub-commands.
 *
 * Supported syntax:
 *
 *     mendeley <command> [subcommand] [flags...] [--] [positional...]
 *
 * Flags may be `--key=value`, `--key value`, or `--key` (boolean).
 * Boolean flags can be negated with `--no-key`.
 *
 * Unknown flags become errors.  Use `--` to end flag parsing.
 */

import process from 'node:process';

export class ArgvError extends Error {}

/**
 * Parse `argv` (defaulting to `process.argv.slice(2)`) into
 * `{ command, args, flags }`.
 *
 * Flags may appear before OR after the command.  The first
 * non-flag token is the command; everything after it is split into
 * `args` (positional) and `flags` (recognized with `--key`/`--key=val`).
 *
 * @param {string[]} argv
 * @returns {{ command: string, args: string[], flags: Record<string, any> }}
 */
export function parse(argv = process.argv.slice(2)) {
  const flags = {};
  const args = [];
  let command = null;
  let foundCommand = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!foundCommand) {
      if (tok.startsWith('-')) {
        // Leading flag — parse it here so `--format` (etc.) work
        // when placed before the subcommand.
        i = parseFlag(tok, i, argv, flags) - 1;
        continue;
      }
      // First non-flag token is the command.
      command = tok;
      foundCommand = true;
      continue;
    }
    if (tok === '--') {
      for (let j = i + 1; j < argv.length; j++) args.push(argv[j]);
      break;
    }
    if (tok.startsWith('--')) {
      i = parseFlag(tok, i, argv, flags) - 1;
      continue;
    }
    if (tok.startsWith('-') && tok.length > 1) {
      throw new ArgvError(`short flags are not supported: ${tok}`);
    }
    args.push(tok);
  }

  return { command, args, flags };
}

/**
 * Parse a single `--key` or `--key=value` flag.
 * @param {string} tok current token (e.g. `--key` or `--key=val`)
 * @param {number} i index of `tok` in `argv`
 * @param {string[]} argv
 * @param {object} flags output bag
 * @returns {number} new index (the caller should subtract 1 before
 *   the for-loop's i++).
 */
function parseFlag(tok, i, argv, flags) {
  const eq = tok.indexOf('=');
  let key;
  let value;
  if (eq >= 0) {
    key = tok.slice(2, eq);
    value = tok.slice(eq + 1);
  } else {
    key = tok.slice(2);
    if (key.startsWith('no-')) {
      flags[key.slice(3)] = false;
      return i + 1;
    }
    // Peek the next token to see if it's a value.  Known boolean
    // flags are always treated as boolean, regardless of the next
    // token, so the user can write `--quiet auth status` and have
    // `auth` parsed as the command (not as the value of `quiet`).
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('-') || BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      return i + 1;
    }
    value = next;
    i += 1;
  }
  if (value === 'true') flags[key] = true;
  else if (value === 'false') flags[key] = false;
  else flags[key] = value;
  return i + 1;
}

// Flags that are always boolean, so the parser doesn't try to eat
// the next token as their value.  Add to this set when adding a new
// `--no-value` flag.
const BOOLEAN_FLAGS = new Set([
  'help',
  'h',
  'version',
  'v',
  'skill',
  'quiet',
  'q',
  'all',
  'yes',
  'y',
  'browser',
]);

/**
 * Parse a string into a JS value: JSON, number, boolean, or plain string.
 * Used for flag values that may be either JSON or plain text.
 */
export function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === '') return value;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if (value === 'undefined') return undefined;
  return value;
}
