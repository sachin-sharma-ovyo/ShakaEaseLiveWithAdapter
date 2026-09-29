import type EaseLive from '@ease-live/ease-live-bridge-web';
import type { PlayerPlugin as EaseLivePlayerPlugin } from '@ease-live/ease-live-bridge-web';
import type {
  ControlsVisibility,
  PlayerPluginBridge,
  PlayerPluginEvents,
  PlayerState,
  PlayerTimePayload,
} from '../../packages/shared-sdk/index';
import type { ShakaPlayer } from '../shaka/ShakaPlayer';

interface PluginElements {
  controls: HTMLElement;
  playButton: HTMLButtonElement;
}

/**
 * Adapter between Shaka and Ease Live. This is the only app file that knows both.
 * Event names and payloads come from `packages/shared-sdk/index.ts`.
 * Follow `packages/shared-sdk/WebPlayerPlugin.example.ts` when changing the flow.
 */
export function createWebPlayerPlugin(
  player: ShakaPlayer,
  elements: PluginElements,
): EaseLivePlayerPlugin {
  return (easeLive) => {
    const bridge = toBridge(easeLive);
    // Last Unix timecode and the video position it belonged to, used to seek and to interpolate.
    let currentTimecode = 0;
    let lastPosition = 0;

    // Overlay -> Shaka. `fromSdkOnly` avoids reacting to our own emits.
    bridge.on(
      'player.state',
      ({ state }) => {
        if (state === 'playing') {
          void player.play();
        } else if (state === 'paused') {
          player.pause();
        }
      },
      true,
    );

    bridge.on(
      'player.time',
      ({ timecode }) => {
        if (currentTimecode > 0) {
          const diffSeconds = (timecode - currentTimecode) / 1000;
          player.seekBy(diffSeconds);
        }
      },
      true,
    );

    // Overlay background clicks are an SDK event outside the shared contract.
    // The adapter turns that click into `player.controls`.
    easeLive.on(
      'stage.clicked',
      () => {
        const visible = !elements.controls.classList.contains('visible');
        setControlsVisible(elements.controls, visible, bridge);
      },
      true,
    );

    // Shaka -> overlay.
    player.onPlaybackState((state) => {
      updatePlayButton(elements.playButton, state);
      bridge.emit('player.state', { state });
    });

    player.onTimeUpdate(() => {
      const payload = readTimecode(player, currentTimecode, lastPosition);
      if (!payload) {
        return;
      }
      currentTimecode = payload.timecode;
      lastPosition = player.getCurrentTime();
      bridge.emit('player.time', {
        timecode: Math.floor(payload.timecode),
        ...(payload.initialTimecode === undefined
          ? {}
          : { initialTimecode: Math.floor(payload.initialTimecode) }),
        ...(payload.maxTimecode === undefined
          ? {}
          : { maxTimecode: Math.floor(payload.maxTimecode) }),
      });
    });

    elements.playButton.addEventListener('click', () => {
      if (player.isPaused()) {
        void player.play();
        return;
      }
      player.pause();
    });

    setControlsVisible(elements.controls, elements.controls.classList.contains('visible'), bridge);

    player.whenReady().then(
      () => {
        bridge.emit('player.ready', {
          player: player.getInstance(),
          playerContainer: player.getContainer() ?? undefined,
        });
      },
      () => {
        // Entry reports the load error. The overlay stays uninitialized without player.ready.
      },
    );

    return player.getInstance();
  };
}

/** Adapts the Ease Live instance to the shared `PlayerPluginBridge` type. */
function toBridge(easeLive: EaseLive): PlayerPluginBridge {
  const wrapped = new Map<object, (data: unknown) => void>();

  return {
    emit(event, payload) {
      easeLive.emit(event, payload as Record<string, unknown>);
    },
    on(event, listener, fromSdkOnly) {
      const callback = (data: unknown) => {
        listener(data as PlayerPluginEvents[typeof event]);
      };
      wrapped.set(listener, callback);
      easeLive.on(event, callback as never, fromSdkOnly);
    },
    off(event, listener) {
      const callback = wrapped.get(listener);
      if (!callback) {
        return;
      }
      easeLive.off(event, callback as never);
      wrapped.delete(listener);
    },
  };
}

/**
 * Prefer the manifest playhead date. Otherwise step forward from the last known
 * Unix timecode by the change in `video.currentTime`. Returns null until one exists.
 */
function readTimecode(
  player: ShakaPlayer,
  currentTimecode: number,
  lastPosition: number,
): PlayerTimePayload | null {
  const position = player.getCurrentTime();
  const date = player.getPlayheadDate();

  if (date) {
    const timecode = date.getTime();
    const range = player.getSeekWindow();
    if (player.isLive() && range.end > range.start) {
      return {
        timecode,
        initialTimecode: timecode - (position - range.start) * 1000,
        maxTimecode: timecode + (range.end - position) * 1000,
      };
    }
    if (player.isLive()) {
      return {
        timecode,
        initialTimecode: timecode,
        maxTimecode: timecode,
      };
    }
    return { timecode };
  }

  if (currentTimecode <= 0) {
    return null;
  }

  return {
    timecode: currentTimecode + (position - lastPosition) * 1000,
  };
}

function setControlsVisible(
  controls: HTMLElement,
  visible: boolean,
  bridge: PlayerPluginBridge,
): void {
  controls.classList.toggle('visible', visible);
  const visibility: ControlsVisibility = visible ? 'visible' : 'hidden';
  bridge.emit('player.controls', { controls: visibility });
}

function updatePlayButton(playButton: HTMLButtonElement, state: PlayerState): void {
  playButton.textContent = state === 'playing' || state === 'buffering' ? 'Pause' : 'Play';
}
