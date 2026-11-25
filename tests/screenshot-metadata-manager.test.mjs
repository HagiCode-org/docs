import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

import {
  buildScreenshotManifest,
  parseCliArgs,
  resolveConfig,
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

async function writePng(filePath, bytes = Buffer.from(TEST_PNG_BASE64, 'base64')) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

function createCaptureWriter() {
  let value = '';
  return {
    write(chunk) {
      value += String(chunk);
    },
    toString() {
      return value;
    }
  };
}

function libraryRootOf(docsRoot) {
  return path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots');
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('parseCliArgs reads non-interactive flags', () => {
  const options = parseCliArgs([
    '--input', './incoming',
    '--dry-run',
    '--category', 'Docs'
  ]);
  assert.equal(options.input, './incoming');
  assert.equal(options.dryRun, true);
  assert.equal(options.category, 'Docs');
});

test('parseCliArgs rejects the removed analysis flags', () => {
  assert.throws(() => parseCliArgs(['--reindex']), /Unknown argument: --reindex/);
  assert.throws(() => parseCliArgs(['--analysis-context-file', './context.txt']), /Unknown argument: --analysis-context-file/);
});

test('resolveConfig reads SCREENSHOT_* overrides from the docs .env and creates no tmp directory', async () => {
  const docsRoot = await createTempDocsRoot();
  await fs.mkdir(path.join(docsRoot, 'incoming'), { recursive: true });
  await fs.writeFile(path.join(docsRoot, '.env'), 'SCREENSHOT_STAGING_DIR=./incoming\n', 'utf8');

  const config = await resolveConfig({}, {
    docsRoot,
    env: {}
  });

  assert.equal(config.inputDir, path.join(docsRoot, 'incoming'));
  assert.equal(config.libraryRoot, libraryRootOf(docsRoot));
  assert.equal(config.manifestPath, path.join(libraryRootOf(docsRoot), 'manifest.json'));
  assert.equal(config.dryRun, false);
  assert.equal(config.tempDir, undefined);
  assert.doesNotMatch(config.assumptions.join('\n'), /Using default staging directory/);
  await assert.rejects(fs.access(path.join(docsRoot, '.tmp')));
});

test('resolveConfig fails fast when the staging directory is missing', async () => {
  const docsRoot = await createTempDocsRoot();

  await assert.rejects(
    resolveConfig({ input: 'does-not-exist' }, { docsRoot, env: {} }),
    /Screenshot staging directory not found: does-not-exist/
  );
});

test('scanStagedScreenshots normalizes category and duplicate slugs deterministically', async () => {
  const docsRoot = await createTempDocsRoot();
  await writePng(path.join(docsRoot, 'screenshot-staging', 'Installation', 'Desktop', 'Step 01.PNG'));
  await writePng(path.join(docsRoot, 'screenshot-staging', 'installation', 'desktop', 'Step_01.png'));
  await writePng(path.join(docsRoot, 'screenshot-staging', '共享', '欢迎界面.png'));

  const entries = await scanStagedScreenshots({
    inputDir: path.join(docsRoot, 'screenshot-staging'),
    libraryRoot: libraryRootOf(docsRoot),
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
  const assetDir = path.join(libraryRootOf(docsRoot), 'installation', 'desktop-start');
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
    libraryRoot: libraryRootOf(docsRoot),
    manifestPath: path.join(libraryRootOf(docsRoot), 'manifest.json'),
    now: new Date('2026-03-13T02:00:00.000Z')
  });

  assert.equal(manifest.items.length, 1);
  assert.deepEqual(manifest.items[0].categorySegments, ['installation']);
  assert.equal(manifest.items[0].relativeImagePath, 'img/screenshots/installation/desktop-start/original.png');

  const helpers = createScreenshotManifestHelpers(manifest);
  const reference = helpers.resolveReference({
    category: 'installation',
    slug: 'desktop-start',
    fromDocument: 'quick-start/proposal-session.mdx'
  });

  assert.equal(reference.markdownImagePath, '../img/screenshots/installation/desktop-start/original.png');
  assert.equal(reference.alt, 'Open the desktop app launcher.');
});

test('buildScreenshotManifest includes skipped-analysis assets and leaves out pending or failed ones', async () => {
  const docsRoot = await createTempDocsRoot();
  const libraryRoot = libraryRootOf(docsRoot);
  const statuses = { captured: 'skipped', failed: 'failed', untracked: undefined };

  for (const [slug, recognition] of Object.entries(statuses)) {
    const assetDir = path.join(libraryRoot, 'guides', slug);
    await writePng(path.join(assetDir, 'original.png'));
    const metadata = { slug, title: slug, paths: { original: 'original.png' } };
    if (recognition) {
      metadata.status = { recognition };
    }
    await fs.writeFile(path.join(assetDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  }

  const manifest = await buildScreenshotManifest({
    docsRoot,
    libraryRoot,
    manifestPath: path.join(libraryRoot, 'manifest.json'),
    now: new Date('2026-03-13T02:00:00.000Z')
  });

  assert.deepEqual(manifest.items.map((item) => item.slug), ['captured']);
  assert.equal(manifest.items[0].analysisStatus, 'skipped');
});

test('runScreenshotMetadataManager imports staged files without analysis and refreshes them on the next run', async () => {
  const docsRoot = await createTempDocsRoot();
  const libraryRoot = libraryRootOf(docsRoot);
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'success-image.png');
  const assetDir = path.join(libraryRoot, 'shared', 'success-image');

  await writePng(stagedPath);

  const firstRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging'
  }, {
    docsRoot,
    env: {},
    now: new Date('2026-03-13T03:00:00.000Z')
  });

  assert.equal(firstRun.exitCode, 0);
  assert.equal(firstRun.successCount, 1);
  assert.equal(firstRun.results[0].action, 'imported');
  assert.equal(firstRun.manifest.items.length, 1);
  assert.equal(firstRun.manifest.items[0].slug, 'success-image');
  assert.equal(firstRun.manifest.items[0].analysisStatus, 'skipped');
  await assert.rejects(fs.access(stagedPath));

  const importedMetadata = JSON.parse(await fs.readFile(path.join(assetDir, 'metadata.json'), 'utf8'));
  assert.equal(importedMetadata.status.recognition, 'skipped');
  assert.equal(importedMetadata.paths.original, 'original.avif');
  assert.equal(importedMetadata.title, 'Success Image');
  assert.equal(importedMetadata.extra.docsScreenshot.relativeSourcePath, 'shared/success-image.png');
  await fs.access(path.join(assetDir, 'original.avif'));
  await assert.rejects(fs.access(path.join(assetDir, 'original.png')));
  const importedBytes = await fs.readFile(path.join(assetDir, 'original.avif'));
  assert.equal(importedBytes.subarray(8, 12).toString('latin1'), 'avif', 'managed original must carry an AVIF brand');

  // A hand-written title and description must survive a refresh.
  importedMetadata.manual = { title: 'Hand-written title', description: 'Hand-written description.' };
  await fs.writeFile(path.join(assetDir, 'metadata.json'), JSON.stringify(importedMetadata, null, 2));

  const replacementBytes = await sharp({
    create: { width: 3, height: 2, channels: 3, background: '#2060c0' }
  }).png().toBuffer();
  await writePng(stagedPath, replacementBytes);

  const secondRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging'
  }, {
    docsRoot,
    env: {},
    now: new Date('2026-03-13T04:00:00.000Z')
  });

  assert.equal(secondRun.exitCode, 0);
  assert.equal(secondRun.results[0].action, 'refreshed-existing');
  await assert.rejects(fs.access(path.join(assetDir, 'original.png')));
  const refreshedOriginal = await sharp(path.join(assetDir, 'original.avif')).metadata();
  assert.equal(refreshedOriginal.format, 'heif');
  assert.equal(refreshedOriginal.width, 3);
  assert.equal(refreshedOriginal.height, 2);
  await assert.rejects(fs.access(stagedPath));

  const refreshedMetadata = JSON.parse(await fs.readFile(path.join(assetDir, 'metadata.json'), 'utf8'));
  assert.equal(refreshedMetadata.status.recognition, 'skipped');
  assert.equal(refreshedMetadata.manual.title, 'Hand-written title');
  const manifestTitle = secondRun.manifest.items[0];
  assert.equal(manifestTitle.title, 'Hand-written title');
  assert.equal(manifestTitle.alt, 'Hand-written description.');
});

