# Verification and compatibility

Read this reference before claiming completion or deciding which checks are possible.

## Existing automated commands

Run from the repository root:

```bash
npm run typecheck   # TypeScript no-emit check for web
npm run build       # tsup library: Shaka and Bitmovin ESM/CJS/types
npm run build:demo  # production webpack demo bundle
```

Use `npm run install:deps` only when dependencies are missing and installation is authorized. `npm start` runs the Webpack development server on port 8080.

There are no Web unit/integration/E2E tests, ESLint script, formatter script, or CI-backed Web browser matrix in the inspected repository. Do not claim those checks. Generated `web/dist` and `web/dist-demo` are build outputs, not source-edit targets.

## Compile/build compatibility

- Node `>=18.12` is declared at the root.
- TypeScript is strict; base target is ES2015 with DOM libraries, while tsup emits ES2017 library code.
- No `browserslist` is configured. Shaka checks browser support at runtime; the repository does not state a complete supported-browser list.
- React 18+, React DOM 18+, and `@white-label/ui-react` are optional peers for consumer controls. A consuming app using a `file:` package link must resolve those peers to the app's copies to avoid duplicate React/hooks/types.

## Focused manual matrix

Choose scenarios affected by the change; do not claim unavailable ones:

- Engines: `?player=shaka` and `?player=bitmovin` (Bitmovin needs a localhost-enabled `BITMOVIN_KEY` in untracked `web/.env`).
- Media: VOD and live/DVR; HLS/DASH and DRM only when suitable test assets/licenses exist.
- Controls: autoplay snapshot, play/pause, +/-10 seconds, pointer and keyboard seek, live restrictions, volume/mute, settings, subtitle cues, audio, fullscreen, episodes, resize, and unmount/remount.
- IMA (Shaka only): user-gesture initialization, pre-roll, due mid-roll, timed/end post-roll, skippable and complete, request error, missing SDK, timeout, late event, sequential breaks, marker removal, keys, and content restoration.
- Ease Live: player ready, 4 Hz timecodes, manifest/configured epoch, overlay play/pause/seek threshold, explicit controls hide/show, scale/unscale, stage/mouse controls, hidden/disabled/fatal, and ad overlap.

## Honest completion report

Separate these evidence levels:

- static inspection/diff review;
- typecheck;
- library and demo build;
- local browser smoke test;
- real stream/ad/Ease Live program verification;
- target browser/TV remote verification.

Call out credentials, network access, unavailable media, SDK program access, or physical-device constraints. Never infer runtime success from compilation alone.

## Current gaps to preserve in the handoff

- No automated Web tests, lint, formatter, or declared browser support matrix.
- IMA exists only in the Shaka demo path; Bitmovin Web ads are not implemented.
- `AdController`/demo teardown is incomplete: content listeners and full player/ads/Ease Live destruction are not currently centralized.
- Demo behavior depends on external stream, IMA CDN/ad tags, Ease Live programs, and (for Bitmovin) a license key, so production-like runtime verification may not be reproducible locally.
