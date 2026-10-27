// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { installGaEventTracking } from '@hagicode/hagilight-core/analytics-events';
import { AssetType, CpuArchitecture } from '@shared/desktop';
import type { DesktopVersionData } from '@shared/version-manager';
import { groupAssetsByPlatform } from '@shared/desktop-utils';
import * as steamStoreLink from '@shared/steam-store-link';
import * as versionManager from '@shared/version-manager';
import InstallButton, { filterSupportedPlatformGroups, getDesktopDownloadGaLabel } from '../InstallButton';
import MicrosoftStoreBadge from '../MicrosoftStoreBadge';

const fallbackUrl = 'https://index.hagicode.com/desktop/history/';
const windowsStoreUrl = 'https://apps.microsoft.com/detail/9N3PM0N3SVDW';
const fallbackSteamUrl = 'https://store.steampowered.com/app/4625540/Hagicode/';

it('loads the Microsoft Store badge script only when a badge is rendered', () => {
  const src = 'https://get.microsoft.com/badge/ms-store-badge.bundled.js';
  render(<><MicrosoftStoreBadge /><MicrosoftStoreBadge /></>);
  expect(document.querySelectorAll(`script[src="${src}"]`)).toHaveLength(1);
  document.querySelector(`script[src="${src}"]`)?.remove();
});
const features = vi.hoisted(() => ({ steam: false }));

vi.mock('@/config/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/features')>()),
  get FEATURE_SITE_STEAM_ENABLED() {
    return features.steam;
  },
}));

vi.mock('@shared/version-manager', async () => {
  const actual = await vi.importActual<typeof import('@shared/version-manager')>('@shared/version-manager');
  return {
    ...actual,
    getDesktopVersionData: vi.fn(),
    clearDesktopVersionCache: vi.fn(),
  };
});

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
const unsignedVersion = {
  version: 'v0.1.77',
  assets: [
    {
      name: 'Hagicode.Desktop-0.1.77-arm64-unsigned.dmg',
      path: 'v0.1.77/Hagicode.Desktop-0.1.77-arm64-unsigned.dmg',
      size: 265383481,
      lastModified: null,
    },
    {
      name: 'Hagicode.Desktop-unsigned.msix',
      path: 'v0.1.77/Hagicode.Desktop-unsigned.msix',
      size: 1048576,
      lastModified: null,
    },
    {
      name: 'Hagicode.Desktop.0.1.77-unsigned.exe',
      path: 'v0.1.77/Hagicode.Desktop.0.1.77-unsigned.exe',
      size: 1048576,
      lastModified: null,
    },
    {
      name: 'Hagicode.Desktop.Setup.0.1.77-unsigned.exe',
      path: 'v0.1.77/Hagicode.Desktop.Setup.0.1.77-unsigned.exe',
      size: 1048576,
      lastModified: null,
    },
  ],
};

