import path from 'node:path';
import { promises as fs } from 'node:fs';

export const LINK_CHECK_CACHE_SCHEMA_VERSION = 1;
export const LINK_CHECK_CACHE_FILE_NAME = 'external-link-results.v1.json';

export function normalizeExternalUrl(href) {
  if (typeof href !== 'string') {
    return null;
  }

  const trimmedHref = href.trim();
  if (trimmedHref.length === 0) {
    return null;
  }

  const candidate = trimmedHref.startsWith('//') ? `https:${trimmedHref}` : trimmedHref;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }

  if (url.pathname.length === 0) {
    url.pathname = '/';
  }

  return url.toString();
}

export function createCacheRecord({
  normalizedUrl,
  now,
  ttlMs,
  success,
  statusCode = null,
  statusText = '',
  error = ''
}) {
  return {
    normalizedUrl,
    checkedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    success,
    statusCode,
    statusText,
    error
  };
}

export function isReusableSuccessRecord(record, now = new Date()) {
  if (!record || typeof record !== 'object' || record.success !== true) {
    return false;
  }

  const expiresAt = Date.parse(record.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export async function loadLinkCheckCache({
  cacheDir,
  fileName = LINK_CHECK_CACHE_FILE_NAME
}) {
  const cachePath = path.resolve(cacheDir, fileName);

  let rawContent;
  try {
    rawContent = await fs.readFile(cachePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        cachePath,
        entries: new Map(),
        status: 'missing',
        warning: null
      };
    }

    return {
      cachePath,
      entries: new Map(),
      status: 'unreadable',
      warning: error instanceof Error ? error.message : String(error)
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    return {
      cachePath,
      entries: new Map(),
      status: 'invalid-json',
      warning: error instanceof Error ? error.message : String(error)
    };
  }

  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== LINK_CHECK_CACHE_SCHEMA_VERSION) {
    return {
      cachePath,
      entries: new Map(),
      status: 'schema-mismatch',
      warning: null
    };
  }

  const rawEntries = parsed.entries;
  if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
    return {
      cachePath,
      entries: new Map(),
      status: 'invalid-shape',
      warning: 'Cache payload is missing an entries object'
    };
  }

  const entries = new Map();
  for (const [rawUrl, rawRecord] of Object.entries(rawEntries)) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      continue;
    }

    const normalizedUrl = normalizeExternalUrl(rawRecord.normalizedUrl ?? rawUrl);
    if (!normalizedUrl) {
      continue;
    }

    entries.set(normalizedUrl, {
      normalizedUrl,
      checkedAt: typeof rawRecord.checkedAt === 'string' ? rawRecord.checkedAt : '',
      expiresAt: typeof rawRecord.expiresAt === 'string' ? rawRecord.expiresAt : '',
      success: rawRecord.success === true,
      statusCode: typeof rawRecord.statusCode === 'number' ? rawRecord.statusCode : null,
      statusText: typeof rawRecord.statusText === 'string' ? rawRecord.statusText : '',
      error: typeof rawRecord.error === 'string' ? rawRecord.error : ''
    });
  }

  return {
    cachePath,
    entries,
    status: 'ready',
    warning: null
  };
}

export async function saveLinkCheckCache({
  cacheDir,
  entries,
  ttlMs,
  fileName = LINK_CHECK_CACHE_FILE_NAME,
  now = new Date()
}) {
  const cachePath = path.resolve(cacheDir, fileName);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });

  const serializableEntries = {};
  const sortedEntries = [...entries.entries()].sort(([left], [right]) => left.localeCompare(right));

  for (const [normalizedUrl, record] of sortedEntries) {
    if (!normalizeExternalUrl(normalizedUrl)) {
      continue;
    }

    if (!record || typeof record !== 'object') {
      continue;
    }

    serializableEntries[normalizedUrl] = {
      normalizedUrl,
      checkedAt: typeof record.checkedAt === 'string' ? record.checkedAt : '',
      expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : '',
      success: record.success === true,
      statusCode: typeof record.statusCode === 'number' ? record.statusCode : null,
      statusText: typeof record.statusText === 'string' ? record.statusText : '',
      error: typeof record.error === 'string' ? record.error : ''
    };
  }

  const payload = {
    schemaVersion: LINK_CHECK_CACHE_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    ttlMs,
    entries: serializableEntries
  };

  await fs.writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return {
    cachePath,
    entryCount: Object.keys(serializableEntries).length
  };
}
