/**
 * Unit tests for the `Command` class and the help system.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Command } from '../../lib/cli/command.js';
import { Output } from '../../lib/cli/output.js';

describe('Command', () => {
  it('builds a basic tree with subcommands', () => {
    const root = new Command('test');
    const sub = root.command('list');
    assert.equal(sub.name, 'list');
    assert.ok(root.subcommands.has('list'));
  });

  it('parses `<arg>` placeholders in command names', () => {
    const root = new Command('test');
    const sub = root.command('set <key> <value>');
    assert.equal(sub.name, 'set');
    assert.equal(sub.positional.length, 2);
    assert.equal(sub.positional[0].name, 'key');
    assert.equal(sub.positional[0].required, true);
    assert.equal(sub.positional[1].name, 'value');
    assert.equal(sub.positional[1].required, true);
  });

  it('parses `[arg]` placeholders as optional', () => {
    const root = new Command('test');
    const sub = root.command('show [name]');
    assert.equal(sub.positional.length, 1);
    assert.equal(sub.positional[0].required, false);
  });

  it('renders help with description, options, and examples', () => {
    const root = new Command('test');
    const sub = root
      .command('list')
      .description('list things')
      .option('--limit <n>', 'max number', '10')
      .example('test list --limit 5');
    const help = sub._helpText();
    assert.match(help, /list things/);
    assert.match(help, /--limit/);
    assert.match(help, /test list --limit 5/);
  });

  it('dispatches the action with (args, flags, out)', async () => {
    const root = new Command('test');
    root.isRoot = true;
    let received;
    root
      .command('greet <name>')
      .action((args, flags, out) => {
        received = { args, flags, hasOut: out && typeof out.write === 'function' };
      });
    const out = new Output('json');
    await root.parseAndRun(['greet', 'world'], out);
    assert.deepEqual(received.args, ['world']);
    assert.deepEqual(received.flags, {});
    assert.equal(received.hasOut, true);
  });

  it('dispatches subcommands recursively', async () => {
    const root = new Command('test');
    root.isRoot = true;
    let received;
    const auth = root.command('auth');
    auth
      .command('login')
      .action((args, flags, out) => {
        received = 'login';
      });
    const out = new Output('json');
    await root.parseAndRun(['auth', 'login'], out);
    assert.equal(received, 'login');
  });

  it('passes flags through to the action', async () => {
    const root = new Command('test');
    root.isRoot = true;
    let received;
    root
      .command('list')
      .option('--limit <n>', 'max', '20')
      .action((args, flags, out) => {
        received = flags;
      });
    const out = new Output('json');
    await root.parseAndRun(['list', '--limit', '5'], out);
    assert.equal(received.limit, '5');
  });

  it('parses booleans from --no- flags', async () => {
    const root = new Command('test');
    root.isRoot = true;
    let received;
    root
      .command('list')
      .option('--no-browser', 'no browser', false)
      .action((args, flags, out) => {
        received = flags;
      });
    const out = new Output('json');
    await root.parseAndRun(['list', '--no-browser'], out);
    assert.equal(received.browser, false);
  });

  it('shows help for the deepest matched command with --help', async () => {
    const root = new Command('test');
    root.isRoot = true;
    root
      .command('greet')
      .description('say hello');
    let stdout = '';
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s) => {
      stdout += s;
      return true;
    };
    try {
      const out = new Output('json');
      await root.parseAndRun(['greet', '--help'], out);
    } finally {
      process.stdout.write = orig;
    }
    assert.match(stdout, /greet/);
    assert.match(stdout, /say hello/);
  });

  it('help includes synopsis, subcommands, options, examples', () => {
    const root = new Command('mendeley');
    root.isRoot = true;
    const auth = root
      .command('auth')
      .description('manage auth')
      .longDescription('long body')
      .example('mendeley auth login')
      .example('mendeley auth status');
    auth
      .command('login')
      .description('log in')
      .option('--port <port>', 'port', '0')
      .example('mendeley auth login --port 8080');
    const help = auth._helpText();
    assert.match(help, /Synopsis:/);
    assert.match(help, /Description:/);
    assert.match(help, /long body/);
    assert.match(help, /mendeley auth login/);
    // The login subcommand has the --port option.
    const loginHelp = auth.subcommands.get('login')._helpText();
    assert.match(loginHelp, /--port/);
  });

  it('handles aliases via alias()', () => {
    const root = new Command('test');
    const a = root.command('a').description('a');
    a.alias('aa');
    const help = a._helpText();
    assert.match(help, /Aliases:/);
    assert.match(help, /\baa\b/);
  });

  it('renders the root with global options and env vars', () => {
    const root = new Command('mendeley');
    root.isRoot = true;
    root
      .description('mendeley cli')
      .option('--format <fmt>', 'output format', 'json')
      .envVar('FOO', 'the foo env var')
      .example('mendeley --help');
    const help = root._helpText();
    assert.match(help, /mendeley cli/);
    assert.match(help, /--format/);
    assert.match(help, /FOO/);
    assert.match(help, /mendeley --help/);
  });
});
