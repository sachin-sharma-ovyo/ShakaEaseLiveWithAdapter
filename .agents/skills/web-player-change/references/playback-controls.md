# Playback engines and custom controls

Read this reference for Bitmovin, common bridge behavior, React controls, settings, subtitles, fullscreen, or host integration.

## Common host contract

Both public entries export `createBridge(config)` and `Controls`. `IPlaybackBridge` owns mount/destroy, snapshot time, playback, percent seek, volume, state subscriptions, ended events, and optional settings.

- Config comes from the host. Bitmovin requires `licenseKey`; Shaka ignores it. Autoplay defaults true. Bitmovin also accepts `subtitleBottomPercent`.
- `mount(container, streamUrl, drmLicenseUrl?, startTime?)` loads DASH/HLS/progressive as supported by the engine, maps one DRM URL to Widevine/PlayReady, and applies only a positive finite VOD start time.
- Listener APIs replay a current snapshot when possible so controls mounted after autoplay do not miss initial events. Ended stays edge-triggered.
- Percent seek is VOD-only and clamped. Volume is 0-100 and unmutes for values above zero.

## React controls

`ShakaControls` and `BitmovinControls` are functional React adapters over `@white-label/ui-react/PlaybackControl`.

- They provide play/pause, +/-10-second skip, pointer/keyboard scrubbing, volume/mute, stream-derived settings, optional episodes, and Fullscreen API toggling.
- Live shows `Live`, disables the progress slider, and does not expose playback rates.
- Arrow Left/Right skip, Home/End seek to boundaries. Accessible slider values and translated labels must remain intact.
- They exit fullscreen on unmount only if that control instance entered it.
- The host owns the surrounding dialog, back/Escape/focus behavior, localization values, stream sessions, and device choice.
- Settings use `null` for auto quality and subtitles off. Hide rows without choices and audio unless more than one logical track exists.

Shaka controls additionally consume bridge ad markers and block skips while an ad is active. `mountShakaControls` connects to an existing player and destroys only its bridge/React root/layer, not that player.

## Bitmovin specifics

- `BitmovinPlaybackBridge.mount` creates a dedicated inner wrapper. This prevents overlapping players during React StrictMode's async teardown. Destroy clears host listeners and adapters, destroys the player, then removes the wrapper.
- `BitmovinPlayer` runs with `ui: false`; controls visibility is an application flag published to the host. The demo uses it to hide the controls layer.
- State is mapped from Bitmovin events. VOD seeking uses relative seconds; live relative seek uses the time-shift window.
- `BitmovinSettings` deduplicates audio/subtitle labels, filters forced subtitles from the menu, sorts qualities highest-first, and preserves Bitmovin's normal buffered delay after a manual quality selection. Do not restore the unsupported buffer-clearing workaround described in its source comments.
- Because stock UI is off, `BitmovinSubtitles` listens for cue enter/exit and renders text through a browser `TextTrack`. It ignores image subtitles, clears cues on disable/source unload, and positions text by `subtitleBottomPercent` (default 25). This renderer is separate from the subtitle settings menu.

## Shaka specifics

- `ShakaPlaybackBridge.connect` attaches common control events to an existing wrapper/video without ownership. `mount` is a separate standalone path that owns its wrapper/player.
- `ShakaSettings` derives rate, ABR/quality, text visibility, and logical audio options directly from Shaka tracks.
- Shaka's built-in UI and keyboard playback controls remain off; the ui-react layer is the interactive control surface.

## Cleanup expectations

- React effects unsubscribe all bridge/settings listeners and disconnect resize/window listeners or observers.
- SDK adapter `attach` and `detach` must be symmetric. Bind named callbacks when `off` requires identity.
- Clear listeners before SDK destroy when destroy can emit source/playback events.
- Do not remove a wrapper owned by a newer mount or let a late async result publish into unmounted UI.
