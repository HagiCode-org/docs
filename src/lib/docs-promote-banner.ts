import { parseDocsLocale } from '@/lib/i18n';

const INDEX_ORIGIN = 'https://index.hagicode.com';
const INDEX_CATALOG_URL = `${INDEX_ORIGIN}/index-catalog.json`;
const FALLBACK_PROMOTE_FLAGS_URL = `${INDEX_ORIGIN}/promote.json`;
const FALLBACK_PROMOTE_CONTENT_URL = `${INDEX_ORIGIN}/promote_content.json`;
const DEFAULT_ROTATION_INTERVAL_MS = 8000;
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DISMISSED_PROMOTIONS_STORAGE_KEY = 'hagicode:docs-promote-banner:dismissed-signature';

type FetchLike = typeof fetch;

type PromoteLocale = 'zh' | 'en';

type JsonRecord = Record<string, unknown>;

interface IndexCatalogEntry {
  id: string;
  path: string;
}

interface PromoteFlagRecord {
  id: string;
  on: boolean;
  startTime?: string;
  endTime?: string;
}

interface PromoteFlagsDocument {
  promotes: PromoteFlagRecord[];
}

interface PromoteContentRecord {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  cta?: Record<string, string>;
  link: string;
  targetPlatform?: string;
}

interface PromoteContentDocument {
  contents: PromoteContentRecord[];
}

interface PromotionDocumentUrls {
  flagsUrl: string;
  contentUrl: string;
  source: 'catalog' | 'fallback';
}

interface PromotionDocuments {
  urls: PromotionDocumentUrls;
  flags: PromoteFlagsDocument;
  content: PromoteContentDocument;
}

export interface ActivePromotion {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  platform: string | null;
}

export interface LoadActivePromotionsOptions {
  locale?: string | null | undefined;
  fetchImpl?: FetchLike;
  forceRefresh?: boolean;
  now?: number;
}

export interface DocsPromoteBannerControllerOptions extends LoadActivePromotionsOptions {
  footer?: HTMLElement | null;
  rotationIntervalMs?: number;
  refreshIntervalMs?: number;
}

let cachedDocumentsPromise: Promise<PromotionDocuments> | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

function isPromoteFlagActive(record: PromoteFlagRecord, now = Date.now()): boolean {
  if (!record.on) {
    return false;
  }

  const startTime = parseTimestamp(record.startTime);
  const endTime = parseTimestamp(record.endTime);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return false;
  }

  if (startTime !== null && endTime !== null && startTime >= endTime) {
    return false;
  }

  if (startTime !== null && now < startTime) {
    return false;
  }

  if (endTime !== null && now >= endTime) {
    return false;
  }

  return true;
}

