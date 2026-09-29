/**
 * Public entry for the shared contract.
 * The web adapter and the example adapter both import from here.
 * `PlayerPlugin.ts` defines the types. This file only re-exports them.
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
