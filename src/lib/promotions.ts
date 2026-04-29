import { parseDocsLocale } from '@/lib/i18n';

const INDEX_ORIGIN = 'https://index.hagicode.com';
const INDEX_CATALOG_URL = `${INDEX_ORIGIN}/index-catalog.json`;
const FALLBACK_PROMOTE_FLAGS_URL = `${INDEX_ORIGIN}/promote.json`;
const FALLBACK_PROMOTE_CONTENT_URL = `${INDEX_ORIGIN}/promote_content.json`;

// Docs treats the Index public JSON contract as read-only: discover current
// paths from the catalog first, then fall back to the canonical promote files.
// Root-relative image assets are hosted by Index, not the docs site.

type FetchLike = typeof fetch;
type PromoteLocale = 'zh' | 'en';
type JsonRecord = Record<string, unknown>;
type PromoteContentLocaleCode =
  | 'zh-CN'
  | 'zh-Hant'
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'de-DE'
  | 'fr-FR'
  | 'es-ES'
  | 'pt-BR'
  | 'ru-RU';

interface IndexCatalogEntry {
  id: string;
  path: string;
}

export interface PromoteFlagRecord {
  id: string;
  on: boolean;
  startTime?: string;
  endTime?: string;
}

export interface PromoteFlagsDocument {
  promotes: PromoteFlagRecord[];
}

export interface PromotionImage {
  src: string;
  alt: string;
  variant?: string;
  width?: number;
  height?: number;
}

export interface PromoteContentRecord {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  cta?: Record<string, string>;
  link: string;
  targetPlatform?: string;
  image?: PromotionImage;
}

export interface PromoteContentDocument {
  contents: PromoteContentRecord[];
}

export interface PromotionDocumentUrls {
  flagsUrl: string;
  contentUrl: string;
  source: 'catalog' | 'fallback';
}

export interface PromotionDocuments {
  urls: PromotionDocumentUrls;
  flags: PromoteFlagsDocument;
  content: PromoteContentDocument;
}

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

export interface NormalizedPromotion {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  platform: string | null;
  targetPlatform: string | null;
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  status: PromotionStatus;
  image: PromotionImage | null;
  hasImage: boolean;
  source: 'matched' | 'flag-only';
}

export interface LoadPromotionsOptions {
  locale?: string | null | undefined;
  fetchImpl?: FetchLike;
  forceRefresh?: boolean;
  now?: number;
}

const DEFAULT_PROMOTE_CONTENT_LOCALE: PromoteContentLocaleCode = 'zh-CN';
const UNSUPPORTED_PROMOTE_CONTENT_LOCALE_FALLBACK: PromoteContentLocaleCode = 'en-US';
const SUPPORTED_PROMOTE_CONTENT_LOCALE_CODES = [
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
] as const satisfies readonly PromoteContentLocaleCode[];
const PROMOTE_CONTENT_LOCALE_FALLBACKS: Record<PromoteContentLocaleCode, readonly PromoteContentLocaleCode[]> = {
  'zh-CN': ['en-US'],
  'zh-Hant': ['zh-CN', 'en-US'],
  'en-US': ['en-US'],
  'ja-JP': ['en-US'],
  'ko-KR': ['en-US'],
  'de-DE': ['en-US'],
  'fr-FR': ['en-US'],
  'es-ES': ['en-US'],
  'pt-BR': ['en-US'],
  'ru-RU': ['en-US'],
};
const DEFAULT_PROMOTE_CTA_LABELS: Record<PromoteContentLocaleCode, string> = {
  'zh-CN': '立即前往',
  'zh-Hant': '立即前往',
  'en-US': 'GO',
  'ja-JP': '今すぐ見る',
  'ko-KR': '바로 보기',
  'de-DE': 'Ansehen',
  'fr-FR': 'Voir',
  'es-ES': 'Ver ahora',
  'pt-BR': 'Ver agora',
  'ru-RU': 'Открыть',
};

let cachedDocumentsPromise: Promise<PromotionDocuments> | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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

function sanitizeLocalizedStringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries: Array<[string, string]> = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (isNonEmptyString(key) && isNonEmptyString(entryValue)) {
      entries.push([key.trim(), entryValue.trim()]);
    }
  }

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function parseCatalogEntries(payload: unknown): IndexCatalogEntry[] {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    return [];
  }

  return payload.entries.flatMap((entry) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.path)) {
      return [];
    }

    return [{ id: entry.id, path: entry.path }];
  });
}

