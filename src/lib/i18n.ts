/**
 * Shared helpers for docs locale handling.
 *
 * Two locale rules coexist in the docs site today:
 * - Starlight content fallback still treats the root locale as Chinese.
 * - Landing pages and docs/blog content pages now use different default-route strategies.
 */

import {
  DOCS_LOCALE_RESOURCES,
  DOCS_LOCALE_SELECTOR_OPTIONS,
} from '../i18n/generated/docs-locale-resources.mjs';

export type DocsLocale =
  | 'root'
  | 'en-US'
  | 'zh-Hant'
  | 'fr-FR'
  | 'it-IT'
  | 'de-DE'
  | 'es-ES'
  | 'bg-BG'
  | 'cs-CZ'
  | 'da-DK'
  | 'nl-NL'
  | 'fi-FI'
  | 'el-GR'
  | 'hu-HU'
  | 'id-ID'
  | 'ja-JP'
  | 'ko-KR'
  | 'nb-NO'
  | 'pl-PL'
  | 'pt-BR'
  | 'pt-PT'
  | 'ro-RO'
  | 'ru-RU'
  | 'es-419'
  | 'sv-SE'
  | 'th-TH'
  | 'tr-TR'
  | 'uk-UA'
  | 'vi-VN';

export type DocsLanguageParam = string;

type DocsContentLayoutToggleCopy = {
  label: string;
  wide: string;
  narrow: string;
};

type DocsFooterCopy = {
  copyright: string;
  sections: {
    ecosystemSites: string;
    quickLinks: string;
    community: string;
  };
  navigation: {
    ecosystemSites: string;
    quickLinks: string;
    community: string;
  };
  filings: {
    icpAriaLabel: string;
    publicSecurityAriaLabel: string;
  };
};

type GeneratedDocsLocaleOption = {
  code: DocsLocale;
  sourceLocale: string;
  label: string;
  lang: string;
  htmlLang: string;
  direction: string;
};

export const DOCS_LOCALE_METADATA = DOCS_LOCALE_SELECTOR_OPTIONS as GeneratedDocsLocaleOption[];
export const DOCS_ROUTE_LOCALE_CODES = DOCS_LOCALE_METADATA.map((locale) => locale.code) as DocsLocale[];
export const DOCS_ROUTE_TO_SOURCE_LOCALE = Object.fromEntries(
  DOCS_LOCALE_METADATA.map((locale) => [locale.code, locale.sourceLocale]),
) as Record<DocsLocale, string>;
export const DOCS_ROUTE_LOCALE_LABELS = Object.fromEntries(
  DOCS_LOCALE_METADATA.map((locale) => [locale.code, locale.label]),
) as Record<DocsLocale, string>;

function canonicalizeLocale(locale: string): string {
  const candidate = locale.trim().replace(/_/g, '-');
  if (!candidate) {
    return '';
  }

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate;
  } catch {
    return candidate;
  }
}

function normalizeLocaleKey(locale: string): string {
  return canonicalizeLocale(locale).toLowerCase();
}

const DOCS_ROUTE_LOCALE_BY_NORMALIZED_KEY = Object.fromEntries(
  DOCS_LOCALE_METADATA.map((locale) => [normalizeLocaleKey(locale.code), locale.code]),
) as Record<string, DocsLocale>;

const DOCS_SOURCE_TO_ROUTE_LOCALE = Object.fromEntries(
  [
    ...Object.entries(DOCS_LOCALE_RESOURCES['en-US'].metadata.aliases),
    ['en', 'en-US'],
  ].map(([locale, routeLocale]) => [normalizeLocaleKey(locale), routeLocale]),
) as Record<string, DocsLocale>;
const DOCS_ROUTE_LOCALE_BY_LANGUAGE = new Map<string, DocsLocale>();

for (const locale of DOCS_LOCALE_METADATA) {
  const languagePart = normalizeLocaleKey(locale.sourceLocale).split('-')[0];
  if (!DOCS_ROUTE_LOCALE_BY_LANGUAGE.has(languagePart)) {
    DOCS_ROUTE_LOCALE_BY_LANGUAGE.set(languagePart, locale.code);
  }
}

