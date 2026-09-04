# Compiler Companion — Phase 1

An initial, security-first implementation of an AI coding environment. It contains a Monaco editor, language-aware starter files, output/diagnostic panes, a project file list, a structured patch preview, and an API boundary for execution and AI analysis.

## Run locally

1. Copy `.env.example` to `.env` and leave `EXECUTION_ENABLED=false` until Docker Desktop is available.
2. Run `npm install` then `npm run dev`.
3. Open the URL printed by Vite (normally `http://localhost:5173`).

The UI remains usable without Docker; Run clearly reports that secure execution is unavailable. The API deliberately does **not** fall back to launching Python/C++ on the host.

## Architecture

```text
React + Monaco UI -> Express API -> Execution service -> language adapter -> Docker sandbox
                         |-> AI provider -> structured suggestion/patch -> user approval
```

Language adapters own extension, version command, compile/run behavior, parsers, and resource defaults. The core API only accepts the adapter id and never interpolates code into a shell command. Docker uses a read-only root filesystem, disabled networking, dropped capabilities, PID/memory/CPU limits, a non-root user, and a short timeout.

## What Phase 1 includes

- Python and C++ adapters, secure Docker runner configuration, standard diagnostic parsing
- Single-file in-browser project workspace (persistence/auth come next)
- Monaco editor and real execution API state/error handling
- Local structured diagnostic analysis and safe, explicitly approved patch application
- AI-provider interface ready for a server-side provider key; no key is exposed to the client

## Explicitly deferred

Authentication, durable projects/database, multi-file builds, terminal sessions, streaming provider responses, voice, avatar/character settings, and autonomous auto-fix verification are subsequent milestones. See `docs/architecture.md`.
