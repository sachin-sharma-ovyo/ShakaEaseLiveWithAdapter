/**
 * Tutorial account from the Ease Live 1.22 docs, plus a public live HLS stream.
 * That program renders Ease Live's installation overlay (state, time, speed, volume).
 * Those rows are the Studio program inside the iframe, not Shaka controls.
 * Swap `accountId` and `programId` for your own program to change that UI.
 */
export const easeLiveConfig = {
  accountId: 'tutorials',
  projectId: '0346ae3e-7a91-4760-bcd3-cd84bb6790dd',
  programId: '2d2711ff-6ff2-41c1-a141-060e9ffa2c38',
  env: 'prod' as const,
  streamUrl:
    'https://stream-akamai.castr.com/5b9352dbda7b8c769937e459/live_2361c920455111ea85db6911fe397b9e/index.fmp4.m3u8',
};
