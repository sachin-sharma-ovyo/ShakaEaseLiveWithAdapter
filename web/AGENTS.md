# Web player engineering rules

## Scope

- These instructions apply to `web/**` only. The Web package is `@white-label/player-web`; Android, Android TV, iOS, tvOS, Kotlin/Gradle, Swift, `Frameworks/`, and mobile assets are out of scope.
- Read `packages/shared-sdk/web/**`, root npm/TypeScript config, and the vendored `@white-label/ui-react` package only when needed to understand Web contracts. Do not edit files outside `web/**` without explicit user approval. Never silently change a shared contract.
- Preserve pre-existing work. Do not reformat, revert, or fold unrelated changes into a player task.
- Prefer the smallest behavior-preserving change. Do not replace an SDK, add a dependency, alter public exports, change content/ad identifiers, or refactor across engines without explicit approval and a concrete need.

## Architecture boundaries

- `src/player/PlaybackBridge.ts` is the host-facing contract shared by the Shaka and Bitmovin entries. Keep both subpath exports compatible unless the request is explicitly engine-specific.
- `src/player/IWebPlayer.ts` is the narrower contract used by Ease Live. Player wrappers implement it; `src/plugin/WebPlayerPlugin.ts` is the only Web layer that should coordinate a player with Ease Live and optional ads.
- Keep SDK calls inside their adapters: Shaka in `src/shaka/**`, Bitmovin in `src/bitmovin/**`, IMA scheduling in `src/ads/**`, and demo composition/configuration in `src/index.ts`, `src/demo/**`, and `src/config/**`.
- React controls render state supplied by an `IPlaybackBridge`. Do not make controls reach into raw Shaka/Bitmovin instances or create a second player/video.
- Treat `src/index.ts` and `index.html` as a demo, not a package API. Library entry points are `src/shaka/index.ts` and `src/bitmovin/index.ts`; keep `package.json` exports, `typesVersions`, and `tsup.config.ts` aligned.

## React and TypeScript

- Keep strict TypeScript types and use the existing interfaces, discriminated unions, listener sets, and unsubscribe functions. Avoid `any`; narrow SDK events locally when vendor types are incomplete.
- Follow the existing class-based SDK adapters and functional React controls. Do not introduce application-wide state management for player-local state.
- Subscribe in effects and return every unsubscribe. Keep callback identities stable when an SDK requires the same function for `on/off` or `add/removeEventListener`.
- A bridge mounted after autoplay may have missed early SDK events; preserve the convention that subscriptions replay current state when a meaningful snapshot exists. `onEnded` remains edge-triggered.
- Keep labels injectable through control props and retain accessible names, slider keyboard behavior, and live-stream seek restrictions.

## Player and controls invariants

- Mount exactly one player per wrapper. Destroy the bridge/player before removing its owned wrapper; make teardown idempotent and prevent teardown events from reaching unmounted React.
- Keep media time in seconds inside player/controls contracts. Ease Live timecodes are integer Unix epoch milliseconds. Convert only at the adapter boundary.
- Clamp VOD seeks and volume. Do not percentage-seek a live stream. Preserve DRM mapping to Widevine and PlayReady and the optional VOD start time.
- Keep stock player UI disabled. Custom `@white-label/ui-react` controls own play/pause, +/-10 seconds, progress, volume, settings, episodes, and fullscreen. The host still owns its surrounding dialog, focus trap, Escape/back behavior, sessions, i18n, and device selection.
- Preserve settings semantics: `null` means automatic quality or subtitles off; speeds are unavailable for live; hide settings without choices; offer audio only when more than one logical track exists.
- Preserve overlay stacking and pointer behavior: video/Bitmovin host at the bottom, IMA above content while active, Ease Live above content when no ad is active, and the small control layer on top. Only interactive descendants should intercept pointer events.

## Shaka and Google IMA

