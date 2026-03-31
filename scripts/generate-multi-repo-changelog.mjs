import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function parseGitLogOutput(output) {
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

function normalizeSource(source) {
  if (!source || typeof source !== 'object') {
    throw new Error('A repository source is required.');
  }

  if (!source.repoKey || !source.repoPath || !source.outputPath) {
    throw new Error('Repository source must include repoKey, repoPath, and outputPath.');
  }

  return source;
}

function resolveRepoDir(monorepoRoot, source) {
  return path.resolve(monorepoRoot, normalizeSource(source).repoPath);
}

export function resolveRepoSource(repoKey) {
  const source = REPO_SOURCES.find((entry) => entry.repoKey === repoKey);
  if (!source) {
    throw new Error(
      `Unknown repoKey "${repoKey}". Expected one of: ${REPO_SOURCES.map((entry) => entry.repoKey).join(', ')}.`,
    );
  }

  return source;
}

export function normalizeReleaseTagKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^v+/, '');
}

export function listRepositoryTags(repoDir, options = {}) {
  const args = [
    'for-each-ref',
    'refs/tags',
    '--sort=creatordate',
    '--format=%(refname:short)%09%(creatordate:iso-strict)',
  ];

  if (options.mergedRef) {
    args.splice(2, 0, '--merged', options.mergedRef);
  }

  const output = runGit(repoDir, args).trim();

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

  return parseGitLogOutput(output);
}

export function collectCommitsUpToRef(repoDir, sourceRef) {
  const output = runGit(repoDir, [
    'log',
    '--reverse',
    `--format=%H%x00%s%x00%b%x00%cI%x00`,
    sourceRef,
  ]);

  return parseGitLogOutput(output);
}

export function getRefCommitDate(repoDir, ref) {
  return runGit(repoDir, ['log', '-1', '--format=%cI', ref]).trim();
}

