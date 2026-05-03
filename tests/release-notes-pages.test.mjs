import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { materializeReleaseNotes, resolveReleaseNotesConfig } from '../scripts/release-notes-sync-lib.mjs';
import { verifyReleaseNotesBuildInput } from '../scripts/verify-release-notes-build-input.mjs';
import {
  getReleaseNotesLandingCopy,
  getReleaseNotesLandingEntries,
  getReleaseNotesTocItems,
} from '../src/lib/release-notes.mjs';

const ALL_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

function createSnapshot(tag = 'v1.0.0') {
  return {
    generatedAt: '2026-04-14T10:00:00.000Z',
    source: {
      repository: 'HagiCode-org/release-notes',
      githubApiBaseUrl: 'https://api.github.com',
      locales: ALL_LOCALES,
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
        summary: Object.fromEntries(ALL_LOCALES.map((locale) => [locale, `${locale} summary for ${tag}.`])),
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
          bodies: Object.fromEntries(ALL_LOCALES.map((locale) => [locale, `published/${tag}.${locale}.md`])),
        },
        bodies: Object.fromEntries(ALL_LOCALES.map((locale) => [locale, `# HagiCode\n\n- ${locale} release note content for ${tag}.\n`])),
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

  for (const localeDir of Object.values(config.outputPaths.localeDirs)) {
    await fs.promises.mkdir(localeDir, { recursive: true });
    await fs.promises.writeFile(path.join(localeDir, 'legacy.md'), 'stale', 'utf8');
  }
  await fs.promises.mkdir(path.dirname(config.outputPaths.legacyIndexJson), { recursive: true });
  await fs.promises.writeFile(config.outputPaths.legacyIndexJson, 'stale', 'utf8');

  await materializeReleaseNotes({ snapshot, config });

  const indexPayload = JSON.parse(await readFile(config.outputPaths.indexJson, 'utf8'));
  const detailPayload = JSON.parse(await readFile(path.join(config.outputPaths.dataDir, 'v1.0.0.json'), 'utf8'));
  const zhLanding = await readFile(path.join(config.outputPaths.localeDirs['zh-CN'], 'index.mdx'), 'utf8');
  const enLanding = await readFile(path.join(config.outputPaths.localeDirs.en, 'index.mdx'), 'utf8');

  assert.equal(indexPayload.entries[0].anchorId, 'v1.0.0');
  assert.equal(indexPayload.entries[0].detailPath, 'v1.0.0.json');
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'landingBodyHtml'), false);
  assert.match(detailPayload.bodyHtml['zh-CN'], /<ul>/);
  assert.match(detailPayload.bodyHtml.en, /en release note content for v1\.0\.0\./);
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'routes'), false);
  assert.match(zhLanding, /<ReleaseNotesLanding locale="zh-CN" \/>/);
  assert.match(enLanding, /<ReleaseNotesLanding locale="en-US" \/>/);
  assert.equal(path.basename(config.outputPaths.indexJson), 'index.json');
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'legacy.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'legacy.md')), false);
  assert.equal(fs.existsSync(config.outputPaths.legacyIndexJson), false);
});

test('landing helpers expose localized summaries and expanded body HTML only for the active locale', () => {
  const snapshot = createSnapshot('v1.0.0');
  const detailEntries = new Map([
    ['v1.0.0', {
      bodyHtml: {
        'zh-CN': '<ul>\n<li>zh-CN summary for v1.0.0.</li>\n</ul>',
        en: '<ul>\n<li>en summary for v1.0.0.</li>\n</ul>',
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

  assert.equal(zhEntries[0].summary, 'zh-CN summary for v1.0.0.');
  assert.equal(zhEntries[0].anchorId, 'v1.0.0');
  assert.equal(zhEntries[0].anchorHref, '/release-notes/#v1.0.0');
  assert.match(zhEntries[0].bodyHtml, /zh-CN summary for v1\.0\.0/);
  assert.equal(zhEntries[0].repositoryCount, 1);
  assert.equal(zhEntries[0].totalCommitCount, 3);
  assert.equal(Object.hasOwn(zhCopy, 'archiveLinkLabel'), false);
  assert.equal(Object.hasOwn(zhEntries[0], 'archiveRoute'), false);

  assert.equal(enEntries[0].summary, 'en summary for v1.0.0.');
  assert.equal(enEntries[0].anchorId, 'v1.0.0');
  assert.equal(enEntries[0].anchorHref, '/en-US/release-notes/#v1.0.0');
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

test('release-notes input verification fails when index references a missing detail file', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-missing-detail-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');

  await fs.promises.mkdir(config.outputPaths.dataDir, { recursive: true });
  await fs.promises.writeFile(config.outputPaths.indexJson, JSON.stringify({
    ...snapshot,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      detailPath: 'missing-detail.json',
    })),
  }, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /missing detail file/);
});

test('release-notes input verification fails when localized body HTML is missing', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-missing-body-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');

  await materializeReleaseNotes({ snapshot, config });

  const detailPath = path.join(config.outputPaths.dataDir, 'v1.0.0.json');
  const detailPayload = JSON.parse(await readFile(detailPath, 'utf8'));
  delete detailPayload.bodyHtml.en;
  await fs.promises.writeFile(detailPath, JSON.stringify(detailPayload, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /missing en bodyHtml/);
});

test('release-notes toc items expose version anchors for all locales', () => {
  const snapshot = createSnapshot('v1.0.0');
  const zhToc = getReleaseNotesTocItems(snapshot, 'zh-CN');
  const enToc = getReleaseNotesTocItems(snapshot, 'en');
  const jaToc = getReleaseNotesTocItems(snapshot, 'ja-JP');

  assert.deepEqual(zhToc, [
    {
      text: 'v1.0.0',
      slug: 'v1.0.0',
      href: '/release-notes/#v1.0.0',
    },
  ]);

  assert.deepEqual(enToc, [
    {
      text: 'v1.0.0',
      slug: 'v1.0.0',
      href: '/en-US/release-notes/#v1.0.0',
    },
  ]);

  assert.deepEqual(jaToc, [
    {
      text: 'v1.0.0',
      slug: 'v1.0.0',
      href: '/ja-JP/release-notes/#v1.0.0',
    },
  ]);
});
