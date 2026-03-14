import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';

import {
  buildScreenshotManifest,
  parseCliArgs,
  runScreenshotMetadataManager,
  scanStagedScreenshots
} from '../scripts/screenshot-metadata-manager.mjs';
import { createScreenshotManifestHelpers } from '../src/utils/screenshot-manifest.js';

const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD84AAAAASUVORK5CYII=';
const createdDirs = [];

async function createTempDocsRoot() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-screenshot-manager-test-'));
  createdDirs.push(tempRoot);
  await fs.mkdir(path.join(tempRoot, 'screenshot-staging'), { recursive: true });
  await fs.writeFile(path.join(tempRoot, 'screenshot-staging', '.gitkeep'), '', 'utf8');
  await fs.mkdir(path.join(tempRoot, 'src', 'content', 'docs', 'img', 'screenshots'), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'manifest.json'),
    JSON.stringify({ generatedAt: null, libraryRoot: 'src/content/docs/img/screenshots', items: [] }, null, 2)
  );
  return tempRoot;
}

async function writePng(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(TEST_PNG_BASE64, 'base64'));
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('parseCliArgs reads non-interactive flags', () => {
  const options = parseCliArgs(['--input', './incoming', '--reindex', '--dry-run', '--category', 'Docs']);
  assert.equal(options.input, './incoming');
  assert.equal(options.reindex, true);
  assert.equal(options.dryRun, true);
  assert.equal(options.category, 'Docs');
});

test('scanStagedScreenshots normalizes category and duplicate slugs deterministically', async () => {
  const docsRoot = await createTempDocsRoot();
  await writePng(path.join(docsRoot, 'screenshot-staging', 'Installation', 'Desktop', 'Step 01.PNG'));
  await writePng(path.join(docsRoot, 'screenshot-staging', 'installation', 'desktop', 'Step_01.png'));
  await writePng(path.join(docsRoot, 'screenshot-staging', '共享', '欢迎界面.png'));

  const entries = await scanStagedScreenshots({
    inputDir: path.join(docsRoot, 'screenshot-staging'),
    libraryRoot: path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots'),
    categoryOverride: undefined
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0].category, 'installation/desktop');
  assert.match(entries[0].slug, /^step-01-[0-9a-f]{8}$/);
  assert.match(entries[1].slug, /^step-01-[0-9a-f]{8}$/);
  assert.notEqual(entries[0].slug, entries[1].slug);
  assert.match(entries[2].category, /^shared-[0-9a-f]{8}$/);
  assert.match(entries[2].slug, /^screenshot-[0-9a-f]{8}$/);
});

test('buildScreenshotManifest preserves metadata fields and helper resolves markdown paths', async () => {
  const docsRoot = await createTempDocsRoot();
  const assetDir = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'installation', 'desktop-start');
  await fs.mkdir(assetDir, { recursive: true });
  await writePng(path.join(assetDir, 'original.png'));
  await fs.writeFile(
    path.join(assetDir, 'metadata.json'),
    JSON.stringify({
      slug: 'desktop-start',
      title: 'Desktop Start',
      description: 'Open the desktop app launcher.',
      tags: ['desktop', 'install'],
      paths: {
        assetDir,
        original: 'original.png'
      },
      status: {
        recognition: 'succeeded'
      },
      timestamps: {
        createdAt: '2026-03-13T00:00:00.000Z',
        updatedAt: '2026-03-13T01:00:00.000Z'
      }
    }, null, 2)
  );

  const manifest = await buildScreenshotManifest({
    docsRoot,
    libraryRoot: path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots'),
    manifestPath: path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'manifest.json'),
    now: new Date('2026-03-13T02:00:00.000Z')
  });

  assert.equal(manifest.items.length, 1);
  assert.deepEqual(manifest.items[0].categorySegments, ['installation']);
  assert.equal(manifest.items[0].relativeImagePath, 'img/screenshots/installation/desktop-start/original.png');

  const helpers = createScreenshotManifestHelpers(manifest);
  const reference = helpers.resolveReference({
    category: 'installation',
    slug: 'desktop-start',
    fromDocument: 'quick-start/conversation-session.mdx'
  });

  assert.equal(reference.markdownImagePath, '../img/screenshots/installation/desktop-start/original.png');
  assert.equal(reference.alt, 'Open the desktop app launcher.');
});

