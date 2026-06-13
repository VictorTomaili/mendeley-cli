/**
 * CLI output helpers.
 *
 * The CLI defaults to JSON output (the format most useful for AI
 * agents) but can be asked for "text", "tsv", or "ids" formats.
 *
 * The chosen format is controlled by the `--format` flag.
 */

import process from 'node:process';

/**
 * Output helpers.
 */
export class Output {
  static KNOWN_FORMATS = ['json', 'text', 'tsv', 'ids'];

  constructor(format = 'json') {
    if (!Output.KNOWN_FORMATS.includes(format)) {
      throw new Error(
        `unknown --format "${format}" (expected one of: ${Output.KNOWN_FORMATS.join(', ')})`,
      );
    }
    this.format = format;
  }

  /**
   * Print `value` using the configured format and exit.
   * @param {*} value
   */
  done(value) {
    this.write(value);
    process.exit(0);
  }

  /**
   * Print `value` using the configured format.
   * @param {*} value
   */
  write(value) {
    const out = this._format(value);
    if (out === null || out === undefined) return;
    process.stdout.write(out.endsWith('\n') ? out : out + '\n');
  }

  /** Print an error and exit non-zero. */
  fail(message, code = 1) {
    if (this.format === 'json') {
      process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + '\n');
    } else {
      process.stderr.write(`error: ${message}\n`);
    }
    process.exit(code);
  }

  _format(value) {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (this.format === 'json') return JSON.stringify(value, jsonReplacer, 2);
    if (this.format === 'ids') return formatIds(value);
    if (this.format === 'tsv') return formatTsv(value);
    if (this.format === 'text') return formatText(value);
    return JSON.stringify(value, null, 2);
  }
}

/** JSON.stringify replacer that turns Mendeley objects into plain JS. */
function jsonReplacer(_key, value) {
  if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
    return value.toJSON();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function formatIds(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const ids = value.map(pluckId);
    if (ids.every((x) => typeof x === 'string')) return ids.join('\n');
    return JSON.stringify(value, jsonReplacer);
  }
  // `list` commands return `{ count, items: [...] }`; extract items.
  if (value && typeof value === 'object' && Array.isArray(value.items)) {
    return formatIds(value.items);
  }
  if (value && typeof value === 'object' && 'id' in value) return String(value.id);
  return JSON.stringify(value, jsonReplacer);
}

function pluckId(v) {
  if (v && typeof v === 'object') {
    if (typeof v.toJSON === 'function') {
      const j = v.toJSON();
      return j && j.id !== undefined ? j.id : j;
    }
    return v.id;
  }
  return v;
}

function formatTsv(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.items)) {
    value = value.items;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Single object: convert to a one-row table.
    value = [value];
  }
  if (!Array.isArray(value) || value.length === 0) return '';
  const rows = value.map((v) => (v && typeof v.toJSON === 'function' ? v.toJSON() : v));
  const cols = new Set();
  for (const r of rows) for (const k of Object.keys(r)) cols.add(k);
  const headers = [...cols];
  const lines = [headers.join('\t')];
  for (const r of rows) {
    lines.push(headers.map((h) => stringifyTab(r[h])).join('\t'));
  }
  return lines.join('\n');
}

function stringifyTab(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).replace(/[\t\r\n]/g, ' ');
}

function formatText(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.items)) {
    value = value.items;
  }
  if (Array.isArray(value)) {
    return value.map(formatText).join('\n\n');
  }
  if (value && typeof value === 'object') {
    if (typeof value.toJSON === 'function') value = value.toJSON();
    // Skip very large nested objects in text mode — the agent can ask
    // for JSON if it wants them.
    const SKIP = new Set([
      'reader_count_by_subdiscipline',
      'reader_count_by_country',
      'reader_count_by_academic_status',
    ]);
    const lines = [];
    for (const [k, v] of Object.entries(value)) {
      if (SKIP.has(k) && v && typeof v === 'object' && Object.keys(v).length > 5) {
        lines.push(`${k}: <${Object.keys(v).length} entries; use --format json to see them>`);
        continue;
      }
      lines.push(`${k}: ${formatValue(v)}`);
    }
    return lines.join('\n');
  }
  return String(value);
}

function formatValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Wrap a generator into an array so it can be JSON-serialised.
 */
export async function collect(generator) {
  const out = [];
  for await (const v of generator) out.push(v);
  return out;
}
