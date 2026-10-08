/**
 * Client-side ad schedule for one brand.
 * Offsets are content seconds. Each break is a single VAST tag, not a VMAP.
 */

export interface AdTagConfig {
  tagUrl: string;
}

export interface MidRollConfig extends AdTagConfig {
  offsetsSec: number[];
}

export interface AdsConfig {
  enabled: boolean;
  adTimeoutMs: number;
  preRoll?: AdTagConfig;
  midRoll?: MidRollConfig;
  postRoll?: AdTagConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTagUrl(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`BrandConfig.${label} must be a non-empty string.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`BrandConfig.${label} must be an absolute URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`BrandConfig.${label} must use http or https.`);
  }
  return value;
}

function parseAdTag(value: unknown, label: string): AdTagConfig {
  if (!isRecord(value)) {
    throw new Error(`BrandConfig.${label} must be an object.`);
  }
  return { tagUrl: parseTagUrl(value.tagUrl, `${label}.tagUrl`) };
}

/**
 * Parses the optional `ads` block.
 * A missing block returns undefined. `enabled: false` skips the rest of the block.
 */
export function parseAdsConfig(value: unknown): AdsConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error('BrandConfig.ads must be an object.');
  }
  if (typeof value.enabled !== 'boolean') {
    throw new Error('BrandConfig.ads.enabled must be a boolean.');
  }
  if (!value.enabled) {
    return { enabled: false, adTimeoutMs: 0 };
  }

  const adTimeoutMs = value.adTimeoutMs;
  if (typeof adTimeoutMs !== 'number' || !Number.isFinite(adTimeoutMs) || adTimeoutMs <= 0) {
    throw new Error('BrandConfig.ads.adTimeoutMs must be a positive number.');
  }

  const ads: AdsConfig = { enabled: true, adTimeoutMs };

  if (value.preRoll !== undefined) {
    ads.preRoll = parseAdTag(value.preRoll, 'ads.preRoll');
  }
  if (value.postRoll !== undefined) {
    ads.postRoll = parseAdTag(value.postRoll, 'ads.postRoll');
  }
  if (value.midRoll !== undefined) {
    if (!isRecord(value.midRoll)) {
      throw new Error('BrandConfig.ads.midRoll must be an object.');
    }
    if (!Array.isArray(value.midRoll.offsetsSec)) {
      throw new Error('BrandConfig.ads.midRoll.offsetsSec must be an array of numbers.');
    }
    const offsetsSec = value.midRoll.offsetsSec.map((offset, index) => {
      if (typeof offset !== 'number' || !Number.isFinite(offset)) {
        throw new Error(`BrandConfig.ads.midRoll.offsetsSec[${index}] must be a finite number.`);
      }
      return offset;
    });
    ads.midRoll = {
      offsetsSec,
      tagUrl: parseTagUrl(value.midRoll.tagUrl, 'ads.midRoll.tagUrl'),
    };
  }

  return ads;
}
