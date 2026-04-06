// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetGithubReachabilityProbeCache } from '@shared/desktop-utils';
import type { DesktopVersionData } from '@shared/version-manager';
import * as versionManager from '@shared/version-manager';
import InstallButton from '../InstallButton';

const fallbackUrl = 'https://index.hagicode.com/desktop/history/';

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
    resetGithubReachabilityProbeCache();
  });

  beforeEach(() => {
    vi.mocked(versionManager.getDesktopVersionData).mockReset();
    vi.mocked(versionManager.clearDesktopVersionCache).mockReset();
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

    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    expect(container.querySelector('.install-button-status')).toBeNull();
    expect(container.querySelector('.btn-download-main-loading')).toBeInTheDocument();

    resolvePromise(createVersionData());
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Install Hagicode Desktop Now/i })).toBeInTheDocument();
    });
  });

  it('keeps download available when canonical data is ready', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="full" locale="en" />);

    expect(await screen.findByRole('link', { name: /Install Hagicode Desktop Now/i })).toHaveAttribute(
      'href',
      expect.stringContaining('Hagicode.Desktop.Setup.1.2.3.exe'),
    );
  });

  it('promotes GitHub Release to the primary CTA after a successful probe and exposes all source actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
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

    const primaryLink = await screen.findByRole('link', { name: /Install Hagicode Desktop Now/i });
    await waitFor(() => {
      expect(primaryLink).toHaveAttribute('href', expect.stringContaining('github.com'));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Other Version' }));
    expect(await screen.findByRole('menuitem', { name: /Official Download/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /GitHub Release/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Torrent/i })).toBeInTheDocument();
  });

  it('falls back to the official link when the GitHub probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
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
              downloadSources: [
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
                  directUrl: 'https://desktop.dl.hagicode.com/v1.2.4/Hagicode.Desktop.Setup.1.2.4.exe',
                  downloadSources: [
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

    const primaryLink = await screen.findByRole('link', { name: /Install Hagicode Desktop Now/i });
    await waitFor(() => {
      expect(primaryLink).toHaveAttribute('href', expect.stringContaining('desktop.dl.hagicode.com'));
    });
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

    await screen.findByRole('link', { name: /Install Hagicode Desktop Now/i });
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
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Install Hagicode Desktop Now/i })).not.toBeInTheDocument();

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
