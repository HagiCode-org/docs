import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createSourceFailureSummary,
  createSyncSummaryMarkdown,
  discoverReleaseNoteAssets,
  fetchReleaseNotesSnapshot,
  hasManagedReleaseNotesOutput,
  inspectReleaseNoteArchive,
  materializeReleaseNotes,
  normalizeSynchronizedReleaseNotes,
  resolveReleaseNotesConfig,
} from '../scripts/release-notes-sync-lib.mjs';

async function writeFixtureFile(filePath, contents) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
}

async function createArchiveFixture({
  tag = 'v1.0.0',
  payloadTag = tag,
  includeJson = true,
  includeLocales = null,
  repositories = {
    web: {
      path: 'repos/web',
      group: {
        range: 'v0.9.0..v1.0.0',
        commits: [
          {
            hash: 'abcdef',
            shortHash: 'abcdef',
            date: '2026-04-13',
            author: 'tester',
            subject: 'feat: ship release notes',
          },
        ],
      },
    },
  },
} = {}) {
  const ALL_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
  const locales = includeLocales ?? ALL_LOCALES;
  const root = await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-archive-'));
  const sourceRoot = path.join(root, 'source');
  const zipPath = path.join(root, `${tag}.zip`);

  if (includeJson) {
    await writeFixtureFile(
      path.join(sourceRoot, 'artifacts', 'tags', tag, `${tag}.json`),
      `${JSON.stringify(
        {
          generatedAt: '2026-04-13T14:14:52.517Z',
          formatVersion: 1,
          tag: payloadTag,
          repositories,
        },
        null,
        2,
      )}\n`,
    );
  }

  for (const locale of locales) {
    await writeFixtureFile(
      path.join(sourceRoot, 'published', `${tag}.${locale}.md`),
      `# HagiCode\n\n- ${locale} release note content.\n`,
    );
  }

  const result = spawnSync('zip', ['-qr', zipPath, '.'], {
    cwd: sourceRoot,
    encoding: 'utf8',
  });

  if ((result.status ?? 0) !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`);
  }

  return { root, zipPath };
}

async function createLocalReleaseNotesRepoFixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-local-'));
  const allLocales = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
  await writeFixtureFile(
    path.join(repoRoot, 'artifacts', 'tags', 'v1.0.0', 'v1.0.0.json'),
    `${JSON.stringify({
      generatedAt: '2026-04-13T14:14:52.517Z',
      formatVersion: 1,
      tag: 'v1.0.0',
      repositories: {
        web: {
          path: 'repos/web',
          group: {
            range: 'v0.9.0..v1.0.0',
            commits: [
              {
                hash: 'abcdef',
                shortHash: 'abcdef',
                date: '2026-04-13',
                author: 'tester',
                subject: 'feat: ship release notes',
              },
            ],
          },
        },
      },
    }, null, 2)}\n`,
  );
  for (const locale of allLocales) {
    await writeFixtureFile(
      path.join(repoRoot, 'published', `v1.0.0.${locale}.md`),
      `# HagiCode\n\n- ${locale} release note content.\n`,
    );
  }
  return repoRoot;
}

async function createMixedLocalReleaseNotesRepoFixture() {
  const repoRoot = await createLocalReleaseNotesRepoFixture();
  await writeFixtureFile(
    path.join(repoRoot, 'artifacts', 'tags', 'v1.0.1', 'v1.0.1.json'),
    `${JSON.stringify({
      generatedAt: '2026-04-14T14:14:52.517Z',
      formatVersion: 1,
      tag: 'v1.0.1',
      repositories: {
        web: {
          path: 'repos/web',
          group: {
            range: 'v1.0.0..v1.0.1',
            commits: [
              {
                hash: '123456',
                shortHash: '123456',
                date: '2026-04-14',
                author: 'tester',
                subject: 'fix: keep docs sync strict',
              },
            ],
          },
        },
      },
    }, null, 2)}\n`,
  );
  await writeFixtureFile(
    path.join(repoRoot, 'published', 'v1.0.1.zh-CN.md'),
    '# HagiCode\n\n- 保持 docs 同步严格。\n',
  );
  return repoRoot;
}

