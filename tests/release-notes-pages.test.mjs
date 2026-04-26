import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import fs from 'node:fs';
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
        anchorId: tag.toLowerCase().startsWith('v') ? tag.toLowerCase() : `v${tag.toLowerCase()}`,
        summary: {
          'zh-CN': '统一了 Code Server 的主要入口。',
          en: 'Unified the main Code Server entry flow.',
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

test('materialization writes index plus per-tag detail files and strips legacy outputs', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-pages-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');

  await fs.promises.mkdir(config.outputPaths.zhDir, { recursive: true });
  await fs.promises.mkdir(config.outputPaths.enDir, { recursive: true });
  await fs.promises.mkdir(path.dirname(config.outputPaths.legacyIndexJson), { recursive: true });
  await fs.promises.writeFile(path.join(config.outputPaths.zhDir, 'legacy.md'), 'stale', 'utf8');
  await fs.promises.writeFile(path.join(config.outputPaths.enDir, 'legacy.md'), 'stale', 'utf8');
  await fs.promises.writeFile(config.outputPaths.legacyIndexJson, 'stale', 'utf8');

  await materializeReleaseNotes({ snapshot, config });

  const indexPayload = JSON.parse(await readFile(config.outputPaths.indexJson, 'utf8'));
  const detailPayload = JSON.parse(await readFile(path.join(config.outputPaths.dataDir, 'v1.0.0.json'), 'utf8'));
  const zhLanding = await readFile(path.join(config.outputPaths.zhDir, 'index.mdx'), 'utf8');
  const enLanding = await readFile(path.join(config.outputPaths.enDir, 'index.mdx'), 'utf8');

  assert.equal(indexPayload.entries[0].anchorId, 'v1.0.0');
  assert.equal(indexPayload.entries[0].detailPath, 'v1.0.0.json');
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'landingBodyHtml'), false);
  assert.match(detailPayload.bodyHtml['zh-CN'], /<ul>/);
  assert.match(detailPayload.bodyHtml.en, /Unified the main Code Server entry flow\./);
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'routes'), false);
  assert.match(zhLanding, /<ReleaseNotesLanding locale="zh-CN" \/>/);
  assert.match(enLanding, /<ReleaseNotesLanding locale="en" \/>/);
  assert.equal(path.basename(config.outputPaths.indexJson), 'index.json');
  assert.equal(fs.existsSync(path.join(config.outputPaths.zhDir, 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.enDir, 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.zhDir, 'legacy.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.enDir, 'legacy.md')), false);
  assert.equal(fs.existsSync(config.outputPaths.legacyIndexJson), false);
});

test('landing helpers expose localized summaries and expanded body HTML only for the active locale', () => {
  const snapshot = createSnapshot('v1.0.0');
  const detailEntries = new Map([
    ['v1.0.0', {
      bodyHtml: {
        'zh-CN': '<ul>\n<li>统一了 Code Server 的主要入口。</li>\n</ul>',
        en: '<ul>\n<li>Unified the main Code Server entry flow.</li>\n</ul>',
      },
    }],
  ]);
  const zhEntries = getReleaseNotesLandingEntries({
    ...snapshot,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      detailPath: 'v1.0.0.json',
    })),
  }, 'zh-CN', detailEntries);
  const enEntries = getReleaseNotesLandingEntries({
    ...snapshot,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      detailPath: 'v1.0.0.json',
    })),
  }, 'en', detailEntries);
  const zhCopy = getReleaseNotesLandingCopy('zh-CN');
  const enCopy = getReleaseNotesLandingCopy('en');

  assert.equal(zhEntries[0].summary, '统一了 Code Server 的主要入口。');
  assert.equal(zhEntries[0].anchorId, 'v1.0.0');
  assert.equal(zhEntries[0].anchorHref, '/release-notes/#v1.0.0');
  assert.match(zhEntries[0].bodyHtml, /Unified the main Code Server entry flow|统一了 Code Server 的主要入口/);
  assert.equal(zhEntries[0].repositoryCount, 1);
  assert.equal(zhEntries[0].totalCommitCount, 3);
  assert.equal(Object.hasOwn(zhCopy, 'archiveLinkLabel'), false);
  assert.equal(Object.hasOwn(zhEntries[0], 'archiveRoute'), false);

  assert.equal(enEntries[0].summary, 'Unified the main Code Server entry flow.');
  assert.equal(enEntries[0].anchorId, 'v1.0.0');
  assert.equal(enEntries[0].anchorHref, '/en/release-notes/#v1.0.0');
  assert.match(enEntries[0].bodyHtml, /<ul>/);
  assert.equal(Object.hasOwn(enCopy, 'archiveLinkLabel'), false);
  assert.equal(Object.hasOwn(enEntries[0], 'archiveRoute'), false);
});

test('landing helpers preserve informative empty states when no synchronized entries exist', () => {
  const zhEntries = getReleaseNotesLandingEntries({ entries: [] }, 'zh-CN');
  const enEntries = getReleaseNotesLandingEntries({ entries: [] }, 'en');

  assert.deepEqual(zhEntries, []);
  assert.deepEqual(enEntries, []);
  assert.match(getReleaseNotesLandingCopy('zh-CN').empty, /当前语言下还没有可浏览的同步版本/);
  assert.match(getReleaseNotesLandingCopy('en').empty, /No synchronized release notes are available yet/);
});
