#!/usr/bin/env node
'use strict';

// Build and pack the reusable Web library using native paths on Windows/macOS/Linux.
// Usage: npm run pack:web -- [destination-directory]
// stdout's final line is the native absolute artifact path (consumed by player:sync).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function run(file, args, cwd, capture = false) {
  return execFileSync(file, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
}

function findNpmCli() {
  // npm supplies its actual JavaScript entry point when this runs via npm run.
  // Launch it through Node, avoiding npm.cmd and shell quoting on Windows.
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find((candidate) => candidate && /\.(?:c?js)$/i.test(candidate) && fs.existsSync(candidate));
  if (!cli) throw new Error('Cannot locate npm CLI. Run this script with npm run pack:web.');
  return path.resolve(cli);
}

function packWeb({ repoRoot = path.resolve(__dirname, '..'), destination, npmCli, execute = run } = {}) {
  repoRoot = path.resolve(repoRoot);
  const webDir = path.join(repoRoot, 'web');
  const dirty = execute('git', ['status', '--porcelain', '--', 'web', 'packages/shared-sdk/web'], repoRoot, true);
  if (dirty.trim()) {
    throw new Error('web/ or packages/shared-sdk/web/ has uncommitted changes. Preserve and commit them before packaging.');
  }
  const sha = execute('git', ['rev-parse', '--short', 'HEAD'], repoRoot, true).trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(webDir, 'package.json'), 'utf8'));
  if (manifest.name !== '@white-label/player-web' || !/^[0-9a-f]+$/i.test(sha) ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new Error('Unexpected player package name, version or Git commit.');
  }
  npmCli = npmCli || findNpmCli();
  const npm = (args, cwd = repoRoot, capture = false) =>
    execute(process.execPath, [npmCli, ...args], cwd, capture);

  // Preserve the original install-on-missing-dependencies behaviour.
  for (const dir of [path.join(repoRoot, 'packages/shared-sdk/web'), webDir]) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) {
      console.error(`==> Installing dependencies in ${path.relative(repoRoot, dir)} …`);
      npm(['install'], dir);
    }
  }

  console.error(`==> Building @white-label/player-web ${manifest.version} (${sha}) …`);
  // Invoke the declared tsup JS CLI directly: no platform-specific .bin launcher.
  const tsupManifestPath = require.resolve('tsup/package.json', { paths: [webDir] });
  const tsupManifest = JSON.parse(fs.readFileSync(tsupManifestPath, 'utf8'));
  const tsupBin = typeof tsupManifest.bin === 'string' ? tsupManifest.bin : tsupManifest.bin.tsup;
  if (!tsupBin || manifest.scripts?.build !== 'tsup') {
    throw new Error('The Web build command changed; update pack-web.js to match it.');
  }
  execute(process.execPath, [path.resolve(path.dirname(tsupManifestPath), tsupBin)], webDir);

  const destinationDir = destination ? path.resolve(destination) : path.join(repoRoot, 'build/web-pack');
  fs.mkdirSync(destinationDir, { recursive: true });
  const stagingDir = fs.mkdtempSync(path.join(destinationDir, '.pack-'));
  try {
    console.error('==> Packing …');
    const output = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', stagingDir, webDir], repoRoot, true));
    if (!Array.isArray(output) || output.length !== 1 || typeof output[0].filename !== 'string' ||
        path.basename(output[0].filename) !== output[0].filename) {
      throw new Error('Unexpected npm pack JSON output.');
    }
    const packed = path.join(stagingDir, output[0].filename);
    if (!fs.statSync(packed).isFile()) throw new Error('npm pack did not produce a package file.');
    const target = path.join(destinationDir, `white-label-player-web-${manifest.version}-${sha}.tgz`);
    // A build/pack failure never deletes the previous package.
    fs.copyFileSync(packed, target);
    return target;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    console.log(packWeb({ destination: process.argv[2] }));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { packWeb };
