/**
 * Shared helpers for docs locale handling.
 *
 * Two locale rules coexist in the docs site today:
 * - Starlight content fallback still treats the root locale as Chinese.
 * - Landing pages and docs/blog content pages now use different default-route strategies.
 */

export type DocsLocale = 'root' | 'en';
export type DocsLanguageParam = 'zh-CN' | 'en';

export const DOCS_LANGUAGE_STORAGE_KEY = 'starlight-route';
export const DEFAULT_DOCS_ENTRY_LOCALE: DocsLocale = 'en';
export const DOCS_ENTRY_PATHS: Record<DocsLocale, string> = {
  root: '/',
  en: '/en/',
};

/**
 * Parses the language parameter from a URL.
 */
export function parseLangFromUrl(url: URL): string | null {
  return url.searchParams.get('lang');
}

/**
 * Parse a locale-like value into a supported docs locale.
 * Returns null for unsupported inputs so callers can decide the fallback policy.
 */
export function parseDocsLocale(lang: string | null | undefined): DocsLocale | null {
  if (!lang) {
    return null;
  }

  const normalized = lang.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  if (
    normalized === 'root' ||
    normalized === 'zh' ||
    normalized === 'zh-cn' ||
    normalized.startsWith('zh-')
  ) {
    return 'root';
  }

  return null;
}

/**
 * Map a cross-site `?lang=` value to the docs locale.
 */
export function mapLanguageParamToDocsLocale(lang: string | null | undefined): DocsLocale | null {
  return parseDocsLocale(lang);
}

/**
 * Historical helper kept for existing callers.
 * For landing-entry flows, missing or invalid values now fall back to English.
 */
export function mapLangToSiteFormat(lang: string | null): DocsLocale {
  return mapLanguageParamToDocsLocale(lang) ?? DEFAULT_DOCS_ENTRY_LOCALE;
}

/**
 * Resolve the docs locale from browser-provided language preferences.
 */
export function resolveClientDocsLocale(
  clientLanguages: Array<string | null | undefined>,
): DocsLocale | null {
  for (const language of clientLanguages) {
    const locale = parseDocsLocale(language);
    if (locale) {
      return locale;
    }
  }

  return null;
}

/**
 * Update Starlight's stored locale preference.
 */
export function setLanguagePreference(lang: string): void {
  const locale = parseDocsLocale(lang) ?? DEFAULT_DOCS_ENTRY_LOCALE;

  try {
    const route = localStorage.getItem(DOCS_LANGUAGE_STORAGE_KEY);
    localStorage.setItem(
      DOCS_LANGUAGE_STORAGE_KEY,
      serializeStoredDocsLocale(route, locale),
    );
  } catch {
    // Ignore storage failures so navigation still works for this visit.
  }
}

/**
 * Checks whether a cross-site language parameter is supported.
 */
export function isValidLanguage(lang: string | null): boolean {
  return mapLanguageParamToDocsLocale(lang) !== null;
}

/**
 * Remove the docs locale prefix from a path.
 */
export function stripDocsLocalePrefix(pathname = '/'): string {
  if (!pathname || pathname === '/en') {
    return '/';
  }

  if (pathname.startsWith('/en/')) {
    return pathname.slice(3) || '/';
  }

  return pathname;
}

/**
 * Returns true when the path already targets the English docs locale.
 */
export function isEnglishDocsPath(pathname = '/'): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

/**
 * Returns true when the route is one of the docs landing pages (`/` or `/en/`).
 */
export function isLandingRoutePath(pathname = '/'): boolean {
  return stripDocsLocalePrefix(pathname) === '/';
}

/**
 * Build the localized docs route path.
 */
export function buildDocsRoutePath(locale: DocsLocale, originalPath = '/'): string {
  const normalizedPath = stripDocsLocalePrefix(originalPath || '/');

  if (locale === 'en') {
    return normalizedPath === '/' ? DOCS_ENTRY_PATHS.en : `/en${normalizedPath}`;
  }

  return normalizedPath || '/';
}

/**
 * Historical helper kept for existing callers.
 */
export function buildTargetPath(mappedLang: string, originalPath = '/'): string {
  return buildDocsRoutePath(parseDocsLocale(mappedLang) ?? 'root', originalPath);
}

/**
 * Parse Starlight's stored `starlight-route` payload and return the saved docs locale.
 */
export function getStoredDocsLocale(storageValue: string | null | undefined): DocsLocale | null {
  if (!storageValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storageValue) as { lang?: string | null };
    return parseDocsLocale(parsed.lang);
  } catch {
    return null;
  }
}

/**
 * Serialize a docs locale back into the Starlight route payload while preserving
 * any unrelated fields that Starlight may already have stored.
 */
export function serializeStoredDocsLocale(
  storageValue: string | null | undefined,
  locale: DocsLocale,
): string {
  let routeObj: Record<string, unknown> = {};

  if (storageValue) {
    try {
      routeObj = JSON.parse(storageValue) as Record<string, unknown>;
    } catch {
      routeObj = {};
    }
  }

  routeObj.lang = locale;
  return JSON.stringify(routeObj);
}

/**
 * Normalize various locale inputs to the Starlight docs locale.
 * This keeps the existing Chinese-root fallback for content rendering.
 */
export function normalizeDocsLocale(lang: string | null | undefined): DocsLocale {
  return parseDocsLocale(lang) ?? 'root';
}

/**
 * Resolve locale using a priority chain and fallback to the Chinese root locale.
 */
export function resolveDocsLocale(...candidates: Array<string | null | undefined>): DocsLocale {
  for (const candidate of candidates) {
    const locale = parseDocsLocale(candidate);
    if (locale) {
      return locale;
    }
  }

  return 'root';
}

/**
 * Resolve the docs landing entry locale using
 * `query > stored preference > client language > default en`.
 */
export function resolveDocsEntryLocale(options: {
  requestedLang?: string | null | undefined;
  storedLocale?: string | null | undefined;
  clientLanguages?: Array<string | null | undefined>;
}): DocsLocale {
  const { requestedLang, storedLocale, clientLanguages = [] } = options;

  if (requestedLang !== null && requestedLang !== undefined) {
    return mapLanguageParamToDocsLocale(requestedLang) ?? DEFAULT_DOCS_ENTRY_LOCALE;
  }

  return (
    parseDocsLocale(storedLocale) ??
    resolveClientDocsLocale(clientLanguages) ??
    DEFAULT_DOCS_ENTRY_LOCALE
  );
}

/**
 * Map Docs locale to InstallButton locale prop.
 */
export function toInstallButtonLocale(locale: DocsLocale): 'zh' | 'en' {
  return locale === 'en' ? 'en' : 'zh';
}
