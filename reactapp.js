#!/usr/bin/env node
/**
 * Re-vendors @white-label/player-web from a white-label-player checkout next to this repo
 * (../white-label-player), so the app itself never depends on that checkout.
 *
 * Runs the player repo's `npm run pack:web` (it refuses uncommitted changes in web/, since
 * the commit SHA names the tarball), replaces the tarball in vendor/white-label-player/web/,
 * records the source in vendor/white-label-player/VERSION and reinstalls it. Commit vendor/,
 * package.json and package-lock.json afterwards.
 *
 * Usage (via package.json): npm run player:sync
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLAYER_DIR = path.resolve(REPO_ROOT, '..', 'white-label-player');
const VENDOR_DIR = path.join(REPO_ROOT, 'vendor', 'white-label-player');
const TARBALL_DIR = path.join(VENDOR_DIR, 'web');

if (!fs.existsSync(path.join(PLAYER_DIR, 'scripts', 'pack-web.js'))) {
    console.error(
        'ERROR: ../white-label-player (with scripts/pack-web.js) not found. Clone it next to this repo first.'
    );
    process.exit(1);
}

console.log('==> Packing @white-label/player-web in ../white-label-player …');
const packOutput = execSync('npm run --silent pack:web', {
    cwd: PLAYER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
});
const packed = packOutput.trim().split(/\r?\n/).pop();
const name = path.basename(packed);
const match = /^white-label-player-web-(.+)-([0-9a-f]+)\.tgz$/.exec(name);
if (!fs.existsSync(packed) || !match) {
    console.error(`ERROR: unexpected pack:web output: ${packed}`);
    process.exit(1);
}

fs.mkdirSync(TARBALL_DIR, { recursive: true });
for (const old of fs.readdirSync(TARBALL_DIR).filter((f) => f.endsWith('.tgz'))) {
    fs.rmSync(path.join(TARBALL_DIR, old));
}
fs.copyFileSync(packed, path.join(TARBALL_DIR, name));
console.log(`==> Wrote vendor/white-label-player/web/${name}`);

const [, version, sha] = match;
const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
    path.join(VENDOR_DIR, 'VERSION'),
    [
        '# white-label-player vendored builds',
        '# Updated by scripts/sync-white-label-player.js',
        '# Format: package | source-repo-commit | date | version',
        `player-web | ${sha} | ${date} | ${version}`,
        '',
    ].join('\n')
);

console.log('==> Installing …');
execSync(`npm install @white-label/player-web@file:vendor/white-label-player/web/${name}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
});

console.log(`\nDone. Commit vendor/, package.json and package-lock.json (player-web ${version}, ${sha}).`);
