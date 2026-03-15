import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';

import {
  buildScreenshotManifest,
  parseCliArgs,
  resolveConfig,
  runScreenshotMetadataManager,
  scanStagedScreenshots
} from '../scripts/screenshot-metadata-manager.mjs';
import { createScreenshotManifestHelpers } from '../src/utils/screenshot-manifest.js';

const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD84AAAAASUVORK5CYII=';
const DEFAULT_ANALYSIS_CONTEXT_RELATIVE = path.join('prompts', 'screenshot-analysis-context.txt');
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
  await writeAnalysisContextFile(tempRoot);
  return tempRoot;
}

async function writeAnalysisContextFile(
  docsRoot,
  relativePath = DEFAULT_ANALYSIS_CONTEXT_RELATIVE,
  content = 'Use visible screenshot evidence first.\n'
) {
  const filePath = path.join(docsRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

async function writePng(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(TEST_PNG_BASE64, 'base64'));
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

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('parseCliArgs reads non-interactive flags', () => {
  const options = parseCliArgs([
    '--input', './incoming',
    '--reindex',
    '--dry-run',
    '--category', 'Docs',
    '--analysis-context-file', './prompts/alt-context.txt'
  ]);
  assert.equal(options.input, './incoming');
  assert.equal(options.reindex, true);
  assert.equal(options.dryRun, true);
  assert.equal(options.category, 'Docs');
  assert.equal(options.analysisContextFilePath, './prompts/alt-context.txt');
});

test('resolveConfig loads docs .env defaults and prepares a workspace tmp directory automatically', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');

  await fs.writeFile(
    path.join(docsRoot, '.env'),
    'IMGBIN_EXECUTABLE=./fake-imgbin.mjs\nIMGBIN_ANALYSIS_TIMEOUT_MS=180000\n',
    'utf8'
  );
  await fs.writeFile(imgbinExecutable, 'console.log("fake imgbin");\n', 'utf8');

  const config = await resolveConfig({}, {
    docsRoot,
    env: {}
  });

  assert.equal(config.imgbinExecutable, './fake-imgbin.mjs');
  assert.equal(config.analysisContextFilePath, path.join(docsRoot, 'prompts', 'screenshot-analysis-context.txt'));
  assert.equal(config.analysisContextFileSource, 'default checked-in analysis context file');
  assert.equal(config.tempDir, path.join(docsRoot, '.tmp'));
  assert.equal(config.env.TMPDIR, path.join(docsRoot, '.tmp'));
  assert.equal(config.env.TMP, path.join(docsRoot, '.tmp'));
  assert.equal(config.env.TEMP, path.join(docsRoot, '.tmp'));
  assert.match(config.assumptions.join('\n'), /Using analysis context file: \.\/prompts\/screenshot-analysis-context\.txt/);
  await fs.access(path.join(docsRoot, '.tmp'));
});

test('resolveConfig prefers installed docs imgbin package before the monorepo fallback', async () => {
  const docsRoot = await createTempDocsRoot();
  const installedPackageRoot = path.join(docsRoot, 'node_modules', '@hagicode', 'imgbin');
  const installedBinPath = path.join(installedPackageRoot, 'dist', 'cli.js');

  await fs.mkdir(path.dirname(installedBinPath), { recursive: true });
  await fs.writeFile(
    path.join(installedPackageRoot, 'package.json'),
    JSON.stringify({
      name: '@hagicode/imgbin',
      version: '0.1.0',
      bin: {
        imgbin: 'dist/cli.js'
      }
    }, null, 2),
    'utf8'
  );
  await fs.writeFile(installedBinPath, 'console.log("installed imgbin");\n', 'utf8');

  const config = await resolveConfig({}, {
    docsRoot,
    env: {}
  });

  assert.equal(config.imgbinExecutable, installedBinPath);
});

test('resolveConfig applies analysis context precedence: CLI over env over checked-in default', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const envContextPath = await writeAnalysisContextFile(docsRoot, path.join('prompts', 'env-context.txt'), 'env context\n');
  const cliContextPath = await writeAnalysisContextFile(docsRoot, path.join('prompts', 'cli-context.txt'), 'cli context\n');

  await fs.writeFile(imgbinExecutable, 'console.log("fake imgbin");\n', 'utf8');

  const defaultConfig = await resolveConfig({
    imgbinExecutable
  }, {
    docsRoot,
    env: {}
  });
  assert.equal(defaultConfig.analysisContextFilePath, path.join(docsRoot, 'prompts', 'screenshot-analysis-context.txt'));
  assert.equal(defaultConfig.analysisContextFileSource, 'default checked-in analysis context file');

  const envConfig = await resolveConfig({
    imgbinExecutable
  }, {
    docsRoot,
    env: {
      SCREENSHOT_ANALYSIS_CONTEXT_FILE: './prompts/env-context.txt'
    }
  });
  assert.equal(envConfig.analysisContextFilePath, envContextPath);
  assert.equal(envConfig.analysisContextFileSource, 'SCREENSHOT_ANALYSIS_CONTEXT_FILE');

  const cliConfig = await resolveConfig({
    imgbinExecutable,
    analysisContextFilePath: './prompts/cli-context.txt'
  }, {
    docsRoot,
    env: {
      SCREENSHOT_ANALYSIS_CONTEXT_FILE: './prompts/env-context.txt'
    }
  });
  assert.equal(cliConfig.analysisContextFilePath, cliContextPath);
  assert.equal(cliConfig.analysisContextFileSource, '--analysis-context-file');
});

