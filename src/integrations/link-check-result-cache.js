import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import pc from 'picocolors';
import { checkLinks, extractLinksFromHtml } from './link-validator-compat.js';

import {
  createCacheRecord,
  LINK_CHECK_CACHE_SCHEMA_VERSION,
  loadLinkCheckCache,
  normalizeExternalUrl,
  saveLinkCheckCache,
  isReusableSuccessRecord
} from './link-check-cache-store.js';

const DEFAULT_INCLUDE = ['**/*.html'];
const DEFAULT_EXTERNAL_TIMEOUT = 5000;
const DEFAULT_EXTERNAL_CONCURRENCY = 10;
const DEFAULT_CACHE_TTL_MS = 48 * 60 * 60 * 1000;

export default function cachedLinkValidator(options = {}) {
  return {
    name: 'hagicode-link-check-result-cache',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        logger.info('🔗 Validating links...');

        try {
          const buildDir = fileURLToPath(dir);
          const result = await runCachedLinkValidation(buildDir, options);

          logger.info(`✅ Checked ${result.totalLinks} links across ${result.checkedFiles.length} files`);

          if (result.skippedFiles.length > 0) {
            logger.warn(`⚠️  Skipped ${result.skippedFiles.length} files`);
            if (result.options.verbose) {
              result.skippedFiles.forEach((file) => {
                logger.warn(`   - ${file}`);
              });
            }
          }

          if (result.externalSummary) {
            logExternalSummary(logger, result.externalSummary);
          }

          if (result.brokenLinks.length > 0) {
            logger.error(`❌ Found ${result.brokenLinks.length} broken links:`);
            reportBrokenLinks(buildDir, result.brokenLinks);

            if (result.options.failOnBrokenLinks !== false) {
              throw new Error(`Build failed: Found ${result.brokenLinks.length} broken links`);
            }

            logger.warn(`⚠️  Build continued with ${result.brokenLinks.length} broken links`);
          } else {
            logger.info('🎉 No broken links found!');
          }
        } catch (error) {
          if (error instanceof Error) {
            logger.error(`💥 Link validation failed: ${error.message}`);
            if (options.failOnBrokenLinks !== false) {
              throw error;
            }
          } else {
            logger.error('💥 Link validation failed with unknown error');
            if (options.failOnBrokenLinks !== false) {
              throw new Error('Link validation failed with unknown error');
            }
          }
        }
      }
    }
  };
}

export async function runCachedLinkValidation(buildDir, options = {}) {
  const resolvedOptions = resolveOptions(options);
  const internalResult = await checkLinks(buildDir, {
    ...resolvedOptions,
    checkExternal: false
  });

  let externalResult = createEmptyExternalResult();
  if (resolvedOptions.checkExternal) {
    externalResult = await validateExternalLinksWithCache(buildDir, resolvedOptions);
  }

  return {
    totalLinks: internalResult.totalLinks,
    brokenLinks: [...internalResult.brokenLinks, ...externalResult.brokenLinks],
    checkedFiles: internalResult.checkedFiles,
    skippedFiles: internalResult.skippedFiles,
    externalSummary: externalResult.summary,
    options: resolvedOptions
  };
}

