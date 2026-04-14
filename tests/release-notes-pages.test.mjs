import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { materializeReleaseNotes, resolveReleaseNotesConfig } from '../scripts/release-notes-sync-lib.mjs';
import {
  getReleaseNotesLandingCopy,
  getReleaseNotesLandingEntries,
} from '../src/lib/release-notes.mjs';

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
        summary: {
          'zh-CN': '统一了 Code Server 的主要入口。',
          en: 'Unified the main Code Server entry flow.',
        },
        routes: {
          'zh-CN': `/release-notes/${tag}/`,
          en: `/en/release-notes/${tag}/`,
        },
        repositoryRanges: [
          {
            repository: 'web',
            path: 'repos/web',
            label: 'v0.9.0..v1.0.0',
            fromTag: 'v0.9.0',
            toTag: tag,
            range: 'v0.9.0..v1.0.0',
            commitCount: 3,
          },
        ],
        totalCommitCount: 3,
        source: {
          releaseName: tag,
          releaseUrl: `https://example.test/releases/${tag}`,
          assetName: `release-notes-${tag}-history.zip`,
          assetUrl: `https://example.test/assets/${tag}.zip`,
          jsonPath: `artifacts/tags/${tag}/${tag}.json`,
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

test('materialization writes bilingual detail pages and locale-specific landing routes', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-pages-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');

  await materializeReleaseNotes({ snapshot, config });

  const zhDetail = await readFile(path.join(config.outputPaths.zhDir, 'v1.0.0.md'), 'utf8');
  const enDetail = await readFile(path.join(config.outputPaths.enDir, 'v1.0.0.md'), 'utf8');
  const zhLanding = await readFile(path.join(config.outputPaths.zhDir, 'index.mdx'), 'utf8');
  const enLanding = await readFile(path.join(config.outputPaths.enDir, 'index.mdx'), 'utf8');

  assert.match(zhDetail, /> 发布日期: 2026-04-13/);
  assert.match(zhDetail, /\[Read English\]\(\/en\/release-notes\/v1\.0\.0\/\)/);
  assert.match(enDetail, /> Release date: 2026-04-13/);
  assert.match(enDetail, /\[查看中文\]\(\/release-notes\/v1\.0\.0\/\)/);
  assert.match(zhLanding, /<ReleaseNotesLanding locale="zh-CN" \/>/);
  assert.match(enLanding, /<ReleaseNotesLanding locale="en" \/>/);
});

test('landing helpers expose localized summaries and metadata counts', () => {
  const snapshot = createSnapshot('v1.0.0');
  const zhEntries = getReleaseNotesLandingEntries(snapshot, 'zh-CN');
  const enEntries = getReleaseNotesLandingEntries(snapshot, 'en');
  const zhCopy = getReleaseNotesLandingCopy('zh-CN');
  const enCopy = getReleaseNotesLandingCopy('en');

  assert.equal(zhEntries[0].primaryRoute, '/release-notes/v1.0.0/');
  assert.equal(zhEntries[0].secondaryRoute, '/en/release-notes/v1.0.0/');
  assert.equal(zhEntries[0].summary, '统一了 Code Server 的主要入口。');
  assert.equal(zhEntries[0].repositoryCount, 1);
  assert.equal(zhEntries[0].totalCommitCount, 3);
  assert.equal(zhCopy.readPrimary, '查看中文');

  assert.equal(enEntries[0].primaryRoute, '/en/release-notes/v1.0.0/');
  assert.equal(enEntries[0].secondaryRoute, '/release-notes/v1.0.0/');
  assert.equal(enEntries[0].summary, 'Unified the main Code Server entry flow.');
  assert.equal(enCopy.readPrimary, 'Read English');
});
