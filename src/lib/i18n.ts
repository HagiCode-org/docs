/**
 * Language parameter parsing and mapping utilities for cross-site language switching
 * Handles language parameter transmission between hagicode.com and docs.hagicode.com
 */

/**
 * Parses the language parameter from a URL
 * @param url - The URL to parse the language parameter from
 * @returns The language parameter value or null if not found
 *
 * @example
 * parseLangFromUrl(new URL('https://docs.hagicode.com/?lang=en'))
 * // Returns: 'en'
 *
 * @example
 * parseLangFromUrl(new URL('https://docs.hagicode.com/'))
 * // Returns: null
 */
export function parseLangFromUrl(url: URL): string | null {
  return url.searchParams.get('lang');
}

/**
 * Maps language values between site and docs formats
 * Site format: 'zh-CN', 'en'
 * Docs format (Starlight): 'root', 'en'
 *
 * @param lang - The language value from the URL parameter
 * @returns The mapped language value in the docs format, or 'root' as default for unsupported values
 *
 * @example
 * mapLangToSiteFormat('zh-CN')
 * // Returns: 'root'
 *
 * @example
 * mapLangToSiteFormat('en')
 * // Returns: 'en'
 *
 * @example
 * mapLangToSiteFormat('fr')
 * // Returns: 'root' (default for unsupported languages)
 */
export function mapLangToSiteFormat(lang: string | null): string {
  if (!lang) {
    return 'root';
  }

  const langMapping: Record<string, string> = {
    'zh-CN': 'root',
    'en': 'en',
  };

  return langMapping[lang] || 'root';
}

/**
 * Updates the localStorage with the language preference
 * Uses Starlight's 'starlight-route' key for language storage
 *
 * @param lang - The language value to store (should be 'root' or 'en')
 *
 * @example
 * setLanguagePreference('en')
 * // Sets localStorage['starlight-route'] = { lang: 'en' }
 */
export function setLanguagePreference(lang: string): void {
  try {
    const route = localStorage.getItem('starlight-route');
    let routeObj = route ? JSON.parse(route) : {};

    routeObj.lang = lang;

    localStorage.setItem('starlight-route', JSON.stringify(routeObj));
  } catch (error) {
    // Silent fallback when localStorage is unavailable (e.g., private browsing mode)
    // The language will still work for the current session
  }
}

/**
 * Checks if a language parameter is valid
 * @param lang - The language value to validate
 * @returns true if the language is supported, false otherwise
 */
export function isValidLanguage(lang: string | null): boolean {
  if (!lang) {
    return false;
  }
  return ['en', 'zh-CN'].includes(lang);
}

/**
 * Builds the target path for language-based redirects
 *
 * @param mappedLang - The mapped language value in docs format
 * @param originalPath - The original path from the request (default: '/')
 * @returns The target path with language prefix
 *
 * @example
 * buildTargetPath('en', '/docs/guide/')
 * // Returns: '/en/docs/guide/'
 *
 * @example
 * buildTargetPath('root', '/')
 * // Returns: '/'
 */
export function buildTargetPath(mappedLang: string, originalPath = '/'): string {
  if (mappedLang === 'en') {
    // Remove trailing slash if present, then add /en/ prefix
    const cleanPath = originalPath.endsWith('/') ? originalPath.slice(0, -1) : originalPath;
    return `/en${cleanPath}`;
  }
  // For root (Chinese), return the original path
  return originalPath;
}

/**
 * Docs locale used by Starlight.
 * - root: Chinese content without URL prefix
 * - en: English content with /en prefix
 */
export type DocsLocale = 'root' | 'en';

/**
 * Normalize various locale inputs to Docs locale.
 * Accepts both Starlight locale (`root`/`en`) and language tags (`zh`, `zh-CN`, `en`).
 */
export function normalizeDocsLocale(lang: string | null | undefined): DocsLocale {
  if (!lang) {
    return 'root';
  }

  const normalized = lang.trim().toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  if (normalized === 'root' || normalized === 'zh' || normalized === 'zh-cn' || normalized.startsWith('zh-')) {
    return 'root';
  }

  return 'root';
}

/**
 * Resolve locale using a priority chain and fallback to root.
 */
export function resolveDocsLocale(...candidates: Array<string | null | undefined>): DocsLocale {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const locale = normalizeDocsLocale(candidate);
    if (locale === 'en') {
      return 'en';
    }
    if (locale === 'root') {
      return 'root';
    }
  }

  return 'root';
}

/**
 * Map Docs locale to InstallButton locale prop.
 */
export function toInstallButtonLocale(locale: DocsLocale): 'zh' | 'en' {
  return locale === 'en' ? 'en' : 'zh';
}