function createReleasePayload() {
  return [
    {
      id: 1,
      tag_name: 'v1.0.1',
      name: 'v1.0.1',
      published_at: '2026-04-14T08:00:00.000Z',
      html_url: 'https://example.test/releases/v1.0.1',
      assets: [
        {
          id: 10,
          name: 'release-notes-v1.0.1-history.zip',
          browser_download_url: 'https://example.test/assets/v1.0.1.zip',
          updated_at: '2026-04-14T08:10:00.000Z',
        },
        {
          id: 11,
          name: 'notes.txt',
          browser_download_url: 'https://example.test/assets/notes.txt',
          updated_at: '2026-04-14T08:10:00.000Z',
        },
      ],
    },
    {
      id: 2,
      tag_name: '1.0.0',
      name: '1.0.0',
      published_at: '2026-04-13T08:00:00.000Z',
      html_url: 'https://example.test/releases/1.0.0',
      assets: [
        {
          id: 20,
          name: 'release-notes-1.0.0-history.zip',
          browser_download_url: 'https://example.test/assets/1.0.0.zip',
          updated_at: '2026-04-13T08:10:00.000Z',
        },
      ],
    },
  ];
}

test('release discovery keeps only matching history bundle assets', () => {
  const discovered = discoverReleaseNoteAssets(createReleasePayload());

  assert.deepEqual(
    discovered.map((entry) => entry.tag),
    ['v1.0.1', '1.0.0'],
  );
  assert.equal(discovered[0].assetName, 'release-notes-v1.0.1-history.zip');
});

test('config prefers explicit cross-repository release-notes tokens', () => {
  const config = resolveReleaseNotesConfig({
    repoRoot: '/tmp/docs',
    env: {
      DOCS_RELEASE_NOTES_TOKEN: 'release-notes-token',
      DOCS_GITHUB_TOKEN: 'docs-token',
      GITHUB_TOKEN: 'github-token',
    },
  });

  assert.equal(config.token, 'release-notes-token');
});

test('config resolves local source mode when an explicit local repository root is provided', () => {
  const config = resolveReleaseNotesConfig({
    repoRoot: '/tmp/docs',
    env: {
      DOCS_RELEASE_NOTES_SOURCE: 'local',
      DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT: '../release-notes',
    },
  });

  assert.equal(config.resolvedSource, 'local');
  assert.equal(config.localRepoRoot, path.resolve('/tmp/release-notes'));
});

test('config rejects local source mode without a local repository root', () => {
  assert.throws(
    () => resolveReleaseNotesConfig({
      repoRoot: '/tmp/docs',
      env: {
        DOCS_RELEASE_NOTES_SOURCE: 'local',
      },
    }),
    /DOCS_RELEASE_NOTES_SOURCE=local requires DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT/u,
  );
});

test('local release-notes repository override can build a snapshot without GitHub access', async () => {
  const localRepoRoot = await createLocalReleaseNotesRepoFixture();
  const config = resolveReleaseNotesConfig({
    repoRoot: '/tmp/docs',
    env: {
      DOCS_RELEASE_NOTES_SOURCE: 'local',
      DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT: localRepoRoot,
    },
  });

  const snapshot = await fetchReleaseNotesSnapshot({ config });

  assert.equal(snapshot.source.repository, 'local-repository');
  assert.equal(snapshot.source.mode, 'local');
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].tag, 'v1.0.0');
  assert.equal(snapshot.entries[0].anchorId, 'v1.0.0');
  assert.ok(snapshot.entries[0].summary.en);
  assert.equal(snapshot.entries[0].source.jsonPath, 'artifacts/tags/v1.0.0/v1.0.0.json');
  assert.ok(snapshot.entries[0].source.bodies['zh-CN']);
  assert.ok(snapshot.entries[0].source.bodies.en);
});

test('archive validation rejects missing required tag json', async () => {
  const fixture = await createArchiveFixture({ includeJson: false });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'missing_required_payload');
});

test('archive validation rejects tag mismatches between asset and payload', async () => {
  const fixture = await createArchiveFixture({ payloadTag: 'v9.9.9' });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'tag_mismatch');
});

test('archive validation requires all published locales', async () => {
  const fixture = await createArchiveFixture({ includeLocales: ['zh-CN'] });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'missing_locale_body');
  assert.equal(inspection.locale, 'en');
});

