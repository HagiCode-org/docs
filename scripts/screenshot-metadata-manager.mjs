import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DOCS_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONTENT_ROOT = path.join(DOCS_ROOT, 'src', 'content', 'docs');
const DEFAULT_INPUT_RELATIVE = 'screenshot-staging';
const DEFAULT_LIBRARY_RELATIVE = path.join('src', 'content', 'docs', 'img', 'screenshots');
const DEFAULT_MANIFEST_RELATIVE = path.join(DEFAULT_LIBRARY_RELATIVE, 'manifest.json');
const DEFAULT_ANALYSIS_CONTEXT_RELATIVE = path.join('prompts', 'screenshot-analysis-context.txt');
const DEFAULT_INSTALLED_IMGBIN_PACKAGE_RELATIVE = path.join('node_modules', '@hagicode', 'imgbin', 'package.json');
const DEFAULT_IMGBIN_RELATIVE = path.join('..', 'imgbin', 'dist', 'cli.js');
const DEFAULT_DOTENV_RELATIVE = '.env';
const DEFAULT_TMP_RELATIVE = '.tmp';
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const LOG_PREFIX = '[screenshots:sync]';

export function parseCliArgs(argv) {
  const options = {
    reindex: false,
    dryRun: false,
    overwrite: true,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--reindex') {
      options.reindex = true;
      continue;
    }
    if (argument === '--no-overwrite') {
      options.overwrite = false;
      continue;
    }

    const nextValue = argv[index + 1];
    if (argument === '--input') {
      options.input = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--library-root') {
      options.libraryRoot = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--manifest') {
      options.manifestPath = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--imgbin') {
      options.imgbinExecutable = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--category') {
      options.category = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--analysis-prompt') {
      options.analysisPromptPath = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--analysis-context-file') {
      options.analysisContextFilePath = requireValue(argument, nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export async function resolveConfig(cliOptions = {}, runtime = {}) {
  const docsRoot = runtime.docsRoot ? path.resolve(runtime.docsRoot) : DOCS_ROOT;
  const envResolution = await resolveRuntimeEnvironment(docsRoot, runtime.env ?? process.env);
  const env = envResolution.env;
  const assumptions = [];

  if (envResolution.loadedEnvPath) {
    assumptions.push(`Loaded defaults from ${toPosixPath(path.relative(docsRoot, envResolution.loadedEnvPath))}`);
  }

  const inputSource = cliOptions.input
    ? { value: cliOptions.input, reason: '--input' }
    : env.SCREENSHOT_STAGING_DIR
      ? { value: env.SCREENSHOT_STAGING_DIR, reason: 'SCREENSHOT_STAGING_DIR' }
      : { value: DEFAULT_INPUT_RELATIVE, reason: 'default screenshot staging directory' };
  if (inputSource.reason === 'default screenshot staging directory') {
    assumptions.push(`Using default staging directory: ${DEFAULT_INPUT_RELATIVE}`);
  }

  const librarySource = cliOptions.libraryRoot
    ? { value: cliOptions.libraryRoot, reason: '--library-root' }
    : env.SCREENSHOT_LIBRARY_ROOT
      ? { value: env.SCREENSHOT_LIBRARY_ROOT, reason: 'SCREENSHOT_LIBRARY_ROOT' }
      : { value: DEFAULT_LIBRARY_RELATIVE, reason: 'default docs screenshot library root' };
  if (librarySource.reason === 'default docs screenshot library root') {
    assumptions.push(`Using default managed screenshot root: ${toPosixPath(DEFAULT_LIBRARY_RELATIVE)}`);
  }

  const manifestSource = cliOptions.manifestPath
    ? { value: cliOptions.manifestPath, reason: '--manifest' }
    : env.SCREENSHOT_MANIFEST_PATH
      ? { value: env.SCREENSHOT_MANIFEST_PATH, reason: 'SCREENSHOT_MANIFEST_PATH' }
      : { value: DEFAULT_MANIFEST_RELATIVE, reason: 'default screenshot manifest path' };
  if (manifestSource.reason === 'default screenshot manifest path') {
    assumptions.push(`Using default manifest path: ${toPosixPath(DEFAULT_MANIFEST_RELATIVE)}`);
  }

  const analysisContextSource = cliOptions.analysisContextFilePath
    ? { value: cliOptions.analysisContextFilePath, reason: '--analysis-context-file' }
    : env.SCREENSHOT_ANALYSIS_CONTEXT_FILE
      ? { value: env.SCREENSHOT_ANALYSIS_CONTEXT_FILE, reason: 'SCREENSHOT_ANALYSIS_CONTEXT_FILE' }
      : { value: DEFAULT_ANALYSIS_CONTEXT_RELATIVE, reason: 'default checked-in analysis context file' };
  const analysisContextFilePath = resolveFromDocsRoot(docsRoot, analysisContextSource.value);
  assumptions.push(
    `Using analysis context file: ${formatDisplayPath(docsRoot, analysisContextFilePath)} (${analysisContextSource.reason})`
  );

  const defaultImgbinSource = await resolveDefaultImgbinSource(docsRoot);
  const imgbinSource = cliOptions.imgbinExecutable
    ? { value: cliOptions.imgbinExecutable, reason: '--imgbin' }
    : env.IMGBIN_EXECUTABLE
      ? { value: env.IMGBIN_EXECUTABLE, reason: 'IMGBIN_EXECUTABLE' }
      : defaultImgbinSource;
  if (imgbinSource.reason === 'default installed docs imgbin package') {
    assumptions.push(`Using installed docs imgbin package: ${toPosixPath(path.relative(docsRoot, path.resolve(imgbinSource.value)))}`);
  } else if (imgbinSource.reason === 'default monorepo imgbin CLI path') {
    assumptions.push(`Using default imgbin executable: ${toPosixPath(path.relative(docsRoot, path.resolve(imgbinSource.value)))}`);
  }

  const tempSource = env.TMPDIR
    ? { value: env.TMPDIR, reason: 'TMPDIR' }
    : env.TMP
      ? { value: env.TMP, reason: 'TMP' }
      : env.TEMP
        ? { value: env.TEMP, reason: 'TEMP' }
        : { value: DEFAULT_TMP_RELATIVE, reason: 'default workspace temp directory' };
  if (tempSource.reason === 'default workspace temp directory') {
    assumptions.push(`Using workspace temp directory: ${DEFAULT_TMP_RELATIVE}`);
  }

  const resolvedTempDir = resolveFromDocsRoot(docsRoot, tempSource.value);
  const config = {
    docsRoot,
    env: {
      ...env,
      TMPDIR: env.TMPDIR ?? resolvedTempDir,
      TMP: env.TMP ?? resolvedTempDir,
      TEMP: env.TEMP ?? resolvedTempDir
    },
    assumptions,
    inputDir: resolveFromDocsRoot(docsRoot, inputSource.value),
    libraryRoot: resolveFromDocsRoot(docsRoot, librarySource.value),
    manifestPath: resolveFromDocsRoot(docsRoot, manifestSource.value),
    analysisContextFilePath,
    analysisContextFileSource: analysisContextSource.reason,
    imgbinExecutable: imgbinSource.value,
    tempDir: resolvedTempDir,
    categoryOverride: cliOptions.category,
    analysisPromptPath: cliOptions.analysisPromptPath
      ? resolveFromDocsRoot(docsRoot, cliOptions.analysisPromptPath)
      : env.SCREENSHOT_ANALYSIS_PROMPT
        ? resolveFromDocsRoot(docsRoot, env.SCREENSHOT_ANALYSIS_PROMPT)
        : undefined,
    dryRun: Boolean(cliOptions.dryRun),
    reindex: Boolean(cliOptions.reindex),
    overwrite: cliOptions.overwrite !== false
  };

  await validateConfig(config);
  return config;
}

export async function scanStagedScreenshots(config) {
  const filePaths = await collectSupportedFiles(config.inputDir);
  const staged = filePaths.map((filePath) => createStagedScreenshot(filePath, config));
  const collisions = new Map();

  for (const entry of staged) {
    const collisionKey = `${entry.category}::${entry.baseSlug}`;
    const current = collisions.get(collisionKey) ?? [];
    current.push(entry);
    collisions.set(collisionKey, current);
  }

  const normalized = [];
  for (const entry of staged.sort((left, right) => left.relativeSourcePath.localeCompare(right.relativeSourcePath))) {
    const collisionKey = `${entry.category}::${entry.baseSlug}`;
    const group = collisions.get(collisionKey) ?? [];
    const slug = group.length > 1 ? `${entry.baseSlug}-${shortHash(entry.relativeSourcePath)}` : entry.baseSlug;
    const targetAssetDir = path.join(config.libraryRoot, ...entry.categorySegments, slug);

    normalized.push({
      ...entry,
      slug,
      targetAssetDir,
      duplicateStrategy: group.length > 1 ? 'hash-relative-path' : 'direct'
    });
  }

  return normalized;
}

export async function buildScreenshotManifest({ docsRoot = DOCS_ROOT, libraryRoot, manifestPath, now = new Date() }) {
  const resolvedDocsRoot = path.resolve(docsRoot);
  const resolvedLibraryRoot = path.resolve(libraryRoot);
  const resolvedManifestPath = path.resolve(manifestPath);
  const metadataPaths = await findMetadataPaths(resolvedLibraryRoot);
  const items = [];

  for (const metadataPath of metadataPaths) {
    const assetDir = path.dirname(metadataPath);
    const raw = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(raw);

    if ((metadata.status?.recognition ?? 'pending') !== 'succeeded') {
      continue;
    }

    const originalFilename = metadata.paths?.original ?? (await detectOriginalFilename(assetDir));
    if (!originalFilename) {
      continue;
    }

    const originalPath = path.join(assetDir, originalFilename);
    const relativeToLibrary = toPosixPath(path.relative(resolvedLibraryRoot, assetDir));
    const pathSegments = relativeToLibrary.split('/').filter(Boolean);
    const slug = pathSegments[pathSegments.length - 1] ?? metadata.slug ?? 'screenshot';
    const categorySegments = pathSegments.slice(0, -1);
    const category = categorySegments.join('/');

    items.push({
      id: category ? `${category}/${slug}` : slug,
      slug,
      category,
      categorySegments,
      title: pickTitle(metadata, slug),
      alt: pickAlt(metadata, slug),
      description: pickDescription(metadata),
      tags: dedupeStrings(metadata.tags ?? metadata.recognized?.tags ?? metadata.generated?.tags ?? []),
      relativeImagePath: toPosixPath(path.relative(path.join(resolvedDocsRoot, 'src', 'content', 'docs'), originalPath)),
      assetDir: toPosixPath(path.relative(resolvedDocsRoot, assetDir)),
      metadataPath: toPosixPath(path.relative(resolvedDocsRoot, metadataPath)),
      originalPath: toPosixPath(path.relative(resolvedDocsRoot, originalPath)),
      updatedAt: metadata.timestamps?.updatedAt ?? metadata.timestamps?.createdAt ?? now.toISOString(),
      analysisStatus: metadata.status?.recognition ?? 'unknown'
    });
  }

  items.sort((left, right) => `${left.category}/${left.slug}`.localeCompare(`${right.category}/${right.slug}`));

  const manifest = {
    generatedAt: now.toISOString(),
    libraryRoot: toPosixPath(path.relative(resolvedDocsRoot, resolvedLibraryRoot)),
    items
  };

  await fs.mkdir(path.dirname(resolvedManifestPath), { recursive: true });
  await fs.writeFile(resolvedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export async function runScreenshotMetadataManager(cliOptions = {}, runtime = {}) {
  const syncStartedAt = Date.now();
  const config = await resolveConfig(cliOptions, runtime);
  const logger = createWriter(runtime.stderr, process.stderr);
  logSync(logger, 'starting sync');
  logSync(logger, `input: ${formatDisplayPath(config.docsRoot, config.inputDir)}`);
  logSync(logger, `library: ${formatDisplayPath(config.docsRoot, config.libraryRoot)}`);
  logSync(logger, `manifest: ${formatDisplayPath(config.docsRoot, config.manifestPath)}`);
  logSync(logger, `imgbin: ${formatDisplayPath(config.docsRoot, resolveFromDocsRoot(config.docsRoot, config.imgbinExecutable))}`);
  logSync(logger, `temp: ${formatDisplayPath(config.docsRoot, config.tempDir)}`);
  logSync(
    logger,
    `analysis context: ${formatDisplayPath(config.docsRoot, config.analysisContextFilePath)} (${config.analysisContextFileSource})`
  );
  const entries = await scanStagedScreenshots(config);
  logSync(logger, `discovered ${entries.length} supported screenshot${entries.length === 1 ? '' : 's'}`);
  const results = [];

  for (const [index, entry] of entries.entries()) {
    const entryStartedAt = Date.now();
    try {
      const result = await processScreenshotEntry(entry, config, {
        logger,
        index: index + 1,
        total: entries.length,
        startedAt: entryStartedAt,
        syncStartedAt
      });
      results.push(result);
    } catch (error) {
      const progress = formatProgress(index + 1, entries.length);
      logSync(
        logger,
        `${progress} failed ${entry.relativeSourcePath}: ${error instanceof Error ? error.message : String(error)} ` +
          `(file ${formatDuration(Date.now() - entryStartedAt)}, cumulative ${formatDuration(Date.now() - syncStartedAt)})`
      );
      results.push({
        sourcePath: entry.relativeSourcePath,
        category: entry.category,
        slug: entry.slug,
        success: false,
        action: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const manifest = await buildScreenshotManifest({
    docsRoot: config.docsRoot,
    libraryRoot: config.libraryRoot,
    manifestPath: config.manifestPath,
    now: runtime.now ?? new Date()
  });

  let reindexResult;
  const shouldReindexFinalLibrary = !config.dryRun && (config.reindex || results.some((result) => result.success));
  if (shouldReindexFinalLibrary) {
    logSync(logger, 'rebuilding ImgBin search index for the managed library');
    reindexResult = await runImgbinCommand(
      config,
      ['search', '--library', config.libraryRoot, '--query', 'docs-screenshot-sync', '--reindex', '--json'],
      { logger, progress: '[index]', label: 'search reindex' }
    );
  }

  const failed = results.filter((result) => !result.success);
  logSync(
    logger,
    `completed: ${results.length - failed.length} succeeded, ${failed.length} failed in ${formatDuration(Date.now() - syncStartedAt)}`
  );
  return {
    config,
    entries,
    results,
    manifest,
    failedCount: failed.length,
    successCount: results.length - failed.length,
    exitCode: failed.length > 0 ? 1 : 0,
    reindexResult
  };
}

export function formatRunSummary(run) {
  const lines = [];

  lines.push(`Scanned ${run.entries.length} staged screenshot${run.entries.length === 1 ? '' : 's'}.`);
  if (run.config.assumptions.length > 0) {
    lines.push('Assumptions:');
    for (const assumption of run.config.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  if (run.results.length === 0) {
    lines.push('No supported screenshots were found.');
  } else {
    lines.push('Per-file results:');
    for (const result of run.results) {
      const prefix = result.success ? '✓' : '✗';
      const detail = result.success
        ? `${result.action} -> ${toPosixPath(path.relative(run.config.docsRoot, result.assetDir))}`
        : result.error;
      lines.push(`- ${prefix} ${result.sourcePath} [${result.category || 'shared'}/${result.slug}]: ${detail}`);
    }
  }

  lines.push(`Manifest entries: ${run.manifest.items.length}`);
  if (run.failedCount > 0) {
    lines.push(`Completed with ${run.failedCount} failure(s).`);
  } else {
    lines.push('Completed without failures.');
  }

  return lines.join('\n');
}

export function printHelp() {
  console.log(`Usage: node ./scripts/screenshot-metadata-manager.mjs [options]\n\nOptions:\n  --input <dir>                 Screenshot staging directory (default: ${DEFAULT_INPUT_RELATIVE})\n  --library-root <dir>          Managed screenshot root (default: ${toPosixPath(DEFAULT_LIBRARY_RELATIVE)})\n  --manifest <path>             Manifest output path (default: ${toPosixPath(DEFAULT_MANIFEST_RELATIVE)})\n  --imgbin <path>               ImgBin executable or CLI entrypoint\n  --category <name>             Force all staged screenshots into one category\n  --analysis-context-file <path> ImgBin analysis context file (env: SCREENSHOT_ANALYSIS_CONTEXT_FILE, default: ${toPosixPath(DEFAULT_ANALYSIS_CONTEXT_RELATIVE)})\n  --analysis-prompt <path>      Custom ImgBin analysis prompt\n  --dry-run                     Preview staging decisions without importing files\n  --reindex                     Rebuild the ImgBin search index after import\n  --no-overwrite                Keep previous recognition fields when refreshing existing assets\n  -h, --help                    Show this help message`);
}

async function processScreenshotEntry(entry, config, context = {}) {
  const logger = context.logger;
  const progress = formatProgress(context.index, context.total);
  const entryStartedAt = context.startedAt ?? Date.now();
  const syncStartedAt = context.syncStartedAt ?? entryStartedAt;
  const targetExists = await pathExists(entry.targetAssetDir);
  const managedMetadataPath = path.join(entry.targetAssetDir, 'metadata.json');
  const targetDisplayPath = formatDisplayPath(config.docsRoot, entry.targetAssetDir);
  logSync(logger, `${progress} processing ${entry.relativeSourcePath}`);

  if (config.dryRun) {
    logSync(logger, `${progress} dry-run ${targetExists ? 'refresh' : 'import'} -> ${targetDisplayPath}`);
    return {
      sourcePath: entry.relativeSourcePath,
      category: entry.category,
      slug: entry.slug,
      success: true,
      action: targetExists ? 'would-refresh-existing' : 'would-import',
      assetDir: entry.targetAssetDir
    };
  }

  if (targetExists) {
    logSync(logger, `${progress} refreshing existing asset ${targetDisplayPath}`);
    if (!(await pathExists(managedMetadataPath))) {
      throw new Error(`Managed asset path already exists without metadata: ${toPosixPath(path.relative(config.docsRoot, entry.targetAssetDir))}`);
    }

    await refreshOriginalAsset(entry, config);
    await runImgbinCommand(config, buildAnnotateArgs(entry.targetAssetDir, config, { overwrite: config.overwrite }), {
      logger,
      progress,
      label: 'annotate refresh'
    });
    await decorateManagedMetadata(entry.targetAssetDir, entry, config);
    await removeStagedSource(entry, config);
    logSync(
      logger,
      `${progress} refreshed -> ${targetDisplayPath} ` +
        `(file ${formatDuration(Date.now() - entryStartedAt)}, cumulative ${formatDuration(Date.now() - syncStartedAt)})`
    );

    return {
      sourcePath: entry.relativeSourcePath,
      category: entry.category,
      slug: entry.slug,
      success: true,
      action: 'refreshed-existing',
      assetDir: entry.targetAssetDir
    };
  }

  const tempRoot = await fs.mkdtemp(path.join(config.tempDir, 'docs-screenshot-import-'));
  try {
    logSync(logger, `${progress} importing into temporary workspace ${formatDisplayPath(config.docsRoot, tempRoot)}`);
    await runImgbinCommand(config, buildAnnotateArgs(entry.sourcePath, config, {
      importTo: tempRoot,
      slug: entry.slug,
      title: titleFromSlug(entry.slug)
    }), {
      logger,
      progress,
      label: 'annotate import'
    });

    const importedAssetDir = await findSingleManagedAssetDir(tempRoot);
    await fs.mkdir(path.dirname(entry.targetAssetDir), { recursive: true });
    await fs.rename(importedAssetDir, entry.targetAssetDir);
    await decorateManagedMetadata(entry.targetAssetDir, entry, config);
    await removeStagedSource(entry, config);
    logSync(
      logger,
      `${progress} imported -> ${targetDisplayPath} ` +
        `(file ${formatDuration(Date.now() - entryStartedAt)}, cumulative ${formatDuration(Date.now() - syncStartedAt)})`
    );

    return {
      sourcePath: entry.relativeSourcePath,
      category: entry.category,
      slug: entry.slug,
      success: true,
      action: 'imported',
      assetDir: entry.targetAssetDir
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function buildAnnotateArgs(assetPath, config, options = {}) {
  const args = ['annotate', assetPath];

  if (options.importTo) {
    args.push('--import-to', options.importTo);
  }
  if (options.slug) {
    args.push('--slug', options.slug);
  }
  if (options.title) {
    args.push('--title', options.title);
  }
  if (config.analysisContextFilePath) {
    args.push('--analysis-context-file', config.analysisContextFilePath);
  }
  if (config.analysisPromptPath) {
    args.push('--analysis-prompt', config.analysisPromptPath);
  }
  if (options.overwrite) {
    args.push('--overwrite');
  }

  return args;
}

async function runImgbinCommand(config, subcommandArgs, context = {}) {
  const invocation = await resolveImgbinInvocation(config.imgbinExecutable, config.docsRoot);
  const command = invocation.command;
  const args = [...invocation.args, ...subcommandArgs];
  const logger = context.logger;
  const progress = context.progress ? `${context.progress} ` : '';
  const label = context.label ?? subcommandArgs[0] ?? 'imgbin';
  logSync(logger, `${progress}invoking imgbin ${label}`);
  const commandStartedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: config.docsRoot,
      env: config.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let stdoutRemainder = '';
    let stderrRemainder = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      stdoutRemainder = relayChildLines(logger, `${progress}imgbin`, text, stdoutRemainder);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      stderrRemainder = relayChildLines(logger, `${progress}imgbin stderr`, text, stderrRemainder);
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      flushChildRemainder(logger, `${progress}imgbin`, stdoutRemainder);
      flushChildRemainder(logger, `${progress}imgbin stderr`, stderrRemainder);
      if (code === 0) {
        logSync(logger, `${progress}imgbin ${label} completed in ${formatDuration(Date.now() - commandStartedAt)}`);
        resolve({ code, stdout, stderr });
        return;
      }

      const output = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
      logSync(
        logger,
        `${progress}imgbin ${label} failed with exit code ${code} in ${formatDuration(Date.now() - commandStartedAt)}`
      );
      reject(new Error(output || `ImgBin command failed with exit code ${code}`));
    });
  });
}

async function resolveImgbinInvocation(imgbinExecutable, docsRoot) {
  if (!imgbinExecutable) {
    throw new Error('ImgBin executable is required. Set IMGBIN_EXECUTABLE or pass --imgbin.');
  }

  const resolvedCandidate = resolveFromDocsRoot(docsRoot, imgbinExecutable);
  if (resolvedCandidate.endsWith('.js') || resolvedCandidate.endsWith('.mjs') || resolvedCandidate.endsWith('.cjs')) {
    return {
      command: process.execPath,
      args: [resolvedCandidate]
    };
  }

  if (resolvedCandidate !== imgbinExecutable) {
    return {
      command: resolvedCandidate,
      args: []
    };
  }

  return {
    command: imgbinExecutable,
    args: []
  };
}

async function decorateManagedMetadata(assetDir, entry, config) {
  const metadataPath = path.join(assetDir, 'metadata.json');
  const raw = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(raw);
  const originalFilename = metadata.paths?.original ?? (await detectOriginalFilename(assetDir));
  const next = {
    ...metadata,
    slug: entry.slug,
    title: pickTitle(metadata, entry.slug),
    description: pickDescription(metadata),
    tags: dedupeStrings(metadata.tags ?? metadata.recognized?.tags ?? metadata.generated?.tags ?? []),
    paths: {
      ...metadata.paths,
      assetDir,
      original: originalFilename
    },
    source: {
      ...metadata.source,
      originalPath: entry.sourcePath
    },
    extra: {
      ...metadata.extra,
      docsScreenshot: {
        category: entry.category,
        categorySegments: entry.categorySegments,
        relativeSourcePath: entry.relativeSourcePath,
        duplicateStrategy: entry.duplicateStrategy
      }
    },
    timestamps: {
      ...metadata.timestamps,
      updatedAt: new Date().toISOString()
    }
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function refreshOriginalAsset(entry, config) {
  const metadataPath = path.join(entry.targetAssetDir, 'metadata.json');
  const raw = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(raw);
  const extension = path.extname(entry.sourcePath).slice(1).toLowerCase();
  const nextOriginalFilename = `original.${extension}`;

  const files = await fs.readdir(entry.targetAssetDir);
  await Promise.all(files
    .filter((filename) => /^original\./.test(filename) && filename !== nextOriginalFilename)
    .map((filename) => fs.rm(path.join(entry.targetAssetDir, filename), { force: true })));
  await fs.copyFile(entry.sourcePath, path.join(entry.targetAssetDir, nextOriginalFilename));

  const nextMetadata = {
    ...metadata,
    paths: {
      ...metadata.paths,
      assetDir: entry.targetAssetDir,
      original: nextOriginalFilename
    },
    source: {
      ...metadata.source,
      originalPath: entry.sourcePath
    },
    timestamps: {
      ...metadata.timestamps,
      updatedAt: new Date().toISOString()
    }
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(nextMetadata, null, 2)}\n`, 'utf8');
}

async function removeStagedSource(entry, config) {
  await fs.rm(entry.sourcePath, { force: true });
  await pruneEmptyDirectories(path.dirname(entry.sourcePath), config.inputDir);
}

async function pruneEmptyDirectories(startDir, stopDir) {
  let currentDir = startDir;
  const resolvedStopDir = path.resolve(stopDir);

  while (currentDir.startsWith(resolvedStopDir) && currentDir !== resolvedStopDir) {
    const entries = await fs.readdir(currentDir);
    if (entries.length > 0) {
      return;
    }

    await fs.rmdir(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

async function validateConfig(config) {
  const inputStats = await safeStat(config.inputDir);
  if (!inputStats?.isDirectory()) {
    throw new Error(`Screenshot staging directory not found: ${toPosixPath(path.relative(config.docsRoot, config.inputDir))}`);
  }

  await fs.mkdir(config.libraryRoot, { recursive: true });
  await fs.mkdir(path.dirname(config.manifestPath), { recursive: true });
  await fs.mkdir(config.tempDir, { recursive: true });

  const analysisContextStats = await safeStat(config.analysisContextFilePath);
  if (!analysisContextStats?.isFile()) {
    throw new Error(`Analysis context file not found: ${formatDisplayPath(config.docsRoot, config.analysisContextFilePath)}`);
  }

  const analysisContextContent = await fs.readFile(config.analysisContextFilePath, 'utf8');
  if (!analysisContextContent.trim()) {
    throw new Error(`Analysis context file is empty: ${formatDisplayPath(config.docsRoot, config.analysisContextFilePath)}`);
  }

  if (config.analysisPromptPath && !(await pathExists(config.analysisPromptPath))) {
    throw new Error(`Analysis prompt path not found: ${toPosixPath(path.relative(config.docsRoot, config.analysisPromptPath))}`);
  }

  const executableCandidate = resolveFromDocsRoot(config.docsRoot, config.imgbinExecutable);
  if (executableCandidate.includes(path.sep) && !(await pathExists(executableCandidate))) {
    throw new Error(`ImgBin executable not found: ${toPosixPath(path.relative(config.docsRoot, executableCandidate))}`);
  }
}

async function collectSupportedFiles(rootDir) {
  const results = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(extension)) {
        results.push(absolutePath);
      }
    }
  }

  return results;
}

function createStagedScreenshot(sourcePath, config) {
  const relativeSourcePath = toPosixPath(path.relative(config.inputDir, sourcePath));
  const parsed = path.parse(relativeSourcePath);
  const rawCategorySegments = config.categoryOverride
    ? [config.categoryOverride]
    : parsed.dir
      ? parsed.dir.split('/').filter(Boolean)
      : [];
  const categorySegments = rawCategorySegments.length > 0
    ? rawCategorySegments.map((segment) => normalizePathSegment(segment, 'shared'))
    : ['shared'];
  const category = categorySegments.join('/');
  const baseSlug = normalizePathSegment(parsed.name, 'screenshot');

  return {
    sourcePath,
    relativeSourcePath,
    category,
    categorySegments,
    baseSlug
  };
}

async function findSingleManagedAssetDir(rootDir) {
  const metadataPaths = await findMetadataPaths(rootDir);
  if (metadataPaths.length !== 1) {
    throw new Error(`Expected one imported asset under ${rootDir}, found ${metadataPaths.length}.`);
  }

  return path.dirname(metadataPaths[0]);
}

async function findMetadataPaths(rootDir) {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const metadataPaths = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name === 'metadata.json') {
        metadataPaths.push(absolutePath);
      }
    }
  }

  return metadataPaths.sort((left, right) => left.localeCompare(right));
}

async function detectOriginalFilename(assetDir) {
  const filenames = await fs.readdir(assetDir);
  const originalFilename = filenames.find((filename) => /^original\./.test(filename));
  return originalFilename;
}

function pickTitle(metadata, slug) {
  return metadata.manual?.title
    ?? metadata.title
    ?? metadata.recognized?.title
    ?? metadata.generated?.title
    ?? titleFromSlug(slug);
}

function pickAlt(metadata, slug) {
  return metadata.manual?.alt
    ?? metadata.manual?.description
    ?? metadata.description
    ?? metadata.recognized?.description
    ?? metadata.generated?.description
    ?? pickTitle(metadata, slug);
}

function pickDescription(metadata) {
  return metadata.manual?.description
    ?? metadata.description
    ?? metadata.recognized?.description
    ?? metadata.generated?.description
    ?? '';
}

function normalizePathSegment(value, fallbackPrefix) {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (ascii) {
    return ascii;
  }

  return `${fallbackPrefix}-${shortHash(value)}`;
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function dedupeStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

function shortHash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);
}

function resolveFromDocsRoot(docsRoot, candidate) {
  if (!candidate) {
    return candidate;
  }
  return path.isAbsolute(candidate) ? candidate : path.resolve(docsRoot, candidate);
}

function formatDisplayPath(docsRoot, targetPath) {
  const relativePath = path.relative(docsRoot, targetPath);
  if (!relativePath) {
    return './';
  }

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return toPosixPath(targetPath);
  }

  return `./${toPosixPath(relativePath)}`;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function formatProgress(index, total) {
  if (!index || !total) {
    return '[?/?]';
  }

  return `[${index}/${total}]`;
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function requireValue(flag, value) {
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function createWriter(writer, fallback) {
  const target = writer ?? fallback;
  return {
    write(chunk) {
      if (typeof target === 'function') {
        target(chunk);
        return;
      }

      target.write(chunk);
    }
  };
}

function logSync(writer, message) {
  if (!writer) {
    return;
  }

  writer.write(`${LOG_PREFIX} ${message}\n`);
}

function relayChildLines(writer, label, chunk, remainder) {
  if (!writer) {
    return `${remainder}${chunk}`;
  }

  const combined = `${remainder}${chunk}`;
  const lines = combined.split(/\r?\n/);
  const nextRemainder = lines.pop() ?? '';

  for (const line of lines) {
    if (line.trim()) {
      logSync(writer, `${label}: ${line}`);
    }
  }

  return nextRemainder;
}

function flushChildRemainder(writer, label, remainder) {
  if (writer && remainder.trim()) {
    logSync(writer, `${label}: ${remainder}`);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return undefined;
  }
}

async function resolveDefaultImgbinSource(docsRoot) {
  const installedPackagePath = path.join(docsRoot, DEFAULT_INSTALLED_IMGBIN_PACKAGE_RELATIVE);
  if (await pathExists(installedPackagePath)) {
    const packageRaw = await fs.readFile(installedPackagePath, 'utf8');
    const packageJson = JSON.parse(packageRaw);
    const binValue = typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.imgbin;

    if (binValue) {
      return {
        value: path.resolve(path.dirname(installedPackagePath), binValue),
        reason: 'default installed docs imgbin package'
      };
    }
  }

  return {
    value: path.join(docsRoot, DEFAULT_IMGBIN_RELATIVE),
    reason: 'default monorepo imgbin CLI path'
  };
}

async function resolveRuntimeEnvironment(docsRoot, baseEnv) {
  const envPath = path.join(docsRoot, DEFAULT_DOTENV_RELATIVE);
  const dotenvValues = await loadDotEnvFile(envPath);
  const env = {
    ...dotenvValues,
    ...baseEnv
  };

  return {
    env,
    loadedEnvPath: Object.keys(dotenvValues).length > 0 ? envPath : null
  };
}

async function loadDotEnvFile(envPath) {
  let raw;
  try {
    raw = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }

  return parseDotEnv(raw);
}

function parseDotEnv(raw) {
  const values = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

async function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exitCode = 0;
      return;
    }

    const run = await runScreenshotMetadataManager(options);
    console.log(formatRunSummary(run));
    process.exitCode = run.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
