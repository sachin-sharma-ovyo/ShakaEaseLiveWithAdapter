/**
 * Public entry for the Ease Live bridge component.
 * SDK types are re-exported so web never imports `@ease-live` directly.
 */
export { EaseLiveComponent } from './EaseLiveComponent';
export type { default as EaseLive, PlayerPlugin as EaseLivePlayerPlugin } from '@ease-live/ease-live-bridge-web';
