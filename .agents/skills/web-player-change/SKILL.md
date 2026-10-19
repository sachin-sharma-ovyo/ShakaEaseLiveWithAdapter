---
name: web-player-change
description: Safely implement or diagnose natural-language change requests for this repository's React/TypeScript Web player, including Shaka, Bitmovin, Google IMA ads, Ease Live overlays, and custom controls. Excludes Android, iOS, tvOS, and unrelated repository work.
---

# Web Player Change

Translate the user's everyday-language request into the smallest safe change to the existing Web player. The user does not need to name files, SDKs, React concepts, or events.

## Establish scope

1. Read `web/AGENTS.md` and obey it.
2. Inspect the current worktree before editing; preserve unrelated and pre-existing changes.
3. Work in `web/**` by default. Read `packages/shared-sdk/web/**` when a Web contract requires context, but request explicit approval before editing outside `web/**`. Never modify Android, Android TV, iOS, tvOS, Kotlin/Gradle, Swift, frameworks, or mobile assets.
4. Ask a question only when different interpretations materially change user-visible behavior, an external/shared contract, credentials, dependencies, destructive actions, or production risk. Otherwise state a reasonable assumption and proceed.

## Route the request

Read only the references relevant to the task:

- For entry points, package APIs, file ownership, or choosing an engine, read [references/architecture.md](references/architecture.md).
- For Shaka playback, IMA ads, markers, ad-state restoration, or transport locking, read [references/shaka-ima.md](references/shaka-ima.md).
- For Ease Live events, timecodes, overlay scaling, controls visibility, CSS layering, or cross-SDK state, read [references/easelive-controls.md](references/easelive-controls.md).
- For Bitmovin, common playback bridges, React controls, tracks/settings, subtitles, fullscreen, or host integration, read [references/playback-controls.md](references/playback-controls.md).
- For validation, browser/device limits, or release confidence, read [references/verification.md](references/verification.md).

## Workflow

### Understand and locate

- Restate the requested outcome internally in observable terms: what the viewer does, what should happen, and under which engine/ad/overlay state.
- Search for the owning public contract, adapter, event, component, CSS layer, config, and existing cleanup path. Trace both directions of an event before changing it.
- Determine whether the behavior is common, Shaka-only, Bitmovin-only, IMA-only, Ease Live-only, demo-only, or a cross-SDK interaction. Do not invent absent behavior.

### Plan and implement

- Choose the narrowest owner consistent with the architecture. Keep SDK-specific code in its adapter and shared behavior behind existing interfaces.
- List important regression risks before editing: async order, duplicate callbacks, teardown, ad/content ownership, time units, controls locks, pointer layers, live/VOD differences, and public export compatibility.
- Preserve unrelated behavior, public APIs, dependency versions, and configuration. Require explicit approval for dependencies, destructive changes, shared/out-of-scope edits, or production identifiers/credentials.
- Pair every new listener, subscription, timer, observer, player, React root, and DOM node with idempotent cleanup. Protect pending promises from publishing into destroyed state.
- Keep ads, content, overlay, and controls as distinct state owners. Never fix one transition by bypassing another owner's lock.

### Verify

- Inspect the diff for scope, accidental formatting, secrets, missing cleanup, and contradictions with `web/AGENTS.md`.
- Run the existing applicable commands from the repository root: `npm run typecheck`, `npm run build`, and `npm run build:demo`.
- Perform focused browser checks when the required stream, license, IMA network access, Ease Live program, and device/browser are available. Never describe a compile/build as playback verification.
- If no automated test/lint command exists, say so. If runtime checks are unavailable, name the exact scenarios still requiring manual verification.

### Explain

Report in plain language:

- what changed and the behavior to expect;
- the main files or subsystem involved, without assuming SDK expertise;
- commands and runtime scenarios actually verified;
- remaining browser/device, ad-tag, DRM/license, or Ease Live checks;
- risks, limitations, and confirmation that non-Web platforms and unrelated code were untouched.
