# Shaka and Google IMA flow

Read this reference for Shaka playback, ad scheduling, markers, skip/error/timeout behavior, or content/ad transitions.

## Startup order

1. `src/index.ts` creates `ShakaPlayer`, mounts React controls by connecting `ShakaPlaybackBridge` to that same player/video, converts content cues to `AdBreak[]`, and wires markers.
2. If ad breaks exist, the demo waits for click, Enter, MediaPlay, or Samsung media-play. Inside that gesture, `AdController.tryInit` finds the global IMA SDK, obtains Shaka's ad manager, sets `ads.skipPlayDetection`, and calls `initClientSide`.
3. Pre-rolls run sequentially before stream load. Content time listeners are then bound for timed breaks and content end.
4. The stream load starts; Ease Live initializes against the same readiness promise; content autoplays after load on the ad path.

If IMA or Shaka's ad manager is absent or init fails, `tryInit` returns false and content continues without scheduled ads.

## Cue and request semantics

- `createAdBreaks` accepts non-negative finite `contentTimePosition` values and maps `PREROLL`, `MIDROLL`, and `POSTROLL` to demo tag URLs.
- Mid-rolls and positive-position post-rolls become due when content time reaches their offsets. Position-zero post-rolls run only after genuine content end.
- Each break is requested as a standalone `google.ima.AdsRequest`; a fresh `correlator` is set.
- `AdController` serializes breaks on `breakQueue`. Generation checks and the start timeout stop late managers from taking over content.
- A break is marked watched only after it started and emits complete or skipped. Error/timeout/stop finishes the wait but does not falsely mark it watched.

## State transitions

`AdController.onChange` exposes `{active, phase}` where phase is `loading` or `playing`.

- On active: `ShakaPlayer.setTransportLocked(true)`, `ShakaPlaybackBridge.setAdActive(true)`, custom controls hide, wrapper/view gain `ad-break`, content commands/time events are suppressed, and Ease Live reports buffering while loading then paused while playing.
- IMA owns the ad container and its interactions. Content transport methods no-op; the capture key handler blocks common keyboard/remote transport keys except events inside the ad container. Enter is deliberately left available for ad skip controls.
- On inactive: content transport unlocks, CSS classes clear, controls restore subject to Ease Live control/scale locks, time interpolation snaps back to content, and current content state/time is emitted.

Do not reorder these operations without checking overlay and controls restoration.

## Markers

- `createAdBreakMarkerSchedule` separates pre, mid, positive post, and end-post states.
- The React path stores schedule state in `ShakaPlaybackBridge`; `ShakaControls` renders marker siblings positioned over the UI-react slider. It never mutates the slider's React-owned DOM.
- Completion or skip calls both player and bridge marker-removal methods in the demo. Live markers outside the current seek window are hidden and recomputed as the window moves.

## Shaka behavior to preserve

- Runtime `isBrowserSupported` check and Shaka polyfills.
- Built-in UI disabled, no big play button, no Shaka keyboard playback controls.
- Streaming configuration: zero rebuffer goal, one-second safe seek offset, zero inaccurate-manifest tolerance.
- DRM URL applied to Widevine and PlayReady; positive finite start time passed to `load`.
- State mapping from video/Shaka events, deduplicated by last state.
- `ShakaSettings` normalizes rates, variants, text tracks, audio languages/roles, and ABR `null` semantics.

## Known lifecycle gap

`AdController.bindContent` currently installs media listeners without returning a disposer, and the controller has no public `destroy`. The demo also does not explicitly destroy its player, ads controller, and Ease Live instance on page exit. Do not claim complete runtime cleanup. If a task touches this lifecycle, add a coherent idempotent teardown path rather than another untracked listener.
