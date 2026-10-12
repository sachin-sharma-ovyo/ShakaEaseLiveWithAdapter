import type { AdsConfig } from '../../../shared/brand';
import type shaka from 'shaka-player/dist/shaka-player.ui';
import { isPrematureContentEnd, onPlaybackTime } from '../utils/media';

export interface AdBreakState {
  active: boolean;
  phase: 'loading' | 'playing';
}

export type AdBreakPosition =
  | { kind: 'pre' }
  | { kind: 'mid'; offsetsSec: number[] }
  | { kind: 'post' };

type AdBreakListener = (state: AdBreakState) => void;
type AdBreakWatchedListener = (position: AdBreakPosition) => void;

interface ImaLoadedEvent extends Event {
  imaAdManager?: google.ima.AdsManager;
}

/**
 * Schedules single VAST breaks through Shaka's client-side IMA manager.
 * Shaka calls `adsLoader.contentComplete()` when the content video ends.
 * A post-roll is a separate tag requested after that, because these tags are not VMAP.
 */
export class AdController {
  private pendingOffsets: number[];
  private adManager: shaka.extern.IAdManager | null = null;
  private imaManager: google.ima.AdsManager | null = null;
  private readonly listeners = new Set<AdBreakListener>();
  private readonly watchedListeners = new Set<AdBreakWatchedListener>();
  private ready = false;
  private adPlaying = false;
  private generation = 0;
  private activeGeneration = 0;
  private started = false;
  private loaded = false;
  private timeoutId = 0;
  private finishBreak: (() => void) | null = null;
  private activeBreakPosition: AdBreakPosition | null = null;
  private activeBreakWatched = false;
  private breakQueue: Promise<void> = Promise.resolve();
  private postRollQueued = false;

  constructor(
    private readonly player: shaka.Player,
    private readonly config: AdsConfig,
  ) {
    this.pendingOffsets = [...(config.midRoll?.offsetsSec ?? [])].sort((left, right) => left - right);
  }

  get isAdPlaying(): boolean {
    return this.adPlaying;
  }

