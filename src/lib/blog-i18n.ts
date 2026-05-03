export const DEFAULT_BLOG_LANGUAGE = 'zh-CN';

export const BLOG_LANGUAGE_CODES = [
  'zh-CN',
  'zh-Hant',
  'en-US',
  'ja-JP',
  'ko-KR',
  'de-DE',
  'fr-FR',
  'es-ES',
  'pt-BR',
  'ru-RU',
] as const;

export type BlogLanguageCode = (typeof BLOG_LANGUAGE_CODES)[number];
export type BlogRouteLocale = 'root' | 'en-US' | Exclude<BlogLanguageCode, 'zh-CN' | 'en-US'>;
export type BlogRssScope = BlogLanguageCode | 'all';

export type BlogLanguageOption = {
  code: BlogLanguageCode;
  routeLocale: BlogRouteLocale;
  routePrefix: string;
  name: string;
  nativeName: string;
  shortLabel: string;
  fallbackCodes: readonly BlogLanguageCode[];
  rssPath: string;
};

export const BLOG_LANGUAGE_OPTIONS: readonly BlogLanguageOption[] = [
  {
    code: 'zh-CN',
    routeLocale: 'root',
    routePrefix: '',
    name: 'Simplified Chinese',
    nativeName: '简体中文',
    shortLabel: '中',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.zh-CN.xml',
  },
  {
    code: 'zh-Hant',
    routeLocale: 'zh-Hant',
    routePrefix: 'zh-Hant',
    name: 'Traditional Chinese',
    nativeName: '繁體中文',
    shortLabel: '繁',
    fallbackCodes: ['zh-CN', 'en-US'],
    rssPath: '/blog/rss.zh-Hant.xml',
  },
  {
    code: 'en-US',
    routeLocale: 'en-US',
    routePrefix: 'en-US',
    name: 'English',
    nativeName: 'English',
    shortLabel: 'EN',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.en.xml',
  },
  {
    code: 'ja-JP',
    routeLocale: 'ja-JP',
    routePrefix: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    shortLabel: '日',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.ja-JP.xml',
  },
  {
    code: 'ko-KR',
    routeLocale: 'ko-KR',
    routePrefix: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    shortLabel: '한',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.ko-KR.xml',
  },
  {
    code: 'de-DE',
    routeLocale: 'de-DE',
    routePrefix: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    shortLabel: 'DE',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.de-DE.xml',
  },
  {
    code: 'fr-FR',
    routeLocale: 'fr-FR',
    routePrefix: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    shortLabel: 'FR',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.fr-FR.xml',
  },
  {
    code: 'es-ES',
    routeLocale: 'es-ES',
    routePrefix: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    shortLabel: 'ES',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.es-ES.xml',
  },
  {
    code: 'pt-BR',
    routeLocale: 'pt-BR',
    routePrefix: 'pt-BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português (Brasil)',
    shortLabel: 'PT',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.pt-BR.xml',
  },
  {
    code: 'ru-RU',
    routeLocale: 'ru-RU',
    routePrefix: 'ru-RU',
    name: 'Russian',
    nativeName: 'Русский',
    shortLabel: 'RU',
    fallbackCodes: ['en-US'],
    rssPath: '/blog/rss.ru-RU.xml',
  },
];

const BLOG_LANGUAGE_BY_CODE = new Map<BlogLanguageCode, BlogLanguageOption>(
  BLOG_LANGUAGE_OPTIONS.map((language) => [language.code, language]),
);

const BLOG_LANGUAGE_BY_ROUTE_LOCALE = new Map<BlogRouteLocale, BlogLanguageOption>(
  BLOG_LANGUAGE_OPTIONS.map((language) => [language.routeLocale, language]),
);

export const BLOG_ROUTE_LOCALES = BLOG_LANGUAGE_OPTIONS.map((language) => language.routeLocale);
export const BLOG_LANGUAGE_INPUTS = [
  ...BLOG_LANGUAGE_CODES,
  'zh',
  'zh-Hans',
  'zh-TW',
  'zh-HK',
  'zh-MO',
  'en',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'ru',
] as const;

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

