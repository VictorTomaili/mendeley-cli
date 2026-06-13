# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-13

### Added

- Initial public release of `mendeley-cli` — a Node.js CLI and JavaScript SDK
  for the Mendeley REST API.
- Shell CLI with **JSON by default** output for AI-agent and scripting use.
- `mendeley --skill` flag that prints the full command surface as a Markdown
  document for LLM system prompts.
- PKCE OAuth flow with automatic token refresh, persistent credential and
  token storage, and a headless two-step `auth url` / `auth exchange` mode.
- Coverage of the major Mendeley resource families (catalog, library, files,
  annotations, …) via the `Mendeley` / `MendeleySession` classes.
- 51 unit and integration tests (integration tests auto-skip without
  credentials).
- Zero runtime dependencies; the optional `open` peer is used only for
  browser-based auth.
- Node.js 18+ support (ESM only).

[Unreleased]: https://github.com/VictorTomaili/mendeley-cli/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/VictorTomaili/mendeley-cli/releases/tag/v1.0.0
