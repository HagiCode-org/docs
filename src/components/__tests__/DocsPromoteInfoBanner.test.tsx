// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsPromoteBannerController } from '@/lib/docs-promote-banner';

type MatchMediaResult = {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchChange: (matches: boolean) => void;
};

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function createMatchMedia(matches = false): MatchMediaResult {
  let currentMatches = matches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  return {
    get matches() {
      return currentMatches;
    },
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatchChange(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

function createFetchMock(promotions: Array<{
  id: string;
  on?: boolean;
  startTime?: string;
  endTime?: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  ctaZh?: string;
  ctaEn?: string;
  link: string;
  platform?: string;
  image?: string | {
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
  };
}>) {
  const jsonHeaders = {
    'content-type': 'application/json',
  };

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.endsWith('/index-catalog.json')) {
      return new Response(JSON.stringify({
        entries: [
          { id: 'promotion-flags', path: '/promote.json' },
          { id: 'promotion-content', path: '/promote_content.json' },
        ],
      }), { status: 200, headers: jsonHeaders });
    }

    if (url.endsWith('/promote.json')) {
      return new Response(JSON.stringify({
        promotes: promotions.map((promotion) => ({
          id: promotion.id,
          on: promotion.on ?? true,
          startTime: promotion.startTime,
          endTime: promotion.endTime,
        })),
      }), { status: 200, headers: jsonHeaders });
    }

    if (url.endsWith('/promote_content.json')) {
      return new Response(JSON.stringify({
        contents: promotions.map((promotion) => ({
          id: promotion.id,
          title: { zh: promotion.titleZh, en: promotion.titleEn },
          description: { zh: promotion.descriptionZh, en: promotion.descriptionEn },
          cta: promotion.ctaZh || promotion.ctaEn
            ? { zh: promotion.ctaZh, en: promotion.ctaEn }
            : undefined,
          link: promotion.link,
          targetPlatform: promotion.platform,
          image: promotion.image,
        })),
      }), { status: 200, headers: jsonHeaders });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function renderBannerShell({
  locale = 'en',
  path = '/en-US/product-overview/',
}: {
  locale?: string;
  path?: string;
} = {}) {
  const labels = locale === 'zh-CN'
    ? {
        close: '关闭推广信息',
        previous: '查看上一条推广',
        next: '查看下一条推广',
        pause: '暂停自动轮播',
        resume: '恢复自动轮播',
      }
    : {
        close: 'Dismiss promotion message',
        previous: 'Show previous promotion',
        next: 'Show next promotion',
        pause: 'Pause automatic rotation',
        resume: 'Resume automatic rotation',
      };

  document.body.innerHTML = `
    <main data-page-shell data-page-path="${path}">
      <footer data-footer-root>
        <docs-promote-banner data-locale="${locale}" hidden>
          <div data-promote-banner-spacer></div>
          <section data-promote-banner-shell hidden>
            <div class="docs-promote-banner__inner">
              <button type="button" class="docs-promote-banner__close" data-promote-banner-close aria-label="${labels.close}">×</button>
              <div class="docs-promote-banner__body">
                <div class="docs-promote-banner__viewport">
                  <div data-promote-banner-track></div>
                </div>
                <div data-promote-banner-controls hidden>
                  <button type="button" data-promote-banner-previous aria-label="${labels.previous}">‹</button>
                  <span data-promote-banner-count></span>
                  <button type="button" data-promote-banner-next aria-label="${labels.next}">›</button>
                  <button
                    type="button"
                    data-promote-banner-pause
                    data-rotation-pause-label="${labels.pause}"
                    data-rotation-resume-label="${labels.resume}"
                    aria-label="${labels.pause}"
                  >
                    ${locale === 'zh-CN' ? '暂停' : 'Pause'}
                  </button>
                </div>
              </div>
            </div>
            <span data-promote-banner-status aria-live="polite"></span>
          </section>
        </docs-promote-banner>
      </footer>
    </main>
  `;

  const footer = document.querySelector<HTMLElement>('[data-footer-root]');
  const root = document.querySelector<HTMLElement>('docs-promote-banner');
  const shell = document.querySelector<HTMLElement>('[data-promote-banner-shell]');
  const spacer = document.querySelector<HTMLElement>('[data-promote-banner-spacer]');

  if (!footer || !root || !shell || !spacer) {
    throw new Error('Failed to build docs promote banner test shell.');
  }

  Object.defineProperty(shell, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 720,
      height: 96,
      top: 620,
      right: 720,
      bottom: 716,
      left: 0,
      x: 0,
      y: 620,
      toJSON() {
        return {};
      },
    }),
  });

  setFooterRect(footer, 1200);

  return { footer, root, shell, spacer };
}

function setFooterRect(footer: HTMLElement, top: number, height = 280) {
  Object.defineProperty(footer, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 720,
      height,
      top,
      right: 720,
      bottom: top + height,
      left: 0,
      x: 0,
      y: top,
      toJSON() {
        return {};
      },
    }),
  });
}

