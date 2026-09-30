import type { ShakaPlayer } from '../shaka/ShakaPlayer';

interface TizenKey {
  name: string;
}

interface TizenInputDevice {
  getSupportedKeys(): TizenKey[];
  registerKey(keyName: string): void;
}

/** Volume and power stay with the TV. Every other remote key is delivered to the page. */
const REMOTE_KEYS_LEFT_TO_TV = new Set(['VolumeUp', 'VolumeDown', 'VolumeMute', 'Power']);

/**
 * Samsung remote support for the Tizen web app.
 * Arrow keys and OK arrive without registration. Other keys arrive only after
 * registerKey, which config.xml must allow with the tv.inputdevice privilege
 * and hwkey-event="enable".
 * Any delivered key starts playback while the video is paused.
 */
export function startRemoteNavigation(player: ShakaPlayer): void {
  registerTvRemoteKeys();
  window.addEventListener('keydown', () => {
    if (!player.isPaused()) {
      return;
    }
    player.play().catch(() => undefined);
  });
}

function registerTvRemoteKeys(): void {
  const inputDevice = (
    window as Window & { tizen?: { tvinputdevice?: TizenInputDevice } }
  ).tizen?.tvinputdevice;
  if (!inputDevice) {
    return;
  }

  inputDevice.getSupportedKeys().forEach((key) => {
    if (REMOTE_KEYS_LEFT_TO_TV.has(key.name)) {
      return;
    }
    try {
      inputDevice.registerKey(key.name);
    } catch {
      // This TV model does not allow the app to take that key.
    }
  });
}