function parseOptionalTimestamp(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function resolvePromotionStatus(record: PromoteFlagRecord, now = Date.now()): PromotionStatus {
  if (!record.on) {
    return 'disabled';
  }

  const startTime = parseTimestamp(record.startTime);
  const endTime = parseTimestamp(record.endTime);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return 'disabled';
  }

  if (startTime !== null && endTime !== null && startTime >= endTime) {
    return 'disabled';
  }

  if (startTime !== null && now < startTime) {
    return 'scheduled';
  }

  if (endTime !== null && now >= endTime) {
    return 'expired';
  }

  return 'active';
}

function parseDimension(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

function parseImageDescriptor(value: unknown): Omit<PromotionImage, 'alt'> | null {
  if (isNonEmptyString(value)) {
    return { src: value.trim() };
  }

  if (!isRecord(value)) {
    return null;
  }

  const src = isNonEmptyString(value.src)
    ? value.src.trim()
    : isNonEmptyString(value.url)
      ? value.url.trim()
      : isNonEmptyString(value.imageUrl)
        ? value.imageUrl.trim()
        : null;

  if (!src) {
    return null;
  }

  return {
    src: normalizeIndexAssetUrl(src),
    variant: isNonEmptyString(value.variant) ? value.variant.trim() : undefined,
    width: parseDimension(value.width),
    height: parseDimension(value.height),
  };
}

function normalizeIndexAssetUrl(src: string): string {
  return src.startsWith('/') ? new URL(src, INDEX_ORIGIN).toString() : src;
}

function parsePromotionImage(record: JsonRecord): PromotionImage | undefined {
  const imageCandidate = parseImageDescriptor(record.image)
    ?? parseImageDescriptor(record.imageUrl)
    ?? parseImageDescriptor(record.imageURL);

  if (!imageCandidate) {
    return undefined;
  }

  const imageRecord = isRecord(record.image) ? record.image : {};
  const alt = isNonEmptyString(imageRecord.alt)
    ? imageRecord.alt.trim()
    : isNonEmptyString(record.imageAlt)
      ? record.imageAlt.trim()
      : '';

  return {
    ...imageCandidate,
    alt,
  };
}

export function parsePromoteFlagsDocument(payload: unknown): PromoteFlagsDocument {
  if (!isRecord(payload) || !Array.isArray(payload.promotes)) {
    return { promotes: [] };
  }

  return {
    promotes: payload.promotes.flatMap((record) => {
      if (!isRecord(record) || !isNonEmptyString(record.id) || typeof record.on !== 'boolean') {
        return [];
      }

      return [{
        id: record.id,
        on: record.on,
        startTime: parseOptionalTimestamp(record.startTime),
        endTime: parseOptionalTimestamp(record.endTime),
      }];
    }),
  };
}

export function parsePromoteContentDocument(payload: unknown): PromoteContentDocument {
  if (!isRecord(payload) || !Array.isArray(payload.contents)) {
    return { contents: [] };
  }

  return {
    contents: payload.contents.flatMap((record) => {
      if (!isRecord(record) || !isNonEmptyString(record.id) || !isNonEmptyString(record.link)) {
        return [];
      }

      const title = sanitizeLocalizedStringMap(record.title);
      const description = sanitizeLocalizedStringMap(record.description);
      const cta = sanitizeLocalizedStringMap(record.cta);
      if (!title || !description) {
        return [];
      }

      return [{
        id: record.id,
        title,
        description,
        cta: cta ?? undefined,
        link: record.link.trim(),
        targetPlatform: isNonEmptyString(record.targetPlatform) ? record.targetPlatform.trim() : undefined,
        image: parsePromotionImage(record),
      }];
    }),
  };
}

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const isJsonResponse = contentType.includes('application/json') || contentType.includes('+json');

  if (!isJsonResponse) {
    throw new Error(`Expected JSON response from ${url}, received ${contentType || 'unknown content type'}`);
  }

  return response.json();
}

function buildCatalogUrl(path: string): string {
  return new URL(path, INDEX_ORIGIN).toString();
}

export function clearPromotionDocumentCache(): void {
  cachedDocumentsPromise = null;
}

