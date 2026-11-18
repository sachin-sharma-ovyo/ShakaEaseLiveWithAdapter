# Apply the player patch

Patch: `white-label-player-ad-autoplay.patch`
Repository: white-label-player
Base commit: `fe4dd77dec51e1c27769c042e285b9bab0206738`

## What it contains

- Google IMA ad resume/pause using white-label-ui-react's PlayPause, including
  resume after advertiser click-through, ad locks, and teardown.
- Shaka autoplay with prerolls; false waits for Play.
- Shaka and Bitmovin keep audio enabled by default. Only `muted: true` requests
  silent startup. Blocked playback retains Play; this does not bypass browser
  policy or transfer a click's transient activation through asynchronous work.
- Focused simulations, API documentation, and changelog entries.

Unrelated native changes (including gradlew.bat), dependencies, generated builds,
licenses, local settings, and the React package snapshot are excluded.

## Preparation

Use a terminal (Git Bash on Windows) with Git, Node.js and npm. Place this
transfer-patches folder beside your repository folders:

```text
work/
  transfer-patches/
  white-label-player/
  white-label-react/
  white-label-ui/       # React app's existing local UI dependency, if configured
```

Run inside white-label-player. Inspect `git status --short` and preserve any
existing work before proceeding. The base above is the version the patch was
verified against; do not reset or overwrite another checkout to force a match.
A newer compatible branch can be used if the applicability check succeeds.

## Apply and verify

```bash
git apply --ignore-space-change --check ../transfer-patches/white-label-player-ad-autoplay.patch
git apply --ignore-space-change ../transfer-patches/white-label-player-ad-autoplay.patch
git diff --stat
```

The whitespace option allows LF/CRLF differences between systems. These are
plain Git diffs: use git apply, not git am. If the check fails, stop and compare
the affected files/base version. Do not use --reject to install a partial feature.
If already applied, this check succeeds instead:

```bash
git apply --ignore-space-change --reverse --check ../transfer-patches/white-label-player-ad-autoplay.patch
```

Install the repo's dependencies if needed (using its normal registry access),
then validate:

```bash
npm run install:deps
npm run typecheck
node web/tests/ad-resume.cjs
node web/tests/autoplay.cjs
npm run build
npm run build:demo
```

Existing installations can skip install:deps. If copied node_modules launchers
are not executable, reinstall dependencies on that system or run the declared
build CLIs through Node from web/ (tsup/dist/cli-default.js and webpack/bin/webpack.js).

## Commit before packaging

The pack:web script refuses uncommitted Web changes because the package filename
uses the source commit SHA. After reviewing the applied patch, commit its files
on the other system. On a checkout that was clean before applying this patch:

```bash
git add CHANGELOG.md docs/features/PF-16-client-side-ads.md docs/features/README.md web
git commit -m "Fix web ad recovery and support autoplay with audio"
npm run pack:web
```

Review the staged list before committing if the checkout had any other work.
The final command prints the generated tarball path. Do not manually rename an
uncommitted build as a clean-commit release.

Next apply the React patch and follow REACT-PATCH-MANUAL.md to sync this package.
No push is required just to build and use it locally.

## Playback checks

In Chrome, check true/false startup with and without Google prerolls; click an
ad, return, and resume it; check Skip and keyboard access. Repeat in target
browsers. Audible autoplay can be rejected even after a card click when SDK or
network work delays playback; the visible Play button is the fallback. Native
fullscreen startup is not added by this patch. Bitmovin requires the host's valid
license key. No keys are included.

## Undo an uncommitted application

Only before subsequent edits, and only when reverse --check passes:

```bash
git apply --ignore-space-change --reverse --check ../transfer-patches/white-label-player-ad-autoplay.patch
git apply --ignore-space-change --reverse ../transfer-patches/white-label-player-ad-autoplay.patch
```

For an already-committed patch use your normal Git revert workflow instead.