test('runScreenshotMetadataManager isolates failures, reuses managed directories, and updates the manifest', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const successStagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'success-image.png');
  const retryStagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'retry-image.png');

  await fs.writeFile(imgbinExecutable, `
import path from 'node:path';
import { promises as fs } from 'node:fs';

const args = process.argv.slice(2);
const command = args[0];
const failPattern = process.env.FAKE_IMGBIN_FAIL_PATTERN || '';

if (command === 'annotate') {
  const assetPath = args[1];
  const importToIndex = args.indexOf('--import-to');
  const slugIndex = args.indexOf('--slug');
  const titleIndex = args.indexOf('--title');
  const overwrite = args.includes('--overwrite');
  const slug = slugIndex >= 0 ? args[slugIndex + 1] : path.basename(assetPath, path.extname(assetPath));
  const title = titleIndex >= 0 ? args[titleIndex + 1] : slug;
  if (failPattern && assetPath.includes(failPattern)) {
    console.error('simulated annotate failure for ' + assetPath);
    process.exit(2);
  }
  const assetDir = importToIndex >= 0
    ? path.join(args[importToIndex + 1], '2026-03', slug)
    : assetPath;
  await fs.mkdir(assetDir, { recursive: true });
  const sourceExtension = importToIndex >= 0 ? path.extname(assetPath).replace(/^\./, '').toLowerCase() || 'png' : 'png';
  const originalFilename = 'original.' + sourceExtension;
  if (importToIndex >= 0) {
    await fs.copyFile(assetPath, path.join(assetDir, originalFilename));
  }
  let metadata = {
    slug,
    title,
    description: 'Annotated ' + slug,
    tags: ['docs', slug],
    source: { type: 'imported', originalPath: assetPath },
    paths: { assetDir, original: originalFilename },
    status: { recognition: 'succeeded' },
    timestamps: { createdAt: '2026-03-13T00:00:00.000Z', updatedAt: '2026-03-13T00:00:00.000Z' }
  };
  try {
    const currentRaw = await fs.readFile(path.join(assetDir, 'metadata.json'), 'utf8');
    metadata = { ...JSON.parse(currentRaw), ...metadata };
  } catch {}
  metadata.paths = { ...(metadata.paths || {}), assetDir, original: metadata.paths?.original || originalFilename };
  metadata.status = { ...(metadata.status || {}), recognition: 'succeeded' };
  metadata.timestamps = { ...(metadata.timestamps || {}), updatedAt: '2026-03-13T00:00:00.000Z', createdAt: metadata.timestamps?.createdAt || '2026-03-13T00:00:00.000Z' };
  await fs.writeFile(path.join(assetDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(overwrite ? 'refreshed' : 'annotated');
  process.exit(0);
}

if (command === 'search') {
  const libraryIndex = args.indexOf('--library');
  const libraryRoot = args[libraryIndex + 1];
  await fs.mkdir(path.join(libraryRoot, '.imgbin'), { recursive: true });
  await fs.writeFile(path.join(libraryRoot, '.imgbin', 'search-index.json'), JSON.stringify({ ok: true }, null, 2));
  console.log(JSON.stringify({ rebuilt: true, totalMatches: 0 }));
  process.exit(0);
}

console.error('unexpected command');
process.exit(1);
`, 'utf8');

  await writePng(successStagedPath);
  await writePng(retryStagedPath);

  const firstRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    imgbinExecutable,
    reindex: true
  }, {
    docsRoot,
    env: {
      ...process.env,
      FAKE_IMGBIN_FAIL_PATTERN: 'retry-image'
    },
    now: new Date('2026-03-13T03:00:00.000Z')
  });

  assert.equal(firstRun.exitCode, 1);
  assert.equal(firstRun.successCount, 1);
  assert.equal(firstRun.failedCount, 1);
  assert.equal(firstRun.manifest.items.length, 1);
  assert.equal(firstRun.manifest.items[0].slug, 'success-image');
  await assert.rejects(fs.access(path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'shared', 'retry-image', 'metadata.json')));
  await assert.rejects(fs.access(successStagedPath));
  await fs.access(retryStagedPath);
  await fs.access(path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', '.imgbin', 'search-index.json'));

  const secondRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    imgbinExecutable
  }, {
    docsRoot,
    env: process.env,
    now: new Date('2026-03-13T04:00:00.000Z')
  });

  assert.equal(secondRun.exitCode, 0);
  assert.equal(secondRun.manifest.items.length, 2);
  await assert.rejects(fs.access(retryStagedPath));

  await writePng(successStagedPath);
  const thirdRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    imgbinExecutable
  }, {
    docsRoot,
    env: process.env,
    now: new Date('2026-03-13T05:00:00.000Z')
  });

  assert.equal(thirdRun.exitCode, 0);
  assert.equal(thirdRun.results[0]?.action, 'refreshed-existing');
  await assert.rejects(fs.access(successStagedPath));

  const sharedDir = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'shared');
  const sharedEntries = await fs.readdir(sharedDir, { withFileTypes: true });
  const managedDirs = sharedEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(managedDirs, ['retry-image', 'success-image']);

  const manifestHash = crypto.createHash('sha1').update(JSON.stringify(secondRun.manifest.items)).digest('hex');
  assert.match(manifestHash, /^[0-9a-f]{40}$/);
});