export function mapDocsLocaleToPromoteLocale(locale: string | null | undefined): PromoteLocale {
  const docsLocale = parseDocsLocale(locale);
  if (docsLocale === 'root') {
    return 'zh';
  }

  if (docsLocale === 'en') {
    return 'en';
  }

  const contentLocale = normalizePromoteContentLocale(locale);
  if (contentLocale === 'zh-CN' || contentLocale === 'zh-Hant') {
    return 'zh';
  }

  return 'en';
}

function localizePlatform(targetPlatform: string | undefined, locale: PromoteLocale): string | null {
  if (!isNonEmptyString(targetPlatform)) {
    return null;
  }

  const normalized = targetPlatform.trim().toLowerCase();
  const labels: Record<string, Record<PromoteLocale, string>> = {
    steam: {
      zh: 'Steam',
      en: 'Steam',
    },
    web: {
      zh: 'Web',
      en: 'Web',
    },
  };

  return labels[normalized]?.[locale] ?? targetPlatform.trim();
}

function normalizePromoteContentLocale(locale: string | null | undefined): PromoteContentLocaleCode | null {
  if (!locale) {
    return null;
  }

  const docsLocale = parseDocsLocale(locale);
  if (docsLocale === 'root') {
    return 'zh-CN';
  }

  if (docsLocale === 'en') {
    return 'en-US';
  }

  const canonical = canonicalizeLocale(locale);
  const normalized = canonical.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'zh-hant' || normalized.includes('-hant') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) {
    return 'zh-Hant';
  }

  if (normalized === 'zh' || normalized.includes('-hans') || ['zh-cn', 'zh-sg'].includes(normalized)) {
    return 'zh-CN';
  }

  for (const supportedCode of SUPPORTED_PROMOTE_CONTENT_LOCALE_CODES) {
    if (supportedCode.toLowerCase() === normalized) {
      return supportedCode;
    }
  }

  const [languagePart] = normalized.split('-');
  switch (languagePart) {
    case 'en':
      return 'en-US';
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

function resolvePromoteContentLocale(locale: string | null | undefined): PromoteContentLocaleCode {
  if (locale === undefined || locale === null || locale.trim().length === 0) {
    return DEFAULT_PROMOTE_CONTENT_LOCALE;
  }

  return normalizePromoteContentLocale(locale) ?? UNSUPPORTED_PROMOTE_CONTENT_LOCALE_FALLBACK;
}

function getPromoteContentKeys(locale: string | null | undefined): string[] {
  const resolvedLocale = resolvePromoteContentLocale(locale);
  const fallbackCodes = PROMOTE_CONTENT_LOCALE_FALLBACKS[resolvedLocale];
  const keys = [
    resolvedLocale,
    resolvedLocale.split('-')[0] ?? resolvedLocale,
    ...fallbackCodes,
    ...fallbackCodes.map((code) => code.split('-')[0] ?? code),
  ];

  return [...new Set(keys)];
}

function pickLocalizedValue(value: Record<string, string>, locale: string | null | undefined): string | null {
  const orderedKeys = getPromoteContentKeys(locale);

  for (const key of orderedKeys) {
    const candidate = value[key];
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
  }

  const fallbackValue = Object.values(value).find(isNonEmptyString);
  return fallbackValue?.trim() ?? null;
}

function resolveCtaLabel(value: Record<string, string> | undefined, locale: string | null | undefined): string {
  if (value) {
    const localized = pickLocalizedValue(value, locale);
    if (localized) {
      return localized;
    }
  }

  return DEFAULT_PROMOTE_CTA_LABELS[resolvePromoteContentLocale(locale)];
}

function resolveImage(image: PromotionImage | undefined, title: string): PromotionImage | null {
  if (!image?.src) {
    return null;
  }

  return {
    ...image,
    src: normalizeIndexAssetUrl(image.src),
    alt: isNonEmptyString(image.alt) ? image.alt.trim() : title,
  };
}

export async function resolvePromotionDocumentUrls(fetchImpl: FetchLike = fetch): Promise<PromotionDocumentUrls> {
  try {
    const catalogPayload = await readJson(fetchImpl, INDEX_CATALOG_URL);
    const entries = parseCatalogEntries(catalogPayload);
    const flagsEntry = entries.find((entry) => entry.id === 'promotion-flags');
    const contentEntry = entries.find((entry) => entry.id === 'promotion-content');

    if (flagsEntry && contentEntry) {
      return {
        flagsUrl: buildCatalogUrl(flagsEntry.path),
        contentUrl: buildCatalogUrl(contentEntry.path),
        source: 'catalog',
      };
    }
  } catch {
    // The canonical promote endpoints remain the stable fallback contract.
  }

  return {
    flagsUrl: FALLBACK_PROMOTE_FLAGS_URL,
    contentUrl: FALLBACK_PROMOTE_CONTENT_URL,
    source: 'fallback',
  };
}

export async function loadPromotionDocuments(options: {
  fetchImpl?: FetchLike;
  forceRefresh?: boolean;
} = {}): Promise<PromotionDocuments> {
  const { fetchImpl = fetch, forceRefresh = false } = options;
  const canReuseInFlightRequest = fetchImpl === fetch && forceRefresh === false;

  if (canReuseInFlightRequest && cachedDocumentsPromise) {
    return cachedDocumentsPromise;
  }

  const request = (async () => {
    const urls = await resolvePromotionDocumentUrls(fetchImpl);
    const [flagsPayload, contentPayload] = await Promise.all([
      readJson(fetchImpl, urls.flagsUrl),
      readJson(fetchImpl, urls.contentUrl),
    ]);

    return {
      urls,
      flags: parsePromoteFlagsDocument(flagsPayload),
      content: parsePromoteContentDocument(contentPayload),
    } satisfies PromotionDocuments;
  })();

  if (canReuseInFlightRequest) {
    cachedDocumentsPromise = request;
  }

  try {
    return await request;
  } finally {
    if (canReuseInFlightRequest) {
      cachedDocumentsPromise = null;
    }
  }
}

export function normalizePromotions(
  flags: PromoteFlagsDocument,
  content: PromoteContentDocument,
  locale: string | null | undefined,
  now = Date.now(),
): NormalizedPromotion[] {
  const promoteLocale = mapDocsLocaleToPromoteLocale(locale);
  const contentById = new Map(content.contents.map((entry) => [entry.id, entry]));

  return flags.promotes.flatMap<NormalizedPromotion>((record) => {
    const promoteContent = contentById.get(record.id);
    const status = resolvePromotionStatus(record, now);

    if (!promoteContent) {
      return [{
        id: record.id,
        title: record.id,
        description: '',
        ctaLabel: resolveCtaLabel(undefined, locale),
        link: '',
        platform: null,
        targetPlatform: null,
        enabled: record.on,
        startTime: record.startTime,
        endTime: record.endTime,
        status,
        image: null,
        hasImage: false,
        source: 'flag-only',
      }];
    }

    const title = pickLocalizedValue(promoteContent.title, locale);
    const description = pickLocalizedValue(promoteContent.description, locale);
    if (!title || !description) {
      return [];
    }

    const image = resolveImage(promoteContent.image, title);

    return [{
      id: promoteContent.id,
      title,
      description,
      ctaLabel: resolveCtaLabel(promoteContent.cta, locale),
      link: promoteContent.link,
      platform: localizePlatform(promoteContent.targetPlatform, promoteLocale),
      targetPlatform: promoteContent.targetPlatform ?? null,
      enabled: record.on,
      startTime: record.startTime,
      endTime: record.endTime,
      status,
      image,
      hasImage: image !== null,
      source: 'matched',
    }];
  });
}

export async function loadPromotions(options: LoadPromotionsOptions = {}): Promise<NormalizedPromotion[]> {
  const { locale, fetchImpl = fetch, forceRefresh = false, now = Date.now() } = options;

  try {
    const documents = await loadPromotionDocuments({ fetchImpl, forceRefresh });
    return normalizePromotions(documents.flags, documents.content, locale, now);
  } catch {
    return [];
  }
}

export function filterActivePromotions(promotions: NormalizedPromotion[]): NormalizedPromotion[] {
  return promotions.filter((promotion) => promotion.status === 'active' && promotion.source === 'matched' && promotion.link);
}

export function normalizeActivePromotions(
  flags: PromoteFlagsDocument,
  content: PromoteContentDocument,
  locale: string | null | undefined,
  now = Date.now(),
): NormalizedPromotion[] {
  return filterActivePromotions(normalizePromotions(flags, content, locale, now));
}

export async function loadActivePromotions(options: LoadPromotionsOptions = {}): Promise<NormalizedPromotion[]> {
  return filterActivePromotions(await loadPromotions(options));
}
