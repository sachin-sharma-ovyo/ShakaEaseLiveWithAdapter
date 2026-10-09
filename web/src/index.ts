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
  type BrandConfig,
} from '../../shared/brand';
import { EaseLiveComponent } from '../../shared/easelive';
import { AdController } from './ads/AdController';
import './app.css';
import { createWebPlayerPlugin } from './plugin/WebPlayerPlugin';
// Custom controls are disabled in favour of the Shaka UI controls mounted by ShakaPlayer.
// import { PlayerControls } from './shaka/playercontrols';
import { ShakaPlayer } from './shaka/ShakaPlayer';

async function main(): Promise<void> {
  const wrapper = document.querySelector<HTMLElement>('#player-wrapper');
  const video = document.querySelector<HTMLVideoElement>('#video');
  const status = document.querySelector<HTMLElement>('#status');
  const view = document.querySelector<HTMLElement>('#ease-live-view');
  const adContainer = document.querySelector<HTMLElement>('#ad-container');

  if (!wrapper || !video || !status || !view || !adContainer) {
    throw new Error('Player markup is missing.');
  }

  let brand: BrandConfig;
  try {
    brand = await loadBrandConfig();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Failed to load brand config.';
    return;
  }

  applyBrandTheme(brand.theme);

  const player = new ShakaPlayer(video);
  player.onError((message) => {
    status.textContent = message;
  });

  const ads = brand.ads?.enabled ? new AdController(player.getInstance(), brand.ads) : null;
  if (ads) {
    player.setAdBreakMarkers({
      hasPreRoll: Boolean(brand.ads?.preRoll),
      midRollOffsetsSec: brand.ads?.midRoll?.offsetsSec ?? [],
      hasPostRoll: Boolean(brand.ads?.postRoll),
    });
    ads.onChange((state) => {
      player.setTransportLocked(state.active);
      view.classList.toggle('ad-break', state.active);
    });
    ads.onWatched((position) => {
      player.markAdBreakWatched(position);
    });
  }

  // const controls = new PlayerControls(player, wrapper);

  const easeLive = new EaseLiveComponent(
    view,
    createWebPlayerPlugin(player, view, ads),
    brand.easeLive,
    {
      onStatus(next) {
        status.textContent = `Overlay ${next}`;
        // if (next === 'hidden' || next === 'disabled') {
        //   controls.focus();
        // }
      },
      onFatal(message) {
        status.textContent = message;
      },
    },
  );

  if (!ads) {
    // Start the manifest fetch before the overlay is created so the first
    // segment can be buffered before the user clicks Play.
    const loadPromise = player.load(brand.streamUrl);
    easeLive.init();
    try {
      await loadPromise;
      status.textContent = 'Player ready';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load the stream.';
      status.textContent = message;
    }
    return;
  }

  status.textContent = 'Click the video to start';
  const imaReady = await waitForStartGesture(wrapper, () => ads.tryInit(adContainer, video));
  if (imaReady && brand.ads?.preRoll) {
    status.textContent = 'Advertisement';
    await ads.playBreak(brand.ads.preRoll.tagUrl, { kind: 'pre' });
  }

  status.textContent = 'Loading stream…';
  const loadPromise = player.load(brand.streamUrl);
  easeLive.init();
  if (imaReady) {
    const onTime = () => {
      ads.onContentTime(video.currentTime);
    };
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    video.addEventListener('ended', () => {
      if (ads.isAdPlaying) {
        return;
      }
      const duration = video.duration;
      // Ignore an `ended` event from an ad that reused the content element
      // before the playhead was restored. Post-roll runs at the content end.
      if (Number.isFinite(duration) && video.currentTime + 0.5 < duration) {
        return;
      }
      ads.onContentEnded();
    });
  }

  try {
    await loadPromise;
    status.textContent = 'Player ready';
    await player.play();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the stream.';
    status.textContent = message;
  }
}

/**
 * Resolves on the first click or Enter / MediaPlay key.
 * `begin` runs inside that gesture so IMA can initialize its display container.
 */
function waitForStartGesture(wrapper: HTMLElement, begin: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const start = (event?: Event) => {
      if (event instanceof KeyboardEvent && !isStartKey(event)) {
        return;
      }
      wrapper.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      resolve(begin());
    };
    const onClick = () => {
      start();
    };
    const onKey = (event: KeyboardEvent) => {
      start(event);
    };
    wrapper.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  });
}

function isStartKey(event: KeyboardEvent): boolean {
  return (
    event.key === 'Enter' ||
    event.key === 'MediaPlay' ||
    event.keyCode === 13 ||
    event.keyCode === 415
  );
}

void main();
