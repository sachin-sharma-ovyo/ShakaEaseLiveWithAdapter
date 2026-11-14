# Episode-selection integration patch

`episode-selection-integration.patch` contains the React host changes for selecting an episode
from the player's Episodes panel, their focused tests, and the required `[Unreleased]` changelog
entry. It intentionally excludes:

- the `@white-label/player-web` package update;
- `package.json` and `package-lock.json` changes;
- vendored player archives and version metadata;
- changes to `scripts/sync-white-label-player.js`;
- any `@white-label/ui-react` package update.

## Prerequisite

In the target system, update the player separately using that checkout's normal command:

```bash
npm run player:sync
```

The installed player must expose `Episode`, `seasonNumber`, `episodeNumber`, and
`onEpisodeSelect` through `@white-label/player-web`.

## Apply the patch

Copy `episode-selection-integration.patch` into the root of the target
`white-label-react` repository, then run:

```bash
git status --short
git apply --check episode-selection-integration.patch
git apply episode-selection-integration.patch
```

`git apply --check` makes no changes. If it reports a conflict, do not run the next command;
the target source has diverged and the affected hunk needs to be applied manually.

## Verify

```bash
npm run typecheck
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath \
  src/ui/content_page/SeriesPlayback.test.tsx \
  src/ui/elements/VideoPlayerOverlay.test.tsx
```

Finally, start the app, open a series episode, open the Episodes panel, and select a different
episode. The selected episode should load in the same player and resume from its saved bookmark.
