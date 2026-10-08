import shaka from 'shaka-player/dist/shaka-player.ui';
import 'shaka-player/dist/controls.css';
import type { PlayerState } from '../../../shared/plugininterface';

type StateListener = (state: PlayerState) => void;
type DestroyListener = () => void;
type ErrorListener = (message: string) => void;
type ControlsListener = (visible: boolean) => void;

const TRANSPORT_KEYS = new Set([
  ' ',
  'Spacebar',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'MediaPlay',
  'MediaPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'MediaPlayPause',
]);

/** Samsung TV media keys. Enter is left alone so an ad skip control can take it. */
const TRANSPORT_KEY_CODES = new Set([415, 19, 413, 417, 412, 10252]);

/** Ease Live `player.videoscale` payload. Every value except `duration` is 0–1. */
export interface VideoScale {
  scaleX: number;
  scaleY: number;
  pivotX: number;
  pivotY: number;
  duration: number;
}

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
 * Shaka UI is mounted on the video's parent. `app.css` lets only its bottom bar
 * take clicks, so the rest of the video surface stays with the Ease Live overlay.
 *
 * `getPlayheadDate()` is the Unix time source for `player.time` when the manifest
 * has `EXT-X-PROGRAM-DATE-TIME`. The adapter interpolates when that date is missing.
 */
export class ShakaPlayer {
  private readonly video: HTMLVideoElement;
  private readonly player: shaka.Player;
  private readonly ui: shaka.ui.Overlay;
  private loadPromise: Promise<void> | null = null;
  private lastState: PlayerState | null = null;
  private transportLocked = false;
  private controlsWereVisible = false;
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

    const container = video.parentElement;
    if (!container) {
      throw new Error('The video element needs a parent for the Shaka UI.');
    }
    this.ui = new shaka.ui.Overlay(this.player, container, video);
    // The big play button sits in the middle of the video, where the overlay needs clicks.
    this.ui.configure({ addBigPlayButton: false });

    this.bindVideoEvents();
    this.bindPlayerEvents();
    window.addEventListener('keydown', this.onTransportKeyDown, true);
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
    if (this.transportLocked) {
      return Promise.resolve();
    }
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
    if (this.transportLocked) {
      return;
    }
    this.video.pause();
  }

  seekBy(seconds: number): void {
    if (this.transportLocked) {
      return;
    }
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

  hasEnded(): boolean {
    return this.video.ended;
  }

  /**
   * Blocks content transport while a linear ad owns the surface.
   * IMA's own controls stay in `#ad-container` and are not part of this lock.
   */
  setTransportLocked(locked: boolean): void {
    if (locked === this.transportLocked) {
      return;
    }
    this.transportLocked = locked;
    const controls = this.ui.getControls();
    if (locked) {
      this.controlsWereVisible = this.areControlsVisible();
      controls?.setEnabledShakaControls(false);
      this.ui.configure({ enableKeyboardPlaybackControls: false });
      this.getContainer()?.classList.add('ad-break');
      controls?.hideUI();
      return;
    }
    controls?.setEnabledShakaControls(true);
    this.ui.configure({ enableKeyboardPlaybackControls: true });
    this.getContainer()?.classList.remove('ad-break');
    if (this.controlsWereVisible) {
      controls?.showUI();
    }
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

  /**
   * Scales the video surface around the pivot, so `scaleX: 0.8, pivotX: 0`
   * keeps the left edge and frees the right 20% for the overlay.
   */
  setVideoScale({ scaleX, scaleY, pivotX, pivotY, duration }: VideoScale): void {
    const style = this.video.style;
    style.transformOrigin = `${pivotX * 100}% ${pivotY * 100}%`;
    style.transition = `transform ${Number.isFinite(duration) ? Math.max(0, duration) : 0}ms ease`;
    style.transform = scaleX === 1 && scaleY === 1 ? '' : `scale(${scaleX}, ${scaleY})`;
  }

  areControlsVisible(): boolean {
    return this.ui.getControls()?.isOpaque() ?? false;
  }

  /** Shaka fades the controls out again after its idle timeout. */
  setControlsVisible(visible: boolean): void {
    const controls = this.ui.getControls();
    if (visible) {
      controls?.showUI();
    } else {
      controls?.hideUI();
    }
  }

  onControlsVisibility(listener: ControlsListener): void {
    const controls = this.ui.getControls();
    controls?.addEventListener('showingui', () => listener(true));
    controls?.addEventListener('hidingui', () => listener(false));
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
    window.removeEventListener('keydown', this.onTransportKeyDown, true);
    this.destroyListeners.forEach((listener) => listener());
    this.destroyListeners.clear();
    // Also destroys the Shaka Player instance.
    return this.ui.destroy();
  }

  private async start(url: string): Promise<void> {
    await this.player.attach(this.video);
    await this.player.load(url);
  }

  private readonly onTransportKeyDown = (event: KeyboardEvent): void => {
    if (!this.transportLocked || !isTransportKey(event)) {
      return;
    }
    const adContainer = this.getContainer()?.querySelector('#ad-container');
    if (adContainer && event.target instanceof Node && adContainer.contains(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

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

function isTransportKey(event: KeyboardEvent): boolean {
  return TRANSPORT_KEYS.has(event.key) || TRANSPORT_KEY_CODES.has(event.keyCode);
}