export async function validateExternalLinksWithCache(buildDir, options = {}) {
  const resolvedOptions = resolveOptions(options);
  const now = resolveNow(resolvedOptions.now);
  const cache = await loadLinkCheckCache({
    cacheDir: resolvedOptions.cacheDir,
    fileName: resolvedOptions.cacheFileName
  });

  const htmlFiles = await getHtmlFiles(buildDir, resolvedOptions.include);
  const occurrences = await collectExternalLinkOccurrences(htmlFiles);

  const summary = {
    cachePath: cache.cachePath,
    cacheStatus: cache.status,
    cacheWarning: cache.warning,
    totalExternalOccurrences: occurrences.length,
    uniqueExternalUrls: 0,
    sameBuildReuses: 0,
    cacheHits: 0,
    liveRevalidations: 0,
    cacheMisses: 0,
    expiredRefreshes: 0,
    previousFailureRefreshes: 0,
    failedUniqueUrls: 0,
    failedOccurrences: 0,
    cacheEntryCount: cache.entries.size,
    persistedEntryCount: cache.entries.size,
    writeWarning: null,
    schemaVersion: LINK_CHECK_CACHE_SCHEMA_VERSION
  };

  const uniqueEntries = new Map();
  const invalidLinks = [];

  for (const occurrence of occurrences) {
    if (shouldExcludeLink(occurrence.href, resolvedOptions.exclude)) {
      continue;
    }

    const normalizedUrl = normalizeExternalUrl(occurrence.href);
    if (!normalizedUrl) {
      invalidLinks.push({
        ...occurrence,
        error: 'Unsupported or invalid external URL',
        reason: 'invalid'
      });
      continue;
    }

    const existing = uniqueEntries.get(normalizedUrl);
    if (existing) {
      existing.occurrences.push(occurrence);
      summary.sameBuildReuses += 1;
      continue;
    }

    uniqueEntries.set(normalizedUrl, {
      normalizedUrl,
      representative: occurrence,
      occurrences: [occurrence],
      outcome: null,
      liveReason: null
    });
  }

  summary.uniqueExternalUrls = uniqueEntries.size;

  const liveQueue = [];
  for (const entry of uniqueEntries.values()) {
    const cachedRecord = cache.entries.get(entry.normalizedUrl);

    if (cachedRecord && isReusableSuccessRecord(cachedRecord, now)) {
      summary.cacheHits += 1;
      entry.outcome = {
        source: 'disk-cache',
        success: true,
        statusCode: cachedRecord.statusCode,
        statusText: cachedRecord.statusText,
        error: cachedRecord.error,
        reason: null
      };
      continue;
    }

    entry.liveReason = determineLiveReason(cache.status, cachedRecord, now);
    summary.liveRevalidations += 1;

    if (entry.liveReason === 'expired') {
      summary.expiredRefreshes += 1;
    } else if (entry.liveReason === 'previous-failure') {
      summary.previousFailureRefreshes += 1;
    } else {
      summary.cacheMisses += 1;
    }

    liveQueue.push(entry);
  }

  await runInBatches(liveQueue, resolvedOptions.externalConcurrency, async (entry) => {
    const liveOutcome = await validateLiveExternalLink(entry.normalizedUrl, {
      timeout: resolvedOptions.externalTimeout,
      cacheTtlMs: resolvedOptions.cacheTtlMs,
      fetchImpl: resolvedOptions.fetchImpl
    });

    entry.outcome = {
      source: 'live',
      success: liveOutcome.brokenLink === null,
      statusCode: liveOutcome.record.statusCode,
      statusText: liveOutcome.record.statusText,
      error: liveOutcome.record.error,
      reason: liveOutcome.brokenLink ? liveOutcome.brokenLink.reason : null
    };

    cache.entries.set(entry.normalizedUrl, liveOutcome.record);
  });

  const brokenLinks = [...invalidLinks];

  for (const entry of uniqueEntries.values()) {
    if (!entry.outcome || entry.outcome.success) {
      continue;
    }

    summary.failedUniqueUrls += 1;

    for (const occurrence of entry.occurrences) {
      brokenLinks.push({
        ...occurrence,
        error: entry.outcome.error,
        reason: entry.outcome.reason ?? 'network-error'
      });
    }
  }

  summary.failedOccurrences = brokenLinks.length;

  try {
    const savedCache = await saveLinkCheckCache({
      cacheDir: resolvedOptions.cacheDir,
      fileName: resolvedOptions.cacheFileName,
      entries: cache.entries,
      ttlMs: resolvedOptions.cacheTtlMs,
      now
    });
    summary.persistedEntryCount = savedCache.entryCount;
  } catch (error) {
    summary.writeWarning = error instanceof Error ? error.message : String(error);
  }

  return {
    brokenLinks,
    summary
  };
}

function resolveOptions(options) {
  return {
    checkExternal: options.checkExternal === true,
    failOnBrokenLinks: options.failOnBrokenLinks,
    exclude: Array.isArray(options.exclude) ? options.exclude : [],
    include: Array.isArray(options.include) && options.include.length > 0 ? options.include : DEFAULT_INCLUDE,
    externalTimeout: Number.isFinite(options.externalTimeout) ? options.externalTimeout : DEFAULT_EXTERNAL_TIMEOUT,
    verbose: options.verbose === true,
    base: options.base,
    redirectsFile: options.redirectsFile,
    cacheDir: path.resolve(options.cacheDir ?? '.tmp/link-check-cache'),
    cacheFileName: options.cacheFileName ?? undefined,
    cacheTtlMs: Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : DEFAULT_CACHE_TTL_MS,
    externalConcurrency: Number.isFinite(options.externalConcurrency) ? options.externalConcurrency : DEFAULT_EXTERNAL_CONCURRENCY,
    fetchImpl: options.fetchImpl,
    now: options.now
  };
}

function resolveNow(nowOption) {
  if (typeof nowOption === 'function') {
    return nowOption();
  }

  if (nowOption instanceof Date) {
    return nowOption;
  }

  return new Date();
}

async function getHtmlFiles(dir, include) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function collectExternalLinkOccurrences(htmlFiles) {
  const allOccurrences = [];

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, 'utf8');
    const links = extractLinksFromHtml(html, htmlFile);
    const externalLinks = links.filter((link) => link.type === 'external');
    allOccurrences.push(...externalLinks);
  }

  return allOccurrences;
}

