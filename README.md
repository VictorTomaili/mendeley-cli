# mendeley-js-sdk

A modern JavaScript port of the [mendeley-python-sdk](https://github.com/Mendeley/mendeley-python-sdk), plus a CLI designed for AI agents to manage a Mendeley library.

The library targets **Node.js 18+** and uses **ESM** (`"type": "module"`).  No transpilation, no TypeScript build step — just `import { Mendeley } from 'mendeley-js-sdk'`.

## Features

* Full coverage of the Mendeley REST API: documents, files, folders, groups, annotations, catalog, profiles, trash.
* PKCE + refresh-token-based OAuth with a tiny zero-dep auth helper.
* A fluent model layer with lazy fields, pagination, and resource classes.
* A shell CLI (`mendeley`) that defaults to **JSON output** for AI agents, and supports `--format text|tsv|ids` for humans.
* Every CLI command has a `--help` that doubles as a **skill description**, and a root `--skill` flag that prints the full API as a single document you can paste into a system prompt.

## Install

```bash
npm install mendeley-js-sdk
```

Or run the CLI straight from a checkout:

```bash
git clone https://github.com/you/mendeley-js-sdk
cd mendeley-js-sdk
npm install     # only needed for the `open` optional dep
node bin/mendeley.js --help
```

## Library quick start

```js
import { Mendeley } from 'mendeley-js-sdk';

const mendeley = new Mendeley({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:11595',
});

// One-time login (PKCE)
const flow = await mendeley.startAuthorizationCodeFlowAsync({ usePkce: true });
console.log('Open this URL in your browser:');
console.log(flow.getLoginUrl());

// …wait for the callback to be received…
const session = await flow.authenticate(codeFromRedirect);

// Use the library
const me = await session.profiles.me;
console.log(me.first_name);

const docs = await session.documents.all({ view: 'client' });
for (const d of docs) console.log(d.title);
```

## CLI quick start

```bash
# 1. Configure credentials
mendeley auth set clientId 23562
mendeley auth set clientSecret fXn0bokYBMNJVo5S
mendeley auth set redirectUri http://localhost:11595

# 2. Log in (opens a browser, captures the callback, saves token.json)
mendeley auth login

# 3. Confirm
mendeley whoami

# 4. Start working
mendeley documents list --limit 5
mendeley catalog search "machine learning" --format ids --limit 20
mendeley library export-bibtex --out refs.bib
mendeley library dedupe
mendeley library add-by-doi 10.1038/nature12373
```

### Output formats

* `--format json` (default) — a single JSON document.  Best for AI agents.
* `--format text` — a one-record-per-section key/value listing.
* `--format tsv` — a tab-separated table.
* `--format ids` — bare identifiers, one per line.  Best for piping.

### The help system

Every command has a `--help` flag that produces a "skill" description:

```text
$ mendeley documents add-note --help

mendeley documents add-note <id> <text> — add a text note to a document

Synopsis:
  $ mendeley documents add-note <id> <text> [flags]

Description:
  Create a sticky-note style annotation containing the given
  text.  Returns the new annotation JSON.

Examples:
  $ mendeley documents add-note abcdef12 "important — read carefully"
```

For the whole API, run:

```bash
mendeley --skill
```

This prints a single ~500-line Markdown document that describes every command, its options, its examples, and the global conventions.  It's designed to be pasted into an AI agent's system prompt.

## File layout

```
src/                      The library
  client.js               `Mendeley` class — entry point
  session.js              `MendeleySession` — authenticated resource container
  auth.js                 OAuth flow helpers (auth-code, client-credentials, PKCE)
  login.js                Local callback server + browser-opener
  exception.js            `MendeleyException`
  mime.js                 Filename → MIME
  pagination.js           `Page`, `iter`
  response.js             `ResponseObject`, `LazyResponseObject`
  resources/              REST resource classes
  models/                 JSON model classes
bin/mendeley.js           The CLI entrypoint
lib/cli/                  The CLI framework
  command.js              Subcommand framework with help + examples
  output.js               Output formatter (json/text/tsv/ids)
  credentials.js          Build a session from env + config files
  file_helper.js          File-download helper
  commands/               One file per top-level subcommand
test/                     Tests (39 unit + 12 command + 1 integration)
```

## Configuration

* **Credentials** are read from `~/.mendeley/credentials.json` (or `$MENDELEY_CONFIG`).  Use `mendeley auth set <key> <value>` to manage them; recognise keys are `clientId`, `clientSecret`, `redirectUri`, and `host`.
* **Tokens** are stored in `~/.mendeley/token.json` (or `$MENDELEY_TOKEN_FILE`).  The CLI uses the saved refresh token automatically; you only need to log in once.
* **Environment variables** (override config):
  * `MENDELEY_CLIENT_ID`
  * `MENDELEY_CLIENT_SECRET`
  * `MENDELEY_REDIRECT_URI`
  * `MENDELEY_HOST` (default `https://api.mendeley.com`)
  * `MENDELEY_CONFIG` and `MENDELEY_TOKEN_FILE` (paths)

## License

MIT
