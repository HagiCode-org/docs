import { getDocsPromoteFallback } from '@/lib/docs-promote-fallback';
import {
  clearPromotionDocumentCache,
  filterActivePromotions,
  loadPromotionDocuments,
  loadPromotions as loadSharedPromotions,
  mapDocsLocaleToPromoteLocale,
  normalizePromotions,
  resolvePromotionDocumentUrls,
  type LoadPromotionsOptions,
  type NormalizedPromotion,
  type PromotionImage,
} from '@/lib/promotions';

const DEFAULT_ROTATION_INTERVAL_MS = 8000;
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DISMISSED_PROMOTIONS_STORAGE_KEY = 'hagicode:docs-promote-banner:dismissed-signature';

type PromoteLocale = 'zh' | 'en';

type FetchLike = typeof fetch;

export {
  clearPromotionDocumentCache,
  loadPromotionDocuments,
  mapDocsLocaleToPromoteLocale,
  resolvePromotionDocumentUrls,
};

export interface ActivePromotion {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  platform: string | null;
  badgeText: string;
  image: PromotionImage | null;
  source: 'remote' | 'fallback';
  payloadSignature: string;
}

export interface LoadActivePromotionsOptions extends LoadPromotionsOptions {}

export interface DocsPromoteBannerControllerOptions extends LoadActivePromotionsOptions {
  footer?: HTMLElement | null;
  rotationIntervalMs?: number;
  refreshIntervalMs?: number;
}

type BannerVisibilityState = 'dismissed' | 'footer-hidden' | 'hidden' | 'ready';

function serializeSignaturePart(value: string): string {
  return encodeURIComponent(value);
}

function buildPayloadSignature(source: 'remote' | 'fallback', values: string[]): string {
  return `${source}:${values.map(serializeSignaturePart).join('|')}`;
}

function createRemotePromotion(
  promotion: NormalizedPromotion,
  locale: PromoteLocale,
): ActivePromotion {
  const badgeText = promotion.platform ?? (locale === 'en' ? 'Promoted' : '推荐');

  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    ctaLabel: promotion.ctaLabel,
    link: promotion.link,
    platform: promotion.platform,
    badgeText,
    image: promotion.image,
    source: 'remote',
    payloadSignature: buildPayloadSignature('remote', [
      promotion.id,
      badgeText,
      promotion.title,
      promotion.description,
      promotion.ctaLabel,
      promotion.link,
      promotion.image?.src ?? '',
      promotion.image?.alt ?? '',
    ]),
  };
}

export function createFallbackPromotion(
  locale: string | null | undefined,
): ActivePromotion {
  const fallback = getDocsPromoteFallback(locale);

  return {
    id: fallback.id,
    title: fallback.title,
    description: fallback.description,
    ctaLabel: fallback.ctaLabel,
    link: fallback.link,
    platform: null,
    badgeText: fallback.badgeText,
    image: null,
    source: 'fallback',
    payloadSignature: buildPayloadSignature('fallback', [
      fallback.id,
      fallback.badgeText,
      fallback.title,
      fallback.description,
      fallback.ctaLabel,
      fallback.link,
    ]),
  };
}

export function selectBannerPromotions(
  promotions: NormalizedPromotion[],
  locale: string | null | undefined,
): ActivePromotion[] {
  const promoteLocale = mapDocsLocaleToPromoteLocale(locale);
  const remotePromotions = filterActivePromotions(promotions).map((promotion) =>
    createRemotePromotion(promotion, promoteLocale),
  );

  if (remotePromotions.length > 0) {
    return remotePromotions;
  }

  return [createFallbackPromotion(locale)];
}

export function normalizeActivePromotions(
  flags: Parameters<typeof normalizePromotions>[0],
  content: Parameters<typeof normalizePromotions>[1],
  locale: string | null | undefined,
  now = Date.now(),
): ActivePromotion[] {
  return selectBannerPromotions(normalizePromotions(flags, content, locale, now), locale);
}

