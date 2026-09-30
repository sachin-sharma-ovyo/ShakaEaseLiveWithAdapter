/**
 * Shared player-plugin contract used by every platform.
 * Import these types from `plugininterface/index.ts`. Do not import this file directly.
 * The map below is the whole contract: six events, nothing else.
 */

/** Playback state reported by the player and requested by the overlay. */
export type PlayerState = 'playing' | 'paused' | 'stopped' | 'seeking' | 'buffering';

/** Visibility of the player control bar. */
export type ControlsVisibility = 'visible' | 'hidden';

/** Producer-controlled status of the Ease Live overlay. */
export type AppStatus = 'enabled' | 'hidden' | 'disabled';

/** Severity of an error reported by the Ease Live SDK. */
export type EaseLiveErrorType = 'fatal' | 'warning';

/** Payload for `player.time`. Timecodes are Unix epoch milliseconds. */
export interface PlayerTimePayload {
  /** Timecode at the current playback position. Strip decimals with `Math.floor`. */
  timecode: number;
  /** Timecode at the start of the seekable window. */
  initialTimecode?: number;
  /** Timecode at the end of the seekable window. */
  maxTimecode?: number;
}

/** Payload for `player.state`. */
export interface PlayerStatePayload {
  /** The new player state. */
  state: PlayerState;
}

/**
 * Payload for `player.ready`.
 * `player` and `playerContainer` stay `unknown` so non-web platforms can share this contract.
 * On web, `player` is the player instance and `playerContainer` is the container element or a selector.
 */
export interface PlayerReadyPayload {
  /** Player instance. */
  player?: unknown;
  /** Container the overlay attaches to when no view container was configured. */
  playerContainer?: unknown;
}

/** Payload for `player.controls`. */
export interface PlayerControlsPayload {
  /** New control-bar visibility. */
  controls: ControlsVisibility;
}

/** Payload for `app.status`. */
export interface AppStatusPayload {
  /** New overlay status. */
  status: AppStatus;
}

/** Payload for `easelive.error`. */
export interface EaseLiveErrorPayload {
  /** `fatal` stops the overlay. `warning` lets it continue with reduced functionality. */
  type: EaseLiveErrorType;
  /** Human-readable description of the error. */
  message: string;
  /** Optional SDK error code. */
  code?: number;
  /** Program id when the error is related to subscribing to a program. */
  programId?: string;
}

/**
 * Events shared by every platform player plugin.
 * This map is the whole contract. Do not add events here.
 */
export interface PlayerPluginEvents {
  /**
   * Fired by the player plugin on every video time update, about four times per second.
   * `timecode` is Unix epoch milliseconds. Use `Math.floor` so the value is an integer.
   * Emit it often enough for the overlay to stay in sync, interpolating between timecode updates.
   * The overlay may also emit this event to request a seek to an absolute timecode.
   * `initialTimecode` and `maxTimecode` are optional. Omit them when the stream has no seekable window.
   * For a live stream, set both equal to `timecode` when there is no seekable buffer.
   */
  'player.time': PlayerTimePayload;

  /**
   * Fired by the player plugin whenever playback state changes.
   * `state` is one of `playing`, `paused`, `stopped`, `seeking`, or `buffering`.
   * The overlay may also emit this event to request `playing` or `paused`.
   */
  'player.state': PlayerStatePayload;

  /**
   * Fired once by the player plugin when the player is initialized and ready for playback.
   * Ease Live initializes the overlay view after this event.
   */
  'player.ready': PlayerReadyPayload;

  /**
   * Fired by the player plugin when player controls change visibility.
   * `controls` is `visible` or `hidden`.
   * The control bar must stay in a small area, typically along the bottom, and must not cover the video surface.
   */
  'player.controls': PlayerControlsPayload;

  /**
   * Fired by the overlay when the producer changes overlay status.
   * `disabled` means the bridge instance can be destroyed.
   * `hidden` means the overlay is hidden and may become `enabled` again later.
   * `enabled` means the overlay is active.
   */
  'app.status': AppStatusPayload;

  /**
   * Fired when the SDK or a plugin reports an error.
   * Listen before `init`. On `fatal`, destroy the bridge instance.
   * On `warning`, leave the instance running.
   */
  'easelive.error': EaseLiveErrorPayload;
}

/**
 * Typed bridge a player plugin uses to exchange {@link PlayerPluginEvents}.
 * `fromSdkOnly` limits a listener to events emitted by the SDK or overlay.
 */
export interface PlayerPluginBridge {
  emit<K extends keyof PlayerPluginEvents>(event: K, payload: PlayerPluginEvents[K]): void;
  on<K extends keyof PlayerPluginEvents>(
    event: K,
    listener: (payload: PlayerPluginEvents[K]) => void,
    fromSdkOnly?: boolean,
  ): void;
  off<K extends keyof PlayerPluginEvents>(
    event: K,
    listener: (payload: PlayerPluginEvents[K]) => void,
  ): void;
}

/**
 * Player plugin installed by the host after bridge init.
 * Return the player instance the bridge should retain.
 */
export type PlayerPlugin = (bridge: PlayerPluginBridge, config?: unknown) => unknown;