function determineLiveReason(cacheStatus, cachedRecord, now) {
  if (cacheStatus !== 'ready') {
    return 'cache-unavailable';
  }

  if (!cachedRecord) {
    return 'cache-miss';
  }

  if (cachedRecord.success !== true) {
    return 'previous-failure';
  }

  const expiresAt = Date.parse(cachedRecord.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return 'expired';
  }

  return 'cache-miss';
}

function shouldExcludeLink(href, excludePatterns) {
  return excludePatterns.some((pattern) => href.includes(pattern));
}

async function runInBatches(items, batchSize, task) {
  const safeBatchSize = Math.max(1, batchSize);

  for (let index = 0; index < items.length; index += safeBatchSize) {
    const batch = items.slice(index, index + safeBatchSize);
    await Promise.all(batch.map(task));
  }
}

async function validateLiveExternalLink(url, { timeout, cacheTtlMs, fetchImpl }) {
  const executeFetch = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const now = new Date();

  try {
    const response = await executeFetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; hagicode-link-check-cache/1.0.0)'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        brokenLink: null,
        record: createCacheRecord({
          normalizedUrl: url,
          now,
          ttlMs: cacheTtlMs,
          success: true,
          statusCode: response.status,
          statusText: response.statusText,
          error: ''
        })
      };
    }

    const error = `HTTP ${response.status}: ${response.statusText}`;
    return {
      brokenLink: {
        href: url,
        error,
        reason: 'network-error'
      },
      record: createCacheRecord({
        normalizedUrl: url,
        now,
        ttlMs: cacheTtlMs,
        success: false,
        statusCode: response.status,
        statusText: response.statusText,
        error
      })
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = `Request timeout after ${timeout}ms`;
      return {
        brokenLink: {
          href: url,
          error: timeoutError,
          reason: 'timeout'
        },
        record: createCacheRecord({
          normalizedUrl: url,
          now,
          ttlMs: cacheTtlMs,
          success: false,
          statusCode: null,
          statusText: '',
          error: timeoutError
        })
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      brokenLink: {
        href: url,
        error: message,
        reason: 'network-error'
      },
      record: createCacheRecord({
        normalizedUrl: url,
        now,
        ttlMs: cacheTtlMs,
        success: false,
        statusCode: null,
        statusText: '',
        error: message
      })
    };
  }
}

function logExternalSummary(logger, summary) {
  logger.info(
    `[link-check-cache] hits=${summary.cacheHits} live=${summary.liveRevalidations} expired=${summary.expiredRefreshes} failures=${summary.failedOccurrences} deduped=${summary.sameBuildReuses}`
  );
  logger.info(`LINK_CHECK_CACHE_SUMMARY ${JSON.stringify(summary)}`);

  if (summary.cacheStatus !== 'ready' && summary.cacheStatus !== 'missing') {
    logger.warn(`[link-check-cache] cache fallback: ${summary.cacheStatus}`);
  }

  if (summary.cacheWarning) {
    logger.warn(`[link-check-cache] cache warning: ${summary.cacheWarning}`);
  }

  if (summary.writeWarning) {
    logger.warn(`[link-check-cache] cache write warning: ${summary.writeWarning}`);
  }
}

function reportBrokenLinks(buildDir, brokenLinks) {
  const brokenLinksByFile = brokenLinks.reduce((accumulator, link) => {
    const file = path.relative(buildDir, link.sourceFile);
    if (!accumulator[file]) {
      accumulator[file] = [];
    }
    accumulator[file].push(link);
    return accumulator;
  }, {});

  for (const [file, fileLinks] of Object.entries(brokenLinksByFile)) {
    console.log(`\n${pc.red(`📄 ${file}`)}:`);
    fileLinks.forEach((link) => {
      const typeIcon = getTypeIcon(link.type);
      const reasonColor = getReasonColor(link.reason);
      console.log(`  ${typeIcon} ${pc.cyan(link.href)}`);
      console.log(`    ${reasonColor(link.error)}`);
      if (link.text && link.text !== link.href) {
        console.log(`    Text: "${pc.dim(link.text)}"`);
      }
    });
  }
}

function getTypeIcon(type) {
  switch (type) {
    case 'internal':
      return '🔗';
    case 'external':
      return '🌐';
    case 'asset':
      return '📦';
    case 'anchor':
      return '⚓';
    default:
      return '❓';
  }
}

function getReasonColor(reason) {
  switch (reason) {
    case 'not-found':
      return pc.red;
    case 'network-error':
      return pc.magenta;
    case 'timeout':
      return pc.yellow;
    case 'invalid':
      return pc.gray;
    default:
      return pc.red;
  }
}

function createEmptyExternalResult() {
  return {
    brokenLinks: [],
    summary: null
  };
}
