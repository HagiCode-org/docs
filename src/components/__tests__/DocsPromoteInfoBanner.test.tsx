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
  link: string;
  platform?: string;
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
          link: promotion.link,
          targetPlatform: promotion.platform,
        })),
      }), { status: 200, headers: jsonHeaders });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function renderBannerShell(locale = 'en') {
  const closeLabel = locale === 'zh-CN' ? '关闭推广信息' : 'Dismiss promotion message';
  document.body.innerHTML = `
    <footer data-footer-root>
      <docs-promote-banner data-locale="${locale}" hidden>
        <div data-promote-banner-spacer></div>
        <section data-promote-banner-shell hidden>
          <div class="docs-promote-banner__inner">
            <button type="button" data-promote-banner-close aria-label="${closeLabel}">×</button>
            <div>
              <div data-promote-banner-track></div>
            </div>
            <div>
              <button type="button" data-promote-banner-previous aria-label="Show previous promotion">‹</button>
              <span data-promote-banner-count></span>
              <button type="button" data-promote-banner-next aria-label="Show next promotion">›</button>
              <button type="button" data-promote-banner-pause aria-label="Pause automatic rotation">Pause</button>
            </div>
          </div>
          <span data-promote-banner-status aria-live="polite"></span>
        </section>
      </docs-promote-banner>
    </footer>
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

  Object.defineProperty(footer, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 720,
      height: 280,
      top: 1200,
      right: 720,
      bottom: 1480,
      left: 0,
      x: 0,
      y: 1200,
      toJSON() {
        return {};
      },
    }),
  });

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
  return root.querySelector<HTMLElement>('.docs-promote-banner__slide[data-active="true"] .docs-promote-banner__title')?.textContent ?? null;
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

  it('keeps the banner hidden when no valid promotions are available', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('en');

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('hidden');
    expect(root.style.display).toBe('none');
    expect(shell.style.display).toBe('none');
    expect(spacer).toHaveAttribute('hidden');
    expect(spacer.style.display).toBe('none');
    expect(spacer.style.height).toBe('0px');
  });

  it('keeps pre-start promotions hidden until a refresh crosses the start time', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell } = renderBannerShell('en');

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'future',
          startTime: '2026-04-29T00:00:00+08:00',
          titleZh: '即将上线',
          titleEn: 'Starts Soon',
          descriptionZh: '预热中',
          descriptionEn: 'Warming up',
          link: 'https://example.invalid/future',
          platform: 'steam',
        },
      ]) as typeof fetch,
      refreshIntervalMs: 1000,
    });

    await controller.connect();

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');

    vi.setSystemTime(new Date('2026-04-29T00:00:00+08:00'));
    await (controller as unknown as { reloadPromotions: ({ forceRefresh }: { forceRefresh: boolean }) => Promise<void> })
      .reloadPromotions({ forceRefresh: true });
    (controller as unknown as { syncLayout: () => void }).syncLayout();

    expect(root).not.toHaveAttribute('hidden');
    expect(getActiveSlideTitle(root)).toBe('Starts Soon');
  });

  it('removes an expired promotion after refresh and hides the banner when no active entry remains', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell } = renderBannerShell('en');

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'expires-now',
          endTime: '2026-04-29T00:00:00+08:00',
          titleZh: '即将结束',
          titleEn: 'Ends Soon',
          descriptionZh: '最后一刻',
          descriptionEn: 'Last chance',
          link: 'https://example.invalid/ends',
          platform: 'steam',
        },
      ]) as typeof fetch,
      refreshIntervalMs: 1000,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');

    vi.setSystemTime(new Date('2026-04-29T00:00:00+08:00'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('hidden');
  });

  it('swaps promotions at the exact boundary on refresh', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell('en');

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: createFetchMock([
        {
          id: 'main-game-2026-04-29',
          endTime: '2026-04-29T00:00:00+08:00',
          titleZh: '愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '旧推广',
          descriptionEn: 'Old promotion',
          link: 'https://example.invalid/wishlist',
          platform: 'steam',
        },
        {
          id: 'main-game-steam-ea-2026-04-29',
          startTime: '2026-04-29T00:00:00+08:00',
          titleZh: '抢先体验',
          titleEn: 'Early Access Is Live',
          descriptionZh: '新推广',
          descriptionEn: 'New promotion',
          link: 'https://example.invalid/ea',
          platform: 'steam',
        },
      ]) as typeof fetch,
      refreshIntervalMs: 1000,
    });

    await controller.connect();

    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');

    vi.setSystemTime(new Date('2026-04-29T00:00:00+08:00'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(getActiveSlideTitle(root)).toBe('Early Access Is Live');
  });

  it('keeps the entire banner hidden when promotion fetch fails', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('en');

    const fetchMock = vi.fn(async () => {
      throw new Error('network failed');
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: fetchMock as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('hidden');
    expect(root.style.display).toBe('none');
    expect(shell.style.display).toBe('none');
    expect(spacer).toHaveAttribute('hidden');
    expect(spacer.style.display).toBe('none');
    expect(spacer.style.height).toBe('0px');
  });

  it('renders a single promotion with localized content and hides carousel-only controls', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('zh-CN');

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
      ]) as typeof fetch,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(shell).not.toHaveAttribute('hidden');
    expect(spacer).not.toHaveAttribute('hidden');
    expect(getActiveSlideTitle(root)).toBe('立即添加到愿望单');
    expect(screen.getByText('游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。')).toBeInTheDocument();
    expect(screen.getByText('Steam')).toBeInTheDocument();
    const stripButton = screen.getByRole('button', { name: /立即添加到愿望单/i });
    expect(stripButton).toBeInTheDocument();
    expect(screen.getByText('立即查看')).toBeInTheDocument();
    fireEvent.click(stripButton);
    expect(window.open).toHaveBeenCalledWith(
      'https://store.steampowered.com/app/4625540/Hagicode/',
      '_blank',
      'noopener,noreferrer',
    );
    expect(root.querySelector('[data-promote-banner-previous]')).toHaveAttribute('hidden');
    expect(root.querySelector('[data-promote-banner-next]')).toHaveAttribute('hidden');
    expect(root.querySelector('[data-promote-banner-pause]')).toHaveAttribute('hidden');
    expect(spacer.style.height).toBe('0px');
    expect(shell.style.getPropertyValue('--docs-promote-banner-bottom-offset')).toBe('0px');
  });

  it('keeps the panel floating until the footer enters the viewport, then hides it', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('en');
    setFooterRect(footer, 1200);

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
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(shell).not.toHaveAttribute('hidden');
    expect(spacer).not.toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('ready');
    expect(spacer.style.height).toBe('0px');

    setFooterRect(footer, 760);
    (controller as unknown as { syncLayout: () => void }).syncLayout();

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(spacer).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('footer-hidden');
    expect(spacer.style.height).toBe('0px');
  });

  it('allows dismissing the current promotion banner from the close button', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('en');

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
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    });

    await controller.connect();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss promotion message' }));

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(spacer).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('dismissed');
    expect(spacer.style.height).toBe('0px');
    expect(window.localStorage.getItem('hagicode:docs-promote-banner:dismissed-signature')).toBe('main-game');
  });

  it('keeps the same promotion set dismissed across reconnects', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const firstRender = renderBannerShell('en');

    const options = {
      footer: firstRender.footer,
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
      ]) as typeof fetch,
      refreshIntervalMs: 60_000,
    };

    const firstController = new DocsPromoteBannerController(firstRender.root, options);
    await firstController.connect();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss promotion message' }));
    firstController.disconnect();

    const secondRender = renderBannerShell('en');
    const secondController = new DocsPromoteBannerController(secondRender.root, {
      ...options,
      footer: secondRender.footer,
    });

    await secondController.connect();

    expect(secondRender.root).toHaveAttribute('hidden');
    expect(secondRender.shell).toHaveAttribute('hidden');
    expect(secondRender.spacer).toHaveAttribute('hidden');
    expect(secondRender.root.dataset.state).toBe('dismissed');
  });

  it('collapses the banner again when a refresh later returns invalid html instead of json', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root, shell, spacer } = renderBannerShell('en');

    let mode: 'json' | 'html' = 'json';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (mode === 'html') {
        return new Response('<html>down</html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        });
      }

      if (url.endsWith('/index-catalog.json')) {
        return new Response(JSON.stringify({
          entries: [
            { id: 'promotion-flags', path: '/promote.json' },
            { id: 'promotion-content', path: '/promote_content.json' },
          ],
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      if (url.endsWith('/promote.json')) {
        return new Response(JSON.stringify({
          promotes: [{ id: 'main-game', on: true }],
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      if (url.endsWith('/promote_content.json')) {
        return new Response(JSON.stringify({
          contents: [{
            id: 'main-game',
            title: { zh: '立即添加到愿望单', en: 'Wishlist Now' },
            description: {
              zh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
              en: 'Coming April 29, 2026. Add to your Steam wishlist now!',
            },
            link: 'https://store.steampowered.com/app/4625540/Hagicode/',
            targetPlatform: 'steam',
          }],
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const controller = new DocsPromoteBannerController(root, {
      footer,
      fetchImpl: fetchMock as typeof fetch,
      refreshIntervalMs: 1000,
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(shell).not.toHaveAttribute('hidden');
    expect(spacer).not.toHaveAttribute('hidden');
    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');

    mode = 'html';
    await vi.advanceTimersByTimeAsync(1000);

    expect(root).toHaveAttribute('hidden');
    expect(shell).toHaveAttribute('hidden');
    expect(spacer).toHaveAttribute('hidden');
    expect(root.dataset.state).toBe('hidden');
    expect(root.style.display).toBe('none');
    expect(shell.style.display).toBe('none');
    expect(spacer.style.display).toBe('none');
    expect(spacer.style.height).toBe('0px');
  });

  it('supports multi-promotion manual navigation', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell('en');

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
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(getActiveSlideTitle(root)).toBe('Wishlist Now');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show next promotion' }));
    expect(getActiveSlideTitle(root)).toBe('Try the Builder');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show previous promotion' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('supports pause/resume and manual switching while auto-rotation is available', async () => {
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell('en');

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
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic rotation' }));
    expect(screen.getByRole('button', { name: 'Pause automatic rotation' })).toHaveTextContent('Resume');

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show previous promotion' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic rotation' }));
    expect(screen.getByRole('button', { name: 'Pause automatic rotation' })).toHaveTextContent('Pause');

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('respects reduced-motion by disabling automatic rotation while preserving manual controls', async () => {
    const matchMedia = createMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn(() => matchMedia));
    const { footer, root } = renderBannerShell('en');

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
    });

    await controller.connect();

    expect(root).not.toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Pause automatic rotation' })).toHaveTextContent('Resume');
    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show next promotion' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });
});