export const DOCS_LANGUAGE_STORAGE_KEY = 'starlight-route';
export const DEFAULT_DOCS_ENTRY_LOCALE: DocsLocale = 'en-US';
export const RELEASE_NOTES_ROUTE_PREFIX = '/release-notes';
export const DOCS_ENTRY_PATHS: Partial<Record<DocsLocale, string>> = {
  root: '/',
  'en-US': '/en-US/',
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

  const normalized = normalizeLocaleKey(lang);
  if (!normalized) {
    return null;
  }

  const generatedRouteLocale = DOCS_SOURCE_TO_ROUTE_LOCALE[normalized];
  if (generatedRouteLocale) {
    return generatedRouteLocale;
  }

  const directRouteLocale = DOCS_ROUTE_LOCALE_BY_NORMALIZED_KEY[normalized];
  if (directRouteLocale) {
    return directRouteLocale;
  }

  const [languagePart] = normalized.split('-');
  return DOCS_ROUTE_LOCALE_BY_LANGUAGE.get(languagePart) ?? null;
}

export function getCanonicalDocsRouteLocale(lang: string | null | undefined): DocsLocale | null {
  return parseDocsLocale(lang);
}

export function getCanonicalDocsSourceLocale(
  lang: string | null | undefined,
): string | null {
  const routeLocale = getCanonicalDocsRouteLocale(lang);
  return routeLocale ? DOCS_ROUTE_TO_SOURCE_LOCALE[routeLocale] : null;
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

function consumeLeadingDocsLocaleSegments(pathname = '/'): {
  locale: DocsLocale | null;
  path: string;
} {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  let remainingPath = normalizedPath || '/';
  let resolvedLocale: DocsLocale | null = null;

  while (remainingPath.startsWith('/')) {
    const match = remainingPath.match(/^\/([^/]+)(?=\/|$)/);
    if (!match) {
      break;
    }

    const matchedLocale = parseDocsLocale(match[1]);
    if (!matchedLocale) {
      break;
    }

    resolvedLocale = matchedLocale;
    remainingPath = remainingPath.slice(match[0].length) || '/';
    if (!remainingPath.startsWith('/')) {
      remainingPath = `/${remainingPath}`;
    }
  }

  return {
    locale: resolvedLocale,
    path: remainingPath || '/',
  };
}

/**
 * Remove the docs locale prefix from a path.
 */
export function stripDocsLocalePrefix(pathname = '/'): string {
  if (!pathname) {
    return '/';
  }

  return consumeLeadingDocsLocaleSegments(pathname).path;
}

/**
 * Collapse locale aliases and stacked locale prefixes into a canonical docs path.
 */
export function normalizeDocsRoutePath(pathname = '/'): string {
  if (!pathname) {
    return '/';
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const { locale, path } = consumeLeadingDocsLocaleSegments(normalizedPath);
  if (!locale) {
    return normalizedPath;
  }

  return buildDocsRoutePath(locale, path || '/');
}

export function getCanonicalDocsPath(pathname = '/'): string {
  return stripDocsLocalePrefix(normalizeDocsRoutePath(pathname));
}

/**
 * Returns true when the path already targets the English docs locale.
 */
export function isEnglishDocsPath(pathname = '/'): boolean {
  return pathname === '/en-US' || pathname.startsWith('/en-US/');
}

/**
 * Returns true when the route is one of the docs landing pages (`/` or `/en-US/`).
 */
export function isLandingRoutePath(pathname = '/'): boolean {
  return stripDocsLocalePrefix(pathname) === '/';
}

/**
 * Returns true when the route is the localized release-notes landing page.
 */
export function isReleaseNotesRoutePath(pathname = '/'): boolean {
  const normalizedPath = stripDocsLocalePrefix(pathname);
  return (
    normalizedPath === RELEASE_NOTES_ROUTE_PREFIX
    || normalizedPath === `${RELEASE_NOTES_ROUTE_PREFIX}/`
  );
}

/**
 * Build the localized docs route path.
 */
export function buildDocsRoutePath(locale: DocsLocale, originalPath = '/'): string {
  const normalizedPath = getCanonicalDocsPath(originalPath || '/');

  if (locale === 'en-US') {
    return normalizedPath === '/' ? DOCS_ENTRY_PATHS['en-US'] ?? '/en-US/' : `/en-US${normalizedPath}`;
  }

  if (locale === 'root') {
    return normalizedPath || '/';
  }

  return normalizedPath === '/' ? `/${locale}/` : `/${locale}${normalizedPath}`;
}

export function buildDocsCounterpartPath(locale: DocsLocale, originalPath = '/'): string {
  return buildDocsRoutePath(locale, getCanonicalDocsPath(originalPath));
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
    if (typeof parsed.lang !== 'string') {
      return null;
    }

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
 * `query > stored preference > client language > default en-US`.
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
  return locale === 'en-US' ? 'en' : 'zh';
}

const DEFAULT_DOCS_CONTENT_LAYOUT_TOGGLE_COPY: DocsContentLayoutToggleCopy = {
  label: 'Content layout',
  wide: 'Wide',
  narrow: 'Narrow',
};

const DOCS_CONTENT_LAYOUT_TOGGLE_COPY_OVERRIDES: Partial<Record<DocsLocale, DocsContentLayoutToggleCopy>> = {
  root: {
    label: '正文宽度',
    wide: '宽版',
    narrow: '窄版',
  },
  'zh-Hant': {
    label: '正文寬度',
    wide: '寬版',
    narrow: '窄版',
  },
  'ja-JP': {
    label: '本文幅',
    wide: 'ワイド',
    narrow: '標準',
  },
  'ko-KR': {
    label: '본문 너비',
    wide: '넓게',
    narrow: '좁게',
  },
  'de-DE': {
    label: 'Inhaltsbreite',
    wide: 'Breit',
    narrow: 'Schmal',
  },
  'fr-FR': {
    label: 'Largeur du contenu',
    wide: 'Large',
    narrow: 'Étroit',
  },
  'es-ES': {
    label: 'Ancho del contenido',
    wide: 'Ancho',
    narrow: 'Estrecho',
  },
  'pt-BR': {
    label: 'Largura do conteúdo',
    wide: 'Largo',
    narrow: 'Estreito',
  },
  'ru-RU': {
    label: 'Ширина контента',
    wide: 'Широкий',
    narrow: 'Узкий',
  },
};

const DEFAULT_DOCS_FOOTER_COPY: DocsFooterCopy = {
  copyright: 'All rights reserved.',
  sections: {
    ecosystemSites: 'Ecosystem Sites',
    quickLinks: 'Quick Links',
    community: 'Community',
  },
  navigation: {
    ecosystemSites: 'Ecosystem site links',
    quickLinks: 'Quick links',
    community: 'Community links',
  },
  filings: {
    icpAriaLabel: 'View ICP filing information',
    publicSecurityAriaLabel: 'View public security filing information',
  },
};

const DOCS_FOOTER_COPY_OVERRIDES: Partial<Record<DocsLocale, DocsFooterCopy>> = {
  root: {
    copyright: 'All rights reserved.',
    sections: {
      ecosystemSites: '生态站点',
      quickLinks: '快速链接',
      community: '社区',
    },
    navigation: {
      ecosystemSites: '生态站点链接',
      quickLinks: '快速链接',
      community: '社区链接',
    },
    filings: {
      icpAriaLabel: '查看 ICP 备案信息',
      publicSecurityAriaLabel: '查看公安备案信息',
    },
  },
  'zh-Hant': {
    copyright: '版權所有。',
    sections: {
      ecosystemSites: '生態站點',
      quickLinks: '快速連結',
      community: '社群',
    },
    navigation: {
      ecosystemSites: '生態站點連結',
      quickLinks: '快速連結',
      community: '社群連結',
    },
    filings: {
      icpAriaLabel: '查看 ICP 備案資訊',
      publicSecurityAriaLabel: '查看公安備案資訊',
    },
  },
  'ja-JP': {
    copyright: 'All rights reserved.',
    sections: {
      ecosystemSites: 'エコシステムサイト',
      quickLinks: 'クイックリンク',
      community: 'コミュニティ',
    },
    navigation: {
      ecosystemSites: 'エコシステムサイトへのリンク',
      quickLinks: 'クイックリンク',
      community: 'コミュニティリンク',
    },
    filings: {
      icpAriaLabel: 'ICP 登録情報を表示',
      publicSecurityAriaLabel: '公安登録情報を表示',
    },
  },
  'ko-KR': {
    copyright: 'All rights reserved.',
    sections: {
      ecosystemSites: '에코시스템 사이트',
      quickLinks: '빠른 링크',
      community: '커뮤니티',
    },
    navigation: {
      ecosystemSites: '에코시스템 사이트 링크',
      quickLinks: '빠른 링크',
      community: '커뮤니티 링크',
    },
    filings: {
      icpAriaLabel: 'ICP 등록 정보 보기',
      publicSecurityAriaLabel: '공안 등록 정보 보기',
    },
  },
  'de-DE': {
    copyright: 'Alle Rechte vorbehalten.',
    sections: {
      ecosystemSites: 'Ökosystem-Seiten',
      quickLinks: 'Schnellzugriffe',
      community: 'Community',
    },
    navigation: {
      ecosystemSites: 'Links zu Ökosystem-Seiten',
      quickLinks: 'Schnellzugriffe',
      community: 'Community-Links',
    },
    filings: {
      icpAriaLabel: 'ICP-Registrierungsinformationen anzeigen',
      publicSecurityAriaLabel: 'Informationen zur Sicherheitsregistrierung anzeigen',
    },
  },
  'fr-FR': {
    copyright: 'Tous droits réservés.',
    sections: {
      ecosystemSites: "Sites de l'écosystème",
      quickLinks: 'Liens rapides',
      community: 'Communauté',
    },
    navigation: {
      ecosystemSites: "Liens vers les sites de l'écosystème",
      quickLinks: 'Liens rapides',
      community: 'Liens communautaires',
    },
    filings: {
      icpAriaLabel: 'Voir les informations de dépôt ICP',
      publicSecurityAriaLabel: 'Voir les informations de dépôt de sécurité publique',
    },
  },
  'es-ES': {
    copyright: 'Todos los derechos reservados.',
    sections: {
      ecosystemSites: 'Sitios del ecosistema',
      quickLinks: 'Enlaces rápidos',
      community: 'Comunidad',
    },
    navigation: {
      ecosystemSites: 'Enlaces de sitios del ecosistema',
      quickLinks: 'Enlaces rápidos',
      community: 'Enlaces de la comunidad',
    },
    filings: {
      icpAriaLabel: 'Ver la información de registro ICP',
      publicSecurityAriaLabel: 'Ver la información de registro de seguridad pública',
    },
  },
  'pt-BR': {
    copyright: 'Todos os direitos reservados.',
    sections: {
      ecosystemSites: 'Sites do ecossistema',
      quickLinks: 'Links rápidos',
      community: 'Comunidade',
    },
    navigation: {
      ecosystemSites: 'Links dos sites do ecossistema',
      quickLinks: 'Links rápidos',
      community: 'Links da comunidade',
    },
    filings: {
      icpAriaLabel: 'Ver informações de registro ICP',
      publicSecurityAriaLabel: 'Ver informações de registro de segurança pública',
    },
  },
  'ru-RU': {
    copyright: 'Все права защищены.',
    sections: {
      ecosystemSites: 'Сайты экосистемы',
      quickLinks: 'Быстрые ссылки',
      community: 'Сообщество',
    },
    navigation: {
      ecosystemSites: 'Ссылки на сайты экосистемы',
      quickLinks: 'Быстрые ссылки',
      community: 'Ссылки сообщества',
    },
    filings: {
      icpAriaLabel: 'Показать информацию о регистрации ICP',
      publicSecurityAriaLabel: 'Показать информацию о регистрации в органах общественной безопасности',
    },
  },
};

export function getDocsContentLayoutToggleCopy(
  localeInput: string | null | undefined,
): DocsContentLayoutToggleCopy {
  const locale = resolveDocsLocale(localeInput);
  return DOCS_CONTENT_LAYOUT_TOGGLE_COPY_OVERRIDES[locale] ?? DEFAULT_DOCS_CONTENT_LAYOUT_TOGGLE_COPY;
}

export function getDocsFooterCopy(localeInput: string | null | undefined): DocsFooterCopy {
  const locale = resolveDocsLocale(localeInput);
  return DOCS_FOOTER_COPY_OVERRIDES[locale] ?? DEFAULT_DOCS_FOOTER_COPY;
}

export const BLOG_ROUTE_LOCALES = DOCS_ROUTE_LOCALE_CODES;
