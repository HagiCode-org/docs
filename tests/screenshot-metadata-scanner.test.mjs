import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';

import sharp from 'sharp';

import { main, runScreenshotMetadataScanner } from '../scripts/screenshot-metadata-scanner.mjs';

const createdDirs = [];

async function createTempDocsRoot() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-screenshot-scanner-test-'));
  createdDirs.push(tempRoot);
  await fs.mkdir(path.join(tempRoot, 'screenshot-staging'), { recursive: true });
  await fs.writeFile(path.join(tempRoot, 'screenshot-staging', '.gitkeep'), '', 'utf8');
  return tempRoot;
}

async function writeImage(filePath, { width, height, extension = '.png' }) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 16, g: 96, b: 184, alpha: 1 }
    }
  });

  if (extension === '.jpg' || extension === '.jpeg') {
    pipeline = pipeline.jpeg();
  } else if (extension === '.webp') {
    pipeline = pipeline.webp();
  } else {
    pipeline = pipeline.png();
  }

  await pipeline.toFile(filePath);
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

test('runScreenshotMetadataScanner uses screenshot-staging by default and returns required metadata fields', async () => {
  const docsRoot = await createTempDocsRoot();
  const stderr = createCaptureWriter();

  await writeImage(path.join(docsRoot, 'screenshot-staging', 'zeta', 'final-step.png'), {
    width: 1440,
    height: 900
  });
  await writeImage(path.join(docsRoot, 'screenshot-staging', 'alpha', 'welcome.webp'), {
    width: 1728,
    height: 1117,
    extension: '.webp'
  });
  await fs.writeFile(path.join(docsRoot, 'screenshot-staging', 'alpha', 'notes.txt'), 'skip me', 'utf8');

  const run = await runScreenshotMetadataScanner({}, {
    docsRoot,
    now: new Date('2026-03-14T09:30:00.000Z'),
    stderr
  });

  assert.equal(run.exitCode, 0);
  assert.equal(run.report.summary.inputDirectory, 'screenshot-staging');
  assert.equal(run.report.summary.scannedFileCount, 2);
  assert.deepEqual(
    run.report.entries.map((entry) => entry.relativePath),
    ['alpha/welcome.webp', 'zeta/final-step.png']
  );

  const [firstEntry] = run.report.entries;
  assert.equal(firstEntry.fileName, 'welcome.webp');
  assert.equal(firstEntry.extension, '.webp');
  assert.equal(firstEntry.mimeType, 'image/webp');
  assert.equal(firstEntry.width, 1728);
  assert.equal(firstEntry.height, 1117);
  assert.equal(typeof firstEntry.sizeBytes, 'number');
  assert.equal(typeof firstEntry.modifiedAt, 'string');
  assert.ok(firstEntry.createdAt === null || typeof firstEntry.createdAt === 'string');

  const logs = stderr.toString();
  assert.match(logs, /\[screenshots:scan-metadata\] starting scan/);
  assert.match(logs, /\[screenshots:scan-metadata\] input: \.\/screenshot-staging/);
  assert.match(logs, /\[screenshots:scan-metadata\] discovered 2 supported screenshot files/);
  assert.match(logs, /\[screenshots:scan-metadata\] completed: 2 succeeded, 0 failed/);
});

test('runScreenshotMetadataScanner preserves deterministic ordering for repeated scans of an explicit input directory', async () => {
  const docsRoot = await createTempDocsRoot();

  await fs.mkdir(path.join(docsRoot, 'incoming'), { recursive: true });
  await writeImage(path.join(docsRoot, 'incoming', 'beta', 'step-b.png'), {
    width: 1200,
    height: 800
  });
  await writeImage(path.join(docsRoot, 'incoming', 'alpha', 'step-a.jpeg'), {
    width: 1600,
    height: 1000,
    extension: '.jpeg'
  });
  await writeImage(path.join(docsRoot, 'incoming', 'alpha', 'step-c.png'), {
    width: 800,
    height: 600
  });

  const firstRun = await runScreenshotMetadataScanner({
    input: './incoming'
  }, {
    docsRoot,
    now: new Date('2026-03-14T09:30:00.000Z'),
    stderr: createCaptureWriter()
  });

  const secondRun = await runScreenshotMetadataScanner({
    input: './incoming'
  }, {
    docsRoot,
    now: new Date('2026-03-14T09:30:00.000Z'),
    stderr: createCaptureWriter()
  });

  const firstPaths = firstRun.report.entries.map((entry) => entry.relativePath);
  const secondPaths = secondRun.report.entries.map((entry) => entry.relativePath);

  assert.deepEqual(firstPaths, ['alpha/step-a.jpeg', 'alpha/step-c.png', 'beta/step-b.png']);
  assert.deepEqual(secondPaths, firstPaths);
});

test('main keeps successful entries, writes the same report to stdout and file, logs progress, and returns a non-zero exit code on failures', async () => {
  const docsRoot = await createTempDocsRoot();
  const stdout = createCaptureWriter();
  const stderr = createCaptureWriter();
  const outputPath = path.join(docsRoot, 'artifacts', 'screenshot-report.json');

  await fs.mkdir(path.join(docsRoot, 'incoming'), { recursive: true });
  await writeImage(path.join(docsRoot, 'incoming', 'ok-image.png'), {
    width: 1440,
    height: 900
  });
  await fs.writeFile(path.join(docsRoot, 'incoming', 'broken-image.png'), 'not-an-image', 'utf8');

  const exitCode = await main([
    '--input',
    './incoming',
    '--output',
    './artifacts/screenshot-report.json'
  ], {
    docsRoot,
    now: new Date('2026-03-14T09:30:00.000Z'),
    stdout,
    stderr
  });

  assert.equal(exitCode, 1);

  const stdoutReport = JSON.parse(stdout.toString());
  const fileReport = JSON.parse(await fs.readFile(outputPath, 'utf8'));

  assert.deepEqual(fileReport, stdoutReport);
  assert.equal(stdoutReport.summary.outputPath, 'artifacts/screenshot-report.json');
  assert.equal(stdoutReport.summary.scannedFileCount, 2);
  assert.equal(stdoutReport.summary.successCount, 1);
  assert.equal(stdoutReport.summary.failureCount, 1);
  assert.equal(stdoutReport.entries.length, 1);
  assert.equal(stdoutReport.failures.length, 1);
  assert.equal(stdoutReport.failures[0].relativePath, 'broken-image.png');
  assert.match(stdoutReport.failures[0].reason, /broken-image\.png|unsupported image|Input file/i);

  const logs = stderr.toString();
  assert.match(logs, /\[screenshots:scan-metadata\] starting scan/);
  assert.match(logs, /\[screenshots:scan-metadata\] input: \.\/incoming/);
  assert.match(logs, /\[screenshots:scan-metadata\] discovered 2 supported screenshot files/);
  assert.match(logs, /\[screenshots:scan-metadata\] \[1\/2\] scanning broken-image\.png/);
  assert.match(logs, /\[screenshots:scan-metadata\] \[2\/2\] scanning ok-image\.png/);
  assert.match(logs, /\[screenshots:scan-metadata\] \[1\/2\] failed /);
  assert.match(logs, /\[screenshots:scan-metadata\] \[2\/2\] ok 1440x900 /);
  assert.match(logs, /\[screenshots:scan-metadata\] wrote report to \.\/artifacts\/screenshot-report\.json/);
  assert.match(logs, /\[screenshots:scan-metadata\] completed: 1 succeeded, 1 failed/);
});