- Reuse the `ShakaPlayer` created by the demo when mounting `ShakaControls`; `ShakaPlaybackBridge.connect` must not take ownership of that player. Standalone `bridge.mount` may own and destroy its own player.
- Preserve Shaka browser support checking, polyfill installation, built-in UI disablement, streaming configuration, playback-state mapping, track/settings mapping, and transport-key lock during ads.
- IMA is Shaka-only in the current Web implementation. The SDK comes from the demo CDN script and is initialized through Shaka's ad manager from the first accepted user gesture, before pre-rolls and content load.
- A missing IMA SDK/ad manager, an ad request error, or a start timeout must fail open to content. Keep the generation guard that prevents a late ad from taking over resumed content.
- Build breaks from `AdvertisingInfo`; keep demo VAST tag URLs separate. Position-zero post-rolls run on genuine content end, positive post-rolls are timed, and completed or skipped breaks remove their markers.
- During an ad, lock content transport, suppress content time/state commands, hide custom controls and Ease Live, keep IMA interactions enabled, and restore content/control/overlay state only after the break finishes.
- Do not treat the `ended` event produced while IMA reuses the media element as content completion.

## Ease Live and cross-SDK synchronization

- Register fatal-error and app-status handlers before `EaseLive.init()`. `disabled` and fatal errors destroy the instance; `hidden` does not.
- Emit `player.ready` only after the same player load promise resolves. Emit `player.time` at roughly 4 Hz; prefer configured media-position-zero timecode, then manifest playhead date, and preserve seek-window bounds for live streams.
- Use SDK-only listeners for overlay-to-player commands so emitted player events do not loop back. Ignore overlay play/pause/seek while an ad owns the surface and ignore the initial overlay seek before playback starts.
- Keep explicit overlay control hiding and video-scaling as independent locks. Stage clicks, mouse entry, and post-ad restoration must not reveal controls until both locks are released.
- Apply `player.videoscale` values exactly, with normalized pivots and non-negative duration, then echo the applied value. Restore the unscaled transform when both axes are 1.
- When ads end, reset time interpolation to the restored content position so ad duration is never added to the overlay timecode.

## Lifecycle, errors, and performance

- Every added DOM, window, SDK, bridge, interval, timeout, observer, and React subscription needs a reachable matching cleanup. Clear callbacks/listeners before destroying SDK objects when teardown can emit events.
- Guard async continuations against destroy/unmount and avoid duplicate `load`, `init`, or listener registration. Do not create polling beyond the existing 250 ms Ease Live synchronization unless required.
- Report actionable errors through existing error callbacks/status paths. Do not swallow load failures or expose license keys, tokens, stream credentials, or a real-key demo bundle.
- Avoid work on every `timeupdate` unless needed. Preserve marker/state signature checks, deduplication, and listener snapshots.

## Verification

Run from the repository root, choosing all commands applicable to the change:

```bash
npm run typecheck
npm run build
npm run build:demo
```

There is currently no Web test, lint, or formatter script. Do not claim those checks ran. For runtime-sensitive work, use `npm start` and manually exercise the affected matrix when credentials, streams, and a browser are available:

- Shaka and Bitmovin; VOD and live as relevant.
- Playback, seek, volume, fullscreen, settings, subtitles/audio, and teardown.
- For Shaka ads: pre/mid/post-roll, skip/complete/error/timeout, marker removal, blocked transport keys, and restoration.
- Ease Live ready/time/state, overlay-requested play/pause/seek, controls hide/show, scale/unscale, ad transitions, and fatal/disabled teardown.

The compiler targets ES2015 in `tsconfig.base.json`; the library bundle targets ES2017. No explicit browser matrix or `browserslist` exists. Rely only on Shaka's runtime support check and the actual SDK/browser documentation; state when device/browser verification was unavailable.

## Handoff

- Explain in plain language what behavior changed, where, what was verified, what still needs browser/device testing, and any risk or limitation.
- Distinguish code review/build verification from actual playback, ad, DRM, license, or Ease Live runtime verification.
- Confirm that unrelated Web behavior and all non-Web platforms were left unchanged.
