/**
 * Entry point. Webpack bundles this file only.
 *
 * Startup order matters:
 * 1. Load `brands/<id>.json` and apply its theme.
 * 2. Create Shaka and the adapter, then start the stream load.
 * 3. Call Ease Live `init()` after that, so the adapter can wait on the same load.
 * 4. The adapter emits `player.ready` when the load finishes, and the overlay appears.
 *
 * When ads are enabled, a user gesture initializes IMA and the pre-roll plays
 * before that load. Brands without an ads block keep the order above.
 */
import {
  applyBrandTheme,
  loadBrandConfig,
  type AdsConfig,
  type BrandConfig,
} from '../../shared/brand';
import { EaseLiveComponent } from '../../shared/easelive';
import { AdController } from './ads/AdController';
import './app.css';
import { createWebPlayerPlugin } from './plugin/WebPlayerPlugin';
import { ShakaPlayer } from './shaka/ShakaPlayer';
import { errorMessage, readPlayerMarkup, waitForStartGesture } from './utils';

async function main(): Promise<void> {
  const { wrapper, video, status, view, adContainer } = readPlayerMarkup();

  let brand: BrandConfig;
  try {
    brand = await loadBrandConfig();
  } catch (error) {
    status.textContent = errorMessage(error, 'Failed to load brand config.');
    return;
  }

  applyBrandTheme(brand.theme);

  const player = new ShakaPlayer(video);
  player.onError((message) => {
    status.textContent = message;
  });

  const ads = wireAds(player, view, brand.ads);
  const easeLive = new EaseLiveComponent(
    view,
    createWebPlayerPlugin(player, view, ads),
    brand.easeLive,
    {
      onStatus(next) {
        status.textContent = `Overlay ${next}`;
      },
      onFatal(message) {
        status.textContent = message;
      },
    },
  );

  if (!ads) {
    await loadStream(player, easeLive, brand.streamUrl, status);
    return;
  }

  status.textContent = 'Click the video to start';
  const imaReady = await waitForStartGesture(wrapper, () => ads.tryInit(adContainer, video));
  if (imaReady && brand.ads?.preRoll) {
    status.textContent = 'Advertisement';
    await ads.playBreak(brand.ads.preRoll.tagUrl, { kind: 'pre' });
  }

  if (imaReady) {
    ads.bindContent(video);
  }

  status.textContent = 'Loading stream…';
  await loadStream(player, easeLive, brand.streamUrl, status, true);
}

/** Connects an enabled ad schedule to the player and the overlay. */
function wireAds(
  player: ShakaPlayer,
  view: HTMLElement,
  adsConfig: AdsConfig | undefined,
): AdController | null {
  if (!adsConfig?.enabled) {
    return null;
  }

  const ads = new AdController(player.getInstance(), adsConfig);
  player.setAdBreakMarkers({
    hasPreRoll: Boolean(adsConfig.preRoll),
    midRollOffsetsSec: adsConfig.midRoll?.offsetsSec ?? [],
    hasPostRoll: Boolean(adsConfig.postRoll),
  });
  ads.onChange((state) => {
    player.setTransportLocked(state.active);
    view.classList.toggle('ad-break', state.active);
  });
  ads.onWatched((position) => {
    player.markAdBreakWatched(position);
  });
  return ads;
}

/**
 * Starts the manifest fetch, then Ease Live, so the adapter can wait on the same load.
 * `autoplay` is used after a pre-roll, when the user gesture has already unlocked playback.
 */
async function loadStream(
  player: ShakaPlayer,
  easeLive: EaseLiveComponent,
  streamUrl: string,
  status: HTMLElement,
  autoplay = false,
): Promise<void> {
  const loadPromise = player.load(streamUrl);
  easeLive.init();
  try {
    await loadPromise;
    status.textContent = 'Player ready';
    if (autoplay) {
      await player.play();
    }
  } catch (error) {
    status.textContent = errorMessage(error, 'Failed to load the stream.');
  }
}

void main();
