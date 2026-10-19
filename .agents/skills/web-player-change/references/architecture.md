# Web architecture and ownership

Read this reference when locating a change, selecting Shaka versus Bitmovin, changing public APIs, or reasoning about demo startup.

## Build and entry points

- Root `package.json` delegates install, typecheck, library build, demo build, and dev-server commands into `web/`; Node `>=18.12` is declared.
- `web/package.json` defines the private `@white-label/player-web` package. It exports only `./shaka`, `./bitmovin`, and `./bitmovin.css` plus package metadata.
- `web/tsup.config.ts` builds ESM and CJS library entries with declarations and source maps, targeting ES2017. Shaka, Bitmovin, React, and UI dependencies remain external.
- `web/webpack.config.js` builds only the demo from `web/src/index.ts` and inlines `BITMOVIN_KEY` from `web/.env` or the environment. A real-key `dist-demo` must not be published.
- `web/index.html` supplies the demo shell and loads Google IMA from its CDN. `src/index.ts` chooses `?player=shaka` or dynamically imports the `?player=bitmovin` demo.

## Contracts and dependency direction

```text
host app
  -> shaka/index.ts or bitmovin/index.ts
  -> IPlaybackBridge
  -> engine wrapper / SDK

demo
  -> engine wrapper + controls bridge
  -> createWebPlayerPlugin(IWebPlayer, optional AdController, startTimecode)
  -> EaseLiveComponent
```

- `src/player/PlaybackBridge.ts`: public host API for mount/destroy, playback, percent seeking, volume, events, optional settings, and `PlayerModule`.
- `src/player/IWebPlayer.ts`: internal player capability required by Ease Live. Both `ShakaPlayer` and `BitmovinPlayer` implement it.
- `packages/shared-sdk/web/plugininterface/`: six-event typed contract (`player.time`, `player.state`, `player.ready`, `player.controls`, `app.status`, `easelive.error`). It is outside the default edit scope.
- `src/plugin/WebPlayerPlugin.ts`: the single coordinator allowed to know a player, Ease Live, and optional Shaka ads at once.

## Ownership map

- `src/shaka/ShakaPlayer.ts`: Shaka lifecycle, stream/DRM load, state events, transport lock, scaling, native UI disablement.
- `src/shaka/ShakaPlaybackBridge.ts`: common control API and React-control state; may connect to an existing player or own a standalone player.
- `src/shaka/ShakaSettings.ts`, `ShakaControls.tsx`, `mountShakaControls.tsx`: tracks/settings, UI-react control bar, and demo mounting.
- `src/bitmovin/BitmovinPlayer.ts`: Bitmovin lifecycle and `IWebPlayer` implementation.
- `src/bitmovin/BitmovinPlaybackBridge.ts`: owned wrapper, common control API, settings/subtitle adapters, and state replay.
- `src/bitmovin/BitmovinSettings.ts`, `BitmovinSubtitles.ts`, `BitmovinControls.tsx`: settings normalization, browser-drawn cue text, and UI-react controls.
- `src/ads/**`: content cue conversion and the Shaka client-side IMA controller.
- `packages/shared-sdk/web/easelive/EaseLiveComponent.ts`: Ease Live creation/init/destroy wrapper.
- `src/config/**`: demo content, ad, and Ease Live configuration. Do not mistake demo values for library defaults.
- `src/app.css` and engine CSS: stacking, pointer ownership, controls, and markers.

## State model

There is no global React store or context. SDK wrappers publish state to listener sets; bridges normalize it; React components subscribe in effects. The Ease Live adapter separately converts player state/time/control visibility to the overlay contract. Keep these flows event-driven and local.

## Shared versus engine-specific behavior

- Both engines: mount/load/destroy, DRM URL, VOD resume, play/pause/seek/volume, settings, custom controls, Ease Live time/state/scaling.
- Shaka only: current Google IMA integration, content cue scheduling, ad markers, transport-key blocking during ads.
- Bitmovin only: license key requirement, stock UI disabled at construction, browser `TextTrack` subtitle cue rendering.
- Demo only: query parameters, status text, sample stream/VAST tags/Ease Live programs, CDN IMA script.
