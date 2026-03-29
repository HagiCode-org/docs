import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DOCS_ROOT = path.resolve(scriptDir, '..');
const DEFAULT_MONOREPO_ROOT = path.resolve(DEFAULT_DOCS_ROOT, '..', '..');

export const REPO_SOURCES = [
  {
    repoKey: 'core',
    repoPath: 'repos/hagicode-core',
    outputPath: 'src/data/changelog/core.json',
  },
  {
    repoKey: 'web',
    repoPath: 'repos/web',
    outputPath: 'src/data/changelog/web.json',
  },
  {
    repoKey: 'desktop',
    repoPath: 'repos/hagicode-desktop',
    outputPath: 'src/data/changelog/desktop.json',
  },
];

function runGit(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function stripLeadingNewlines(value) {
  return value.replace(/^\n+/, '');
}

export function listRepositoryTags(repoDir) {
  const output = runGit(repoDir, [
    'for-each-ref',
    'refs/tags',
    '--sort=creatordate',
    '--format=%(refname:short)%09%(creatordate:iso-strict)',
  ]).trim();

  if (output.length === 0) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => {
      const [name, createdAt] = line.split('\t');
      return {
        name,
        createdAt,
      };
    })
    .filter((tag) => tag.name && tag.createdAt);
}

export function buildReleaseWindows(tags) {
  if (tags.length < 2) {
    return [];
  }

  const windows = [];

  for (let index = 1; index < tags.length; index += 1) {
    windows.push({
      previousTag: tags[index - 1],
      currentTag: tags[index],
    });
  }

  return windows;
}

export function collectTagWindowCommits(repoDir, previousTag, currentTag) {
  const range = `${previousTag}..${currentTag}`;
  const output = runGit(repoDir, [
    'log',
    '--reverse',
    `--format=%H%x00%s%x00%b%x00%cI%x00`,
    range,
  ]);

  if (output.length === 0) {
    return [];
  }

  const fields = output.split('\u0000');
  if (fields.at(-1) === '') {
    fields.pop();
  }

  const commits = [];
  for (let index = 0; index < fields.length; index += 4) {
    const [hash = '', title = '', detail = '', committedAt = ''] = fields.slice(index, index + 4);
    const normalizedHash = stripLeadingNewlines(hash);
    const normalizedTitle = stripLeadingNewlines(title);
    const normalizedCommittedAt = stripLeadingNewlines(committedAt);

    if (!normalizedHash || !normalizedCommittedAt) {
      continue;
    }

    commits.push({
      hash: normalizedHash,
      title: normalizedTitle,
      detail: detail.trim(),
      committedAt: normalizedCommittedAt,
    });
  }

  return commits;
}

export function normalizeRelease(window, commits) {
  return {
    tag: window.currentTag.name,
    previousTag: window.previousTag.name,
    tagDate: window.currentTag.createdAt,
    commitCount: commits.length,
    commits,
  };
}

export function buildRepositoryChangelog(source, options = {}) {
  const monorepoRoot = options.monorepoRoot ?? DEFAULT_MONOREPO_ROOT;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const repoDir = path.resolve(monorepoRoot, source.repoPath);
  const tags = listRepositoryTags(repoDir);
  const releases = buildReleaseWindows(tags)
    .map((window) =>
      normalizeRelease(
        window,
        collectTagWindowCommits(repoDir, window.previousTag.name, window.currentTag.name),
      ),
    )
    .reverse();

  return {
    repoKey: source.repoKey,
    repoPath: source.repoPath,
    generatedAt,
    releases,
  };
}

export async function writeRepositoryChangelogJson(docsRoot, source, changelog) {
  const outputPath = path.resolve(docsRoot, source.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8');
  return outputPath;
}

export async function generateAllChangelogData(options = {}) {
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;
  const monorepoRoot = options.monorepoRoot ?? path.resolve(docsRoot, '..', '..');
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const results = [];

  for (const source of REPO_SOURCES) {
    const changelog = buildRepositoryChangelog(source, { monorepoRoot, generatedAt });
    const outputPath = await writeRepositoryChangelogJson(docsRoot, source, changelog);
    results.push({
      repoKey: source.repoKey,
      repoPath: source.repoPath,
      outputPath,
      releaseCount: changelog.releases.length,
      commitCount: changelog.releases.reduce((total, release) => total + release.commitCount, 0),
    });
  }

  return results;
}

async function main() {
  const results = await generateAllChangelogData();
  console.log(JSON.stringify({ status: 'ok', results }, null, 2));
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
