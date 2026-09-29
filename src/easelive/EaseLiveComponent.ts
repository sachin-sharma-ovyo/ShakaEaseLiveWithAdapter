import EaseLive from '@ease-live/ease-live-bridge-web';
import type { PlayerPlugin } from '@ease-live/ease-live-bridge-web';
import type { AppStatus, EaseLiveErrorPayload } from '../../packages/shared-sdk/index';
import { easeLiveConfig } from '../config';

interface EaseLiveHandlers {
  onStatus?: (status: AppStatus) => void;
  onFatal?: (message: string) => void;
}

/**
 * Creates the Ease Live bridge and loads the program from `src/config.ts`.
 * The graphics inside `#ease-live-view` come from that Studio program.
 * Register `app.status` and `easelive.error` before `init()`.
 * `disabled` or a fatal error destroys the bridge. `hidden` leaves it alive.
 */
export class EaseLiveComponent {
  private instance: EaseLive | null = null;

  constructor(
    private readonly viewContainer: string | HTMLElement,
    private readonly playerPlugin: PlayerPlugin,
    private readonly handlers: EaseLiveHandlers = {},
  ) {}

  init(): void {
    if (this.instance) {
      return;
    }

    const instance = new EaseLive({
      accountId: easeLiveConfig.accountId,
      projectId: easeLiveConfig.projectId,
      programId: easeLiveConfig.programId,
      env: easeLiveConfig.env,
      viewContainer: this.viewContainer,
      playerPlugin: this.playerPlugin,
    });

    instance.on('easelive.error', (payload) => {
      const error = payload as EaseLiveErrorPayload;
      if (error.type === 'fatal') {
        this.handlers.onFatal?.(error.message);
        void this.destroy();
      }
    });

    instance.on('app.status', ({ status }) => {
      this.handlers.onStatus?.(status);
      if (status === 'disabled') {
        void this.destroy();
      }
    });

    this.instance = instance;
    instance.init();
  }

  destroy(): Promise<void> {
    const instance = this.instance;
    this.instance = null;
    if (!instance) {
      return Promise.resolve();
    }
    return instance.destroy();
  }
}
