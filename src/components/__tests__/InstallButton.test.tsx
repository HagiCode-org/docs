// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetType, CpuArchitecture } from '@shared/desktop';
import type { DesktopVersionData } from '@shared/version-manager';
import * as steamStoreLink from '@shared/steam-store-link';
import * as versionManager from '@shared/version-manager';
import InstallButton, { filterSupportedPlatformGroups } from '../InstallButton';

const fallbackUrl = 'https://index.hagicode.com/desktop/history/';
const windowsStoreUrl = 'https://apps.microsoft.com/detail/9N3PM0N3SVDW';
const fallbackSteamUrl = 'https://store.steampowered.com/app/4625540/Hagicode/';
vi.mock('@shared/version-manager', async () => {
  const actual = await vi.importActual<typeof import('@shared/version-manager')>('@shared/version-manager');
  return {
    ...actual,
    getDesktopVersionData: vi.fn(),
    clearDesktopVersionCache: vi.fn(),
  };
});

vi.mock('@shared/links', () => ({
  getLink: vi.fn(() => '/container/'),
  getLinkWithLocale: vi.fn((key: string, locale?: string) => (locale === 'en' ? 'https://hagicode.com/container/' : '/container/')),
}));

vi.mock('@shared/steam-store-link', () => ({
  getFallbackSteamStoreLink: vi.fn(() => ({
    href: fallbackSteamUrl,
    source: 'fallback',
    updatedAt: null,
  })),
  loadSteamStoreLink: vi.fn(async () => ({
    href: fallbackSteamUrl,
    source: 'canonical',
    updatedAt: '2026-04-16T00:00:00.000Z',
  })),
}));

function createVersionData(overrides: Partial<DesktopVersionData> = {}): DesktopVersionData {
  const assets = [
    {
      name: 'Hagicode.Desktop.Setup.1.2.3.exe',
      path: 'v1.2.3/Hagicode.Desktop.Setup.1.2.3.exe',
      size: 1048576,
      lastModified: null,
    },
    {
      name: 'Hagicode.Desktop-1.2.3-arm64.dmg',
      path: 'v1.2.3/Hagicode.Desktop-1.2.3-arm64.dmg',
      size: 1048576,
      lastModified: null,
    },
  ];

  return {
    latest: {
      version: 'v1.2.3',
      assets,
    },
    platforms: [],
    error: null,
    source: 'primary',
    status: 'ready',
    attempts: [],
    fallbackTarget: null,
    failedAttemptSummary: null,
    channels: {
      stable: {
        latest: {
          version: 'v1.2.3',
          assets,
        },
        all: [],
      },
      beta: {
        latest: null,
        all: [],
      },
    },
    ...overrides,
  };
}

