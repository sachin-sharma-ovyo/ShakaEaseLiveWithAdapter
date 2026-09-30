/**
 * Entry point. Webpack bundles this file only.
 *
 * Startup order matters:
 * 1. Load `brands/<id>.json` and apply its theme.
 * 2. Create Shaka and the adapter, then start the stream load.
 * 3. Call Ease Live `init()` after that, so the adapter can wait on the same load.
 * 4. The adapter emits `player.ready` when the load finishes, and the overlay appears.
 */
import {
  applyBrandTheme,
  loadBrandConfig,
  type BrandConfig,
} from '../packages/shared-sdk/brand';
import { EaseLiveComponent } from '../packages/shared-sdk/easelive';
import './app.css';
import { createWebPlayerPlugin } from './plugin/WebPlayerPlugin';
import { PlayerControls } from './shaka/playercontrols';
import { ShakaPlayer } from './shaka/ShakaPlayer';

async function main(): Promise<void> {
  const wrapper = document.querySelector<HTMLElement>('#player-wrapper');
  const video = document.querySelector<HTMLVideoElement>('#video');
  const status = document.querySelector<HTMLElement>('#status');
  const view = document.querySelector<HTMLElement>('#ease-live-view');

  if (!wrapper || !video || !status || !view) {
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

  // Start the manifest fetch before the overlay is created so the first
  // segment can be buffered before the user clicks Play.
  const loadPromise = player.load(brand.streamUrl);
  const controls = new PlayerControls(player, wrapper);

  const easeLive = new EaseLiveComponent(
    view,
    createWebPlayerPlugin(player, controls),
    brand.easeLive,
    {
      onStatus(next) {
        status.textContent = `Overlay ${next}`;
        if (next === 'hidden' || next === 'disabled') {
          controls.focus();
        }
      },
      onFatal(message) {
        status.textContent = message;
      },
    },
  );

  easeLive.init();

  try {
    await loadPromise;
    status.textContent = 'Player ready';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the stream.';
    status.textContent = message;
  }
}

void main();