export async function loadActivePromotions(
  options: LoadActivePromotionsOptions = {},
): Promise<ActivePromotion[]> {
  const promotions = await loadSharedPromotions(options);
  return selectBannerPromotions(promotions, options.locale);
}

export function getPromotionSetSignature(
  promotions: ActivePromotion[],
): string | null {
  if (promotions.length === 0) {
    return null;
  }

  return promotions.map((promotion) => promotion.payloadSignature).join('||');
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
  private readonly controls: HTMLElement | null;
  private readonly countLabel: HTMLElement | null;
  private readonly statusLabel: HTMLElement | null;
  private readonly motionQuery: MediaQueryList | null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly pauseLabel: string;
  private readonly resumeLabel: string;
  private readonly boundRequestLayoutSync: () => void;
  private readonly boundHandlePrevious: () => void;
  private readonly boundHandleNext: () => void;
  private readonly boundHandlePause: () => void;
  private readonly boundHandleClose: (event: MouseEvent) => void;
  private readonly boundHandleMotionChange: () => void;
  private readonly boundHandleVisibilityChange: () => void;

  private connected = false;
  private promotions: ActivePromotion[] = [];
  private currentIndex = 0;
  private isPaused = false;
  private prefersReducedMotion = false;
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
    this.controls = root.querySelector<HTMLElement>('[data-promote-banner-controls]');
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
    this.boundHandleVisibilityChange = () => {
      this.syncRotationTimer();

      if (this.isDocumentVisible()) {
        this.startRefreshTimer();
        return;
      }

      this.stopRefreshTimer();
    };
    this.pauseLabel = this.pauseButton?.getAttribute('data-rotation-pause-label')
      ?? (mapDocsLocaleToPromoteLocale(this.locale) === 'en' ? 'Pause automatic rotation' : '暂停自动轮播');
    this.resumeLabel = this.pauseButton?.getAttribute('data-rotation-resume-label')
      ?? (mapDocsLocaleToPromoteLocale(this.locale) === 'en' ? 'Resume automatic rotation' : '恢复自动轮播');
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
    this.syncRotationTimer();
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
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);

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
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);

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
      this.applyVisibilityState();
      this.track.replaceChildren();
      if (this.statusLabel) {
        this.statusLabel.textContent = '';
      }
      if (this.countLabel) {
        this.countLabel.textContent = '';
      }
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
      slide.dataset.source = promotion.source;
      slide.dataset.hasImage = promotion.image ? 'true' : 'false';
      slide.setAttribute(
        'aria-label',
        this.promotions.length > 1
          ? `${promotion.ctaLabel}: ${promotion.title} (${index + 1} / ${this.promotions.length})`
          : `${promotion.ctaLabel}: ${promotion.title}`,
      );
      slide.addEventListener('click', () => {
        this.openPromotionLink(promotion.link);
      });

      const copy = document.createElement('div');
      copy.className = 'docs-promote-banner__copy';

      const title = document.createElement('h2');
      title.className = 'docs-promote-banner__title';
      title.textContent = promotion.title;
      copy.append(title);

      const description = document.createElement('p');
      description.className = 'docs-promote-banner__description';
      description.textContent = promotion.description;
      copy.append(description);

      let media: HTMLElement | null = null;
      if (promotion.image?.src) {
        media = document.createElement('span');
        media.className = 'docs-promote-banner__media';

        const image = document.createElement('img');
        image.className = 'docs-promote-banner__image';
        image.src = promotion.image.src;
        image.alt = promotion.image.alt || promotion.title;
        image.loading = index === this.currentIndex ? 'eager' : 'lazy';
        image.decoding = 'async';

        if (promotion.image.width) {
          image.width = promotion.image.width;
        }

        if (promotion.image.height) {
          image.height = promotion.image.height;
        }

        media.append(image);
      }

      const actions = document.createElement('div');
      actions.className = 'docs-promote-banner__actions';

      const cta = document.createElement('span');
      cta.className = 'docs-promote-banner__cta';
      cta.textContent = promotion.ctaLabel;
      actions.append(cta);

      if (media) {
        slide.append(copy, media, actions);
      } else {
        slide.append(copy, actions);
      }
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
      const isActive = index === this.currentIndex;
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      slide.dataset.active = isActive ? 'true' : 'false';
      slide.tabIndex = isActive ? 0 : -1;
      if (isActive) {
        slide.removeAttribute('inert');
      } else {
        slide.setAttribute('inert', '');
      }
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

    setElementHidden(this.controls, !hasMultiple);
    setElementHidden(this.previousButton, !hasMultiple);
    setElementHidden(this.nextButton, !hasMultiple);
    setElementHidden(this.pauseButton, !hasMultiple);
    setElementHidden(this.countLabel, !hasMultiple);
    this.updatePauseButton();
  }

  private updatePauseButton(): void {
    if (!this.pauseButton) {
      return;
    }

    const disabledByMotion = this.prefersReducedMotion;
    const isPaused = disabledByMotion || this.isPaused;
    const promoteLocale = mapDocsLocaleToPromoteLocale(this.locale);

    this.pauseButton.textContent = isPaused
      ? (promoteLocale === 'en' ? 'Resume' : '继续')
      : (promoteLocale === 'en' ? 'Pause' : '暂停');
    this.pauseButton.setAttribute('aria-label', isPaused ? this.resumeLabel : this.pauseLabel);
    this.pauseButton.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    this.pauseButton.disabled = this.promotions.length < 2;
    this.pauseButton.title = disabledByMotion
      ? (promoteLocale === 'en'
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

    const visibilityState = this.getVisibilityState();

    if (
      this.promotions.length < 2 ||
      this.isPaused ||
      this.prefersReducedMotion ||
      !this.isDocumentVisible() ||
      visibilityState !== 'ready'
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

    if (!this.isDocumentVisible()) {
      return;
    }

    this.refreshHandle = window.setInterval(() => {
      if (!this.isDocumentVisible()) {
        return;
      }

      void this.reloadPromotions({ forceRefresh: true });
    }, this.refreshIntervalMs);
  }

  private stopRefreshTimer(): void {
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }

  private isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
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
    const visibilityState = this.getVisibilityState();
    const shouldShow = visibilityState === 'ready' || visibilityState === 'footer-hidden';
    const footerHidden = visibilityState === 'footer-hidden';

    setElementHidden(this.root, !shouldShow);
    setElementHidden(this.shell, !shouldShow);
    setElementHidden(this.spacer, !shouldShow);
    this.root.dataset.mode = this.promotions[0]?.source ?? 'hidden';
    this.root.dataset.state = visibilityState;
    this.syncFooterHiddenState(footerHidden);

    if (!shouldShow) {
      this.setSpacerHeight(0);
    }

    return shouldShow;
  }

  private syncFooterHiddenState(footerHidden: boolean): void {
    if (!this.shell) {
      return;
    }

    if (footerHidden) {
      this.shell.setAttribute('aria-hidden', 'true');
      this.shell.setAttribute('inert', '');

      if (
        document.activeElement instanceof HTMLElement &&
        this.shell.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }

      return;
    }

    this.shell.removeAttribute('aria-hidden');
    this.shell.removeAttribute('inert');
  }

  private getVisibilityState(): BannerVisibilityState {
    if (this.promotions.length === 0) {
      return 'hidden';
    }

    if (this.isCurrentPromotionDismissed()) {
      return 'dismissed';
    }

    return this.isFooterVisible() ? 'footer-hidden' : 'ready';
  }

  private isFooterVisible(): boolean {
    if (!this.footer) {
      return false;
    }

    const footerRect = this.footer.getBoundingClientRect();
    return footerRect.top < window.innerHeight && footerRect.bottom > 0;
  }

  private getCurrentPromotionSignature(): string | null {
    return getPromotionSetSignature(this.promotions);
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
