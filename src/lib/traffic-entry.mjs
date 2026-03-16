export const TRAFFIC_ENTRY_ROUTE_PATH = '/go';
export const TRAFFIC_ENTRY_PLATFORM_QUERY_PARAM = 'platform';
export const TRAFFIC_ENTRY_TARGET_QUERY_PARAM = 'target';
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
    return {
      valid: false,
      hasTrafficEntryParams: false,
      code: 'missing_params',
      message: 'Traffic-entry parameters are required.',
    };
  }

  if (!platformId) {
    return {
      valid: false,
      hasTrafficEntryParams: true,
      code: 'missing_platform',
      message: 'Traffic-entry platform is required.',
    };
  }

  if (!rawTarget) {
    return {
      valid: false,
      hasTrafficEntryParams: true,
      code: 'missing_target',
      message: 'Traffic-entry target is required.',
    };
  }

  try {
    const targetPath = normalizeTrafficEntryTargetPath(rawTarget);
    const redirectUrl = new URL(targetPath, url.origin);

    url.searchParams.forEach((value, key) => {
      if (!RESERVED_TRAFFIC_ENTRY_QUERY_PARAMS.has(key)) {
        redirectUrl.searchParams.append(key, value);
      }
    });

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
    return {
      valid: false,
      hasTrafficEntryParams: true,
      code: 'invalid_target',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
