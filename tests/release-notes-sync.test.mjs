import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createReleaseSummary,
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

function createCapture(tag, { repositories } = {}) {
  return {
    formatVersion: 1,
    tag,
    drafter: { package: '@hagicode/hagi-release-drafter', version: '0.4.0', source: 'package' },
    repositories: repositories ?? [
      {
        key: 'hagicode-core',
        input: './repos/hagicode-core',
        name: 'HagiCode-org/hagicode-core',
        status: 'ok',
        version: '0.1.0',
        lastTag: 'v0.9.0',
        lastTagSource: 'auto',
        endTag: tag,
        commitCount: 4,
        renderedCount: 4,
        truncated: false,
        notes: '## Changes\n\n### Features\n\n- **scope:** ship release notes ([`abcdef`](https://example.test/commit/abcdef))\n',
      },
      {
        key: 'web',
        input: './repos/web',
        name: 'HagiCode-org/web',
        status: 'failed',
        error: 'git tag not found',
      },
    ],
  };
}

function createBody(tag) {
  return [
    `# HagiCode ${tag}`,
    '',
    '## Features',
    '',
    '### HagiCode-org/hagicode-core',
    '',
    '- **scope:** ship release notes ([`abcdef`](https://example.test/commit/abcdef))',
    '',
    '## Fixes',
    '',
    '### HagiCode-org/web',
    '',
    '- **ui:** keep docs sync strict ([`123456`](https://example.test/commit/123456))',
    '',
  ].join('\n');
}

async function createArchiveFixture({
  tag = 'v1.0.0',
  captureTag = tag,
  captureText = null,
  bodyText = null,
  includeCapture = true,
  includeBody = true,
  legacyLocaleBodies = [],
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-archive-'));
  const sourceRoot = path.join(root, 'source');
  const zipPath = path.join(root, `${tag}.zip`);

  if (includeCapture) {
    await writeFixtureFile(
      path.join(sourceRoot, 'artifacts', 'commits', `${tag}.json`),
      captureText ?? `${JSON.stringify(createCapture(captureTag), null, 2)}\n`,
    );
  }

  if (includeBody) {
    await writeFixtureFile(
      path.join(sourceRoot, 'published', `${tag}.md`),
      bodyText ?? `${createBody(tag)}\n`,
    );
  }

  for (const locale of legacyLocaleBodies) {
    await writeFixtureFile(
      path.join(sourceRoot, 'published', `${tag}.${locale}.md`),
      `# HagiCode\n\n- ${locale} legacy content.\n`,
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
  await writeFixtureFile(
    path.join(repoRoot, 'artifacts', 'commits', 'v1.0.0.json'),
    `${JSON.stringify(createCapture('v1.0.0'), null, 2)}\n`,
  );
  await writeFixtureFile(path.join(repoRoot, 'published', 'v1.0.0.md'), `${createBody('v1.0.0')}\n`);
  // Legacy locale bodies from the retired multilingual flow must be ignored.
  for (const locale of ['zh-CN', 'en', 'ja-JP']) {
    await writeFixtureFile(
      path.join(repoRoot, 'published', `v1.0.0.${locale}.md`),
      `# HagiCode\n\n- ${locale} legacy content.\n`,
    );
  }
  // Legacy per-tag export that the sync must never read.
  await writeFixtureFile(
    path.join(repoRoot, 'artifacts', 'tags', 'v1.0.0', 'v1.0.0.json'),
    '{"legacy": true}\n',
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

test('summary rule counts features and fixes and names repositories deterministically', () => {
  assert.equal(
    createReleaseSummary({ features: 1, fixes: 1, repositories: ['HagiCode-org/hagicode-core', 'HagiCode-org/web'] }),
    '1 feature and 1 fix across HagiCode-org/hagicode-core, HagiCode-org/web.',
  );
  assert.equal(
    createReleaseSummary({ features: 0, fixes: 3, repositories: ['HagiCode-org/web'] }),
    '3 fixes across HagiCode-org/web.',
  );
  assert.equal(
    createReleaseSummary({ features: 2, fixes: 0, repositories: [] }),
    '2 features.',
  );
});

test('local source builds one summary and one body per tag from the capture and body', async () => {
  const localRepoRoot = await createLocalReleaseNotesRepoFixture();
  const config = resolveReleaseNotesConfig({
    repoRoot: '/tmp/docs',
    env: {
      DOCS_RELEASE_NOTES_SOURCE: 'local',
      DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT: localRepoRoot,
    },
  });

  const snapshot = await fetchReleaseNotesSnapshot({ config });
  const [entry] = snapshot.entries;

  assert.equal(snapshot.source.repository, 'local-repository');
  assert.equal(snapshot.source.mode, 'local');
  assert.equal(Object.hasOwn(snapshot.source, 'locales'), false);
  assert.equal(snapshot.entries.length, 1);
  assert.equal(entry.tag, 'v1.0.0');
  assert.equal(entry.anchorId, 'v1.0.0');
  assert.equal(entry.summary, '1 feature and 1 fix across HagiCode-org/hagicode-core, HagiCode-org/web.');
  assert.equal(entry.releaseDate, null);
  assert.equal(entry.totalCommitCount, 4);
  assert.deepEqual(entry.repositoryRanges.map((range) => [range.repository, range.commitCount, range.renderedCount, range.truncated]), [
    ['hagicode-core', 4, 4, false],
  ]);
  assert.equal(entry.source.capturePath, 'artifacts/commits/v1.0.0.json');
  assert.equal(entry.source.bodyPath, 'published/v1.0.0.md');
  assert.equal(typeof entry.body, 'string');
  assert.equal(Object.hasOwn(entry, 'bodies'), false);
  assert.equal(Object.hasOwn(entry.source, 'bodies'), false);
  assert.equal(Object.hasOwn(entry.source, 'jsonPath'), false);
});

test('archive validation accepts a valid capture and single body', async () => {
  const fixture = await createArchiveFixture();
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, true);
  assert.equal(inspection.capturePath, 'artifacts/commits/v1.0.0.json');
  assert.equal(inspection.bodyPath, 'published/v1.0.0.md');
  assert.match(inspection.body, /^# HagiCode v1\.0\.0/u);
});

test('archive validation rejects a missing drafter capture', async () => {
  const fixture = await createArchiveFixture({ includeCapture: false });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'missing_drafter_capture');
});

test('archive validation rejects a malformed drafter capture', async () => {
  const fixture = await createArchiveFixture({ captureText: '{"tag": "v1.0.0", "repositories": [' });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'invalid_drafter_capture');
});

test('archive validation rejects a capture without a repositories array', async () => {
  const fixture = await createArchiveFixture({ captureText: '{"formatVersion": 1, "tag": "v1.0.0"}' });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'invalid_drafter_capture');
});

test('archive validation rejects a capture with an ok row lacking integer counters', async () => {
  const capture = createCapture('v1.0.0');
  capture.repositories[0].commitCount = '4';
  const fixture = await createArchiveFixture({ captureText: `${JSON.stringify(capture)}\n` });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'invalid_drafter_capture');
});

test('archive validation rejects tag mismatches between asset and capture', async () => {
  const fixture = await createArchiveFixture({ captureTag: 'v9.9.9' });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'tag_mismatch');
});

