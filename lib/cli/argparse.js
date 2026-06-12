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
 * @param {string[]} argv
 * @returns {{ command: string, args: string[], flags: Record<string, any> }}
 */
export function parse(argv = process.argv.slice(2)) {
  const flags = {};
  const args = [];
  let command = null;
  let i = 0;

  // First non-flag argument is the command (and optional subcommand).
  while (i < argv.length && argv[i].startsWith('-') === false) {
    if (command === null) {
      command = argv[i];
    } else {
      args.push(argv[i]);
    }
    i += 1;
  }

  for (; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--') {
      // Remaining tokens are positional.
      for (i = i + 1; i < argv.length; i++) args.push(argv[i]);
      break;
    }
    if (tok.startsWith('--')) {
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
          continue;
        }
        // Peek the next token to see if it's a value.
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          flags[key] = true;
        } else {
          flags[key] = next;
          i += 1;
        }
        continue;
      }
      if (value === 'true') flags[key] = true;
      else if (value === 'false') flags[key] = false;
      else flags[key] = value;
    } else if (tok.startsWith('-') && tok.length > 1) {
      throw new ArgvError(`short flags are not supported: ${tok}`);
    } else {
      args.push(tok);
    }
  }

  return { command, args, flags };
}

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