test('resolveConfig fails fast when the resolved analysis context file is missing or empty', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const defaultContextPath = path.join(docsRoot, DEFAULT_ANALYSIS_CONTEXT_RELATIVE);

  await fs.writeFile(imgbinExecutable, 'console.log("fake imgbin");\n', 'utf8');
  await fs.rm(defaultContextPath);

  await assert.rejects(
    resolveConfig({ imgbinExecutable }, { docsRoot, env: {} }),
    /Analysis context file not found: \.\/prompts\/screenshot-analysis-context\.txt/
  );

  await writeAnalysisContextFile(docsRoot, DEFAULT_ANALYSIS_CONTEXT_RELATIVE, '   \n\t');

  await assert.rejects(
    resolveConfig({ imgbinExecutable }, { docsRoot, env: {} }),
    /Analysis context file is empty: \.\/prompts\/screenshot-analysis-context\.txt/
  );
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

test('runScreenshotMetadataManager passes analysis context to ImgBin, preserves provenance, and updates the manifest', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const defaultContextPath = path.join(docsRoot, DEFAULT_ANALYSIS_CONTEXT_RELATIVE);
  const analysisPromptPath = path.join(docsRoot, 'prompts', 'custom-analysis-prompt.txt');
  const commandLogPath = path.join(docsRoot, 'imgbin-command-log.jsonl');
  const successStagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'success-image.png');
  const retryStagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'retry-image.png');

  await fs.writeFile(analysisPromptPath, 'Describe visible workflow state.\n', 'utf8');

  await fs.writeFile(imgbinExecutable, `
import path from 'node:path';
import { promises as fs } from 'node:fs';

const args = process.argv.slice(2);
const command = args[0];
const failPattern = process.env.FAKE_IMGBIN_FAIL_PATTERN || '';
const commandLogPath = process.env.FAKE_IMGBIN_COMMAND_LOG;

if (command === 'annotate') {
  const assetPath = args[1];
  const importToIndex = args.indexOf('--import-to');
  const slugIndex = args.indexOf('--slug');
  const titleIndex = args.indexOf('--title');
  const contextIndex = args.indexOf('--analysis-context-file');
  const promptIndex = args.indexOf('--analysis-prompt');
  const overwrite = args.includes('--overwrite');
  const slug = slugIndex >= 0 ? args[slugIndex + 1] : path.basename(assetPath, path.extname(assetPath));
  const title = titleIndex >= 0 ? args[titleIndex + 1] : slug;
  const analysisContextFile = contextIndex >= 0 ? args[contextIndex + 1] : null;
  const analysisPrompt = promptIndex >= 0 ? args[promptIndex + 1] : null;
  if (!analysisContextFile) {
    console.error('missing analysis context file');
    process.exit(3);
  }
  if (commandLogPath) {
    await fs.appendFile(commandLogPath, JSON.stringify({
      command,
      assetPath,
      analysisContextFile,
      analysisPrompt,
      overwrite
    }) + '\\n', 'utf8');
  }
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
    extra: {
      analysisContext: {
        filePath: analysisContextFile,
        promptPath: analysisPrompt
      }
    },
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
    analysisPromptPath,
    reindex: true
  }, {
    docsRoot,
    env: {
      ...process.env,
      FAKE_IMGBIN_FAIL_PATTERN: 'retry-image',
      FAKE_IMGBIN_COMMAND_LOG: commandLogPath
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
    imgbinExecutable,
    analysisPromptPath
  }, {
    docsRoot,
    env: {
      ...process.env,
      FAKE_IMGBIN_COMMAND_LOG: commandLogPath
    },
    now: new Date('2026-03-13T04:00:00.000Z')
  });

  assert.equal(secondRun.exitCode, 0);
  assert.equal(secondRun.manifest.items.length, 2);
  await assert.rejects(fs.access(retryStagedPath));

  await writePng(successStagedPath);
  const thirdRun = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    imgbinExecutable,
    analysisPromptPath
  }, {
    docsRoot,
    env: {
      ...process.env,
      FAKE_IMGBIN_COMMAND_LOG: commandLogPath
    },
    now: new Date('2026-03-13T05:00:00.000Z')
  });

  assert.equal(thirdRun.exitCode, 0);
  assert.equal(thirdRun.results[0]?.action, 'refreshed-existing');
  await assert.rejects(fs.access(successStagedPath));

  const sharedDir = path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'shared');
  const sharedEntries = await fs.readdir(sharedDir, { withFileTypes: true });
  const managedDirs = sharedEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(managedDirs, ['retry-image', 'success-image']);

  const successMetadataRaw = await fs.readFile(path.join(sharedDir, 'success-image', 'metadata.json'), 'utf8');
  const successMetadata = JSON.parse(successMetadataRaw);
  assert.equal(successMetadata.extra?.analysisContext?.filePath, defaultContextPath);
  assert.equal(successMetadata.extra?.analysisContext?.promptPath, analysisPromptPath);
  assert.equal(successMetadata.extra?.docsScreenshot?.relativeSourcePath, 'shared/success-image.png');

  const commandLogRaw = await fs.readFile(commandLogPath, 'utf8');
  const annotateCalls = commandLogRaw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(annotateCalls.length, 4);
  assert.ok(annotateCalls.every((entry) => entry.analysisContextFile === defaultContextPath));
  assert.ok(annotateCalls.every((entry) => entry.analysisPrompt === analysisPromptPath));
  assert.ok(annotateCalls.some((entry) => entry.overwrite === true));

  const manifestHash = crypto.createHash('sha1').update(JSON.stringify(secondRun.manifest.items)).digest('hex');
  assert.match(manifestHash, /^[0-9a-f]{40}$/);
});

test('runScreenshotMetadataManager can import with docs-local .env defaults and auto-created tmp', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'auto-env.png');

  await fs.writeFile(
    path.join(docsRoot, '.env'),
    'IMGBIN_EXECUTABLE=./fake-imgbin.mjs\nIMGBIN_ANALYSIS_TIMEOUT_MS=180000\n',
    'utf8'
  );
  await fs.writeFile(imgbinExecutable, `
import path from 'node:path';
import { promises as fs } from 'node:fs';

const args = process.argv.slice(2);
const command = args[0];

if (command !== 'annotate') {
  if (command === 'search') {
    const libraryIndex = args.indexOf('--library');
    const libraryRoot = args[libraryIndex + 1];
    await fs.mkdir(path.join(libraryRoot, '.imgbin'), { recursive: true });
    await fs.writeFile(path.join(libraryRoot, '.imgbin', 'search-index.json'), JSON.stringify({ ok: true }, null, 2));
  }
  process.exit(0);
}

const assetPath = args[1];
const importToIndex = args.indexOf('--import-to');
const slugIndex = args.indexOf('--slug');
const titleIndex = args.indexOf('--title');
const slug = slugIndex >= 0 ? args[slugIndex + 1] : path.basename(assetPath, path.extname(assetPath));
const title = titleIndex >= 0 ? args[titleIndex + 1] : slug;
const assetDir = path.join(args[importToIndex + 1], '2026-03', slug);
const originalFilename = 'original.png';

await fs.mkdir(assetDir, { recursive: true });
await fs.copyFile(assetPath, path.join(assetDir, originalFilename));
await fs.writeFile(path.join(assetDir, 'metadata.json'), JSON.stringify({
  slug,
  title,
  description: 'Annotated ' + slug,
  tags: ['docs', slug],
  paths: { assetDir, original: originalFilename },
  status: { recognition: 'succeeded' },
  timestamps: { createdAt: '2026-03-13T00:00:00.000Z', updatedAt: '2026-03-13T00:00:00.000Z' }
}, null, 2));
process.exit(0);
`, 'utf8');

  await writePng(stagedPath);

  const run = await runScreenshotMetadataManager({}, {
    docsRoot,
    env: {},
    now: new Date('2026-03-13T06:00:00.000Z')
  });

  assert.equal(run.exitCode, 0);
  assert.equal(run.manifest.items.length, 1);
  assert.equal(run.config.env.TMPDIR, path.join(docsRoot, '.tmp'));
  assert.equal(run.config.analysisContextFilePath, path.join(docsRoot, 'prompts', 'screenshot-analysis-context.txt'));
  await fs.access(path.join(docsRoot, '.tmp'));
  await assert.rejects(fs.access(stagedPath));
  await fs.access(path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', 'shared', 'auto-env', 'metadata.json'));
  await fs.access(path.join(docsRoot, 'src', 'content', 'docs', 'img', 'screenshots', '.imgbin', 'search-index.json'));
});

test('runScreenshotMetadataManager emits detailed sync logs for import and index rebuild stages', async () => {
  const docsRoot = await createTempDocsRoot();
  const imgbinExecutable = path.join(docsRoot, 'fake-imgbin.mjs');
  const stagedPath = path.join(docsRoot, 'screenshot-staging', 'shared', 'verbose-sync.png');
  const stderr = createCaptureWriter();

  await fs.writeFile(imgbinExecutable, `
import path from 'node:path';
import { promises as fs } from 'node:fs';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'annotate') {
  const assetPath = args[1];
  const importToIndex = args.indexOf('--import-to');
  const slugIndex = args.indexOf('--slug');
  const titleIndex = args.indexOf('--title');
  const slug = slugIndex >= 0 ? args[slugIndex + 1] : path.basename(assetPath, path.extname(assetPath));
  const title = titleIndex >= 0 ? args[titleIndex + 1] : slug;
  const assetDir = path.join(args[importToIndex + 1], '2026-03', slug);
  await fs.mkdir(assetDir, { recursive: true });
  await fs.copyFile(assetPath, path.join(assetDir, 'original.png'));
  await fs.writeFile(path.join(assetDir, 'metadata.json'), JSON.stringify({
    slug,
    title,
    description: 'Annotated ' + slug,
    tags: ['docs', slug],
    paths: { assetDir, original: 'original.png' },
    status: { recognition: 'succeeded' },
    timestamps: { createdAt: '2026-03-13T00:00:00.000Z', updatedAt: '2026-03-13T00:00:00.000Z' }
  }, null, 2));
  console.log('annotated ' + slug);
  process.exit(0);
}