function parsePromoteFlagsDocument(payload: unknown): PromoteFlagsDocument {
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

function parsePromoteContentDocument(payload: unknown): PromoteContentDocument {
  if (!isRecord(payload) || !Array.isArray(payload.contents)) {
    return { contents: [] };
  }

  return {
    contents: payload.contents.flatMap((record) => {
      if (
        !isRecord(record) ||
        !isNonEmptyString(record.id) ||
        !isNonEmptyString(record.link)
      ) {
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
        link: record.link,
        targetPlatform: isNonEmptyString(record.targetPlatform) ? record.targetPlatform : undefined,
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
  const isJsonResponse =
    contentType.includes('application/json') ||
    contentType.includes('+json');

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
  return parseDocsLocale(locale) === 'en' ? 'en' : 'zh';
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
  };

  return labels[normalized]?.[locale] ?? targetPlatform.trim();
}

function pickLocalizedValue(
  value: Record<string, string>,
  locale: PromoteLocale,
): string | null {
  const orderedKeys = locale === 'en'
    ? ['en', 'zh']
    : ['zh', 'zh-CN', 'en'];

  for (const key of orderedKeys) {
    const candidate = value[key];
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
  }

  const fallbackValue = Object.values(value).find(isNonEmptyString);
  return fallbackValue?.trim() ?? null;
}

function resolveCtaLabel(value: Record<string, string> | undefined, locale: PromoteLocale): string {
  if (value) {
    const localized = pickLocalizedValue(value, locale);
    if (localized) {
      return localized;
    }
  }

  return locale === 'zh' ? '立即前往' : 'GO';
}

export async function resolvePromotionDocumentUrls(
  fetchImpl: FetchLike = fetch,
): Promise<PromotionDocumentUrls> {
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
    // Fall back to canonical promote endpoints.
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

    const documents: PromotionDocuments = {
      urls,
      flags: parsePromoteFlagsDocument(flagsPayload),
      content: parsePromoteContentDocument(contentPayload),
    };

    return documents;
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

export function normalizeActivePromotions(
  flags: PromoteFlagsDocument,
  content: PromoteContentDocument,
  locale: string | null | undefined,
  now = Date.now(),
): ActivePromotion[] {
  const promoteLocale = mapDocsLocaleToPromoteLocale(locale);
  const contentById = new Map(content.contents.map((entry) => [entry.id, entry]));

  return flags.promotes.flatMap((record) => {
    if (!isPromoteFlagActive(record, now)) {
      return [];
    }

    const promoteContent = contentById.get(record.id);
    if (!promoteContent) {
      return [];
    }

    const title = pickLocalizedValue(promoteContent.title, promoteLocale);
    const description = pickLocalizedValue(promoteContent.description, promoteLocale);
    if (!title || !description) {
      return [];
    }

    return [{
      id: promoteContent.id,
      title,
      description,
      ctaLabel: resolveCtaLabel(promoteContent.cta, promoteLocale),
      link: promoteContent.link,
      platform: localizePlatform(promoteContent.targetPlatform, promoteLocale),
    }];
  });
}

export async function loadActivePromotions(
  options: LoadActivePromotionsOptions = {},
): Promise<ActivePromotion[]> {
  const { locale, fetchImpl = fetch, forceRefresh = false, now = Date.now() } = options;

  try {
    const documents = await loadPromotionDocuments({ fetchImpl, forceRefresh });
    return normalizeActivePromotions(documents.flags, documents.content, locale, now);
  } catch {
    return [];
  }
}

function setElementHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) {
    return;
  }

  if (hidden) {
    element.setAttribute('hidden', '');
    element.style.setProperty('display', 'none');
  } else {
    element.removeAttribute('hidden');
    element.style.removeProperty('display');
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readDismissedPromotionSignature(): string | null {
  return getStorage()?.getItem(DISMISSED_PROMOTIONS_STORAGE_KEY) ?? null;
}

function writeDismissedPromotionSignature(signature: string | null): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (signature) {
    storage.setItem(DISMISSED_PROMOTIONS_STORAGE_KEY, signature);
  } else {
    storage.removeItem(DISMISSED_PROMOTIONS_STORAGE_KEY);
  }
}

export class DocsPromoteBannerController {
  private readonly fetchImpl: FetchLike;
  private readonly footer: HTMLElement | null;
  private readonly locale: string | null | undefined;
  private readonly rotationIntervalMs: number;
  private readonly refreshIntervalMs: number;
  private readonly spacer: HTMLElement | null;
  private readonly shell: HTMLElement | null;
  private readonly track: HTMLElement | null;
  private readonly previousButton: HTMLButtonElement | null;
  private readonly nextButton: HTMLButtonElement | null;
  private readonly pauseButton: HTMLButtonElement | null;
  private readonly closeButton: HTMLButtonElement | null;
  private readonly countLabel: HTMLElement | null;
  private readonly statusLabel: HTMLElement | null;
  private readonly motionQuery: MediaQueryList | null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly boundRequestLayoutSync: () => void;
  private readonly boundHandlePrevious: () => void;
  private readonly boundHandleNext: () => void;
  private readonly boundHandlePause: () => void;
  private readonly boundHandleClose: (event: MouseEvent) => void;
  private readonly boundHandleMotionChange: () => void;

  private connected = false;
  private promotions: ActivePromotion[] = [];
  private currentIndex = 0;
  private isPaused = false;
  private prefersReducedMotion = false;
  private isFooterInView = false;
  private dismissedPromotionSignature: string | null;
  private rotationHandle: number | null = null;
  private refreshHandle: number | null = null;
  private layoutFrame: number | null = null;
  private loadToken = 0;

  constructor(
    private readonly root: HTMLElement,
    options: DocsPromoteBannerControllerOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.footer = options.footer ?? root.closest('footer');
    this.locale = options.locale ?? root.getAttribute('data-locale');
    this.rotationIntervalMs = options.rotationIntervalMs ?? DEFAULT_ROTATION_INTERVAL_MS;
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.spacer = root.querySelector<HTMLElement>('[data-promote-banner-spacer]');
    this.shell = root.querySelector<HTMLElement>('[data-promote-banner-shell]');
    this.track = root.querySelector<HTMLElement>('[data-promote-banner-track]');
    this.previousButton = root.querySelector<HTMLButtonElement>('[data-promote-banner-previous]');
    this.nextButton = root.querySelector<HTMLButtonElement>('[data-promote-banner-next]');
    this.pauseButton = root.querySelector<HTMLButtonElement>('[data-promote-banner-pause]');
    this.closeButton = root.querySelector<HTMLButtonElement>('[data-promote-banner-close]');
    this.countLabel = root.querySelector<HTMLElement>('[data-promote-banner-count]');
    this.statusLabel = root.querySelector<HTMLElement>('[data-promote-banner-status]');
    this.motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            this.requestLayoutSync();
          })
        : null;
    this.boundRequestLayoutSync = () => {
      this.requestLayoutSync();
    };
    this.boundHandlePrevious = () => {
      this.moveBy(-1);
    };
    this.boundHandleNext = () => {
      this.moveBy(1);
    };
    this.boundHandlePause = () => {
      this.togglePause();
    };
    this.boundHandleClose = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.dismissBanner();
    };
    this.boundHandleMotionChange = () => {
      this.prefersReducedMotion = this.motionQuery?.matches ?? false;
      this.updatePauseButton();
      this.syncRotationTimer();
    };
    this.dismissedPromotionSignature = readDismissedPromotionSignature();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.prefersReducedMotion = this.motionQuery?.matches ?? false;
    this.attachListeners();
    await this.reloadPromotions({ forceRefresh: false });
    this.startRefreshTimer();
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.detachListeners();
    this.stopRotationTimer();
    this.stopRefreshTimer();

    if (this.layoutFrame !== null) {
      window.cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = null;
    }
  }

  private attachListeners(): void {
    this.previousButton?.addEventListener('click', this.boundHandlePrevious);
    this.nextButton?.addEventListener('click', this.boundHandleNext);
    this.pauseButton?.addEventListener('click', this.boundHandlePause);
    this.closeButton?.addEventListener('click', this.boundHandleClose);
    window.addEventListener('scroll', this.boundRequestLayoutSync, { passive: true });
    window.addEventListener('resize', this.boundRequestLayoutSync);

    if (this.motionQuery) {
      if (typeof this.motionQuery.addEventListener === 'function') {
        this.motionQuery.addEventListener('change', this.boundHandleMotionChange);
      } else {
        this.motionQuery.addListener(this.boundHandleMotionChange);
      }
    }

    if (this.resizeObserver) {
      if (this.shell) {
        this.resizeObserver.observe(this.shell);
      }

      if (this.footer) {
        this.resizeObserver.observe(this.footer);
      }
    }
  }

  private detachListeners(): void {
    this.previousButton?.removeEventListener('click', this.boundHandlePrevious);
    this.nextButton?.removeEventListener('click', this.boundHandleNext);
    this.pauseButton?.removeEventListener('click', this.boundHandlePause);
    this.closeButton?.removeEventListener('click', this.boundHandleClose);
    window.removeEventListener('scroll', this.boundRequestLayoutSync);
    window.removeEventListener('resize', this.boundRequestLayoutSync);

    if (this.motionQuery) {
      if (typeof this.motionQuery.removeEventListener === 'function') {
        this.motionQuery.removeEventListener('change', this.boundHandleMotionChange);
      } else {
        this.motionQuery.removeListener(this.boundHandleMotionChange);
      }
    }

    this.resizeObserver?.disconnect();
  }

  private async reloadPromotions({ forceRefresh }: { forceRefresh: boolean }): Promise<void> {
    const token = ++this.loadToken;
    const previousPromotionId = this.promotions[this.currentIndex]?.id ?? null;
    const promotions = await loadActivePromotions({
      locale: this.locale,
      fetchImpl: this.fetchImpl,
      forceRefresh,
    });

    if (!this.connected || token !== this.loadToken) {
      return;
    }

    this.promotions = promotions;
    if (previousPromotionId) {
      const previousIndex = promotions.findIndex((promotion) => promotion.id === previousPromotionId);
      this.currentIndex = previousIndex >= 0 ? previousIndex : 0;
    } else {
      this.currentIndex = 0;
    }

    if (this.currentIndex >= promotions.length) {
      this.currentIndex = 0;
    }

    this.render();
  }

  private render(): void {
    if (!this.shell || !this.track || !this.spacer) {
      return;
    }

    const hasPromotions = this.promotions.length > 0;
    if (!hasPromotions) {
      this.isFooterInView = false;
      this.applyVisibilityState();
      this.track.replaceChildren();
      this.statusLabel && (this.statusLabel.textContent = '');
      this.countLabel && (this.countLabel.textContent = '');
      this.stopRotationTimer();
      this.requestLayoutSync();
      return;
    }

    this.renderSlides();
    this.updateActiveSlide();
    this.updateControls();
    this.requestLayoutSync();
  }

  private renderSlides(): void {
    if (!this.track) {
      return;
    }

    const fragment = document.createDocumentFragment();

    this.promotions.forEach((promotion, index) => {
      const slide = document.createElement('button');
      slide.className = 'docs-promote-banner__slide';
      slide.type = 'button';
      slide.dataset.slideId = promotion.id;
      slide.setAttribute('aria-label', `${promotion.title} (${index + 1} / ${this.promotions.length})`);
      slide.addEventListener('click', () => {
        this.openPromotionLink(promotion.link);
      });

      const copy = document.createElement('div');
      copy.className = 'docs-promote-banner__copy';

      if (promotion.platform) {
        const platform = document.createElement('p');
        platform.className = 'docs-promote-banner__platform';
        platform.textContent = promotion.platform;
        copy.append(platform);
      }

      const title = document.createElement('h2');
      title.className = 'docs-promote-banner__title';
      title.textContent = promotion.title;
      copy.append(title);

      const description = document.createElement('p');
      description.className = 'docs-promote-banner__description';
      description.textContent = promotion.description;
      copy.append(description);

      const actions = document.createElement('div');
      actions.className = 'docs-promote-banner__actions';

      const cta = document.createElement('span');
      cta.className = 'docs-promote-banner__cta';
      cta.textContent = promotion.ctaLabel;
      actions.append(cta);

      slide.append(copy, actions);
      fragment.append(slide);
    });

    this.track.replaceChildren(fragment);
  }

  private updateActiveSlide(): void {
    if (!this.track) {
      return;
    }

    const slides = Array.from(this.track.querySelectorAll<HTMLElement>('.docs-promote-banner__slide'));
    slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', index === this.currentIndex ? 'false' : 'true');
      slide.dataset.active = index === this.currentIndex ? 'true' : 'false';
    });

    this.track.style.transform = `translate3d(-${this.currentIndex * 100}%, 0, 0)`;

    const currentPromotion = this.promotions[this.currentIndex];
    if (this.statusLabel && currentPromotion) {
      this.statusLabel.textContent = currentPromotion.title;
    }

    if (this.countLabel) {
      this.countLabel.textContent = `${this.currentIndex + 1} / ${this.promotions.length}`;
    }
  }

  private updateControls(): void {
    const hasMultiple = this.promotions.length > 1;

    if (this.previousButton) {
      setElementHidden(this.previousButton, !hasMultiple);
    }

    if (this.nextButton) {
      setElementHidden(this.nextButton, !hasMultiple);
    }

    if (this.pauseButton) {
      setElementHidden(this.pauseButton, !hasMultiple);
    }

    if (this.countLabel) {
      setElementHidden(this.countLabel, !hasMultiple);
    }

    this.updatePauseButton();
  }

  private updatePauseButton(): void {
    if (!this.pauseButton) {
      return;
    }

    const disabledByMotion = this.prefersReducedMotion;
    const isPaused = disabledByMotion || this.isPaused;

    this.pauseButton.textContent = isPaused
      ? (mapDocsLocaleToPromoteLocale(this.locale) === 'en' ? 'Resume' : '继续')
      : (mapDocsLocaleToPromoteLocale(this.locale) === 'en' ? 'Pause' : '暂停');
    this.pauseButton.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    this.pauseButton.disabled = this.promotions.length < 2;
    this.pauseButton.title = disabledByMotion
      ? (mapDocsLocaleToPromoteLocale(this.locale) === 'en'
          ? 'Automatic rotation is disabled because reduced motion is enabled.'
          : '检测到减少动画偏好，自动轮播已关闭。')
      : '';
  }

  private moveBy(direction: -1 | 1): void {
    if (this.promotions.length < 2) {
      return;
    }

    const total = this.promotions.length;
    this.currentIndex = (this.currentIndex + direction + total) % total;
    this.updateActiveSlide();
    this.syncRotationTimer();
  }

  private togglePause(): void {
    if (this.promotions.length < 2 || this.prefersReducedMotion) {
      return;
    }

    this.isPaused = !this.isPaused;
    this.updatePauseButton();
    this.syncRotationTimer();
  }

  private syncRotationTimer(): void {
    this.stopRotationTimer();

    if (
      this.promotions.length < 2 ||
      this.isPaused ||
      this.prefersReducedMotion ||
      this.isFooterInView
    ) {
      return;
    }

    this.rotationHandle = window.setInterval(() => {
      this.moveBy(1);
    }, this.rotationIntervalMs);
  }

  private stopRotationTimer(): void {
    if (this.rotationHandle !== null) {
      window.clearInterval(this.rotationHandle);
      this.rotationHandle = null;
    }
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshHandle = window.setInterval(() => {
      void this.reloadPromotions({ forceRefresh: true });
    }, this.refreshIntervalMs);
  }

  private stopRefreshTimer(): void {
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }

  private requestLayoutSync(): void {
    if (this.layoutFrame !== null) {
      return;
    }

    this.layoutFrame = window.requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.syncLayout();
    });
  }

  private dismissBanner(): void {
    const signature = this.getCurrentPromotionSignature();
    if (!signature) {
      return;
    }

    this.dismissedPromotionSignature = signature;
    writeDismissedPromotionSignature(signature);
    this.stopRotationTimer();
    this.applyVisibilityState();
    this.requestLayoutSync();
  }

  private syncLayout(): void {
    if (!this.shell || !this.spacer) {
      return;
    }

    if (!this.applyVisibilityState()) {
      this.stopRotationTimer();
      return;
    }

    this.setSpacerHeight(0);

    let bottomOffset = 0;
    if (this.footer) {
      const footerRect = this.footer.getBoundingClientRect();
      bottomOffset = Math.max(window.innerHeight - footerRect.top, 0);
      bottomOffset = Math.min(bottomOffset, footerRect.height);
    }

    this.shell.style.setProperty('--docs-promote-banner-bottom-offset', `${bottomOffset}px`);
    this.syncRotationTimer();
  }

  private setSpacerHeight(height: number): void {
    if (!this.spacer) {
      return;
    }

    this.spacer.style.height = `${Math.max(height, 0)}px`;
  }

  private openPromotionLink(url: string): void {
    if (typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (typeof window.location.assign === 'function') {
      window.location.assign(url);
    }
  }

  private applyVisibilityState(): boolean {
    const hasPromotions = this.promotions.length > 0;
    const footerVisible = this.isFooterVisible();
    const dismissed = this.isCurrentPromotionDismissed();
    const shouldShow = hasPromotions && !footerVisible && !dismissed;

    this.isFooterInView = footerVisible;
    setElementHidden(this.root, !shouldShow);
    setElementHidden(this.shell, !shouldShow);
    setElementHidden(this.spacer, !shouldShow);
    this.root.dataset.state = shouldShow
      ? 'ready'
      : dismissed
        ? 'dismissed'
        : hasPromotions
          ? 'footer-hidden'
          : 'hidden';

    if (!shouldShow) {
      this.setSpacerHeight(0);
      this.shell?.style.removeProperty('--docs-promote-banner-bottom-offset');
    }

    return shouldShow;
  }

  private isFooterVisible(): boolean {
    if (!this.footer) {
      return true;
    }

    const footerRect = this.footer.getBoundingClientRect();
    return footerRect.top < window.innerHeight && footerRect.bottom > 0;
  }

  private getCurrentPromotionSignature(): string | null {
    if (this.promotions.length === 0) {
      return null;
    }

    return this.promotions.map((promotion) => promotion.id).join('|');
  }

  private isCurrentPromotionDismissed(): boolean {
    const signature = this.getCurrentPromotionSignature();
    return signature !== null && this.dismissedPromotionSignature === signature;
  }
}

export function defineDocsPromoteBannerElement(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!customElements.get('docs-promote-banner')) {
    class DocsPromoteBannerElement extends HTMLElement {
      private controller: DocsPromoteBannerController | null = null;

      connectedCallback(): void {
        if (this.controller) {
          return;
        }

        this.controller = new DocsPromoteBannerController(this);
        void this.controller.connect();
      }

      disconnectedCallback(): void {
        this.controller?.disconnect();
        this.controller = null;
      }
    }

    customElements.define('docs-promote-banner', DocsPromoteBannerElement);
  }
}