describe('InstallButton runtime states', () => {
  const assignMock = vi.fn();

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.mocked(versionManager.getDesktopVersionData).mockReset();
    vi.mocked(versionManager.clearDesktopVersionCache).mockReset();
    vi.mocked(steamStoreLink.loadSteamStoreLink).mockClear();
    assignMock.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('shows a loading status while runtime data is pending', async () => {
    let resolvePromise: (value: DesktopVersionData) => void = () => {};
    vi.mocked(versionManager.getDesktopVersionData).mockImplementation(
      () =>
        new Promise<DesktopVersionData>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { container } = render(<InstallButton variant="full" locale="en" />);

    expect(screen.getByRole('button', { name: 'China' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeDisabled();
    expect(container.querySelector('.install-button-status')).toBeNull();
    expect(container.querySelector('.btn-download-source-loading')).toBeInTheDocument();

    resolvePromise(createVersionData());
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /China/i })).toBeInTheDocument();
    });
  });

  it('keeps download available when canonical data is ready', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="full" locale="en" />);

    expect(await screen.findByRole('link', { name: /China/i })).toHaveAttribute(
      'href',
      expect.stringContaining('Hagicode.Desktop.Setup.1.2.3.exe'),
    );
  });

  it('promotes Microsoft Store as the primary Windows CTA and hides duplicate shortcuts', async () => {
    window.history.replaceState({}, '', '/?os=windows');
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.4',
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.4.exe',
              path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
              size: 1048576,
              lastModified: null,
              torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
              downloadSources: [
                {
                  kind: 'official',
                  label: 'Official Download',
                  url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  primary: true,
                },
                {
                  kind: 'github-release',
                  label: 'GitHub Release',
                  url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                },
              ],
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.4',
              assets: [
                {
                  name: 'Hagicode.Desktop.Setup.1.2.4.exe',
                  path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  size: 1048576,
                  lastModified: null,
                  torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
                  downloadSources: [
                    {
                      kind: 'official',
                      label: 'Official Download',
                      url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                      primary: true,
                    },
                    {
                      kind: 'github-release',
                      label: 'GitHub Release',
                      url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                    },
                  ],
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    const { container } = render(<InstallButton variant="compact" locale="en" />);

    expect(
      await screen.findByRole('link', { name: 'Install Hagicode Desktop from Microsoft Store' }),
    ).toHaveAttribute('href', windowsStoreUrl);
    expect(screen.queryByRole('link', { name: /China/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /GitHub/i })).not.toBeInTheDocument();
    expect(
      container.querySelector('ms-store-badge[data-windows-store-entry="docs-header-install"]'),
    ).toBeNull();
  });

  it('filters historical deb downloads out of precomputed platform groups', () => {
    const filtered = filterSupportedPlatformGroups([
      {
        platform: 'linux',
        architectures: [CpuArchitecture.X64],
        downloads: [
          {
            url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop-1.2.4.AppImage',
            size: '120 MB',
            filename: 'Hagicode.Desktop-1.2.4.AppImage',
            assetType: AssetType.LinuxAppImage,
            architecture: CpuArchitecture.X64,
            sourceActions: [],
          },
          {
            url: 'https://desktop.dl.hagicode.com/v1.2.4/hagicode-desktop_1.2.4_amd64.deb',
            size: '118 MB',
            filename: 'hagicode-desktop_1.2.4_amd64.deb',
            assetType: 'linux-deb' as AssetType,
            architecture: CpuArchitecture.X64,
            sourceActions: [],
          },
        ],
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.downloads.map((download) => download.filename)).toEqual([
      'Hagicode.Desktop-1.2.4.AppImage',
    ]);
  });

  it('keeps Windows MSIX downloads available in precomputed platform groups', () => {
    const filtered = filterSupportedPlatformGroups([
      {
        platform: 'windows',
        architectures: [CpuArchitecture.X64],
        downloads: [
          {
            url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
            size: '120 MB',
            filename: 'Hagicode.Desktop.Setup.1.2.4.exe',
            assetType: AssetType.WindowsSetup,
            architecture: CpuArchitecture.X64,
            sourceActions: [],
          },
          {
            url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.msix',
            size: '122 MB',
            filename: 'Hagicode.Desktop.msix',
            assetType: AssetType.WindowsMsix,
            architecture: CpuArchitecture.X64,
            sourceActions: [],
          },
        ],
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.downloads.map((download) => download.filename)).toEqual([
      'Hagicode.Desktop.Setup.1.2.4.exe',
      'Hagicode.Desktop.msix',
    ]);
  });

  it('renders separate accelerated and GitHub buttons while keeping torrent in the version menu', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.4',
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.4.exe',
              path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
              size: 1048576,
              lastModified: null,
              torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
              downloadSources: [
                {
                  kind: 'official',
                  label: 'Official Download',
                  url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  primary: true,
                },
                {
                  kind: 'github-release',
                  label: 'GitHub Release',
                  url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                },
              ],
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.4',
              assets: [
                {
                  name: 'Hagicode.Desktop.Setup.1.2.4.exe',
                  path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  size: 1048576,
                  lastModified: null,
                  torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
                  downloadSources: [
                    {
                      kind: 'official',
                      label: 'Official Download',
                      url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                      primary: true,
                    },
                    {
                      kind: 'github-release',
                      label: 'GitHub Release',
                      url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                    },
                  ],
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    render(<InstallButton variant="full" locale="en" />);

    expect(await screen.findByRole('link', { name: /China/i })).toHaveAttribute(
      'href',
      expect.stringContaining('desktop.dl.hagicode.com'),
    );
    expect(screen.getByRole('link', { name: /GitHub/i })).toHaveAttribute(
      'href',
      expect.stringContaining('github.com'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    expect(await screen.findByRole('menuitem', { name: 'China' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Torrent/i })).toBeInTheDocument();
  });

  it('keeps the compact header install entry as one grouped control while preserving the menu', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.4',
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.4.exe',
              path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
              size: 1048576,
              lastModified: null,
              torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
              downloadSources: [
                {
                  kind: 'official',
                  label: 'Official Download',
                  url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  primary: true,
                },
                {
                  kind: 'github-release',
                  label: 'GitHub Release',
                  url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                },
              ],
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.4',
              assets: [
                {
                  name: 'Hagicode.Desktop.Setup.1.2.4.exe',
                  path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  size: 1048576,
                  lastModified: null,
                  torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
                  downloadSources: [
                    {
                      kind: 'official',
                      label: 'Official Download',
                      url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                      primary: true,
                    },
                    {
                      kind: 'github-release',
                      label: 'GitHub Release',
                      url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                    },
                  ],
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    const { container } = render(<InstallButton variant="compact" locale="en" />);

    await waitFor(() => {
      expect(container.querySelector('[data-action-group="segmented"]')).toBeInTheDocument();
    });
    expect(container.querySelector('[data-segment-role="primary-actions"]')).toBeInTheDocument();
    expect(container.querySelector('[data-segment-role="toggle"]')).toBeInTheDocument();
    const windowsStoreBadge = container.querySelector('ms-store-badge[data-windows-store-entry="docs-header-install"]');
    expect(windowsStoreBadge).toHaveAttribute('productid', '9N3PM0N3SVDW');
    expect(windowsStoreBadge).toHaveAttribute('language', 'en-us');

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('keeps the dropdown menu subtree out of the DOM until the toggle is opened', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="full" locale="en" />);

    await screen.findByRole('link', { name: /China/i });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the compact header install cluster free of the Steam shortcut while Steam support is pending', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.4',
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.4.exe',
              path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
              size: 1048576,
              lastModified: null,
              torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
              downloadSources: [
                {
                  kind: 'official',
                  label: 'Official Download',
                  url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  primary: true,
                },
                {
                  kind: 'github-release',
                  label: 'GitHub Release',
                  url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                },
              ],
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.4',
              assets: [
                {
                  name: 'Hagicode.Desktop.Setup.1.2.4.exe',
                  path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  size: 1048576,
                  lastModified: null,
                  torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
                  downloadSources: [
                    {
                      kind: 'official',
                      label: 'Official Download',
                      url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                      primary: true,
                    },
                    {
                      kind: 'github-release',
                      label: 'GitHub Release',
                      url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                    },
                  ],
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    render(<InstallButton variant="compact" locale="en" />);

    await screen.findByRole('link', { name: /China/i });
    expect(screen.queryByRole('link', { name: 'Open Hagicode on Steam' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /China/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GitHub/i })).toBeInTheDocument();
  });

  it('skips the Steam link fetch for the full install surface', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="full" locale="en" />);

    await screen.findByRole('link', { name: /China/i });
    expect(vi.mocked(steamStoreLink.loadSteamStoreLink)).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open Hagicode on Steam' })).not.toBeInTheDocument();
  });

  it('skips the Steam link fetch for the compact install surface while Steam support is pending', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="compact" locale="en" />);

    await screen.findByRole('link', { name: /China/i });
    expect(vi.mocked(steamStoreLink.loadSteamStoreLink)).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open Hagicode on Steam' })).not.toBeInTheDocument();
  });

  it('hides the missing GitHub button when only the accelerated source is available', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.4',
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.4.exe',
              path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
              size: 1048576,
              lastModified: null,
              directUrl: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.4',
              assets: [
                {
                  name: 'Hagicode.Desktop.Setup.1.2.4.exe',
                  path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  size: 1048576,
                  lastModified: null,
                  directUrl: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    render(<InstallButton variant="full" locale="en" />);

    expect(await screen.findByRole('link', { name: /China/i })).toHaveAttribute(
      'href',
      expect.stringContaining('desktop.dl.hagicode.com'),
    );
    expect(screen.queryByRole('link', { name: /GitHub/i })).not.toBeInTheDocument();
  });

  it('moves the current OS group to the top of the dropdown', async () => {
    window.history.replaceState({}, '', '/?os=windows');
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: {
          version: 'v1.2.5',
          assets: [
            {
              name: 'Hagicode.Desktop-1.2.5.AppImage',
              path: 'v1.2.5/Hagicode.Desktop-1.2.5.AppImage',
              size: 1048576,
              lastModified: null,
            },
            {
              name: 'Hagicode.Desktop.Setup.1.2.5.exe',
              path: 'v1.2.5/Hagicode.Desktop.Setup.1.2.5.exe',
              size: 1048576,
              lastModified: null,
            },
            {
              name: 'Hagicode.Desktop-1.2.5-arm64.dmg',
              path: 'v1.2.5/Hagicode.Desktop-1.2.5-arm64.dmg',
              size: 1048576,
              lastModified: null,
            },
          ],
        },
        channels: {
          stable: {
            latest: {
              version: 'v1.2.5',
              assets: [
                {
                  name: 'Hagicode.Desktop-1.2.5.AppImage',
                  path: 'v1.2.5/Hagicode.Desktop-1.2.5.AppImage',
                  size: 1048576,
                  lastModified: null,
                },
                {
                  name: 'Hagicode.Desktop.Setup.1.2.5.exe',
                  path: 'v1.2.5/Hagicode.Desktop.Setup.1.2.5.exe',
                  size: 1048576,
                  lastModified: null,
                },
                {
                  name: 'Hagicode.Desktop-1.2.5-arm64.dmg',
                  path: 'v1.2.5/Hagicode.Desktop-1.2.5-arm64.dmg',
                  size: 1048576,
                  lastModified: null,
                },
              ],
            },
            all: [],
          },
          beta: { latest: null, all: [] },
        },
      }),
    );

    const { container } = render(<InstallButton variant="full" locale="en" />);

    await screen.findByRole('link', { name: 'Install Hagicode Desktop from Microsoft Store' });
    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));

    const groupLabels = Array.from(container.querySelectorAll('.dropdown-group-label'));
    expect(groupLabels[0]).toHaveTextContent('Windows');
  });

  it('shows fallback actions and auto-redirects from the full install entry after terminal failure', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      assign: assignMock,
    });
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: null,
        channels: {
          stable: { latest: null, all: [] },
          beta: { latest: null, all: [] },
        },
        source: null,
        status: 'fatal',
        error: 'Failed to load desktop versions',
        fallbackTarget: fallbackUrl,
        failedAttemptSummary: 'primary=down; backup=503; local=offline',
      }),
    );

    render(<InstallButton variant="full" locale="en" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Redirecting to version history');
    expect(alert).toHaveTextContent('primary=down; backup=503; local=offline');
    expect(screen.getByRole('link', { name: 'Open version history' })).toHaveAttribute('href', fallbackUrl);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'China' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeDisabled();

    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(assignMock).toHaveBeenCalledWith(fallbackUrl);
  });

  it('keeps the compact entry on-page while still exposing version history and retry actions', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      assign: assignMock,
    });
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: null,
        channels: {
          stable: { latest: null, all: [] },
          beta: { latest: null, all: [] },
        },
        source: null,
        status: 'fatal',
        error: 'Failed to load desktop versions',
        fallbackTarget: fallbackUrl,
        failedAttemptSummary: 'primary=down',
      }),
    );

    render(<InstallButton variant="compact" locale="en" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Open version history or retry');
    expect(screen.getByRole('link', { name: 'Open version history' })).toHaveAttribute('href', fallbackUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(versionManager.clearDesktopVersionCache).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(assignMock).not.toHaveBeenCalled();
  });
});
