/**
 * Client-side landing route resolution for docs entry pages.
 *
 * Rule priority:
 * - all routed docs pages: `query > stored preference > client language > default en`
 */

import {
  buildDocsRoutePath,
  DOCS_LANGUAGE_STORAGE_KEY,
  DEFAULT_DOCS_ENTRY_LOCALE,
  getStoredDocsLocale,
  isLandingRoutePath,
  parseDocsLocale,
  parseLangFromUrl,
  resolveClientDocsLocale,
  serializeStoredDocsLocale,
  type DocsLocale,
} from './i18n.ts';

export interface LandingRouteResolution {
  currentPath: string;
  targetPath: string;
  targetUrl: string;
  resolvedLocale: DocsLocale;
  requestedLang: string | null;
  storedLocale: DocsLocale | null;
  isLandingPath: boolean;
  shouldPersist: boolean;
  shouldRedirect: boolean;
}

function resolveRouteLocale(options: {
  requestedLang: string | null;
  storedLocale: DocsLocale | null;
  clientLanguages: Array<string | null | undefined>;
}): { locale: DocsLocale; shouldPersist: boolean } {
  const { requestedLang, storedLocale, clientLanguages } = options;

  if (requestedLang !== null) {
    const requestedLocale = parseDocsLocale(requestedLang);
    return {
      locale: requestedLocale ?? storedLocale ?? resolveClientDocsLocale(clientLanguages) ?? DEFAULT_DOCS_ENTRY_LOCALE,
      shouldPersist: requestedLocale !== null,
    };
  }

  if (storedLocale) {
    return { locale: storedLocale, shouldPersist: false };
  }

  return {
    locale: resolveClientDocsLocale(clientLanguages) ?? DEFAULT_DOCS_ENTRY_LOCALE,
    shouldPersist: true,
  };
}

function getClientLanguages(win: Window): string[] {
  const languages = Array.isArray(win.navigator?.languages)
    ? win.navigator.languages
    : [];

  if (languages.length > 0) {
    return languages.filter((language): language is string => typeof language === 'string');
  }

  return typeof win.navigator?.language === 'string' ? [win.navigator.language] : [];
}

function normalizeLandingTargetPath(pathname: string | null | undefined): string | null {
  if (!pathname) {
    return null;
  }

  const trimmed = pathname.trim();
  if (!trimmed) {
    return null;
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getLandingTargetPath(doc?: Document): string | null {
  const meta = doc?.querySelector('meta[name="hagicode-docs-landing-target"]');
  return normalizeLandingTargetPath(meta?.getAttribute('content'));
}

function buildTargetUrl(currentUrl: URL, targetPath: string): URL {
  const targetUrl = new URL(targetPath, currentUrl.origin);

  currentUrl.searchParams.forEach((value, key) => {
    if (key !== 'lang') {
      targetUrl.searchParams.set(key, value);
    }
  });

  targetUrl.hash = currentUrl.hash;
  return targetUrl;
}

export function resolveDocsLandingRoute(
  currentUrl: URL,
  storedRouteValue: string | null | undefined,
  clientLanguages: Array<string | null | undefined> = [],
  landingTargetPath: string | null = null,
): LandingRouteResolution {
  const requestedLang = parseLangFromUrl(currentUrl);
  const storedLocale = getStoredDocsLocale(storedRouteValue);
  const currentPath = currentUrl.pathname || '/';
  const isLandingPath = isLandingRoutePath(currentPath);
  const { locale: resolvedLocale, shouldPersist } = resolveRouteLocale({
    requestedLang,
    storedLocale,
    clientLanguages,
  });
  const targetBasePath =
    landingTargetPath && isLandingPath ? landingTargetPath : currentPath;
  const targetPath = buildDocsRoutePath(resolvedLocale, targetBasePath);
  const targetUrl = buildTargetUrl(currentUrl, targetPath);

  return {
    currentPath,
    targetPath,
    targetUrl: targetUrl.toString(),
    resolvedLocale,
    requestedLang,
    storedLocale,
    isLandingPath,
    shouldPersist,
    shouldRedirect: targetUrl.toString() !== currentUrl.toString(),
  };
}

export function handleLanguageParameter(win?: Window): LandingRouteResolution | null {
  if (!win && typeof window === 'undefined') {
    return null;
  }

  const browserWindow = win ?? window;

  let storedRouteValue: string | null = null;
  try {
    storedRouteValue = browserWindow.localStorage.getItem(DOCS_LANGUAGE_STORAGE_KEY);
  } catch {
    storedRouteValue = null;
  }

  const resolution = resolveDocsLandingRoute(
    new URL(browserWindow.location.href),
    storedRouteValue,
    getClientLanguages(browserWindow),
    getLandingTargetPath(browserWindow.document),
  );

  if (resolution.shouldPersist) {
    try {
      browserWindow.localStorage.setItem(
        DOCS_LANGUAGE_STORAGE_KEY,
        serializeStoredDocsLocale(storedRouteValue, resolution.resolvedLocale),
      );
    } catch {
      // Ignore storage failures so the route still resolves for this visit.
    }
  }

  if (resolution.shouldRedirect) {
    if (typeof browserWindow.location.replace === 'function') {
      browserWindow.location.replace(resolution.targetUrl);
    } else {
      browserWindow.location.href = resolution.targetUrl;
    }
  }

  return resolution;
}
