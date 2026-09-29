/**
 * Entry point. Webpack bundles this file only.
 *
 * Startup order matters:
 * 1. Create Shaka and the adapter, then start the stream load.
 * 2. Call Ease Live `init()` after that, so the adapter can wait on the same load.
 * 3. The adapter emits `player.ready` when the load finishes, and the overlay appears.
 */
import { easeLiveConfig } from './config';
import { EaseLiveComponent } from './easelive/EaseLiveComponent';
import { createWebPlayerPlugin } from './plugin/WebPlayerPlugin';
import { ShakaPlayer } from './shaka/ShakaPlayer';

async function main(): Promise<void> {
  const video = document.querySelector<HTMLVideoElement>('#video');
  const controls = document.querySelector<HTMLElement>('#controls');
  const playButton = document.querySelector<HTMLButtonElement>('#play-pause');
  const status = document.querySelector<HTMLElement>('#status');
  const view = document.querySelector<HTMLElement>('#ease-live-view');

  if (!video || !controls || !playButton || !status || !view) {
    throw new Error('Player markup is missing.');
  }

  const player = new ShakaPlayer(video);
  player.onError((message) => {
    status.textContent = message;
  });

  const easeLive = new EaseLiveComponent(
    view,
    createWebPlayerPlugin(player, { controls, playButton }),
    {
      onStatus(next) {
        status.textContent = `Overlay ${next}`;
      },
      onFatal(message) {
        status.textContent = message;
      },
    },
  );

  // Start the load before init so `whenReady()` already has a promise when the plugin runs.
  const loadPromise = player.load(easeLiveConfig.streamUrl);
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
