import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { materializeReleaseNotes, resolveReleaseNotesConfig } from '../scripts/release-notes-sync-lib.mjs';
import { verifyReleaseNotesBuildOutput } from '../scripts/verify-release-notes-build-output.mjs';

function createSnapshot(tag = 'v1.0.0') {
  return {
    generatedAt: '2026-04-14T10:00:00.000Z',
    source: {
      repository: 'HagiCode-org/release-notes',
      githubApiBaseUrl: 'https://api.github.com',
      locales: ['zh-CN', 'en'],
    },
    entries: [
      {
        tag,
        displayTag: tag,
        sortVersion: '1.0.0',
        releaseDate: '2026-04-13',
        publishedAt: '2026-04-13T08:00:00.000Z',
        synchronizedAt: '2026-04-14T10:00:00.000Z',
        upstreamGeneratedAt: '2026-04-13T07:55:00.000Z',
        anchorId: tag.toLowerCase().startsWith('v') ? tag.toLowerCase() : `v${tag.toLowerCase()}`,
        summary: {
          'zh-CN': '统一了 Code Server 的主要入口。',
          en: 'Unified the main Code Server entry flow.',
        },
        repositoryRanges: [],
        totalCommitCount: 0,
        source: {
          bodies: {
            'zh-CN': `published/${tag}.zh-CN.md`,
            en: `published/${tag}.en.md`,
          },
        },
        bodies: {
          'zh-CN': '# HagiCode\n\n- 统一了 Code Server 的主要入口。\n',
          en: '# HagiCode\n\n- Unified the main Code Server entry flow.\n',
        },
      },
    ],
    skipped: [],
    counts: {
      releases: 1,
      discovered: 1,
      synchronized: 1,
      skipped: 0,
    },
  };
}

async function createRepoWithArtifacts() {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-output-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');
  await materializeReleaseNotes({ snapshot, config });

  const distDir = path.join(repoRoot, 'dist');
  const zhArtifact = path.join(distDir, 'release-notes', 'index.html');
  const enArtifact = path.join(distDir, 'en', 'release-notes', 'index.html');
  await fs.promises.mkdir(path.dirname(zhArtifact), { recursive: true });
  await fs.promises.mkdir(path.dirname(enArtifact), { recursive: true });
  await writeFile(zhArtifact, '<article><h2 id="v1.0.0">v1.0.0</h2><p>统一了 Code Server 的主要入口。</p></article>', 'utf8');
  await writeFile(enArtifact, '<article><h2 id="v1.0.0">v1.0.0</h2><p>Unified the main Code Server entry flow.</p></article>', 'utf8');

  return { repoRoot, zhArtifact, enArtifact };
}

test('release-notes output verification accepts zh-CN and en artifacts that keep latest content', async () => {
  const { repoRoot } = await createRepoWithArtifacts();

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.latestEntry.tag, 'v1.0.0');
});

test('release-notes output verification fails when zh-CN artifact loses synchronized content', async () => {
  const { repoRoot, zhArtifact } = await createRepoWithArtifacts();

  await writeFile(zhArtifact, '<p>当前语言下还没有可浏览的同步版本。</p>', 'utf8');

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /zh-CN artifact .*missing anchor v1\.0\.0/);
  assert.match(result.issues.join('\n'), /zh-CN artifact .*rendered the empty state/);
});

test('release-notes output verification fails when en artifact loses synchronized content', async () => {
  const { repoRoot, enArtifact } = await createRepoWithArtifacts();
  const original = await readFile(enArtifact, 'utf8');

  await writeFile(enArtifact, original.replace('Unified the main Code Server entry flow.', 'Unrelated copy.'), 'utf8');

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /en artifact .*missing localized summary\/body/);
});

test('release-notes output verification allows empty states only when index has no entries', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-empty-output-'));
  const config = resolveReleaseNotesConfig({ repoRoot });

  await fs.promises.mkdir(config.outputPaths.dataDir, { recursive: true });
  await writeFile(config.outputPaths.indexJson, JSON.stringify({ entries: [] }, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 0);
});
