import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DOCS_ROOT = path.resolve(SCRIPT_DIR, '..');
const LOG_PREFIX = '[build output]';

export async function collectBuildOutputStats(options = {}) {
  const docsRoot = options.docsRoot ? path.resolve(options.docsRoot) : DOCS_ROOT;
  const distDir = options.distDir ? path.resolve(options.distDir) : path.join(docsRoot, 'dist');

  let distStats;
  try {
    distStats = await fs.stat(distDir);
  } catch {
    throw new Error(`Build output directory is missing: ${distDir}`);
  }

  if (!distStats.isDirectory()) {
    throw new Error(`Build output path is not a directory: ${distDir}`);
  }

  const summary = await walkBuildOutput(distDir);
  return {
    distDir,
    fileCount: summary.fileCount,
    totalBytes: summary.totalBytes,
  };
}

export function formatByteSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error(`Invalid byte size: ${sizeBytes}`);
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} ${units[unitIndex]}`;
  }

  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatBuildOutputSummary(stats, options = {}) {
  const distLabel = options.distLabel ?? 'dist';
  return `${LOG_PREFIX} ${distLabel}: ${stats.fileCount} files, ${formatByteSize(stats.totalBytes)} total`;
}

export async function reportBuildOutputStats(options = {}) {
  const docsRoot = options.docsRoot ? path.resolve(options.docsRoot) : DOCS_ROOT;
  const stats = await collectBuildOutputStats({
    docsRoot,
    distDir: options.distDir,
  });
  const stdout = createWriter(options.stdout, process.stdout);
  const distLabel = options.distLabel ?? (path.relative(docsRoot, stats.distDir) || path.basename(stats.distDir));
  const message = formatBuildOutputSummary(stats, { distLabel });

  stdout.write(`${message}\n`);

  return {
    ...stats,
    message,
  };
}

export async function main(runtime = {}) {
  const stderr = createWriter(runtime.stderr, process.stderr);

  try {
    await reportBuildOutputStats({
      docsRoot: runtime.docsRoot ?? process.cwd(),
      distDir: runtime.distDir,
      distLabel: runtime.distLabel,
      stdout: runtime.stdout,
    });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${LOG_PREFIX} failed: ${message}\n`);
    return 1;
  }
}

async function walkBuildOutput(currentDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  let fileCount = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      const child = await walkBuildOutput(entryPath);
      fileCount += child.fileCount;
      totalBytes += child.totalBytes;
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(entryPath);
    fileCount += 1;
    totalBytes += stats.size;
  }

  return { fileCount, totalBytes };
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
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  const exitCode = await main();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
