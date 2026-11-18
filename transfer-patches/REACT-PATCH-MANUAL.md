# Apply the React patch

Patch: `white-label-react-autoplay-audio.patch`
Repository: white-label-react
Base commit: `878146d8f609703f34ac9edfb32d6d0f4ba5f838`

## What it contains

- VideoPlayerOverlay autoplay and muted props, forwarded through both engine adapters.
- User-initiated movie, trailer, programme, series, and demo playback passes
  `autoplay: true, muted: false` to request audio without another Play click.
- Host option tests and changelog notes.

The overlay defaults to autoplay false when the host omits the option. Explicit
muted true remains supported. The companion player patch changes its defaults
so autoplay itself never implicitly mutes audio.

This patch excludes unrelated episode-selection work, bulk line-ending changes,
secrets, node_modules, and the old local vendor snapshot/package-lock updates.
Rebuilding and syncing the player on the destination creates the correct package
and lockfile there, with a real source commit rather than this machine's snapshot.
No automatic native-fullscreen request or browser permission bypass is included.

## Apply

Use the sibling folders described in PLAYER-PATCH-MANUAL.md. Start inside
white-label-react. Check `git status --short` and preserve any existing work.

```bash
git apply --ignore-space-change --check ../transfer-patches/white-label-react-autoplay-audio.patch
git apply --ignore-space-change ../transfer-patches/white-label-react-autoplay-audio.patch
git diff --stat
```

Use git apply, not git am. --ignore-space-change handles LF/CRLF context differences.
If the check fails, stop and reconcile the changed base/files; do not force a
partial application. The recorded base is the version used for verification.
Check whether it is already applied with:

```bash
git apply --ignore-space-change --reverse --check ../transfer-patches/white-label-react-autoplay-audio.patch
```

## Sync the newly patched player (required)

First finish the player manual: apply, validate, and commit the player patch.
Ensure its Web tree is clean. Place the checkout at ../white-label-player, with
that exact name (no trailing space), since the existing sync command uses this
sibling path. A same-named folder is preferable across Windows/macOS/Linux.

The React app also has an existing file dependency on
../white-label-ui/platforms/react. Ensure that dependency is present and built
as your normal app setup requires; do not replace it with a different UI build
just to install this patch. Use the same versions/registries as your team.

From white-label-react run:

```bash
npm run player:sync
npm run typecheck
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --watchman=false --runInBand --runTestsByPath src/ui/elements/VideoPlayerOverlay.test.tsx src/ui/content_page/SeriesPlayback.test.tsx src/ui/content_page/VodDetailsContentItem.test.tsx
npm run build
npm start
```

The test command's CI=true prefix is for Bash/Git Bash. For PowerShell set
$env:CI="true" before running the same node command without that prefix.
--watchman=false avoids needing Watchman's socket service on the new system.
Use your project's normal install/setup first if dependencies are not installed.
player:sync builds, copies and installs the new player automatically. It updates
vendor/white-label-player/, package.json, and package-lock.json. A plain npm
install alone does not build the new player source.

Review and commit those generated vendor/manifest changes along with the React
patch on the destination when ready. Teammates pulling that commit run npm install;
they do not need to run player:sync or clone the player repo.

## Use and test

For other host flows, pass these props alongside the required existing props:

```tsx
<VideoPlayerOverlay
    streamUrl={streamUrl}
    title={title}
    onClose={onClose}
    autoplay={true}
    muted={false}
/>
```

Set autoplay false for an additional Play gesture. Set muted true for silent
startup. Card/Play clicks are real interactions, but browser policy remains the
authority: asynchronous loading can lose transient activation, and sound is not
guaranteed. This patch does not automatically retry muted when audio is blocked;
it preserves the audible request and leaves the player Play control available.

Test a content Play/card flow with both engines. Verify sound, pause/resume,
engine switching, autoplay false, and Shaka ad click-through/return/resume.
Bitmovin requires your configured REACT_APP_BITMOVIN_KEY; no license is supplied.

## Undo an uncommitted application

Before further edits, after confirming reverse applicability:

```bash
git apply --ignore-space-change --reverse --check ../transfer-patches/white-label-react-autoplay-audio.patch
git apply --ignore-space-change --reverse ../transfer-patches/white-label-react-autoplay-audio.patch
```

This reverses source changes only. If you also ran player:sync, separately revert
only its vendor/package.json/package-lock.json changes using your normal Git
workflow. Do not discard unrelated changes. For committed work use git revert.
