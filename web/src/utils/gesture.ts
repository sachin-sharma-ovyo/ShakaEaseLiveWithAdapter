/**
 * Resolves on the first click or Enter / MediaPlay key.
 * `begin` runs inside that gesture so IMA can initialize its display container.
 */
export function waitForStartGesture(target: HTMLElement, begin: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const start = (event?: Event) => {
      if (event instanceof KeyboardEvent && !isStartKey(event)) {
        return;
      }
      target.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      resolve(begin());
    };
    const onClick = () => {
      start();
    };
    const onKey = (event: KeyboardEvent) => {
      start(event);
    };
    target.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  });
}

/** Enter, MediaPlay, and the Samsung TV key codes for those keys. */
function isStartKey(event: KeyboardEvent): boolean {
  return (
    event.key === 'Enter' ||
    event.key === 'MediaPlay' ||
    event.keyCode === 13 ||
    event.keyCode === 415
  );
}
