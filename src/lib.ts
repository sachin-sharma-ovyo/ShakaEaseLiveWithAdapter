/**
 * Package entry for consumers installing this as an NPM dependency.
 * `index.ts` is the demo page and is not part of the package.
 */
export * from '../packages/shared-sdk/index';
export { applyBrandTheme } from './brand/applyBrandTheme';
export { loadBrandConfig } from './brand/loadBrandConfig';
export { EaseLiveComponent } from './easelive/EaseLiveComponent';
export { createWebPlayerPlugin } from './plugin/WebPlayerPlugin';
export { ShakaPlayer } from './shaka/ShakaPlayer';
