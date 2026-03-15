import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

import sharp from 'sharp';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DOCS_ROOT = path.resolve(SCRIPT_DIR, '..');
const LOG_PREFIX = '[screenshots:scan-metadata]';

export const DEFAULT_INPUT_RELATIVE = 'screenshot-staging';
export const SUPPORTED_SCREENSHOT_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp']);

const SUPPORTED_EXTENSION_SET = new Set(SUPPORTED_SCREENSHOT_EXTENSIONS);
const MIME_TYPES_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]);

export function parseCliArgs(argv) {
  const options = {
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (argument === '--input') {
      options.input = requireValue(argument, nextValue);
      index += 1;
      continue;
    }
    if (argument === '--output') {
      options.output = requireValue(argument, nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export async function resolveConfig(cliOptions = {}, runtime = {}) {
  const docsRoot = runtime.docsRoot ? path.resolve(runtime.docsRoot) : DOCS_ROOT;
  const assumptions = [];
  const inputSource = cliOptions.input
    ? { value: cliOptions.input, reason: '--input' }
    : { value: DEFAULT_INPUT_RELATIVE, reason: 'default screenshot staging directory' };

  if (inputSource.reason === 'default screenshot staging directory') {
    assumptions.push(`Using default staging directory: ${DEFAULT_INPUT_RELATIVE}`);
  }

  const inputDir = resolveFromDocsRoot(docsRoot, inputSource.value);
  const outputPath = cliOptions.output ? resolveFromDocsRoot(docsRoot, cliOptions.output) : undefined;

  await ensureDirectoryExists(inputDir, 'input directory');

  return {
    docsRoot,
    assumptions,
    inputDir,
    outputPath,
    inputDisplayPath: formatDisplayPath(docsRoot, inputDir),
    outputDisplayPath: outputPath ? formatDisplayPath(docsRoot, outputPath) : null
  };
}

export async function collectSupportedScreenshotFiles(rootDir) {
  const discovered = [];
  await walkDirectory(rootDir, discovered);

  return discovered.sort((left, right) =>
    compareStrings(toPosixPath(path.relative(rootDir, left)), toPosixPath(path.relative(rootDir, right)))
  );
}

export async function readScreenshotMetadata(filePath, inputDir) {
  const relativePath = toPosixPath(path.relative(inputDir, filePath));
  const extension = path.extname(filePath).toLowerCase();
  const stats = await fs.stat(filePath);
  const metadata = await sharp(filePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine image dimensions for ${relativePath}`);
  }

  return {
    relativePath,
    fileName: path.basename(filePath),
    extension,
    mimeType: MIME_TYPES_BY_EXTENSION.get(extension) ?? 'application/octet-stream',
    sizeBytes: stats.size,
    createdAt: toIsoTimestampOrNull(stats.birthtimeMs),
    modifiedAt: toIsoTimestampOrNull(stats.mtimeMs),
    width: metadata.width,
    height: metadata.height
  };
}

export function buildScanReport({ config, entries, failures, now = new Date() }) {
  return {
    summary: {
      generatedAt: now.toISOString(),
      inputDirectory: relativeToDocsRoot(config.docsRoot, config.inputDir),
      outputPath: config.outputPath ? relativeToDocsRoot(config.docsRoot, config.outputPath) : null,
      supportedExtensions: [...SUPPORTED_SCREENSHOT_EXTENSIONS],
      scannedFileCount: entries.length + failures.length,
      successCount: entries.length,
      failureCount: failures.length
    },
    entries,
    failures
  };
}

export async function runScreenshotMetadataScanner(cliOptions = {}, runtime = {}) {
  const config = await resolveConfig(cliOptions, runtime);
  const logger = createWriter(runtime.stderr, process.stderr);

  logProgress(logger, 'starting scan');
  logProgress(logger, `input: ${config.inputDisplayPath}`);

  const filePaths = await collectSupportedScreenshotFiles(config.inputDir);
  logProgress(logger, `discovered ${filePaths.length} supported screenshot files`);

  const entries = [];
  const failures = [];

  for (const [index, filePath] of filePaths.entries()) {
    const relativePath = toPosixPath(path.relative(config.inputDir, filePath));
    const progress = `[${index + 1}/${filePaths.length}]`;
    logProgress(logger, `${progress} scanning ${relativePath}`);

    try {
      const entry = await readScreenshotMetadata(filePath, config.inputDir);
      entries.push(entry);
      logProgress(logger, `${progress} ok ${entry.width}x${entry.height} ${formatByteSize(entry.sizeBytes)}`);
    } catch (error) {
      const failure = {
        relativePath,
        fileName: path.basename(filePath),
        extension: path.extname(filePath).toLowerCase(),
        reason: error instanceof Error ? error.message : String(error)
      };
      failures.push(failure);
      logProgress(logger, `${progress} failed ${failure.reason}`);
    }
  }

  const report = buildScanReport({
    config,
    entries,
    failures,
    now: runtime.now ?? new Date()
  });

  if (config.outputPath) {
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    logProgress(logger, `wrote report to ${config.outputDisplayPath}`);
  }

  logProgress(logger, `completed: ${entries.length} succeeded, ${failures.length} failed`);

  return {
    config,
    report,
    exitCode: failures.length > 0 ? 1 : 0
  };
}

export function printHelp(output = process.stdout) {
  const writer = createWriter(output, process.stdout);
  writer.write(
    `Usage: node ./scripts/screenshot-metadata-scanner.mjs [options]\n\n` +
      `Options:\n` +
      `  --input <dir>   Screenshot directory to scan (default: ${DEFAULT_INPUT_RELATIVE})\n` +
      `  --output <path> Write the JSON report to a file while keeping stdout output\n` +
      `  -h, --help      Show this help message\n`
  );
}

export async function main(argv = process.argv.slice(2), runtime = {}) {
  const stdout = createWriter(runtime.stdout, process.stdout);
  const stderr = createWriter(runtime.stderr, process.stderr);

  try {
    const cliOptions = parseCliArgs(argv);
    if (cliOptions.help) {
      printHelp(stdout);
      return 0;
    }

    const run = await runScreenshotMetadataScanner(cliOptions, runtime);
    stdout.write(`${JSON.stringify(run.report, null, 2)}\n`);
    return run.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${LOG_PREFIX} failed: ${message}\n`);
    return 1;
  }
}

async function walkDirectory(currentDir, discovered) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  entries.sort((left, right) => compareStrings(left.name, right.name));

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(entryPath, discovered);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_EXTENSION_SET.has(extension)) {
      discovered.push(entryPath);
    }
  }
}

async function ensureDirectoryExists(targetPath, label) {
  let stats;
  try {
    stats = await fs.stat(targetPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`The ${label} does not exist: ${targetPath}`);
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`The ${label} must be a directory: ${targetPath}`);
  }
}

function requireValue(argument, value) {
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${argument}`);
  }

  return value;
}

function resolveFromDocsRoot(docsRoot, targetPath) {
  if (path.isAbsolute(targetPath)) {
    return path.resolve(targetPath);
  }

  return path.resolve(docsRoot, targetPath);
}

function relativeToDocsRoot(docsRoot, targetPath) {
  const relativePath = toPosixPath(path.relative(docsRoot, targetPath));
  return relativePath || '.';
}

function formatDisplayPath(docsRoot, targetPath) {
  const relativePath = relativeToDocsRoot(docsRoot, targetPath);
  return relativePath === '.' ? './' : `./${relativePath}`;
}

function toPosixPath(targetPath) {
  return targetPath.split(path.sep).join('/');
}

function toIsoTimestampOrNull(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function formatByteSize(sizeBytes) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compareStrings(left, right) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
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

function logProgress(writer, message) {
  writer.write(`${LOG_PREFIX} ${message}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
