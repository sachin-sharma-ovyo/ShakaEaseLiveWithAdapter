import type {
  ControlsVisibility,
  PlayerPlugin,
  PlayerPluginBridge,
  PlayerState,
} from './index';

interface ExamplePlayerListeners {
  ready: () => void;
  statechange: (state: PlayerState) => void;
  timeupdate: (timecode: number) => void;
  controls: (controls: ControlsVisibility) => void;
}

/**
 * Stand-in player used only by this example.
 * The web adapter replaces these calls with Shaka Player.
 */
interface ExamplePlayer {
  play(): void;
  pause(): void;
  currentTime(): number;
  seek(seconds: number): void;
  on<K extends keyof ExamplePlayerListeners>(event: K, listener: ExamplePlayerListeners[K]): void;
}

/**
 * Reference adapter. It is type-checked with the app and is not bundled.
 * The running Shaka adapter is `src/plugin/WebPlayerPlugin.ts`.
 * Types come from `./index`, not from `PlayerPlugin.ts` directly.
 *
 * An adapter does two jobs:
 * 1. Listen to the overlay and drive the player (`on`, third arg `true`).
 * 2. Listen to the player and tell the overlay what changed (`emit`).
 */
export function createExamplePlayerPlugin(player: ExamplePlayer): PlayerPlugin {
  return (bridge: PlayerPluginBridge) => {
    let currentTimecode = 0;
    let lastPosition = 0;

    // Overlay -> player. `true` ignores events this plugin just emitted.
    bridge.on(
      'player.state',
      ({ state }) => {
        if (state === 'playing') player.play();
        if (state === 'paused') player.pause();
      },
      true,
    );

    bridge.on(
      'player.time',
      ({ timecode }) => {
        if (currentTimecode > 0) {
          const diffSeconds = (timecode - currentTimecode) / 1000;
          player.seek(player.currentTime() + diffSeconds);
        }
      },
      true,
    );

    bridge.on('app.status', (payload) => {
      const status = payload.status;
      if (status === 'disabled') {
        // The host destroys the bridge. Hidden and enabled leave it running.
      }
    });

    bridge.on('easelive.error', (payload) => {
      if (payload.type === 'fatal') {
        // The host destroys the bridge. payload.message describes the failure.
      }
    });

    // Player -> overlay. `player.ready` is what allows the overlay to load.
    player.on('ready', () => {
      bridge.emit('player.ready', { player });
    });

    player.on('statechange', (state) => {
      bridge.emit('player.state', { state });
    });

    player.on('timeupdate', (timecode) => {
      if (timecode !== currentTimecode) {
        currentTimecode = timecode;
        lastPosition = player.currentTime();
      }
      const diffSeconds = player.currentTime() - lastPosition;
      const interpolated = currentTimecode + diffSeconds * 1000;
      bridge.emit('player.time', { timecode: Math.floor(interpolated) });
    });

    player.on('controls', (controls) => {
      bridge.emit('player.controls', { controls });
    });

    return player;
  };
}