test('archive validation rejects a missing published body', async () => {
  const fixture = await createArchiveFixture({ includeBody: false });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'missing_published_body');
  assert.match(inspection.message, /published\/v1\.0\.0\.md/u);
});

test('archive validation rejects a body with no Features or Fixes entries', async () => {
  const fixture = await createArchiveFixture({ bodyText: '# HagiCode v1.0.0\n\n\n' });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'empty_published_body');
});

test('archive validation ignores legacy locale bodies', async () => {
  const fixture = await createArchiveFixture({ legacyLocaleBodies: ['zh-CN', 'ja-JP'] });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, true);
});

test('local source skips incomplete tags and ignores legacy locale files and artifacts/tags', async () => {
  const localRepoRoot = await createLocalReleaseNotesRepoFixture();
  // Capture only: body missing.
  await writeFixtureFile(
    path.join(localRepoRoot, 'artifacts', 'commits', 'v1.0.1.json'),
    `${JSON.stringify(createCapture('v1.0.1'), null, 2)}\n`,
  );
  // Body only (legacy locale files only): capture missing.
  await writeFixtureFile(path.join(localRepoRoot, 'published', 'v1.0.2.zh-CN.md'), '# HagiCode\n\n- legacy\n');
  // Malformed capture.
  await writeFixtureFile(path.join(localRepoRoot, 'artifacts', 'commits', 'v1.0.3.json'), '{ not json');
  await writeFixtureFile(path.join(localRepoRoot, 'published', 'v1.0.3.md'), `${createBody('v1.0.3')}\n`);
  // Empty body.
  await writeFixtureFile(path.join(localRepoRoot, 'artifacts', 'commits', 'v1.0.4.json'), `${JSON.stringify(createCapture('v1.0.4'))}\n`);
  await writeFixtureFile(path.join(localRepoRoot, 'published', 'v1.0.4.md'), '   \n');

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
  assert.deepEqual(
    snapshot.skipped.map((entry) => [entry.tag, entry.reason]),
    [
      ['v1.0.1', 'missing_published_body'],
      ['v1.0.3', 'invalid_drafter_capture'],
      ['v1.0.4', 'empty_published_body'],
    ],
  );
  assert.match(snapshot.skipped[0].message, /published\/v1\.0\.1\.md/u);
  assert.ok(materialized.writtenFiles.includes('src/data/release-notes/index.json'));
  assert.ok(materialized.writtenFiles.includes('src/data/release-notes/v1.0.0.json'));
  assert.ok(materialized.writtenFiles.includes('src/content/docs/release-notes/index.mdx'));
  assert.ok(materialized.writtenFiles.includes('src/content/translations/docs/en-US/release-notes/index.mdx'));
  assert.deepEqual(index.entries.map((entry) => entry.tag), ['v1.0.0']);
  assert.match(summary, /v1\.0\.1/);
  assert.match(summary, /missing_published_body/);
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
  assert.equal(snapshot.entries[0].source.capturePath, 'artifacts/commits/v1.0.1.json');
  assert.equal(snapshot.entries[1].source.bodyPath, 'published/1.0.0.md');

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
  assert.ok(firstRun.writtenFiles.includes('src/content/translations/docs/en-US/release-notes/index.mdx'));
  assert.ok(firstRun.writtenFiles.includes('src/content/translations/docs/zh-Hant/release-notes/index.mdx'));
  assert.ok(firstRun.writtenFiles.includes('src/content/translations/docs/ja-JP/release-notes/index.mdx'));
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs['zh-CN'], 'legacy-detail.md')), false);
  assert.equal(fs.existsSync(path.join(config.outputPaths.localeDirs.en, 'legacy-detail.md')), false);
  assert.equal(parsedIndex.entries[0].anchorId, 'v1.0.1');
  assert.equal(parsedIndex.entries[0].detailPath, 'v1.0.1.json');
  assert.equal(parsedIndex.entries[1].detailPath, '1.0.0.json');
  assert.equal(parsedIndex.entries[0].releaseDate, '2026-04-14');
  assert.equal(Object.hasOwn(parsedIndex.entries[0], 'routes'), false);

  const summary = createSyncSummaryMarkdown({ snapshot, materialized: secondRun });
  assert.match(summary, /\/release-notes\/#v1\.0\.1/);
  assert.match(summary, /\/en-US\/release-notes\/#v1\.0\.1/);
  assert.doesNotMatch(summary, /\/release-notes\/v1\.0\.1\//);
});

test('materialized index and detail carry one summary string and one body HTML, with no locale maps', async () => {
  const localRepoRoot = await createLocalReleaseNotesRepoFixture();
  const config = resolveReleaseNotesConfig({
    repoRoot: await mkdtemp(path.join(os.tmpdir(), 'docs-release-notes-shape-')),
    env: {
      DOCS_RELEASE_NOTES_SOURCE: 'local',
      DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT: localRepoRoot,
    },
  });

  const snapshot = await fetchReleaseNotesSnapshot({ config });
  await materializeReleaseNotes({ snapshot, config });

  const index = JSON.parse(await readFile(config.outputPaths.indexJson, 'utf8'));
  const detail = JSON.parse(await readFile(path.join(config.outputPaths.dataDir, 'v1.0.0.json'), 'utf8'));
  const [indexEntry] = index.entries;

  assert.equal(typeof indexEntry.summary, 'string');
  assert.equal(indexEntry.detailPath, 'v1.0.0.json');
  assert.equal(Object.hasOwn(indexEntry, 'body'), false);
  assert.equal(Object.hasOwn(indexEntry, 'bodyHtml'), false);
  assert.equal(indexEntry.source.bodyPath, 'published/v1.0.0.md');
  assert.equal(JSON.stringify(index).includes('"zh-CN"'), false);
  assert.equal(typeof detail.summary, 'string');
  assert.equal(typeof detail.bodyHtml, 'string');
  assert.match(detail.bodyHtml, /<li>/u);
  assert.match(detail.bodyHtml, /keep docs sync strict/u);
  assert.doesNotMatch(detail.bodyHtml, /<h1/u);
  assert.equal(Object.hasOwn(detail, 'bodies'), false);
  assert.equal(JSON.stringify(detail).includes('"zh-CN"'), false);
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
        upstreamGeneratedAt: null,
        anchorId: 'v1.0.0',
        summary: '1 feature across HagiCode-org/hagicode-core.',
        repositoryRanges: [],
        totalCommitCount: 0,
        source: { releaseName: 'v1.0.0', releaseUrl: null, assetName: 'release-notes-v1.0.0-history.zip', assetUrl: null, capturePath: 'artifacts/commits/v1.0.0.json', bodyPath: 'published/v1.0.0.md' },
        body: '# HagiCode\n\n## Features\n\n### HagiCode-org/hagicode-core\n\n- Unified the entry flow.\n',
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
