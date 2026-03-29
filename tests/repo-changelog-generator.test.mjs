import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildReleaseWindows,
  buildRepositoryChangelog,
  collectTagWindowCommits,
  listRepositoryTags,
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
