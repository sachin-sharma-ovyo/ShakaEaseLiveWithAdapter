/** How close to the duration an `ended` event must be to count as the content end. */
const CONTENT_END_SLACK_SEC = 0.5;

/**
 * An `ended` event can fire while an ad reuses the content element, before
 * the playhead is restored. Those events are not the content ending.
 */
export function isPrematureContentEnd(
  media: HTMLMediaElement,
  slackSec = CONTENT_END_SLACK_SEC,
): boolean {
  const duration = media.duration;
  return Number.isFinite(duration) && media.currentTime + slackSec < duration;
}

/** Fires `listener` on playhead updates and after a seek. */
export function onPlaybackTime(media: HTMLMediaElement, listener: () => void): void {
  media.addEventListener('timeupdate', listener);
  media.addEventListener('seeked', listener);
}
