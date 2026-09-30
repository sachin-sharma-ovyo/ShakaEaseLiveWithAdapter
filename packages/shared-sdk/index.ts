/**
 * Public entry for the shared contract.
 * The web adapter and the example adapter both import from here.
 * `PlayerPlugin.ts` defines the player events. `brand/BrandConfig.ts` defines the tenant file.
 */
export type {
  BrandConfig,
  BrandEaseLiveConfig,
  BrandEnvironment,
  BrandTheme,
} from './brand/BrandConfig';

export { BRAND_ENVIRONMENTS, parseBrandConfig } from './brand/BrandConfig';

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
