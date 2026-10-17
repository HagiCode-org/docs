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

const ROUTE_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

function createBody(tag) {
  return [
    `# HagiCode ${tag}`,
    '',
    '## Features',
    '',
    '### HagiCode-org/hagicode-core',
    '',
    `- **scope:** ${tag} feature content ([\`abcdef\`](https://example.test/commit/abcdef))`,
    '',
    '## Fixes',
    '',
    '### HagiCode-org/web',
    '',
    `- **ui:** ${tag} fix content ([\`123456\`](https://example.test/commit/123456))`,
    '',
  ].join('\n');
}

function createSnapshot(tag = 'v1.0.0') {
  return {
    generatedAt: '2026-04-14T10:00:00.000Z',
    source: {
      repository: 'local-repository',
      githubApiBaseUrl: null,
      mode: 'local',
    },
    entries: [
      {
        tag,
        displayTag: tag,
        sortVersion: '1.0.0',
        releaseDate: '2026-04-13',
        publishedAt: '2026-04-13T08:00:00.000Z',
        synchronizedAt: '2026-04-14T10:00:00.000Z',
        upstreamGeneratedAt: null,
        anchorId: tag.toLowerCase().startsWith('v') ? tag.toLowerCase() : `v${tag.toLowerCase()}`,
        summary: `2 features and 1 fix across HagiCode-org/hagicode-core, HagiCode-org/web for ${tag}.`,
        repositoryRanges: [
          {
            repository: 'hagicode-core',
            path: './repos/hagicode-core',
            label: 'HagiCode-org/hagicode-core',
            fromTag: 'v0.9.0',
            toTag: tag,
            range: `v0.9.0..${tag}`,
            commitCount: 3,
            renderedCount: 3,
            truncated: false,
          },
        ],
        totalCommitCount: 3,
        source: {
          releaseName: tag,
          releaseUrl: `https://example.test/releases/${tag}`,
          assetName: `release-notes-${tag}-history.zip`,
          assetUrl: `https://example.test/assets/${tag}.zip`,
          capturePath: `artifacts/commits/${tag}.json`,
          bodyPath: `published/${tag}.md`,
        },
        body: `${createBody(tag)}\n`,
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

test('materialization writes index plus per-tag detail files with one body and strips legacy outputs', async () => {
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
  assert.equal(typeof indexPayload.entries[0].summary, 'string');
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'landingBodyHtml'), false);
  assert.equal(Object.hasOwn(indexPayload.entries[0], 'routes'), false);
  assert.equal(typeof detailPayload.bodyHtml, 'string');
  assert.match(detailPayload.bodyHtml, /v1\.0\.0 feature content/);
  assert.match(detailPayload.bodyHtml, /v1\.0\.0 fix content/);
  assert.match(zhLanding, /<ReleaseNotesLanding locale="zh-CN" \/>/);
  assert.match(enLanding, /<ReleaseNotesLanding locale="en-US" \/>/);
  assert.equal(path.basename(config.outputPaths.indexJson), 'index.json');
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'v1.0.0.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'legacy.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'legacy.md')), false);
  assert.equal(fs.existsSync(config.outputPaths.legacyIndexJson), false);
});

test('landing helpers expose the same summary and body HTML on every route with localized chrome', () => {
  const snapshot = createSnapshot('v1.0.0');
  const detailEntries = new Map([
    ['v1.0.0', {
      bodyHtml: '<h2 id="features">Features</h2>\n<ul>\n<li>v1.0.0 feature content.</li>\n</ul>',
    }],
  ]);
  const indexPayload = {
    ...snapshot,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      detailPath: 'v1.0.0.json',
    })),
  };
  const zhEntries = getReleaseNotesLandingEntries(indexPayload, 'zh-CN', detailEntries);
  const enEntries = getReleaseNotesLandingEntries(indexPayload, 'en', detailEntries);
  const zhCopy = getReleaseNotesLandingCopy('zh-CN');
  const enCopy = getReleaseNotesLandingCopy('en');

  assert.equal(zhEntries[0].summary, enEntries[0].summary);
  assert.equal(zhEntries[0].summary, '2 features and 1 fix across HagiCode-org/hagicode-core, HagiCode-org/web for v1.0.0.');
  assert.equal(zhEntries[0].bodyHtml, enEntries[0].bodyHtml);
  assert.match(zhEntries[0].bodyHtml, /v1\.0\.0 feature content/);
  assert.equal(zhEntries[0].anchorId, 'v1.0.0');
  assert.equal(zhEntries[0].anchorHref, '/release-notes/#v1.0.0');
  assert.equal(enEntries[0].anchorHref, '/en-US/release-notes/#v1.0.0');
  assert.equal(zhEntries[0].repositoryCount, 1);
  assert.equal(zhEntries[0].totalCommitCount, 3);
  assert.equal(zhEntries[0].releaseDate, '2026-04-13');
  assert.match(zhCopy.intro, /HagiCode/);
  assert.match(enCopy.intro, /Browse synchronized HagiCode release notes in English/);
  assert.notEqual(zhCopy.intro, enCopy.intro);
  assert.equal(Object.hasOwn(zhCopy, 'archiveLinkLabel'), false);
  assert.equal(Object.hasOwn(zhEntries[0], 'archiveRoute'), false);

  for (const locale of ROUTE_LOCALES) {
    const entries = getReleaseNotesLandingEntries(indexPayload, locale, detailEntries);
    assert.equal(entries[0].summary, zhEntries[0].summary, `summary differs for ${locale}`);
    assert.equal(entries[0].bodyHtml, zhEntries[0].bodyHtml, `body differs for ${locale}`);
  }
});

test('landing entries keep no release date when the source has none', () => {
  const snapshot = createSnapshot('v1.0.0');
  const entries = getReleaseNotesLandingEntries({
    entries: snapshot.entries.map((entry) => ({ ...entry, releaseDate: null, detailPath: 'v1.0.0.json' })),
  }, 'en', new Map());

  assert.equal(entries[0].releaseDate, null);
  assert.equal(entries[0].bodyHtml, '');
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

test('release-notes input verification fails when the single body HTML is missing', async () => {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-missing-body-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');

  await materializeReleaseNotes({ snapshot, config });

  const detailPath = path.join(config.outputPaths.dataDir, 'v1.0.0.json');
  const detailPayload = JSON.parse(await readFile(detailPath, 'utf8'));
  delete detailPayload.bodyHtml;
  await fs.promises.writeFile(detailPath, JSON.stringify(detailPayload, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /missing bodyHtml/);
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
