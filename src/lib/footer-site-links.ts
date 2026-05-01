import footerSitesSnapshot from '@/data/footer-sites.snapshot.json';
import { DOCS_ROUTE_TO_SOURCE_LOCALE, parseDocsLocale } from './i18n';

interface FooterCatalogLink {
  siteId: string;
  title: string;
  description: string;
  href: string;
}

type FooterCatalogLocale = 'zh-CN' | 'zh-Hant' | 'en-US' | 'ja-JP' | 'ko-KR' | 'de-DE' | 'fr-FR' | 'es-ES' | 'pt-BR' | 'ru-RU';
type LocalizedFooterField = string | Readonly<Record<FooterCatalogLocale, string>>;

type FooterSnapshotEntry = {
  id: string;
  title: LocalizedFooterField;
  description: LocalizedFooterField;
  url: string;
};

const DEFAULT_RELATED_SITE_ORDER = [
  'hagicode-main',
  'hagicode-docs',
  'newbe-blog',
  'index-data',
  'compose-builder',
  'cost-calculator',
  'status-page',
  'awesome-design-gallery',
  'soul-builder',
  'trait-builder',
] as const;

const CURRENT_SITE_ID = 'hagicode-docs';

function normalizeUrl(url: string) {
  const normalized = new URL(url);
  normalized.hash = '';
  normalized.search = '';
  const pathname = normalized.pathname.replace(/\/+$/u, '');
  normalized.pathname = pathname || '/';
  return normalized.toString();
}

function getFooterLocaleFallbackChain(locale: FooterCatalogLocale): readonly FooterCatalogLocale[] {
  return locale === 'zh-Hant' ? ['zh-CN', 'en-US'] : ['en-US'];
}

function resolveLocalizedField(field: LocalizedFooterField, locale: FooterCatalogLocale): string {
  if (typeof field === 'string') {
    return field;
  }

  for (const candidate of [locale, ...getFooterLocaleFallbackChain(locale)]) {
    const value = field[candidate as SiteLocale];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  for (const value of Object.values(field)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

function resolveDocsFooterLocale(locale: string | null | undefined): FooterCatalogLocale {
  const routeLocale = parseDocsLocale(locale) ?? 'root';
  return (DOCS_ROUTE_TO_SOURCE_LOCALE[routeLocale] ?? 'zh-CN') as FooterCatalogLocale;
}

export function resolveDocsFooterSiteLinks(
  locale: string | null | undefined,
  localLinks: ReadonlyArray<{ href: string; siteId?: string }> = [],
): FooterCatalogLink[] {
  const resolvedLocale = resolveDocsFooterLocale(locale);
  const localIds = new Set(localLinks.flatMap((link) => (link.siteId ? [link.siteId] : [])));
  const localUrls = new Set(localLinks.map((link) => normalizeUrl(link.href)));
  const snapshotById = new Map<string, FooterSnapshotEntry>(
    footerSitesSnapshot.entries.map((entry) => [entry.id, entry as FooterSnapshotEntry]),
  );

  return DEFAULT_RELATED_SITE_ORDER.flatMap((siteId) => {
    const entry = snapshotById.get(siteId);
    if (!entry || entry.id === CURRENT_SITE_ID) {
      return [];
    }

    if (localIds.has(entry.id) || localUrls.has(normalizeUrl(entry.url))) {
      return [];
    }

    return [
      {
        siteId: entry.id,
        title: resolveLocalizedField(entry.title, resolvedLocale),
        description: resolveLocalizedField(entry.description, resolvedLocale),
        href: entry.url,
      },
    ];
  });
}
