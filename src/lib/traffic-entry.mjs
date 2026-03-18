export const TRAFFIC_ENTRY_ROUTE_PATH = '/go';
export const TRAFFIC_ENTRY_PLATFORM_QUERY_PARAM = 'platform';
export const TRAFFIC_ENTRY_TARGET_QUERY_PARAM = 'target';
export const TRAFFIC_ENTRY_FALLBACK_URL = 'https://docs.hagicode.com/';
export const RESERVED_TRAFFIC_ENTRY_QUERY_PARAMS = new Set([
  TRAFFIC_ENTRY_PLATFORM_QUERY_PARAM,
  TRAFFIC_ENTRY_TARGET_QUERY_PARAM,
]);
export const SUPPORTED_TRAFFIC_ENTRY_PLATFORM_IDS = [
  'zhihu',
  'wechat',
  'cnblogs',
  'juejin',
  'oschina',
  'aliyun-community',
  'tencent-cloud-community',
  'csdn',
  'segmentfault',
  'toutiao',
  'infoq',
];

function ensureTrailingSlash(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function buildTrafficEntryRedirectUrl(baseUrl, sourceUrl) {
  const redirectUrl = new URL(baseUrl);

  sourceUrl.searchParams.forEach((value, key) => {
    if (!RESERVED_TRAFFIC_ENTRY_QUERY_PARAMS.has(key)) {
      redirectUrl.searchParams.append(key, value);
    }
  });

  return redirectUrl;
}

function createFallbackResolution(url, hasTrafficEntryParams, code, message) {
  const redirectUrl = buildTrafficEntryRedirectUrl(TRAFFIC_ENTRY_FALLBACK_URL, url);

  return {
    valid: false,
    hasTrafficEntryParams,
    code,
    message,
    fallbackUrl: redirectUrl.toString(),
    redirectUrl: redirectUrl.toString(),
    preservedSearchParams: Array.from(redirectUrl.searchParams.entries()),
  };
}

export function isSupportedTrafficEntryPlatform(platformId) {
  return SUPPORTED_TRAFFIC_ENTRY_PLATFORM_IDS.includes(platformId);
}

export function normalizeTrafficEntryTargetPath(targetPath) {
  if (typeof targetPath !== 'string') {
    throw new Error('Traffic-entry target must be a string');
  }

  const trimmed = targetPath.trim();
  if (!trimmed) {
    throw new Error('Traffic-entry target is required');
  }

  if (/^[a-z]+:/i.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Traffic-entry target must be a site-relative path');
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const url = new URL(normalized, 'https://docs.hagicode.com');
  const pathname = ensureTrailingSlash(url.pathname);

  if (!pathname.startsWith('/blog/')) {
    throw new Error('Traffic-entry target must stay within /blog/');
  }

  if (pathname.includes('..')) {
    throw new Error('Traffic-entry target cannot contain traversal segments');
  }

  return pathname;
}

export function hasTrafficEntryParams(url) {
  return (
    url.searchParams.has(TRAFFIC_ENTRY_PLATFORM_QUERY_PARAM) ||
    url.searchParams.has(TRAFFIC_ENTRY_TARGET_QUERY_PARAM)
  );
}

export function resolveTrafficEntryRequest(input) {
  const url = input instanceof URL ? input : new URL(String(input));
  const platformId = url.searchParams.get(TRAFFIC_ENTRY_PLATFORM_QUERY_PARAM);
  const rawTarget = url.searchParams.get(TRAFFIC_ENTRY_TARGET_QUERY_PARAM);

  if (!hasTrafficEntryParams(url)) {
    return createFallbackResolution(
      url,
      false,
      'missing_params',
      'Traffic-entry parameters are required.'
    );
  }

  if (!platformId) {
    return createFallbackResolution(
      url,
      true,
      'missing_platform',
      'Traffic-entry platform is required.'
    );
  }

  if (!isSupportedTrafficEntryPlatform(platformId)) {
    return createFallbackResolution(
      url,
      true,
      'invalid_platform',
      'Traffic-entry platform is not supported.'
    );
  }

  if (!rawTarget) {
    return createFallbackResolution(
      url,
      true,
      'missing_target',
      'Traffic-entry target is required.'
    );
  }

  try {
    const targetPath = normalizeTrafficEntryTargetPath(rawTarget);
    const redirectUrl = buildTrafficEntryRedirectUrl(new URL(targetPath, url.origin), url);

    return {
      valid: true,
      hasTrafficEntryParams: true,
      code: 'ok',
      platformId,
      targetPath,
      canonicalUrl: new URL(targetPath, 'https://docs.hagicode.com').toString(),
      redirectUrl: redirectUrl.toString(),
      preservedSearchParams: Array.from(redirectUrl.searchParams.entries()),
    };
  } catch (error) {
    return createFallbackResolution(
      url,
      true,
      'invalid_target',
      error instanceof Error ? error.message : String(error)
    );
  }
}