const unsignedPlatformGroups = groupAssetsByPlatform(unsignedVersion.assets);


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

  it('keeps v0.1.77 unsigned desktop assets in platform groups', () => {
    expect(unsignedPlatformGroups.map((group) => group.platform)).toEqual(['macos', 'windows']);
    expect(unsignedPlatformGroups[0]?.downloads.map((download) => download.filename)).toEqual([
      'Hagicode.Desktop-0.1.77-arm64-unsigned.dmg',
    ]);
    expect(unsignedPlatformGroups[1]?.downloads.map((download) => download.filename)).toEqual([
      'Hagicode.Desktop.Setup.0.1.77-unsigned.exe',
      'Hagicode.Desktop-unsigned.msix',
      'Hagicode.Desktop.0.1.77-unsigned.exe',
    ]);
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

describe('getDesktopDownloadGaLabel', () => {
  it.each([
    [AssetType.WindowsSetup, 'downloadDesktopWindows'],
    [AssetType.WindowsPortable, 'downloadDesktopWindows'],
    [AssetType.WindowsMsix, 'downloadDesktopWindows'],
    [AssetType.WindowsStore, 'downloadDesktopWindows'],
    [AssetType.MacOSApple, 'downloadDesktopMacOS'],
    [AssetType.MacOSIntel, 'downloadDesktopMacOS'],
    [AssetType.LinuxAppImage, 'downloadDesktopLinux'],
    [AssetType.LinuxArm64AppImage, 'downloadDesktopLinux'],
    [AssetType.LinuxTarball, 'downloadDesktopLinux'],
    [AssetType.LinuxArm64Tarball, 'downloadDesktopLinux'],
  ])('maps %s to %s', (assetType, label) => {
    expect(getDesktopDownloadGaLabel(assetType)).toBe(label);
  });

  it.each([AssetType.Source, AssetType.Unknown, 'something-new', '', null, undefined])(
    'falls back to the generic label for %s',
    (assetType) => {
      expect(getDesktopDownloadGaLabel(assetType)).toBe('downloadDesktop');
    },
  );
});

describe('InstallButton Google Analytics events', () => {
  const gtag = vi.fn();

  beforeAll(() => {
    installGaEventTracking(document, () => gtag);
    // jsdom does not implement navigation; keep link clicks from logging errors.
    document.addEventListener('click', (event) => event.preventDefault());
  });

  beforeEach(() => {
    gtag.mockClear();
    features.steam = false;
    vi.mocked(versionManager.getDesktopVersionData).mockReset();
    vi.mocked(versionManager.clearDesktopVersionCache).mockReset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    features.steam = false;
  });

  function createSourcedVersionData(): DesktopVersionData {
    const asset = {
      name: 'Hagicode.Desktop.Setup.1.2.4.exe',
      path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
      size: 1048576,
      lastModified: null,
      torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
      downloadSources: [
        {
          kind: 'official' as const,
          label: 'Official Download',
          url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
          primary: true,
        },
        {
          kind: 'github-release' as const,
          label: 'GitHub Release',
          url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
        },
      ],
    };
    const latest = { version: 'v1.2.4', assets: [asset] };

    return createVersionData({
      latest,
      channels: {
        stable: { latest, all: [] },
        beta: { latest: null, all: [] },
      },
    });
  }

  function expectOneEvent(
    action: 'download_click' | 'link_click' | 'store_visit',
    params: { category: string; label: string; url: string },
  ) {
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', action, {
      event_category: params.category,
      event_label: params.label,
      link_location: 'docs_install_button',
      link_url: params.url,
      transport_type: 'beacon',
    });
    gtag.mockClear();
  }

  it('reports one download event per platform installer click and none for the dropdown toggle', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createSourcedVersionData());

    render(<InstallButton variant="full" locale="en" />);

    const primary = await screen.findByRole('link', { name: /China/i });
    fireEvent.click(primary);
    expectOneEvent('download_click', {
      category: 'download',
      label: 'downloadDesktopWindows',
      url: primary.getAttribute('href') as string,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    expect(gtag).not.toHaveBeenCalled();

    for (const name of ['China', 'GitHub', /Torrent/i]) {
      const item = await screen.findByRole('menuitem', { name });
      fireEvent.click(item);
      expectOneEvent('download_click', {
        category: 'download',
        label: 'downloadDesktopWindows',
        url: item.getAttribute('href') as string,
      });
      if (!screen.queryByRole('menu')) {
        fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
      }
    }
  });

  it('reports the primary Microsoft Store link on Windows', async () => {
    window.history.replaceState({}, '', '/?os=windows');
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createSourcedVersionData());

    render(<InstallButton variant="compact" locale="en" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Install Hagicode Desktop from Microsoft Store' }));

    expectOneEvent('store_visit', { category: 'store', label: 'microsoftStore', url: windowsStoreUrl });
  });

  it('reports the Microsoft Store badge shortcut once through its host element', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createSourcedVersionData());

    const { container } = render(<InstallButton variant="compact" locale="en" />);

    await screen.findByRole('link', { name: /China/i });
    const badge = container.querySelector('ms-store-badge[data-windows-store-entry="docs-header-install"]');
    expect(badge).not.toBeNull();
    fireEvent.click(badge as Element);

    expectOneEvent('store_visit', { category: 'store', label: 'microsoftStore', url: windowsStoreUrl });
  });

  it('reports the Steam shortcut as a store visit once', async () => {
    features.steam = true;
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createSourcedVersionData());

    render(<InstallButton variant="compact" locale="en" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Open Hagicode on Steam' }));

    expectOneEvent('store_visit', { category: 'store', label: 'openSteamStore', url: fallbackSteamUrl });
  });

  it('sends nothing for the retry and version history controls', async () => {
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

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('link', { name: 'Open version history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('InstallButton PostHog events', () => {
  const capture = vi.fn();
  type PostHogWindow = { posthog?: unknown };

  const windowsSetupProps = {
    platform: 'windows',
    architecture: 'x64',
    asset_type: 'windows-setup',
  };

  beforeEach(() => {
    capture.mockReset();
    (window as unknown as PostHogWindow).posthog = {
      __loaded: true,
      capture,
      has_opted_out_capturing: () => false,
    };
    vi.mocked(versionManager.getDesktopVersionData).mockReset();
    vi.mocked(versionManager.clearDesktopVersionCache).mockReset();
    features.steam = false;
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as PostHogWindow).posthog;
    features.steam = false;
  });

  function createWindowsVersion(overrides: Partial<DesktopVersionData> = {}): DesktopVersionData {
    const asset = {
      name: 'Hagicode.Desktop.Setup.1.2.4.exe',
      path: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
      size: 1048576,
      lastModified: null,
      torrentUrl: 'v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe.torrent',
      downloadSources: [
        {
          kind: 'official' as const,
          label: 'Official Download',
          url: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
          primary: true,
        },
        {
          kind: 'github-release' as const,
          label: 'GitHub Release',
          url: 'https://github.com/HagiCode-org/releases/download/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
        },
      ],
    };
    const latest = { version: 'v1.2.4', assets: [asset] };

    return createVersionData({
      latest,
      channels: {
        stable: { latest, all: [] },
        beta: { latest: null, all: [] },
      },
      ...overrides,
    });
  }

  it('reports the accelerated primary download with the resolved model and no URL', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    render(<InstallButton variant="full" locale="en" />);
    fireEvent.click(await screen.findByRole('link', { name: /China/i }));

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('download_desktop_windows', {
      ...windowsSetupProps,
      source: 'accelerated',
      app_version: '1.2.4',
    });
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/https?:/);
  });

  it('reports the GitHub dropdown item and sends nothing for the torrent item or the toggle', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    render(<InstallButton variant="full" locale="en" />);
    await screen.findByRole('link', { name: /China/i });

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    expect(capture).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('menuitem', { name: /Torrent/i }));
    expect(capture).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'GitHub' }));

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('download_desktop_windows', {
      ...windowsSetupProps,
      source: 'github',
      app_version: '1.2.4',
    });
  });

  it.each([
    ['backup index', { source: 'backup' as const, status: 'degraded' as const }],
    ['local snapshot', { source: 'local' as const, status: 'local_snapshot' as const }],
  ])('reports the %s fallback with the source and version actually used', async (_label, overrides) => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion(overrides));

    render(<InstallButton variant="full" locale="en" />);
    fireEvent.click(await screen.findByRole('link', { name: /China/i }));

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('download_desktop_windows', {
      ...windowsSetupProps,
      source: 'accelerated',
      app_version: '1.2.4',
    });
  });

  it('sends nothing for a disabled source', async () => {
    const emptyLatest = { version: 'v1.2.4', assets: [] };
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: emptyLatest,
        channels: {
          stable: { latest: emptyLatest, all: [] },
          beta: { latest: null, all: [] },
        },
      }),
    );

    const { container } = render(<InstallButton variant="full" locale="en" />);
    await waitFor(() => {
      expect(container.querySelectorAll('button.btn-download-source-disabled').length).toBeGreaterThan(0);
    });

    for (const button of Array.from(container.querySelectorAll('button.btn-download-source-disabled'))) {
      fireEvent.click(button);
    }

    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps the primary link navigation and sends nothing when PostHog is missing', async () => {
    delete (window as unknown as PostHogWindow).posthog;
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    render(<InstallButton variant="full" locale="en" />);
    const primary = await screen.findByRole('link', { name: /China/i });
    fireEvent.click(primary);

    expect(primary).toHaveAttribute('href', 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe');
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports the Microsoft Store primary button on Windows with no URL', async () => {
    window.history.replaceState({}, '', '/?os=windows');
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    render(<InstallButton variant="compact" locale="en" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Install Hagicode Desktop from Microsoft Store' }));

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('open_microsoft_store', { source: 'install_primary' });
  });

  it('reports the Microsoft Store badge shortcut through its host element', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    const { container } = render(<InstallButton variant="compact" locale="en" />);
    await screen.findByRole('link', { name: /China/i });
    const badge = container.querySelector('ms-store-badge[data-windows-store-entry="docs-header-install"]');
    expect(badge).not.toBeNull();
    fireEvent.click(badge as Element);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('open_microsoft_store', { source: 'install_shortcut' });
  });

  it('reports the Steam shortcut with no URL', async () => {
    features.steam = true;
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(createWindowsVersion());

    render(<InstallButton variant="compact" locale="en" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Open Hagicode on Steam' }));

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('open_steam_store', { source: 'install_shortcut' });
  });
});
