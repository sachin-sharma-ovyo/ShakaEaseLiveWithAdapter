import EaseLive from '@ease-live/ease-live-bridge-web';
import type { PlayerPlugin } from '@ease-live/ease-live-bridge-web';
import type { BrandEaseLiveConfig } from '../brand';
import type { AppStatus, EaseLiveErrorPayload } from '../plugininterface';

interface EaseLiveHandlers {
  onStatus?: (status: AppStatus) => void;
  onFatal?: (message: string) => void;
}

/**
 * Creates the Ease Live bridge for one brand.
 * The graphics inside `#ease-live-view` come from `easeLiveConfig.programId`.
 * Register `app.status` and `easelive.error` before `init()`.
 * `disabled` or a fatal error destroys the bridge. `hidden` leaves it alive.
 */
export class EaseLiveComponent {
  private instance: EaseLive | null = null;

  constructor(
    private readonly viewContainer: string | HTMLElement,
    private readonly playerPlugin: PlayerPlugin,
    private readonly easeLiveConfig: BrandEaseLiveConfig,
    private readonly handlers: EaseLiveHandlers = {},
  ) {}

  init(): void {
    if (this.instance) {
      return;
    }

    const instance = new EaseLive({
      accountId: this.easeLiveConfig.accountId,
      programId: this.easeLiveConfig.programId,
      ...(this.easeLiveConfig.projectId ? { projectId: this.easeLiveConfig.projectId } : {}),
      env: this.easeLiveConfig.env ?? 'prod',
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