  onChange(listener: AdBreakListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onWatched(listener: AdBreakWatchedListener): () => void {
    this.watchedListeners.add(listener);
    return () => {
      this.watchedListeners.delete(listener);
    };
  }

  /**
   * Call from a user gesture. `initClientSide` initializes the IMA display container.
   * Returns false when the SDK is missing or Shaka has no ad manager; content should continue.
   */
  tryInit(adContainer: HTMLElement, video: HTMLMediaElement): boolean {
    if (this.ready) {
      return true;
    }
    const ima = readIma();
    if (!ima?.AdsLoader) {
      return false;
    }
    const manager = this.player.getAdManager();
    if (!manager) {
      return false;
    }
    this.player.configure({ ads: { skipPlayDetection: true } });
    try {
      manager.initClientSide(adContainer, video, null);
    } catch {
      return false;
    }
    this.adManager = manager;
    this.listen();
    this.ready = true;
    return true;
  }

  /** Plays one tag. Resolves when the ad stops, errors, or fails to start in time. */
  playBreak(tagUrl: string, position: AdBreakPosition): Promise<void> {
    if (!this.ready || !this.adManager) {
      return Promise.resolve();
    }

    const generation = ++this.generation;
    this.activeGeneration = generation;
    this.started = false;
    this.loaded = false;
    this.activeBreakPosition = position;
    this.activeBreakWatched = false;
    this.publish(true, 'loading');

    return new Promise((resolve) => {
      const finish = () => {
        if (this.activeGeneration !== generation) {
          return;
        }
        this.activeGeneration = 0;
        this.finishBreak = null;
        this.activeBreakPosition = null;
        window.clearTimeout(this.timeoutId);
        this.publish(false, 'loading');
        resolve();
      };
      this.finishBreak = finish;
      this.timeoutId = window.setTimeout(() => {
        if (this.started || this.activeGeneration !== generation) {
          return;
        }
        // A late `ad-started` must not take over content that has already moved on.
        this.generation += 1;
        this.imaManager?.stop();
        finish();
      }, this.config.adTimeoutMs);

      try {
        const request = new google.ima.AdsRequest();
        request.adTagUrl = withCorrelator(tagUrl);
        this.adManager?.requestClientSideAds(request);
      } catch {
        finish();
      }
    });
  }

  /**
   * Plays one mid-roll when content reaches an offset.
   * Every offset at or behind the playhead is discarded, including when a seek passes several.
   */
  onContentTime(seconds: number): void {
    if (this.adPlaying || !this.config.midRoll || !Number.isFinite(seconds)) {
      return;
    }
    const dueOffsets = this.pendingOffsets.filter((offset) => offset <= seconds);
    if (!dueOffsets.length) {
      return;
    }
    this.pendingOffsets = this.pendingOffsets.filter((offset) => offset > seconds);
    this.enqueue(this.config.midRoll.tagUrl, { kind: 'mid', offsetsSec: dueOffsets });
  }

  /**
   * Mid-rolls follow the content playhead. `ended` from an ad that reused this
   * element is ignored; post-roll runs when the content itself ends.
   */
  bindContent(video: HTMLMediaElement): void {
    const onTime = () => {
      this.onContentTime(video.currentTime);
    };
    onPlaybackTime(video, onTime);
    video.addEventListener('ended', () => {
      if (this.isAdPlaying || isPrematureContentEnd(video)) {
        return;
      }
      this.onContentEnded();
    });
  }

  /** Requests the post-roll tag. Shaka has already reported content completion to IMA. */
  onContentEnded(): void {
    if (!this.config.postRoll || this.postRollQueued) {
      return;
    }
    this.postRollQueued = true;
    this.enqueue(this.config.postRoll.tagUrl, { kind: 'post' });
  }

  private enqueue(tagUrl: string, position: AdBreakPosition): void {
    this.breakQueue = this.breakQueue.then(
      () => this.playBreak(tagUrl, position),
      () => this.playBreak(tagUrl, position),
    );
  }

  private listen(): void {
    const manager = this.adManager;
    if (!manager) {
      return;
    }
    manager.addEventListener('ima-ad-manager-loaded', this.onImaLoaded);
    manager.addEventListener('ad-started', this.onAdStarted);
    manager.addEventListener('ad-complete', this.onAdWatched);
    manager.addEventListener('ad-skipped', this.onAdWatched);
    manager.addEventListener('ad-error', this.onAdError);
    manager.addEventListener('ad-stopped', this.onAdStopped);
  }

  private readonly onImaLoaded = (event: Event): void => {
    const imaManager = (event as ImaLoadedEvent).imaAdManager;
    if (!imaManager) {
      return;
    }
    this.imaManager = imaManager;
    if (this.activeGeneration === 0 || this.activeGeneration !== this.generation) {
      imaManager.stop();
      return;
    }
    this.loaded = true;
  };

  private readonly onAdStarted = (): void => {
    if (this.activeGeneration === 0 || this.activeGeneration !== this.generation) {
      this.imaManager?.stop();
      return;
    }
    this.started = true;
    window.clearTimeout(this.timeoutId);
    this.publish(true, 'playing');
  };

  private readonly onAdError = (): void => {
    if (this.activeGeneration === 0) {
      return;
    }
    this.finishBreak?.();
  };

  private readonly onAdWatched = (): void => {
    const position = this.activeBreakPosition;
    if (
      this.activeGeneration === 0 ||
      !this.started ||
      this.activeBreakWatched ||
      !position
    ) {
      return;
    }
    this.activeBreakWatched = true;
    this.watchedListeners.forEach((listener) => listener(position));
  };

  private readonly onAdStopped = (): void => {
    // Requesting the next tag destroys the previous manager and can emit a stop
    // before the new ad has loaded. That stop belongs to the previous break.
    if (!this.loaded && !this.started) {
      return;
    }
    this.finishBreak?.();
  };

  private publish(active: boolean, phase: AdBreakState['phase']): void {
    this.adPlaying = active;
    const state = { active, phase };
    this.listeners.forEach((listener) => listener(state));
  }
}

function readIma(): typeof google.ima | undefined {
  const root = (window as Window & { google?: { ima?: typeof google.ima } }).google;
  return root?.ima;
}

function withCorrelator(tagUrl: string): string {
  const url = new URL(tagUrl);
  url.searchParams.set('correlator', String(Math.floor(Math.random() * 1_000_000_000)));
  return url.toString();
}