export function normalizeBlogLanguageCode(language: string | null | undefined): BlogLanguageCode | null {
  if (!language) {
    return null;
  }

  const canonical = canonicalizeLocale(language);
  const normalized = canonical.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'root' || normalized === 'zh' || normalized.includes('-hans') || ['zh-cn', 'zh-sg'].includes(normalized)) {
    return 'zh-CN';
  }

  if (normalized === 'zh-hant' || normalized.includes('-hant') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) {
    return 'zh-Hant';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en-US';
  }

  for (const supportedCode of BLOG_LANGUAGE_CODES) {
    if (supportedCode.toLowerCase() === normalized) {
      return supportedCode;
    }
  }

  const [languagePart] = normalized.split('-');
  switch (languagePart) {
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'pt':
      return 'pt-BR';
    case 'ru':
      return 'ru-RU';
    default:
      return null;
  }
}

export function resolveBlogLanguageCode(
  language: string | null | undefined,
  fallback: BlogLanguageCode = DEFAULT_BLOG_LANGUAGE,
): BlogLanguageCode {
  return normalizeBlogLanguageCode(language) ?? fallback;
}

export function getBlogLanguageOption(language: string | null | undefined): BlogLanguageOption | null {
  const code = normalizeBlogLanguageCode(language);
  return code ? BLOG_LANGUAGE_BY_CODE.get(code) ?? null : null;
}

export function getBlogLanguageByRouteLocale(routeLocale: string | null | undefined): BlogLanguageOption | null {
  if (!routeLocale) {
    return null;
  }

  if (routeLocale === 'root') {
    return BLOG_LANGUAGE_BY_ROUTE_LOCALE.get('root') ?? null;
  }

  if (routeLocale === 'en-US') {
    return BLOG_LANGUAGE_BY_ROUTE_LOCALE.get('en-US') ?? null;
  }

  const code = normalizeBlogLanguageCode(routeLocale);
  if (!code) {
    return null;
  }

  return BLOG_LANGUAGE_BY_CODE.get(code) ?? null;
}

export function getBlogRouteLocale(language: string | null | undefined): BlogRouteLocale | null {
  return getBlogLanguageOption(language)?.routeLocale ?? null;
}

export function isBlogRouteLocale(routeLocale: string | null | undefined): routeLocale is BlogRouteLocale {
  return getBlogLanguageByRouteLocale(routeLocale) !== null;
}

export function stripBlogLocalePrefix(pathname = '/'): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  for (const routeLocale of BLOG_ROUTE_LOCALES) {
    if (routeLocale === 'root') {
      continue;
    }

    if (normalizedPath === `/${routeLocale}`) {
      return '/';
    }

    if (normalizedPath.startsWith(`/${routeLocale}/`)) {
      return normalizedPath.slice(routeLocale.length + 1) || '/';
    }
  }

  return normalizedPath;
}

export function buildBlogRoutePath(language: string | null | undefined, blogPath = '/blog/'): string {
  const option = getBlogLanguageOption(language) ?? BLOG_LANGUAGE_BY_CODE.get(DEFAULT_BLOG_LANGUAGE)!;
  const normalizedPath = stripBlogLocalePrefix(blogPath || '/blog/');
  const pathWithSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  if (!option.routePrefix) {
    return pathWithSlash;
  }

  return `/${option.routePrefix}${pathWithSlash}`;
}

export function buildBlogPostRoutePath(language: string | null | undefined, slug: string): string {
  return buildBlogRoutePath(language, `/blog/${slug}/`);
}

export function deriveBlogLanguageFromContentId(id: string): BlogLanguageCode {
  for (const option of BLOG_LANGUAGE_OPTIONS) {
    if (!option.routePrefix) {
      continue;
    }

    if (id === `${option.routePrefix}/blog` || id.startsWith(`${option.routePrefix}/blog/`)) {
      return option.code;
    }
  }

  return 'zh-CN';
}

export function getAllBlogRssLinks() {
  return BLOG_LANGUAGE_OPTIONS.map((language) => ({
    scope: language.code,
    label: language.nativeName,
    path: language.rssPath,
  }));
}
