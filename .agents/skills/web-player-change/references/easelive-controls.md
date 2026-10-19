# Ease Live, controls, and cross-SDK flow

Read this reference for overlay events, Unix timecodes, video scaling, control visibility, CSS layering, or any change spanning playback and ads.

## Instance lifecycle

- `EaseLiveComponent` creates `@ease-live/ease-live-bridge-web` with account, program, optional project, environment, view container, and player plugin.
- It attaches `easelive.error` and `app.status` handlers before `init`. Fatal errors and `disabled` destroy the bridge; warning and `hidden` leave it alive.
- The component's `startTimecode` config is consumed by the Web player plugin, not passed to the SDK constructor.

## Player plugin directions

Overlay to player listeners use the SDK-only flag so player-originated emits cannot loop back:

- `player.state`: honor only `playing` and `paused`, and ignore during ads.
- `player.time`: after playback has started, relative-seek when the requested epoch differs by at least 750 ms; ignore during ads and ignore the initial sync.
- `player.controls`: maintain an explicit overlay hide lock; defer changes received during an ad.
- `player.videoscale`: maintain a separate scale lock, apply values exactly, and echo the applied payload.
- `stage.clicked`: toggle controls only when no ad or overlay lock exists.
- `view.mouseenter`: show controls only when no ad or overlay lock exists.

Player to overlay:

- `player.ready` follows a successful player load and includes the raw player plus container.
- `player.state` follows deduplicated wrapper state unless an ad is active.
- `player.time` is emitted every 250 ms once ready.
- `player.controls` reports current visibility except that an active ad always reports hidden.

## Timecode rules

All player positions are seconds; all overlay timecodes are integer Unix epoch milliseconds.

1. If `startTimecode` is configured, `timecode = startTimecode + mediaPosition * 1000`.
2. Otherwise use the player's manifest playhead date. For live DVR, derive initial/max timecodes from the seek window; for live without a usable window, set both equal to current.
3. Without either source, continue from the last known epoch using the position delta; before any epoch exists, emit nothing.

When an ad ends, reset the interpolation base to restored content time before emitting. Never add ad duration to content timecode.

## Control locks

Two independent overlay conditions hide controls:

- explicit SDK-originated `player.controls: hidden`;
- either `player.videoscale` axis below 1.

Controls may show only when both conditions are released and no ad is active. A full-size scale does not cancel an explicit hide. A visible controls request does not override an active scale. Changes received during an ad apply after the ad finishes.

## Layout and pointer ownership

Current demo stack:

```text
z=3  ui-react controls (small bottom layer; descendants interactive)
z=2  Ease Live view (hidden/non-interactive during ads)
z=1/6 Google IMA ad container (non-interactive when idle; interactive during ads)
z=0  video or Bitmovin host
```

`player.videoscale` transforms only the video element around normalized pivots. Keep overlay coordinates aligned by applying SDK values exactly. Restoring both axes to 1 removes the transform. Avoid full-surface pointer layers in controls because Ease Live needs the remaining video area.

## Cross-SDK regression checklist

- Overlay play/pause/seek cannot drive content during ads.
- An ad start hides controls and overlay before IMA becomes interactive.
- An ad end restores controls only if both overlay locks permit it.
- Scale/unscale during an ad is deferred correctly.
- Stage clicks and mouse entry cannot break overlay locks.
- Time stays on the content timeline across ad duration and seeks.
- Fatal/disabled teardown cannot leave a running time interval or callbacks into destroyed state.