if (command === 'search') {
  const libraryIndex = args.indexOf('--library');
  const libraryRoot = args[libraryIndex + 1];
  await fs.mkdir(path.join(libraryRoot, '.imgbin'), { recursive: true });
  await fs.writeFile(path.join(libraryRoot, '.imgbin', 'search-index.json'), JSON.stringify({ ok: true }, null, 2));
  console.log('reindexed library');
  process.exit(0);
}

process.exit(1);
`, 'utf8');

  await writePng(stagedPath);

  const run = await runScreenshotMetadataManager({
    input: 'screenshot-staging',
    imgbinExecutable
  }, {
    docsRoot,
    env: process.env,
    stderr
  });

  assert.equal(run.exitCode, 0);
  const logs = stderr.toString();
  assert.match(logs, /\[screenshots:sync\] starting sync/);
  assert.match(logs, /\[screenshots:sync\] input: \.\/screenshot-staging/);
  assert.match(logs, /\[screenshots:sync\] analysis context: \.\/prompts\/screenshot-analysis-context\.txt \(default checked-in analysis context file\)/);
  assert.match(logs, /\[screenshots:sync\] discovered 1 supported screenshot/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] processing shared\/verbose-sync\.png/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] importing into temporary workspace \.\/\.tmp\//);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] invoking imgbin annotate import/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] imgbin: annotated verbose-sync/);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] imgbin annotate import completed in /);
  assert.match(logs, /\[screenshots:sync\] \[1\/1\] imported -> .* \(file .* cumulative .*\)/);
  assert.match(logs, /\[screenshots:sync\] rebuilding ImgBin search index for the managed library/);
  assert.match(logs, /\[screenshots:sync\] \[index\] imgbin: reindexed library/);
  assert.match(logs, /\[screenshots:sync\] \[index\] imgbin search reindex completed in /);
  assert.match(logs, /\[screenshots:sync\] completed: 1 succeeded, 0 failed in /);
});