function getActiveSlideTitle(root: HTMLElement): string | null {
  return root.querySelector<HTMLElement>('[data-active="true"] .docs-promote-banner__title')?.textContent ?? null;
}

function syncLayout(controller: DocsPromoteBannerController): void {
  (controller as unknown as { syncLayout: () => void }).syncLayout();
}

describe('DocsPromoteBannerController', () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    window.localStorage.clear();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T23:59:59+08:00'));
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
    vi.stubGlobal('open', vi.fn());
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('shows the localized fallback on the Chinese product overview entry flow and hides carousel chrome', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell({
      locale: 'zh-CN',
      path: '/product-overview/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(shell).not.toHaveAttribute('hidden');
    expect(spacer).not.toHaveAttribute('hidden');
    expect(root.dataset.mode).toBe('fallback');
    expect(getActiveSlideTitle(root)).toBe('查看 HagiCode 产品概览');
    expect(screen.getByText('从文档入口快速了解产品能力、版本关系与常见上手路径。')).toBeInTheDocument();
    expect(screen.getByText('文档')).toBeInTheDocument();
    expect(root.querySelector('[data-promote-banner-controls]')).toHaveAttribute('hidden');

    fireEvent.click(screen.getByRole('button', { name: /查看文档/i }));
    expect(window.open).toHaveBeenCalledWith('/product-overview/', '_blank', 'noopener,noreferrer');
  });

  it('shows the remote promotion on the English product overview entry flow and keeps single-card controls hidden', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell({
      locale: 'en',
      path: '/en-US/product-overview/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'main-game',
          titleZh: '立即添加到愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
          descriptionEn: 'Coming April 29, 2026. Add to your Steam wishlist now!',
          ctaZh: '加入愿望单',
          ctaEn: 'Wishlist on Steam',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
          image: {
            src: '/images/promotions/main-game.webp',
            alt: 'HagiCode Steam artwork',
            width: 640,
            height: 640,
          },
        },
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root.dataset.mode).toBe('remote');
    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');
    expect(screen.getByText('Coming April 29, 2026. Add to your Steam wishlist now!')).toBeInTheDocument();
    expect(screen.getByText('Steam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss promotion message' })).toBeInTheDocument();
    const promoImage = root.querySelector<HTMLImageElement>('.docs-promote-banner__image');
    expect(promoImage).not.toBeNull();
    expect(promoImage).toHaveAttribute('src', 'https://index.hagicode.com/images/promotions/main-game.webp');
    expect(promoImage).toHaveAttribute('alt', 'HagiCode Steam artwork');
    expect(root.querySelector('[data-promote-banner-controls]')).toHaveAttribute('hidden');
  });

  it('hides the banner while the footer is visible and restores it after scrolling away', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell } = renderBannerShell({
      locale: 'en',
      path: '/en-US/guides/skills/',
    });

    const fetchMock = vi.fn(async () => {
      throw new Error('network failed');
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: fetchMock as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(root.dataset.mode).toBe('fallback');
    expect(root.dataset.state).toBe('ready');
    expect(getActiveSlideTitle(root)).toBe('Explore the HagiCode Product Overview');
    expect(shell.style.getPropertyValue('--docs-promote-banner-bottom-offset')).toBe('');

    setFooterRect(footer, 760);
    syncLayout(controller);

    expect(root).not.toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('footer-hidden');
    expect(shell).toHaveAttribute('aria-hidden', 'true');
    expect(shell).toHaveAttribute('inert');
    expect(shell.style.getPropertyValue('--docs-promote-banner-bottom-offset')).toBe('');

    setFooterRect(footer, 1200);
    syncLayout(controller);

    expect(root).not.toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('ready');
    expect(shell).not.toHaveAttribute('aria-hidden');
    expect(shell).not.toHaveAttribute('inert');
    expect(getActiveSlideTitle(root)).toBe('Explore the HagiCode Product Overview');
  });

  it('keeps the dismissed banner hidden when footer visibility changes for the same promotion set', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell({
      locale: 'en',
      path: '/en-US/product-overview/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss promotion message' }));

    expect(window.open).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('dismissed');

    setFooterRect(footer, 760);
    syncLayout(controller);
    expect(root).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('dismissed');

    setFooterRect(footer, 1200);
    syncLayout(controller);
    expect(root).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('dismissed');
  });

  it('keeps fallback dismissal persisted for the same payload but allows a later remote promotion to reappear', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));

    const firstRender = renderBannerShell({
      locale: 'en',
      path: '/en-US/product-overview/',
    });
    const fallbackController = new DocsPromoteBannerController(firstRender.root, {
      footer: firstRender.footer,
      fetchImpl: createFetchMock([]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await fallbackController.connect();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss promotion message' }));
    expect(firstRender.root.dataset.state).toBe('dismissed');

    const secondRender = renderBannerShell({
      locale: 'en',
      path: '/en-US/product-overview/',
    });
    const secondController = new DocsPromoteBannerController(secondRender.root, {
      footer: secondRender.footer,
      fetchImpl: createFetchMock([]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await secondController.connect();
    expect(secondRender.root).toHaveAttribute('hidden');
    expect(secondRender.root.dataset.state).toBe('dismissed');

    const thirdRender = renderBannerShell({
      locale: 'en',
      path: '/en-US/product-overview/',
    });
    const remoteController = new DocsPromoteBannerController(thirdRender.root, {
      footer: thirdRender.footer,
      fetchImpl: createFetchMock([
        {
          id: 'builder',
          titleZh: '体验部署生成器',
          titleEn: 'Try the Builder',
          descriptionZh: '使用 Docker Compose Builder 快速生成部署配置。',
          descriptionEn: 'Generate Docker Compose deployment files with the Builder.',
          ctaZh: '立即体验',
          ctaEn: 'Open Builder',
          link: 'https://builder.hagicode.com/',
          platform: 'web',
        },
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await remoteController.connect();
    expect(thirdRender.root).not.toHaveAttribute('hidden');
    expect(thirdRender.root.dataset.mode).toBe('remote');
    expect(getActiveSlideTitle(thirdRender.root)).toBe('Try the Builder');
  });

  it('preserves multi-promotion navigation and carousel controls for multiple active remote entries', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell({
      locale: 'en',
      path: '/en-US/guides/skills/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'main-game',
          titleZh: '立即添加到愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
          descriptionEn: 'Coming April 29, 2026. Add to your Steam wishlist now!',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
        },
        {
          id: 'builder',
          titleZh: '体验部署生成器',
          titleEn: 'Try the Builder',
          descriptionZh: '使用 Docker Compose Builder 快速生成部署配置。',
          descriptionEn: 'Generate Docker Compose deployment files with the Builder.',
          link: 'https://builder.hagicode.com/',
          platform: 'web',
        },
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root.querySelector('[data-promote-banner-controls]')).not.toHaveAttribute('hidden');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    const slides = root.querySelectorAll<HTMLElement>('.docs-promote-banner__slide');
    expect(slides).toHaveLength(2);
    expect(slides[0]).not.toHaveAttribute('inert');
    expect(slides[1]).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Show next promotion' }));
    expect(getActiveSlideTitle(root)).toBe('Try the Builder');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(slides[0]).toHaveAttribute('inert');
    expect(slides[1]).not.toHaveAttribute('inert');
  });

  it('pauses automatic rotation while footer-hidden and resumes after the footer leaves the viewport', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell({
      locale: 'en',
      path: '/en-US/guides/skills/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'main-game',
          titleZh: '立即添加到愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
          descriptionEn: 'Coming April 29, 2026. Add to your Steam wishlist now!',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
        },
        {
          id: 'builder',
          titleZh: '体验部署生成器',
          titleEn: 'Try the Builder',
          descriptionZh: '使用 Docker Compose Builder 快速生成部署配置。',
          descriptionEn: 'Generate Docker Compose deployment files with the Builder.',
          link: 'https://builder.hagicode.com/',
          platform: 'web',
        },
      ]) as typeof fetch,
      rotationIntervalMs: 1000,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');
    setFooterRect(footer, 760);
    syncLayout(controller);
    expect(root.dataset.state).toBe('footer-hidden');

    await vi.advanceTimersByTimeAsync(2000);
    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    setFooterRect(footer, 1200);
    syncLayout(controller);
    expect(root.dataset.state).toBe('ready');

    await vi.advanceTimersByTimeAsync(1000);
    expect(getActiveSlideTitle(root)).toBe('Try the Builder');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('supports pause and resume while automatic rotation is available', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell({
      locale: 'en',
      path: '/en-US/guides/skills/',
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'main-game',
          titleZh: '立即添加到愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
          descriptionEn: 'Coming April 29, 2026. Add to your Steam wishlist now!',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
        },
        {
          id: 'builder',
          titleZh: '体验部署生成器',
          titleEn: 'Try the Builder',
          descriptionZh: '使用 Docker Compose Builder 快速生成部署配置。',
          descriptionEn: 'Generate Docker Compose deployment files with the Builder.',
          link: 'https://builder.hagicode.com/',
          platform: 'web',
        },
      ]) as typeof fetch,
      rotationIntervalMs: 1000,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const pauseButton = screen.getByRole('button', { name: 'Pause automatic rotation' });
    fireEvent.click(pauseButton);
    expect(pauseButton).toHaveTextContent('Resume');
    expect(pauseButton).toHaveAttribute('aria-label', 'Resume automatic rotation');

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(pauseButton).toHaveTextContent('Pause');

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
});
