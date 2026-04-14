import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  discoverReleaseNoteAssets,
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
  includeZh = true,
  includeEn = true,
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

  if (includeZh) {
    await writeFixtureFile(
      path.join(sourceRoot, 'published', `${tag}.zh-CN.md`),
      '# HagiCode\n\n- 统一了入口流程。\n',
    );
  }

  if (includeEn) {
    await writeFixtureFile(
      path.join(sourceRoot, 'published', `${tag}.en.md`),
      '# HagiCode\n\n- Unified the entry flow.\n',
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

test('archive validation requires both published locales', async () => {
  const fixture = await createArchiveFixture({ includeEn: false });
  const inspection = inspectReleaseNoteArchive({
    zipPath: fixture.zipPath,
    candidate: { tag: 'v1.0.0' },
  });

  assert.equal(inspection.accepted, false);
  assert.equal(inspection.reason, 'missing_locale_body');
  assert.equal(inspection.locale, 'en');
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

  const firstRun = await materializeReleaseNotes({ snapshot, config });
  const firstIndex = await readFile(config.outputPaths.indexJson, 'utf8');
  const firstZh = await readFile(path.join(config.outputPaths.zhDir, 'v1.0.1.md'), 'utf8');

  const secondRun = await materializeReleaseNotes({ snapshot, config });
  const secondIndex = await readFile(config.outputPaths.indexJson, 'utf8');
  const secondZh = await readFile(path.join(config.outputPaths.zhDir, 'v1.0.1.md'), 'utf8');

  assert.equal(firstIndex, secondIndex);
  assert.equal(firstZh, secondZh);
  assert.deepEqual(firstRun.writtenFiles, secondRun.writtenFiles);
});