test('runScreenshotMetadataManager reports a failure for an existing asset directory without metadata', async () => {
  const docsRoot = await createTempDocsRoot();
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'broken.png');
  await writePng(path.join(libraryRootOf(docsRoot), 'shared', 'broken', 'original.png'));
  await writePng(stagedPath);

  const run = await runScreenshotMetadataManager({
    input: 'screenshot-staging'
  }, {
    docsRoot,
    env: {}
  });

  assert.equal(run.exitCode, 1);
  assert.equal(run.failedCount, 1);
  assert.match(run.results[0].error, /Managed asset path already exists without metadata: src\/content\/docs\/img\/screenshots\/shared\/broken/);
  await fs.access(stagedPath);
});

test('runScreenshotMetadataManager dry-run previews the import without writing anything', async () => {
  const docsRoot = await createTempDocsRoot();
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'preview.png');
  await writePng(stagedPath);

  const run = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    dryRun: true
  }, {
    docsRoot,
    env: {}
  });

  assert.equal(run.exitCode, 0);
  assert.equal(run.results[0].action, 'would-import');
  await fs.access(stagedPath);
  await assert.rejects(fs.access(path.join(libraryRootOf(docsRoot), 'shared', 'preview')));
});

test('runScreenshotMetadataManager emits sync logs for each stage and no analysis lines', async () => {
  const docsRoot = await createTempDocsRoot();
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'verbose-sync.png');
  const stderr = createCaptureWriter();

  await writePng(stagedPath);

  const run = await runScreenshotMetadataManager({
    input: 'screenshot-staging'
  }, {
    docsRoot,
    env: {},
    stderr
  });

  assert.equal(run.exitCode, 0);
  const logs = stderr.toString();
  assert.match(logs, /\[screenshots:sync\] starting sync/);
  assert.match(logs, /\[screenshots:sync\] input: \.\/screenshot-staging/);
  assert.match(logs, /\[screenshots:sync\] library: \.\/src\/content\/docs\/img\/screenshots/);
  assert.match(logs, /\[screenshots:sync\] discovered 1 supported screenshot/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] processing shared\/verbose-sync\.png/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] imported -> \.\/src\/content\/docs\/img\/screenshots\/shared\/verbose-sync \(file .* cumulative .*\)/);
  assert.match(logs, /\[screenshots:sync\] completed: 1 succeeded, 0 failed in /);
  assert.doesNotMatch(logs, /analysis context|temp:/i);
});
