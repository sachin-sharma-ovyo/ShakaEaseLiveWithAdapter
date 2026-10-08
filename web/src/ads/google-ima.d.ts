/**
 * Minimal IMA HTML5 SDK surface used by AdController.
 * `@types/google.ima` is not published. The SDK itself loads from the CDN script in index.html.
 */
declare namespace google.ima {
  class AdsRequest {
    adTagUrl: string;
  }

  class AdsLoader {
    constructor(container: object);
  }

  class AdsManager {
    stop(): void;
  }
}
