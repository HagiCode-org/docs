import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { materializeReleaseNotes, resolveReleaseNotesConfig } from '../scripts/release-notes-sync-lib.mjs';
import { verifyReleaseNotesBuildInput } from '../scripts/verify-release-notes-build-input.mjs';
import { verifyReleaseNotesBuildOutput } from '../scripts/verify-release-notes-build-output.mjs';

const ROUTE_ARTIFACTS = {
  'zh-CN': path.join('release-notes', 'index.html'),
  en: path.join('en-US', 'release-notes', 'index.html'),
  'zh-Hant': path.join('zh-Hant', 'release-notes', 'index.html'),
  'ja-JP': path.join('ja-JP', 'release-notes', 'index.html'),
  'ko-KR': path.join('ko-KR', 'release-notes', 'index.html'),
  'de-DE': path.join('de-DE', 'release-notes', 'index.html'),
  'fr-FR': path.join('fr-FR', 'release-notes', 'index.html'),
  'es-ES': path.join('es-ES', 'release-notes', 'index.html'),
  'pt-BR': path.join('pt-BR', 'release-notes', 'index.html'),
  'ru-RU': path.join('ru-RU', 'release-notes', 'index.html'),
};

function createBody(tag) {
  return [
    `# HagiCode ${tag}`,
    '',
    '## Features',
    '',
    '### HagiCode-org/web',
    '',
    `- **ui:** ${tag} feature content ([\`abcdef\`](https://example.test/commit/abcdef))`,
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
        summary: `1 feature across HagiCode-org/web for ${tag}.`,
        repositoryRanges: [],
        totalCommitCount: 0,
        source: {
          releaseName: tag,
          releaseUrl: null,
          assetName: `release-notes-${tag}-history.zip`,
          assetUrl: null,
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

async function createRepoWithArtifacts() {
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-output-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');
  await materializeReleaseNotes({ snapshot, config });

  const distDir = path.join(repoRoot, 'dist');
  const artifacts = {};
  for (const [locale, relativePath] of Object.entries(ROUTE_ARTIFACTS)) {
    const artifactPath = path.join(distDir, relativePath);
    await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(
      artifactPath,
      `<article><h2 id="v1.0.0">v1.0.0</h2><p>1 feature across HagiCode-org/web for v1.0.0.</p><h3>HagiCode-org/web</h3><ul><li>v1.0.0 feature content</li></ul></article>`,
      'utf8',
    );
    artifacts[locale] = artifactPath;
  }

  return { repoRoot, artifacts, config };
}

test('release-notes output verification accepts every route artifact that keeps the latest content', async () => {
  const { repoRoot } = await createRepoWithArtifacts();

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.latestEntry.tag, 'v1.0.0');
});

test('release-notes output verification fails when zh-CN artifact loses synchronized content', async () => {
  const { repoRoot, artifacts } = await createRepoWithArtifacts();

  await writeFile(artifacts['zh-CN'], '<p>当前语言下还没有可浏览的同步版本。</p>', 'utf8');

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /zh-CN artifact .*missing anchor v1\.0\.0/);
  assert.match(result.issues.join('\n'), /zh-CN artifact .*rendered the empty state/);
});

test('release-notes output verification fails when en artifact loses the synchronized summary and body', async () => {
  const { repoRoot, artifacts } = await createRepoWithArtifacts();
  const original = await readFile(artifacts.en, 'utf8');

  await writeFile(
    artifacts.en,
    original
      .replace('1 feature across HagiCode-org/web for v1.0.0.', 'Unrelated copy.')
      .replace('v1.0.0 feature content', 'Other copy'),
    'utf8',
  );

  const result = verifyReleaseNotesBuildOutput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /en artifact .*missing the synchronized summary\/body/);
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

test('release-notes build input verification fails on an empty body and on a per-locale body map', async () => {
  const { repoRoot, config } = await createRepoWithArtifacts();
  const detailPath = path.join(config.outputPaths.dataDir, 'v1.0.0.json');
  const detailPayload = JSON.parse(await readFile(detailPath, 'utf8'));

  detailPayload.bodyHtml = '';
  await writeFile(detailPath, JSON.stringify(detailPayload, null, 2), 'utf8');
  let result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /missing bodyHtml/);

  detailPayload.bodyHtml = { en: '<h2 id="features">Features</h2><ul><li>v1.0.0 feature content</li></ul>' };
  await writeFile(detailPath, JSON.stringify(detailPayload, null, 2), 'utf8');
  result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /bodyHtml must be a single string/);
});

test('release-notes build input verification fails when a body carries sections other than Features and Fixes', async () => {
  const { repoRoot, config } = await createRepoWithArtifacts();
  const detailPath = path.join(config.outputPaths.dataDir, 'v1.0.0.json');
  const detailPayload = JSON.parse(await readFile(detailPath, 'utf8'));

  detailPayload.bodyHtml = `${detailPayload.bodyHtml}<h2 id="maintenance">Maintenance</h2><ul><li>chore cleanup</li></ul>`;
  await writeFile(detailPath, JSON.stringify(detailPayload, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /sections other than Features and Fixes \(Maintenance\)/);
});

test('release-notes build input verification fails when the index summary is a per-locale map', async () => {
  const { repoRoot, config } = await createRepoWithArtifacts();
  const indexPayload = JSON.parse(await readFile(config.outputPaths.indexJson, 'utf8'));

  indexPayload.entries[0].summary = { en: 'Summary.', 'zh-CN': '摘要。' };
  await writeFile(config.outputPaths.indexJson, JSON.stringify(indexPayload, null, 2), 'utf8');

  const result = verifyReleaseNotesBuildInput({ docsRoot: repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /summary must be a single string/);
});
