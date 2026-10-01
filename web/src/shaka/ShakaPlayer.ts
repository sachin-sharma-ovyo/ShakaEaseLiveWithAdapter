import shaka from 'shaka-player';
import type { PlayerState } from '../../../shared/plugininterface';

type StateListener = (state: PlayerState) => void;
type DestroyListener = () => void;
type ErrorListener = (message: string) => void;

interface BufferingEvent extends Event {
  buffering: boolean;
}

interface PlayerErrorEvent extends Event {
  detail?: {
    code?: number;
    message?: string;
  };
}

/**
 * Shaka playback wrapper. The adapter is the only class that talks to Ease Live.
 * Shaka UI is not mounted. Its control layer covers the video and toggles playback
 * on any click, which blocks the Ease Live overlay.
 * Play and pause live in the 48px bar in `index.html`, above the overlay.
 *
 * `getPlayheadDate()` is the Unix time source for `player.time` when the manifest
 * has `EXT-X-PROGRAM-DATE-TIME`. The adapter interpolates when that date is missing.
 */
export class ShakaPlayer {
  private readonly video: HTMLVideoElement;
  private readonly player: shaka.Player;
  private loadPromise: Promise<void> | null = null;
  private lastState: PlayerState | null = null;
  private readonly stateListeners = new Set<StateListener>();
  private readonly destroyListeners = new Set<DestroyListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  constructor(video: HTMLVideoElement) {
    if (!shaka.Player.isBrowserSupported()) {
      throw new Error('This browser is not supported by Shaka Player.');
    }

    shaka.polyfill.installAll();
    this.video = video;
    // Native controls paint a full-video click layer. Ease Live needs that surface.
    this.video.controls = false;
    this.video.removeAttribute('controls');
    this.video.preload = 'auto';
    this.player = new shaka.Player();
    // First play was waiting 1–2s. The default live start sits 5s inside the
    // window and may fetch the previous segment when close to a boundary.
    // A short offset starts on the segment already in hand.
    this.player.configure({
      streaming: {
        rebufferingGoal: 0,
        safeSeekOffset: 1,
        inaccurateManifestTolerance: 0,
      },
    });
    this.bindVideoEvents();
    this.bindPlayerEvents();
  }

  load(url: string): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.start(url);
    }
    return this.loadPromise;
  }

  whenReady(): Promise<void> {
    if (!this.loadPromise) {
      return Promise.reject(new Error('Stream load has not started.'));
    }
    return this.loadPromise;
  }

  play(): Promise<void> {
    // Call play() in the click turn so the browser accepts the gesture.
    // If the media source is not attached yet, retry once the load finishes.
    const started = this.video.play();
    if (!this.loadPromise) {
      return started;
    }
    return started.catch(async () => {
      await this.loadPromise;
      if (!this.video.paused) {
        return;
      }
      await this.video.play();
    });
  }

  pause(): void {
    this.video.pause();
  }

  seekBy(seconds: number): void {
    const range = this.player.seekRange();
    const next = this.video.currentTime + seconds;
    const clamped = Math.min(range.end, Math.max(range.start, next));
    this.video.currentTime = clamped;
  }

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getPlayheadDate(): Date | null {
    return this.player.getPlayheadTimeAsDate();
  }

  getSeekWindow(): { start: number; end: number } {
    return this.player.seekRange();
  }

  isPaused(): boolean {
    return this.video.paused;
  }

  isLive(): boolean {
    return this.player.isLive();
  }

  getInstance(): shaka.Player {
    return this.player;
  }

  getContainer(): HTMLElement | null {
    return this.video.parentElement;
  }

  onPlaybackState(listener: StateListener): void {
    this.stateListeners.add(listener);
  }

  onError(listener: ErrorListener): void {
    this.errorListeners.add(listener);
  }

  onDestroy(listener: DestroyListener): void {
    this.destroyListeners.add(listener);
  }

  destroy(): Promise<void> {
    this.destroyListeners.forEach((listener) => listener());
    this.destroyListeners.clear();
    return this.player.destroy();
  }

  private async start(url: string): Promise<void> {
    await this.player.attach(this.video);
    await this.player.load(url);
  }

  private emitState(state: PlayerState): void {
    if (state === this.lastState) {
      return;
    }
    this.lastState = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private bindVideoEvents(): void {
    this.video.addEventListener('playing', () => this.emitState('playing'));
    this.video.addEventListener('pause', () => {
      if (!this.video.ended) {
        this.emitState('paused');
      }
    });
    this.video.addEventListener('ended', () => this.emitState('stopped'));
    this.video.addEventListener('seeking', () => this.emitState('seeking'));
    this.video.addEventListener('seeked', () => {
      this.emitState(this.video.paused ? 'paused' : 'playing');
    });
  }

  private bindPlayerEvents(): void {
    this.player.addEventListener('buffering', (event) => {
      const buffering = (event as BufferingEvent).buffering;
      if (buffering) {
        this.emitState('buffering');
        return;
      }
      this.emitState(this.video.paused ? 'paused' : 'playing');
    });

    this.player.addEventListener('error', (event) => {
      const detail = (event as PlayerErrorEvent).detail;
      const message = detail?.message || `Shaka Player error ${detail?.code ?? ''}`.trim();
      this.errorListeners.forEach((listener) => listener(message));
    });
  }
}
