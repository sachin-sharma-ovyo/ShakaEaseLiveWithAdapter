/**
 * White-label brand contract.
 * A client changes `brands/<brandId>.json`. They do not change player code.
 * `brand-config.schema.json` is the same shape, for editors and validation.
 */

export const BRAND_ENVIRONMENTS = ['prod', 'staging', 'dev'] as const;

export type BrandEnvironment = (typeof BRAND_ENVIRONMENTS)[number];

/** Colors and type the player shell uses for this tenant. */
export interface BrandTheme {
  /** Shown as the page heading and document title. */
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  accentTextColor: string;
  fontFamily: string;
}

/** Ease Live Studio program loaded for this tenant. */
export interface BrandEaseLiveConfig {
  accountId: string;
  programId: string;
  projectId?: string;
  env?: BrandEnvironment;
}

/**
 * One tenant's player settings.
 * `streamUrl` is that tenant's playback endpoint (HLS or DASH).
 */
export interface BrandConfig {
  brandId: string;
  theme: BrandTheme;
  easeLive: BrandEaseLiveConfig;
  streamUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`BrandConfig.${label} must be a non-empty string.`);
  }
  return value;
}

function isBrandEnvironment(value: string): value is BrandEnvironment {
  return BRAND_ENVIRONMENTS.some((environment) => environment === value);
}

/**
 * Checks a parsed JSON value against BrandConfig.
 * Throws a message that names the missing or invalid field.
 */
export function parseBrandConfig(input: unknown): BrandConfig {
  if (!isRecord(input)) {
    throw new Error('BrandConfig must be a JSON object.');
  }

  const theme = input.theme;
  const easeLive = input.easeLive;
  if (!isRecord(theme)) {
    throw new Error('BrandConfig.theme must be an object.');
  }
  if (!isRecord(easeLive)) {
    throw new Error('BrandConfig.easeLive must be an object.');
  }

  const env = easeLive.env;
  if (env !== undefined && (typeof env !== 'string' || !isBrandEnvironment(env))) {
    throw new Error('BrandConfig.easeLive.env must be "prod", "staging", or "dev".');
  }

  const projectId = easeLive.projectId;
  if (projectId !== undefined && typeof projectId !== 'string') {
    throw new Error('BrandConfig.easeLive.projectId must be a string when set.');
  }
  if (typeof projectId === 'string' && projectId.trim() === '') {
    throw new Error('BrandConfig.easeLive.projectId must be a non-empty string when set.');
  }

  const streamUrl = requiredString(input, 'streamUrl', 'streamUrl');
  let parsedStream: URL;
  try {
    parsedStream = new URL(streamUrl);
  } catch {
    throw new Error('BrandConfig.streamUrl must be an absolute URL.');
  }
  if (parsedStream.protocol !== 'http:' && parsedStream.protocol !== 'https:') {
    throw new Error('BrandConfig.streamUrl must use http or https.');
  }

  return {
    brandId: requiredString(input, 'brandId', 'brandId'),
    theme: {
      name: requiredString(theme, 'name', 'theme.name'),
      backgroundColor: requiredString(theme, 'backgroundColor', 'theme.backgroundColor'),
      textColor: requiredString(theme, 'textColor', 'theme.textColor'),
      accentColor: requiredString(theme, 'accentColor', 'theme.accentColor'),
      accentTextColor: requiredString(theme, 'accentTextColor', 'theme.accentTextColor'),
      fontFamily: requiredString(theme, 'fontFamily', 'theme.fontFamily'),
    },
    easeLive: {
      accountId: requiredString(easeLive, 'accountId', 'easeLive.accountId'),
      programId: requiredString(easeLive, 'programId', 'easeLive.programId'),
      ...(typeof projectId === 'string' ? { projectId } : {}),
      ...(env !== undefined && typeof env === 'string' ? { env } : {}),
    },
    streamUrl,
  };
}
