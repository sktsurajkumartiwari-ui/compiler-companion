# Phase 1 architecture and milestones

## Stack

React, TypeScript, Vite and Monaco form the client. An Express TypeScript API owns trusted operations. Docker is the only production execution transport; image definitions are maintained beside deployment infrastructure. PostgreSQL + object storage are the intended Phase 2 persistence layer, with Redis for execution queues and WebSockets for status streaming.

## Data flow

The editor holds a workspace model. Run sends a selected file, language id, and optional stdin to `POST /api/execute`. The API validates size and adapter, delegates to a Docker-only runner, normalizes compiler/runtime diagnostics, and returns execution metadata. AI analysis is a separate request and returns a typed suggestion; patches stay previews until the client applies them. A future Auto-Fix flow must snapshot, patch, compile, test, and restore on failure.

## AI and voice boundaries

`AIProvider` is server-only and receives a minimum selected context bundle. Its contract returns typed advice and `PatchProposal`, never raw file operations. Speech-to-text and TTS will be behind analogous provider interfaces. Voice intents map to the same explicit UI/API commands (run, analyze, propose patch); they do not gain hidden tools.

## Character system

A character profile will separately persist display assets, licensed voice choice, and behavioral settings. State is a finite set (idle, listening, thinking, speaking, success, warning). Character inspiration must not imply identity or voice cloning.

## Security risks and controls

Untrusted code is the critical risk: no host fallback, no network, bounded resources, non-root execution, read-only root, ephemeral work dir, and an allow-listed adapter registry. Additional required controls: authentication and authorization before persistent projects, per-user rate limits, audit logs, encrypted secrets, prompt-injection-resistant tool authorization, content/size limits, and isolated per-user storage.

## Milestones

1. **Foundation (implemented):** safe execution contract, Python/C++, editor, diagnostics, explicit patch preview.
2. **Workspace:** auth, database projects, multi-file compilation, versions and diff viewer.
3. **Assistant:** server AI provider, selected-context engine, streaming chat, verified patch loop.
4. **Companion:** voice providers, commands, accessible character/avatar profiles.
5. **Scale:** queues, WebSockets, observability, more adapters, collaboration, cloud isolation.
