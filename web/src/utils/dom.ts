/** Nodes the player page must contain before startup can continue. */
export interface PlayerMarkup {
  wrapper: HTMLElement;
  video: HTMLVideoElement;
  status: HTMLElement;
  view: HTMLElement;
  adContainer: HTMLElement;
}

/**
 * Reads the player shell. Throws when any required node is missing so startup
 * does not continue against a partial page.
 */
export function readPlayerMarkup(root: ParentNode = document): PlayerMarkup {
  const wrapper = root.querySelector<HTMLElement>('#player-wrapper');
  const video = root.querySelector<HTMLVideoElement>('#video');
  const status = root.querySelector<HTMLElement>('#status');
  const view = root.querySelector<HTMLElement>('#ease-live-view');
  const adContainer = root.querySelector<HTMLElement>('#ad-container');

  if (!wrapper || !video || !status || !view || !adContainer) {
    throw new Error('Player markup is missing.');
  }

  return { wrapper, video, status, view, adContainer };
}
