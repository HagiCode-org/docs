import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';

import {
  collectBuildOutputStats,
  formatByteSize,
  reportBuildOutputStats,
} from '../scripts/report-build-output-stats.mjs';

const createdDirs = [];

async function createTempDocsRoot() {
  const docsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-build-output-stats-'));
  createdDirs.push(docsRoot);
  await fs.mkdir(path.join(docsRoot, 'dist'), { recursive: true });
  return docsRoot;
}

async function writeBuildFile(docsRoot, relativePath, content) {
  const filePath = path.join(docsRoot, 'dist', relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return filePath;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('collectBuildOutputStats sums file count and byte size recursively', async () => {
  const docsRoot = await createTempDocsRoot();
  const first = Buffer.from('hello', 'utf8');
  const second = Buffer.from('world!', 'utf8');
  const third = Buffer.alloc(2048, 7);

  await writeBuildFile(docsRoot, 'index.html', first);
  await writeBuildFile(docsRoot, 'assets/app.js', second);
  await writeBuildFile(docsRoot, 'assets/chunk/data.bin', third);

  const stats = await collectBuildOutputStats({ docsRoot });

  assert.equal(stats.fileCount, 3);
  assert.equal(stats.totalBytes, first.length + second.length + third.length);
  assert.equal(path.basename(stats.distDir), 'dist');
});

test('reportBuildOutputStats prints a readable summary for the dist directory', async () => {
  const docsRoot = await createTempDocsRoot();
  const chunk = Buffer.alloc(2 * 1024 * 1024, 1);

  await writeBuildFile(docsRoot, 'assets/app.js', chunk);
  await writeBuildFile(docsRoot, 'index.html', Buffer.from('<html></html>', 'utf8'));

  let output = '';
  const result = await reportBuildOutputStats({
    docsRoot,
    stdout(chunkText) {
      output += chunkText;
    },
  });

  assert.match(output, /^\[build output\] dist: 2 files, 2\.0 MB total\n$/);
  assert.equal(result.message, '[build output] dist: 2 files, 2.0 MB total');
  assert.equal(result.fileCount, 2);
});

test('formatByteSize keeps bytes readable across small and large values', () => {
  assert.equal(formatByteSize(999), '999 B');
  assert.equal(formatByteSize(1536), '1.5 KB');
  assert.equal(formatByteSize(12 * 1024 * 1024), '12 MB');
});
