import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

import cachedLinkValidator, {
  runCachedLinkValidation,
  validateExternalLinksWithCache
} from '../src/integrations/link-check-result-cache.js';
import {
  createCacheRecord,
  loadLinkCheckCache,
  normalizeExternalUrl,
  saveLinkCheckCache
} from '../src/integrations/link-check-cache-store.js';

const createdDirs = [];
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const FIXED_NOW = new Date('2026-03-15T12:00:00.000Z');

async function createTempBuild() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-link-check-cache-'));
  const buildDir = path.join(tempRoot, 'dist');
  const cacheDir = path.join(tempRoot, '.tmp', 'link-check-cache');

  createdDirs.push(tempRoot);
  await fs.mkdir(buildDir, { recursive: true });

  return {
    tempRoot,
    buildDir,
    cacheDir
  };
}

async function writeHtml(buildDir, relativePath, html) {
  const filePath = path.join(buildDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');
  return filePath;
}

async function seedCache(cacheDir, records, now = FIXED_NOW) {
  const entries = new Map(records.map((record) => [record.normalizedUrl, record]));
  await saveLinkCheckCache({
    cacheDir,
    entries,
    ttlMs: CACHE_TTL_MS,
    now
  });
}

function createResponse(status, statusText = 'OK') {
  return new Response('', {
    status,
    statusText
  });
}

function createLogger() {
  return {
    infoLogs: [],
    warnLogs: [],
    errorLogs: [],
    info(message) {
      this.infoLogs.push(String(message));
    },
    warn(message) {
      this.warnLogs.push(String(message));
    },
    error(message) {
      this.errorLogs.push(String(message));
    }
  };
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('reuses fresh success cache entries and deduplicates repeated URLs in the same build', async () => {
  const { buildDir, cacheDir } = await createTempBuild();
  const normalizedUrl = normalizeExternalUrl('https://example.com/docs');

  await writeHtml(
    buildDir,
    'index.html',
    `
      <a href="https://example.com/docs#intro">Docs</a>
      <a href="https://example.com/docs">Docs Again</a>
    `
  );

  await seedCache(cacheDir, [
    createCacheRecord({
      normalizedUrl,
      now: FIXED_NOW,
      ttlMs: CACHE_TTL_MS,
      success: true,
      statusCode: 200,
      statusText: 'OK'
    })
  ]);

  let fetchCallCount = 0;
  const result = await validateExternalLinksWithCache(buildDir, {
    cacheDir,
    cacheTtlMs: CACHE_TTL_MS,
    now: FIXED_NOW,
    fetchImpl: async () => {
      fetchCallCount += 1;
      return createResponse(200);
    }
  });

  assert.equal(fetchCallCount, 0);
  assert.equal(result.brokenLinks.length, 0);
  assert.equal(result.summary.cacheHits, 1);
  assert.equal(result.summary.sameBuildReuses, 1);
  assert.equal(result.summary.liveRevalidations, 0);
  assert.equal(result.summary.failedOccurrences, 0);
});

test('refreshes expired cache entries with a live validation and persists the updated record', async () => {
  const { buildDir, cacheDir } = await createTempBuild();
  const normalizedUrl = normalizeExternalUrl('https://expired.example.com/resource');
  const expiredNow = new Date('2026-03-15T12:00:00.000Z');

  await writeHtml(buildDir, 'index.html', '<a href="https://expired.example.com/resource">Expired</a>');
  await seedCache(cacheDir, [
    createCacheRecord({
      normalizedUrl,
      now: new Date('2026-03-10T12:00:00.000Z'),
      ttlMs: 60 * 1000,
      success: true,
      statusCode: 200,
      statusText: 'OK'
    })
  ]);

  let fetchCallCount = 0;
  const result = await validateExternalLinksWithCache(buildDir, {
    cacheDir,
    cacheTtlMs: CACHE_TTL_MS,
    now: expiredNow,
    fetchImpl: async () => {
      fetchCallCount += 1;
      return createResponse(200);
    }
  });

  assert.equal(fetchCallCount, 1);
  assert.equal(result.summary.liveRevalidations, 1);
  assert.equal(result.summary.expiredRefreshes, 1);
  assert.equal(result.summary.cacheHits, 0);
  assert.equal(result.brokenLinks.length, 0);

  const loadedCache = await loadLinkCheckCache({ cacheDir });
  const refreshedRecord = loadedCache.entries.get(normalizedUrl);
  assert.equal(refreshedRecord.success, true);
  assert.ok(Date.parse(refreshedRecord.expiresAt) > expiredNow.getTime());
});

test('revalidates prior failures instead of trusting them as reusable cache hits', async () => {
  const { buildDir, cacheDir } = await createTempBuild();
  const normalizedUrl = normalizeExternalUrl('https://retry.example.com/help');

  await writeHtml(buildDir, 'index.html', '<a href="https://retry.example.com/help">Retry</a>');
  await seedCache(cacheDir, [
    createCacheRecord({
      normalizedUrl,
      now: new Date('2026-03-15T11:00:00.000Z'),
      ttlMs: CACHE_TTL_MS,
      success: false,
      statusCode: 503,
      statusText: 'Service Unavailable',
      error: 'HTTP 503: Service Unavailable'
    })
  ]);

  let fetchCallCount = 0;
  const result = await validateExternalLinksWithCache(buildDir, {
    cacheDir,
    cacheTtlMs: CACHE_TTL_MS,
    now: FIXED_NOW,
    fetchImpl: async () => {
      fetchCallCount += 1;
      return createResponse(200);
    }
  });

  assert.equal(fetchCallCount, 1);
  assert.equal(result.summary.previousFailureRefreshes, 1);
  assert.equal(result.summary.liveRevalidations, 1);
  assert.equal(result.summary.cacheHits, 0);

  const loadedCache = await loadLinkCheckCache({ cacheDir });
  assert.equal(loadedCache.entries.get(normalizedUrl).success, true);
});

test('falls back cleanly when the cache is missing and only validates each unique URL once per build', async () => {
  const { buildDir, cacheDir } = await createTempBuild();
  const requestedUrls = [];

  await writeHtml(
    buildDir,
    'index.html',
    `
      <a href="https://missing-cache.example.com/start">Start</a>
      <a href="https://missing-cache.example.com/start#again">Start Again</a>
    `
  );
  await writeHtml(
    buildDir,
    'guide/index.html',
    '<a href="https://second.example.com/guide">Guide</a>'
  );

  const result = await runCachedLinkValidation(buildDir, {
    checkExternal: true,
    cacheDir,
    cacheTtlMs: CACHE_TTL_MS,
    now: FIXED_NOW,
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return createResponse(200);
    },
    failOnBrokenLinks: false
  });

  assert.equal(result.externalSummary.cacheStatus, 'missing');
  assert.equal(result.externalSummary.cacheMisses, 2);
  assert.equal(result.externalSummary.sameBuildReuses, 1);
  assert.equal(result.externalSummary.liveRevalidations, 2);
  assert.deepEqual(requestedUrls.sort(), [
    'https://missing-cache.example.com/start',
    'https://second.example.com/guide'
  ]);

  const loadedCache = await loadLinkCheckCache({ cacheDir });
  assert.equal(loadedCache.entries.size, 2);
});

test('emits a parsable cache summary in build logs with hits, revalidations, expired refreshes, and failures', async () => {
  const { buildDir, cacheDir } = await createTempBuild();
  const cacheHitUrl = normalizeExternalUrl('https://cached.example.com/docs');
  const expiredUrl = normalizeExternalUrl('https://expired.example.com/fail');

  await writeHtml(
    buildDir,
    'index.html',
    `
      <a href="https://cached.example.com/docs">Cached</a>
      <a href="https://expired.example.com/fail">Expired</a>
      <a href="https://new.example.com/live">Live</a>
    `
  );

  await seedCache(cacheDir, [
    createCacheRecord({
      normalizedUrl: cacheHitUrl,
      now: FIXED_NOW,
      ttlMs: CACHE_TTL_MS,
      success: true,
      statusCode: 200,
      statusText: 'OK'
    }),
    createCacheRecord({
      normalizedUrl: expiredUrl,
      now: new Date('2026-03-10T12:00:00.000Z'),
      ttlMs: 60 * 1000,
      success: true,
      statusCode: 200,
      statusText: 'OK'
    })
  ]);

  const logger = createLogger();
  const integration = cachedLinkValidator({
    checkExternal: true,
    failOnBrokenLinks: false,
    cacheDir,
    cacheTtlMs: CACHE_TTL_MS,
    now: FIXED_NOW,
    fetchImpl: async (url) => {
      if (String(url) === expiredUrl) {
        return createResponse(503, 'Service Unavailable');
      }
      return createResponse(200);
    }
  });

  await integration.hooks['astro:build:done']({
    dir: pathToFileURL(`${buildDir}${path.sep}`),
    logger
  });

  const humanSummary = logger.infoLogs.find((entry) => entry.startsWith('[link-check-cache]'));
  assert.match(humanSummary, /hits=1 live=2 expired=1 failures=1 deduped=0/);

  const machineSummaryLine = logger.infoLogs.find((entry) => entry.startsWith('LINK_CHECK_CACHE_SUMMARY '));
  assert.ok(machineSummaryLine, 'expected LINK_CHECK_CACHE_SUMMARY log');

  const summary = JSON.parse(machineSummaryLine.replace('LINK_CHECK_CACHE_SUMMARY ', ''));
  assert.equal(summary.cacheHits, 1);
  assert.equal(summary.liveRevalidations, 2);
  assert.equal(summary.expiredRefreshes, 1);
  assert.equal(summary.failedOccurrences, 1);
  assert.equal(summary.failedUniqueUrls, 1);
  assert.match(logger.errorLogs.join('\n'), /Found 1 broken links/);
});
