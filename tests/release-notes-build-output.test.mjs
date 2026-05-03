import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { materializeReleaseNotes, resolveReleaseNotesConfig } from '../scripts/release-notes-sync-lib.mjs';
import { verifyReleaseNotesBuildOutput } from '../scripts/verify-release-notes-build-output.mjs';

function createSnapshot(tag = 'v1.0.0') {
  const ALL_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
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
        repositoryRanges: [],
        totalCommitCount: 0,
        source: {
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

async function createRepoWithArtifacts() {
  const ALL_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
  const repoRoot = await mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'docs-release-notes-output-'));
  const config = resolveReleaseNotesConfig({ repoRoot });
  const snapshot = createSnapshot('v1.0.0');
  await materializeReleaseNotes({ snapshot, config });

  const distDir = path.join(repoRoot, 'dist');
  const artifacts = {};
  for (const locale of ALL_LOCALES) {
    const localeDir = locale === 'zh-CN' ? 'release-notes' : `${locale === 'en' ? 'en-US' : locale}/release-notes`;
    const artifactPath = path.join(distDir, localeDir, 'index.html');
    await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `<article><h2 id="v1.0.0">v1.0.0</h2><p>${locale} summary for v1.0.0.</p></article>`, 'utf8');
    artifacts[locale] = artifactPath;
  }

  return { repoRoot, artifacts };
}

test('release-notes output verification accepts all locale artifacts that keep latest content', async () => {
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

test('release-notes output verification fails when en artifact loses localized summary/body', async () => {
  const { repoRoot, artifacts } = await createRepoWithArtifacts();
  const original = await readFile(artifacts.en, 'utf8');

  await writeFile(artifacts.en, original.replace('en summary for v1.0.0.', 'Unrelated copy.'), 'utf8');

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
