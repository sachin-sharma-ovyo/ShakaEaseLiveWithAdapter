import type { PlayerState } from '../../../packages/shared-sdk/plugininterface';
import type { ShakaPlayer } from '../ShakaPlayer';
import './PlayerControls.css';

/**
 * Play/pause bar rendered over the bottom of the Shaka stream.
 * It sits above the Ease Live view (z-index 2 over 1) and is only 48px tall,
 * so the rest of the video stays clickable for overlay graphics.
 */
export class PlayerControls {
  readonly element: HTMLElement;
  private readonly playButton: HTMLButtonElement;

  constructor(
    private readonly player: ShakaPlayer,
    container: HTMLElement,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'player-controls visible';

    this.playButton = document.createElement('button');
    this.playButton.type = 'button';
    this.playButton.className = 'player-controls__play-pause';
    this.playButton.textContent = 'Play';
    this.playButton.addEventListener('click', this.onPlayPauseClick);

    const live = document.createElement('span');
    live.className = 'player-controls__live';
    live.textContent = 'LIVE';

    this.element.append(this.playButton, live);
    container.appendChild(this.element);

    player.onPlaybackState((state) => this.render(state));
  }

  isVisible(): boolean {
    return this.element.classList.contains('visible');
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('visible', visible);
  }

  focus(): void {
    this.playButton.focus();
  }

  destroy(): void {
    this.playButton.removeEventListener('click', this.onPlayPauseClick);
    this.element.remove();
  }

  private readonly onPlayPauseClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (this.player.isPaused()) {
      void this.player.play();
      return;
    }
    this.player.pause();
  };

  private render(state: PlayerState): void {
    // Initial load buffers while the video is still paused. That is not playback.
    const showPause = !this.player.isPaused() && state !== 'paused' && state !== 'stopped';
    this.playButton.textContent = showPause ? 'Pause' : 'Play';
    this.playButton.setAttribute('aria-label', showPause ? 'Pause' : 'Play');
  }
}
