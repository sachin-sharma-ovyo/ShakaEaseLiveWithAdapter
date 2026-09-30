import { parseBrandConfig, type BrandConfig } from './BrandConfig';

const BRAND_ID = /^[a-zA-Z0-9_-]+$/;

/**
 * Loads `brands/<id>.json` from the same origin as the player.
 * `?brand=<id>` selects the file. With no query, the player loads `default`.
 * A client adds a new tenant by dropping another JSON file in `brands/`.
 */
export async function loadBrandConfig(location: Location = window.location): Promise<BrandConfig> {
  const requested = new URLSearchParams(location.search).get('brand') ?? 'default';
  if (!BRAND_ID.test(requested)) {
    throw new Error(`Invalid brand id "${requested}". Use letters, numbers, "_" or "-".`);
  }

  const response = await fetch(`./brands/${requested}.json`);
  if (!response.ok) {
    throw new Error(
      `Brand config "brands/${requested}.json" was not found (${response.status}).`,
    );
  }

  return parseBrandConfig(await response.json());
}
