import type EaseLive from '@ease-live/ease-live-bridge-web';
import type { PlayerPlugin as EaseLivePlayerPlugin } from '@ease-live/ease-live-bridge-web';
import type {
  ControlsVisibility,
  PlayerPluginBridge,
  PlayerPluginEvents,
  PlayerTimePayload,
} from '../../../shared/plugininterface';
// import type { PlayerControls } from '../shaka/playercontrols';
import type { ShakaPlayer } from '../shaka/ShakaPlayer';

const TIME_INTERVAL_MS = 250;
const SCALED_VIDEO_SIZE = 0.8;

/**
 * Adapter between Shaka and Ease Live. This is the only app file that knows both.
 * Event names and payloads come from `shared/plugininterface/index.ts`.
 * Follow `shared/plugininterface/WebPlayerPlugin.example.ts` when changing the flow.
 */
export function createWebPlayerPlugin(player: ShakaPlayer): EaseLivePlayerPlugin {
  return (easeLive) => {
    const bridge = toBridge(easeLive);
    // Last Unix timecode and the video position it belonged to, used to seek and to interpolate.
    let currentTimecode = 0;
    let lastPosition = 0;
    let playbackStarted = false;

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
        // Ignore the overlay's first sync. Seeking before the first frame
        // drops the segment just buffered and adds a 1–2s startup stall.
        if (!playbackStarted || currentTimecode <= 0) {
          return;
        }
        const diffSeconds = (timecode - currentTimecode) / 1000;
        if (Math.abs(diffSeconds) < 0.75) {
          return;
        }
        player.seekBy(diffSeconds);
      },
      true,
    );

    // Overlay background clicks toggle the Shaka UI bar. They are not part of the shared contract.
    // `view.mouseenter` shows it again. Only the bar takes clicks, so the overlay keeps the video.
    easeLive.on(
      'stage.clicked',
      () => {
        player.setControlsVisible(!player.areControlsVisible());
      },
      true,
    );

    easeLive.on(
      'view.mouseenter',
      () => {
        player.setControlsVisible(true);
      },
      true,
    );

    // Overlay moves and resizes the video surface. Not part of the shared contract.
    // The pivot picks the corner or edge; a shrunk axis always leaves 20% free.
    easeLive.on(
      'player.videoscale',
      ({ scaleX, scaleY, pivotX, pivotY, duration }) => {
        const applied = {
          scaleX: scaleX < 1 ? SCALED_VIDEO_SIZE : 1,
          scaleY: scaleY < 1 ? SCALED_VIDEO_SIZE : 1,
          pivotX,
          pivotY,
          duration,
        };
        player.setVideoScale(applied);
        easeLive.emit('player.videoscale', applied);
      },
      true,
    );

    // Shaka -> overlay.
    player.onPlaybackState((state) => {
      if (state === 'playing') {
        playbackStarted = true;
      }
      bridge.emit('player.state', { state });
    });

    const emitTime = () => {
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
    };

    emitControls(player.areControlsVisible(), bridge);
    player.onControlsVisibility((visible) => emitControls(visible, bridge));

    player.whenReady().then(
      () => {
        bridge.emit('player.ready', {
          player: player.getInstance(),
          playerContainer: player.getContainer() ?? undefined,
        });
        // The contract requires 4Hz; `timeupdate` frequency is browser-dependent.
        const timer = window.setInterval(emitTime, TIME_INTERVAL_MS);
        player.onDestroy(() => window.clearInterval(timer));
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

function emitControls(visible: boolean, bridge: PlayerPluginBridge): void {
  const visibility: ControlsVisibility = visible ? 'visible' : 'hidden';
  bridge.emit('player.controls', { controls: visibility });
}