test('local source skips incomplete upstream tags without materializing partial docs outputs', async () => {
  const localRepoRoot = await createMixedLocalReleaseNotesRepoFixture();
  const config = resolveReleaseNotesConfig({
    repoRoot: await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-local-sync-')),
    env: {
      DOCS_RELEASE_NOTES_SOURCE: 'local',
      DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT: localRepoRoot,
    },
  });

  const snapshot = await fetchReleaseNotesSnapshot({ config });
  const materialized = await materializeReleaseNotes({ snapshot, config });
  const index = JSON.parse(await readFile(config.outputPaths.indexJson, 'utf8'));
  const summary = createSyncSummaryMarkdown({ snapshot, materialized });

  assert.deepEqual(snapshot.entries.map((entry) => entry.tag), ['v1.0.0']);
  assert.deepEqual(snapshot.skipped.map((entry) => [entry.tag, entry.reason]), [['v1.0.1', 'missing_locale_body']]);
  assert.match(snapshot.skipped[0].message, /incomplete for docs sync/u);
  assert.ok(materialized.writtenFiles.includes('src/data/release-notes/index.json'));
  assert.ok(materialized.writtenFiles.includes('src/data/release-notes/v1.0.0.json'));
  assert.ok(materialized.writtenFiles.includes('src/content/docs/release-notes/index.mdx'));
  assert.ok(materialized.writtenFiles.includes('src/content/docs/en-US/release-notes/index.mdx'));
  assert.deepEqual(index.entries.map((entry) => entry.tag), ['v1.0.0']);
  assert.match(summary, /v1\.0\.1/);
  assert.match(summary, /missing_locale_body/);
});

