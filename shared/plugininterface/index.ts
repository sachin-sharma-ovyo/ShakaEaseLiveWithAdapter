/**
 * Public entry for the player-plugin contract.
 * The web adapter and the example adapter both import from here.
 * `PlayerPlugin.ts` defines the player events.
 */
export type {
  AppStatus,
  AppStatusPayload,
  ControlsVisibility,
  EaseLiveErrorPayload,
  EaseLiveErrorType,
  PlayerControlsPayload,
  PlayerPlugin,
  PlayerPluginBridge,
  PlayerPluginEvents,
  PlayerReadyPayload,
  PlayerState,
  PlayerStatePayload,
  PlayerTimePayload,
} from './PlayerPlugin';
