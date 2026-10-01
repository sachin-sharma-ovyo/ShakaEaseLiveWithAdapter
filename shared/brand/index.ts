/**
 * Public entry for white-label brand settings.
 * Import brand types, parsing, loading, and theme application from here.
 */
export type {
  BrandConfig,
  BrandEaseLiveConfig,
  BrandEnvironment,
  BrandTheme,
} from './BrandConfig';

export { BRAND_ENVIRONMENTS, parseBrandConfig } from './BrandConfig';
export { applyBrandTheme } from './applyBrandTheme';
export { loadBrandConfig } from './loadBrandConfig';