test('normalization preserves display tags, sorts semver consistently, and materialization is idempotent', async () => {
  const firstFixture = await createArchiveFixture({ tag: '1.0.0' });
  const secondFixture = await createArchiveFixture({ tag: 'v1.0.1' });
  const firstAccepted = inspectReleaseNoteArchive({
    zipPath: firstFixture.zipPath,
    candidate: {
      tag: '1.0.0',
      assetName: 'release-notes-1.0.0-history.zip',
      assetDownloadUrl: 'https://example.test/assets/1.0.0.zip',
      releasePublishedAt: '2026-04-13T08:00:00.000Z',
      releaseHtmlUrl: 'https://example.test/releases/1.0.0',
      releaseName: '1.0.0',
    },
  });
  const secondAccepted = inspectReleaseNoteArchive({
    zipPath: secondFixture.zipPath,
    candidate: {
      tag: 'v1.0.1',
      assetName: 'release-notes-v1.0.1-history.zip',
      assetDownloadUrl: 'https://example.test/assets/v1.0.1.zip',
      releasePublishedAt: '2026-04-14T08:00:00.000Z',
      releaseHtmlUrl: 'https://example.test/releases/v1.0.1',
      releaseName: 'v1.0.1',
    },
  });

  assert.equal(firstAccepted.accepted, true);
  assert.equal(secondAccepted.accepted, true);

  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-materialize-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = {
    ...normalizeSynchronizedReleaseNotes({
      acceptedEntries: [firstAccepted, secondAccepted],
      config,
      synchronizedAt: '2026-04-14T10:00:00.000Z',
    }),
    skipped: [],
    counts: {
      releases: 2,
      discovered: 2,
      synchronized: 2,
      skipped: 0,
    },
  };

  assert.deepEqual(
    snapshot.entries.map((entry) => entry.tag),
    ['v1.0.1', '1.0.0'],
  );
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.anchorId),
    ['v1.0.1', 'v1.0.0'],
  );
  assert.equal(snapshot.entries[0].source.jsonPath, 'artifacts/tags/v1.0.1/v1.0.1.json');
  assert.equal(snapshot.entries[1].source.bodies.en, 'published/1.0.0.en.md');

  await writeFixtureFile(path.join(config.outputPaths.localeDirs['zh-CN'], 'legacy-detail.md'), 'stale');
  await writeFixtureFile(path.join(config.outputPaths.localeDirs.en, 'legacy-detail.md'), 'stale');

  const firstRun = await materializeReleaseNotes({ snapshot, config });
  const firstIndex = await readFile(config.outputPaths.indexJson, 'utf8');
  const firstZhLanding = await readFile(path.join(config.outputPaths.localeDirs['zh-CN'], 'index.mdx'), 'utf8');
  const firstEnLanding = await readFile(path.join(config.outputPaths.localeDirs.en, 'index.mdx'), 'utf8');

  const secondRun = await materializeReleaseNotes({ snapshot, config });
  const secondIndex = await readFile(config.outputPaths.indexJson, 'utf8');
  const secondZhLanding = await readFile(path.join(config.outputPaths.localeDirs['zh-CN'], 'index.mdx'), 'utf8');
  const secondEnLanding = await readFile(path.join(config.outputPaths.localeDirs.en, 'index.mdx'), 'utf8');
  const parsedIndex = JSON.parse(secondIndex);

  assert.equal(firstIndex, secondIndex);
  assert.equal(firstZhLanding, secondZhLanding);
  assert.equal(firstEnLanding, secondEnLanding);
  assert.deepEqual(firstRun.writtenFiles, secondRun.writtenFiles);
  assert.ok(firstRun.writtenFiles.includes('src/data/release-notes/index.json'));
  assert.ok(firstRun.writtenFiles.includes('src/data/release-notes/v1.0.1.json'));
  assert.ok(firstRun.writtenFiles.includes('src/data/release-notes/1.0.0.json'));
  assert.ok(firstRun.writtenFiles.includes('src/content/docs/release-notes/index.mdx'));
  assert.ok(firstRun.writtenFiles.includes('src/content/docs/en-US/release-notes/index.mdx'));
  assert.ok(firstRun.writtenFiles.includes('src/content/docs/zh-Hant/release-notes/index.mdx'));
  assert.ok(firstRun.writtenFiles.includes('src/content/docs/ja-JP/release-notes/index.mdx'));
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'legacy-detail.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'legacy-detail.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'v1.0.1.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'v1.0.1.md')), false);
  assert.equal(parsedIndex.entries[0].anchorId, 'v1.0.1');
  assert.equal(parsedIndex.entries[0].detailPath, 'v1.0.1.json');
  assert.equal(parsedIndex.entries[1].detailPath, '1.0.0.json');
  assert.equal(Object.hasOwn(parsedIndex.entries[0], 'routes'), false);

  const summary = createSyncSummaryMarkdown({ snapshot, materialized: secondRun });
  assert.match(summary, /\/release-notes\/#v1\.0\.1/);
  assert.match(summary, /\/en-US\/release-notes\/#v1\.0\.1/);
  assert.doesNotMatch(summary, /\/release-notes\/v1\.0\.1\//);
});

test('stale-output detection and summary work for source failures', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-stale-'));
  const config = resolveReleaseNotesConfig({
    repoRoot,
    env: {
      DOCS_RELEASE_NOTES_ALLOW_STALE_ON_SOURCE_ERROR: 'true',
    },
  });
  const snapshot = {
    ...normalizeSynchronizedReleaseNotes({
      acceptedEntries: [],
      config,
      synchronizedAt: '2026-04-14T10:00:00.000Z',
    }),
    entries: [
      {
        tag: 'v1.0.0',
        displayTag: 'v1.0.0',
        sortVersion: '1.0.0',
        releaseDate: '2026-04-13',
        publishedAt: '2026-04-13T08:00:00.000Z',
        synchronizedAt: '2026-04-14T10:00:00.000Z',
        upstreamGeneratedAt: '2026-04-13T07:55:00.000Z',
        anchorId: 'v1.0.0',
        summary: { 'zh-CN': '统一了入口流程。', en: 'Unified the entry flow.' },
        repositoryRanges: [],
        totalCommitCount: 0,
        source: { releaseName: 'v1.0.0', releaseUrl: null, assetName: 'release-notes-v1.0.0-history.zip', assetUrl: null, jsonPath: 'artifacts/tags/v1.0.0/v1.0.0.json', bodies: { 'zh-CN': 'published/v1.0.0.zh-CN.md', en: 'published/v1.0.0.en.md' } },
        bodies: { 'zh-CN': '# HagiCode\n\n- 统一了入口流程。\n', en: '# HagiCode\n\n- Unified the entry flow.\n' },
      },
    ],
    skipped: [],
    counts: { releases: 1, discovered: 1, synchronized: 1, skipped: 0 },
  };

  await materializeReleaseNotes({ snapshot, config });
  assert.equal(await hasManagedReleaseNotesOutput(config), true);

  const summary = createSyncSummaryMarkdown({ snapshot, materialized: { writtenFiles: [] } });
  assert.match(summary, /\/release-notes\/#v1\.0\.0/);
  assert.match(summary, /\/en-US\/release-notes\/#v1\.0\.0/);

  const failureSummary = createSourceFailureSummary({
    config,
    error: new Error('GitHub release discovery for HagiCode-org/release-notes failed with status 404.'),
  });

  assert.match(failureSummary, /preserved existing managed outputs/);
  assert.match(failureSummary, /status 404/);
});