export function resolveExplicitPreviousTag(repoDir, targetVersion, sourceRef, explicitPreviousTag = null) {
  if (explicitPreviousTag) {
    return explicitPreviousTag;
  }

  const mergedTags = listRepositoryTags(repoDir, { mergedRef: sourceRef });
  if (mergedTags.length === 0) {
    return null;
  }

  const targetKey = normalizeReleaseTagKey(targetVersion);
  const targetIndex = mergedTags.findIndex((tag) => normalizeReleaseTagKey(tag.name) === targetKey);

  if (targetIndex > 0) {
    return mergedTags[targetIndex - 1].name;
  }

  if (targetIndex === 0) {
    return null;
  }

  return mergedTags.at(-1)?.name ?? null;
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

export function normalizeExplicitRelease({ targetVersion, previousTag, tagDate }, commits) {
  return {
    tag: targetVersion,
    previousTag,
    tagDate,
    commitCount: commits.length,
    commits,
  };
}

export function buildRepositoryChangelog(source, options = {}) {
  const monorepoRoot = options.monorepoRoot ?? DEFAULT_MONOREPO_ROOT;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const repoDir = resolveRepoDir(monorepoRoot, source);
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

export function buildExplicitReleaseBucket(source, options = {}) {
  const monorepoRoot = options.monorepoRoot ?? DEFAULT_MONOREPO_ROOT;
  const repoDir = resolveRepoDir(monorepoRoot, source);
  const targetVersion = options.targetVersion?.trim();
  const sourceRef = options.sourceRef?.trim();

  if (!targetVersion) {
    throw new Error('Explicit changelog generation requires targetVersion.');
  }

  if (!sourceRef) {
    throw new Error('Explicit changelog generation requires sourceRef.');
  }

  const tags = listRepositoryTags(repoDir, { mergedRef: sourceRef });
  const matchingTargetTag =
    tags.find((tag) => normalizeReleaseTagKey(tag.name) === normalizeReleaseTagKey(targetVersion)) ?? null;
  const previousTag = resolveExplicitPreviousTag(
    repoDir,
    targetVersion,
    sourceRef,
    options.previousTag ?? null,
  );
  const commits = previousTag
    ? collectTagWindowCommits(repoDir, previousTag, sourceRef)
    : collectCommitsUpToRef(repoDir, sourceRef);
  const tagDate = matchingTargetTag?.createdAt ?? getRefCommitDate(repoDir, sourceRef);

  return normalizeExplicitRelease(
    {
      targetVersion,
      previousTag,
      tagDate,
    },
    commits,
  );
}

export function mergeReleaseBucket(existingReleases, nextRelease) {
  const targetKey = normalizeReleaseTagKey(nextRelease.tag);
  const remainingReleases = (existingReleases ?? []).filter(
    (release) => normalizeReleaseTagKey(release.tag) !== targetKey,
  );

  return [...remainingReleases, nextRelease].sort((left, right) => {
    const rightTime = Date.parse(right.tagDate ?? '');
    const leftTime = Date.parse(left.tagDate ?? '');

    if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return normalizeReleaseTagKey(right.tag).localeCompare(normalizeReleaseTagKey(left.tag));
  });
}

export async function readRepositoryChangelogJson(docsRoot, source) {
  const outputPath = path.resolve(docsRoot, source.outputPath);

  try {
    const content = await readFile(outputPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeRepositoryChangelogJson(docsRoot, source, changelog) {
  const outputPath = path.resolve(docsRoot, source.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8');
  return outputPath;
}

export async function updateRepositoryChangelogForVersion(options = {}) {
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;
  const monorepoRoot = options.monorepoRoot ?? path.resolve(docsRoot, '..', '..');
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const source = resolveRepoSource(options.repoKey);
  const existing = (await readRepositoryChangelogJson(docsRoot, source)) ?? {
    repoKey: source.repoKey,
    repoPath: source.repoPath,
    generatedAt,
    releases: [],
  };
  const release = buildExplicitReleaseBucket(source, {
    monorepoRoot,
    targetVersion: options.targetVersion,
    sourceRef: options.sourceRef,
    previousTag: options.previousTag ?? null,
  });
  const changelog = {
    repoKey: source.repoKey,
    repoPath: source.repoPath,
    generatedAt,
    releases: mergeReleaseBucket(existing.releases, release),
  };
  const outputPath = await writeRepositoryChangelogJson(docsRoot, source, changelog);

  return {
    repoKey: source.repoKey,
    repoPath: source.repoPath,
    outputPath,
    generatedAt,
    release,
    releaseCount: changelog.releases.length,
    commitCount: changelog.releases.reduce((total, bucket) => total + bucket.commitCount, 0),
  };
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

export function parseCliArgs(argv) {
  const args = {
    docsRoot: undefined,
    monorepoRoot: undefined,
    repoKey: undefined,
    targetVersion: undefined,
    sourceRef: undefined,
    previousTag: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    switch (token) {
      case '--docs-root':
        args.docsRoot = nextValue;
        index += 1;
        break;
      case '--monorepo-root':
        args.monorepoRoot = nextValue;
        index += 1;
        break;
      case '--repo-key':
        args.repoKey = nextValue;
        index += 1;
        break;
      case '--target-version':
        args.targetVersion = nextValue;
        index += 1;
        break;
      case '--source-ref':
        args.sourceRef = nextValue;
        index += 1;
        break;
      case '--previous-tag':
        args.previousTag = nextValue;
        index += 1;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/generate-multi-repo-changelog.mjs
  node scripts/generate-multi-repo-changelog.mjs --repo-key <repoKey> --target-version <version> --source-ref <ref> [--previous-tag <tag>] [--docs-root <path>] [--monorepo-root <path>]`);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (args.repoKey || args.targetVersion || args.sourceRef || args.previousTag) {
    if (!args.repoKey || !args.targetVersion || !args.sourceRef) {
      throw new Error(
        'Explicit mode requires --repo-key, --target-version, and --source-ref. --previous-tag is optional.',
      );
    }

    const result = await updateRepositoryChangelogForVersion(args);
    console.log(JSON.stringify({ status: 'ok', mode: 'explicit', result }, null, 2));
    return;
  }

  const results = await generateAllChangelogData(args);
  console.log(JSON.stringify({ status: 'ok', mode: 'all', results }, null, 2));
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
