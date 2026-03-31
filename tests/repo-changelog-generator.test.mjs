import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildReleaseWindows,
  buildExplicitReleaseBucket,
  buildRepositoryChangelog,
  collectTagWindowCommits,
  listRepositoryTags,
  normalizeReleaseTagKey,
  resolveRepoSource,
  updateRepositoryChangelogForVersion,
} from '../scripts/generate-multi-repo-changelog.mjs';

function git(repoDir, args, env = {}) {
  return execFileSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

async function createTempRepository(t) {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'docs-changelog-'));
  t.after(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  git(repoDir, ['init', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'Docs Test']);
  git(repoDir, ['config', 'user.email', 'docs-test@example.com']);

  return repoDir;
}

async function createDocsFixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'docs-changelog-fixture-'));
  const monorepoRoot = path.join(rootDir, 'monorepo');
  const docsRoot = path.join(monorepoRoot, 'repos', 'docs');
  const desktopRepoDir = path.join(monorepoRoot, 'repos', 'hagicode-desktop');
  const coreOutputPath = path.join(docsRoot, 'src', 'data', 'changelog', 'core.json');

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await mkdir(path.dirname(coreOutputPath), { recursive: true });
  await writeFile(
    coreOutputPath,
    `${JSON.stringify(
      {
        repoKey: 'core',
        repoPath: 'repos/hagicode-core',
        generatedAt: '2026-03-01T00:00:00.000Z',
        releases: [
          {
            tag: 'v9.9.9',
            previousTag: 'v9.9.8',
            tagDate: '2026-03-01T00:00:00.000Z',
            commitCount: 1,
            commits: [],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await mkdir(desktopRepoDir, { recursive: true });
  git(desktopRepoDir, ['init', '-b', 'main']);
  git(desktopRepoDir, ['config', 'user.name', 'Docs Test']);
  git(desktopRepoDir, ['config', 'user.email', 'docs-test@example.com']);

  return {
    docsRoot,
    monorepoRoot,
    desktopRepoDir,
    coreOutputPath,
  };
}

async function commitFile(repoDir, filename, content, date, subject, body = '') {
  await writeFile(path.join(repoDir, filename), content, 'utf8');
  git(repoDir, ['add', filename]);

  const args = ['commit', '-m', subject];
  if (body.length > 0) {
    args.push('-m', body);
  }

  git(repoDir, args, {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
}

test('generator builds adjacent tag windows and skips commits before the earliest tag', async (t) => {
  const repoDir = await createTempRepository(t);

  await commitFile(repoDir, 'notes.md', '# init\n', '2026-01-01T00:00:00Z', 'chore: init');
  git(repoDir, ['tag', '0.1.0']);

  await commitFile(
    repoDir,
    'notes.md',
    '# init\n\nsecond\n',
    '2026-01-02T00:00:00Z',
    'feat: add second change',
    'detail for second change',
  );
  await commitFile(
    repoDir,
    'notes.md',
    '# init\n\nsecond\n\nthird\n',
    '2026-01-03T00:00:00Z',
    'fix: prepare release two',
    'detail for release two',
  );
  git(repoDir, ['tag', 'v0.2.0']);

  await commitFile(
    repoDir,
    'notes.md',
    '# init\n\nsecond\n\nthird\n\nfourth\n',
    '2026-01-04T00:00:00Z',
    'docs: release three',
  );
  git(repoDir, ['tag', 'V0.3.0']);

  const tags = listRepositoryTags(repoDir);
  assert.deepEqual(
    tags.map((tag) => tag.name),
    ['0.1.0', 'v0.2.0', 'V0.3.0'],
  );

  const windows = buildReleaseWindows(tags);
  assert.deepEqual(
    windows.map((window) => [window.previousTag.name, window.currentTag.name]),
    [
      ['0.1.0', 'v0.2.0'],
      ['v0.2.0', 'V0.3.0'],
    ],
  );

  const secondReleaseCommits = collectTagWindowCommits(repoDir, '0.1.0', 'v0.2.0');
  assert.equal(secondReleaseCommits.length, 2);
  assert.deepEqual(
    secondReleaseCommits.map((commit) => commit.title),
    ['feat: add second change', 'fix: prepare release two'],
  );
  assert.deepEqual(
    secondReleaseCommits.map((commit) => commit.detail),
    ['detail for second change', 'detail for release two'],
  );

  const changelog = buildRepositoryChangelog(
    {
      repoKey: 'fixture',
      repoPath: repoDir,
      outputPath: 'unused.json',
    },
    {
      monorepoRoot: '/',
    },
  );

  assert.equal(changelog.releases.length, 2);
  assert.deepEqual(
    changelog.releases.map((release) => release.tag),
    ['V0.3.0', 'v0.2.0'],
  );
  assert.equal(changelog.releases[0].commitCount, 1);
  assert.equal(changelog.releases[1].commitCount, 2);
  assert.equal(changelog.releases[0].commits[0].title, 'docs: release three');
  assert.equal(changelog.releases[1].commits[0].title, 'feat: add second change');
});

test('generator returns a valid empty release list for repositories with a single tag', async (t) => {
  const repoDir = await createTempRepository(t);

  await commitFile(repoDir, 'README.md', 'single tag repo\n', '2026-02-01T00:00:00Z', 'feat: first release');
  git(repoDir, ['tag', 'v1.0.0']);

  const changelog = buildRepositoryChangelog(
    {
      repoKey: 'single',
      repoPath: repoDir,
      outputPath: 'unused.json',
    },
    {
      monorepoRoot: '/',
    },
  );

  assert.equal(changelog.repoKey, 'single');
  assert.equal(changelog.releases.length, 0);
});

test('explicit mode writes only the selected dataset and builds a pending release bucket before the target tag exists', async (t) => {
  const fixture = await createDocsFixture(t);
  const desktopSource = resolveRepoSource('desktop');
  const desktopOutputPath = path.join(fixture.docsRoot, desktopSource.outputPath);
  const originalCoreJson = await readFile(fixture.coreOutputPath, 'utf8');

  await commitFile(
    fixture.desktopRepoDir,
    'CHANGELOG.md',
    'v0.1.0\n',
    '2026-03-01T00:00:00Z',
    'feat: first release',
  );
  git(fixture.desktopRepoDir, ['tag', 'v0.1.0']);

  await commitFile(
    fixture.desktopRepoDir,
    'CHANGELOG.md',
    'v0.2.0\n',
    '2026-03-02T00:00:00Z',
    'feat: pending release work',
    'detail for pending release',
  );

  const result = await updateRepositoryChangelogForVersion({
    docsRoot: fixture.docsRoot,
    monorepoRoot: fixture.monorepoRoot,
    repoKey: 'desktop',
    targetVersion: 'v0.2.0',
    sourceRef: 'HEAD',
    generatedAt: '2026-03-02T01:00:00.000Z',
  });

  assert.equal(result.repoKey, 'desktop');
  assert.equal(result.release.tag, 'v0.2.0');
  assert.equal(result.release.previousTag, 'v0.1.0');
  assert.equal(result.release.commitCount, 1);
  assert.equal(result.outputPath, desktopOutputPath);

  const desktopJson = JSON.parse(await readFile(desktopOutputPath, 'utf8'));
  assert.equal(desktopJson.generatedAt, '2026-03-02T01:00:00.000Z');
  assert.equal(desktopJson.releases.length, 1);
  assert.equal(desktopJson.releases[0].tag, 'v0.2.0');
  assert.equal(desktopJson.releases[0].commits[0].title, 'feat: pending release work');

  const currentCoreJson = await readFile(fixture.coreOutputPath, 'utf8');
  assert.equal(currentCoreJson, originalCoreJson);
});

test('explicit mode rejects unknown repo keys before writing any changelog data', async (t) => {
  const fixture = await createDocsFixture(t);
  const coreBefore = await readFile(fixture.coreOutputPath, 'utf8');

  await assert.rejects(
    updateRepositoryChangelogForVersion({
      docsRoot: fixture.docsRoot,
      monorepoRoot: fixture.monorepoRoot,
      repoKey: 'unknown',
      targetVersion: 'v1.0.0',
      sourceRef: 'HEAD',
    }),
    /Unknown repoKey "unknown"/,
  );

  const coreAfter = await readFile(fixture.coreOutputPath, 'utf8');
  assert.equal(coreAfter, coreBefore);
});

test('explicit mode re-running the same target version replaces the existing bucket instead of duplicating it', async (t) => {
  const fixture = await createDocsFixture(t);
  const desktopSource = resolveRepoSource('desktop');
  const desktopOutputPath = path.join(fixture.docsRoot, desktopSource.outputPath);

  await commitFile(
    fixture.desktopRepoDir,
    'release.md',
    'v0.1.0\n',
    '2026-03-01T00:00:00Z',
    'feat: bootstrap release',
  );
  git(fixture.desktopRepoDir, ['tag', 'v0.1.0']);

  await commitFile(
    fixture.desktopRepoDir,
    'release.md',
    'v0.2.0\n',
    '2026-03-02T00:00:00Z',
    'feat: prepare v0.2.0',
  );
  git(fixture.desktopRepoDir, ['tag', 'v0.2.0']);

  await updateRepositoryChangelogForVersion({
    docsRoot: fixture.docsRoot,
    monorepoRoot: fixture.monorepoRoot,
    repoKey: 'desktop',
    targetVersion: 'v0.2.0',
    sourceRef: 'v0.2.0',
    generatedAt: '2026-03-02T01:00:00.000Z',
  });

  await commitFile(
    fixture.desktopRepoDir,
    'release.md',
    'v0.2.0 rerun\n',
    '2026-03-03T00:00:00Z',
    'fix: refresh pending changelog bucket',
  );

  const refreshed = await updateRepositoryChangelogForVersion({
    docsRoot: fixture.docsRoot,
    monorepoRoot: fixture.monorepoRoot,
    repoKey: 'desktop',
    targetVersion: 'v0.2.0',
    sourceRef: 'HEAD',
    generatedAt: '2026-03-03T01:00:00.000Z',
  });

  assert.equal(refreshed.release.previousTag, 'v0.1.0');
  assert.equal(refreshed.release.commitCount, 2);

  const desktopJson = JSON.parse(await readFile(desktopOutputPath, 'utf8'));
  const matchingReleases = desktopJson.releases.filter(
    (release) => normalizeReleaseTagKey(release.tag) === normalizeReleaseTagKey('v0.2.0'),
  );

  assert.equal(matchingReleases.length, 1);
  assert.equal(matchingReleases[0].commitCount, 2);
  assert.deepEqual(
    matchingReleases[0].commits.map((commit) => commit.title),
    ['feat: prepare v0.2.0', 'fix: refresh pending changelog bucket'],
  );
});

test('explicit mode still produces a valid first release bucket when no previous tag exists', async (t) => {
  const fixture = await createDocsFixture(t);

  await commitFile(
    fixture.desktopRepoDir,
    'README.md',
    'first\n',
    '2026-03-01T00:00:00Z',
    'feat: initial commit',
  );
  await commitFile(
    fixture.desktopRepoDir,
    'README.md',
    'first\nsecond\n',
    '2026-03-02T00:00:00Z',
    'docs: first release notes',
  );

  const release = buildExplicitReleaseBucket(
    {
      repoKey: 'desktop',
      repoPath: path.relative(fixture.monorepoRoot, fixture.desktopRepoDir),
      outputPath: 'unused.json',
    },
    {
      monorepoRoot: fixture.monorepoRoot,
      targetVersion: 'v0.1.0',
      sourceRef: 'HEAD',
    },
  );

  assert.equal(release.tag, 'v0.1.0');
  assert.equal(release.previousTag, null);
  assert.equal(release.commitCount, 2);
  assert.deepEqual(
    release.commits.map((commit) => commit.title),
    ['feat: initial commit', 'docs: first release notes'],
  );
});
