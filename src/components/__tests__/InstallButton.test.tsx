// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  return {
    latest: {
      version: 'v1.2.3',
      assets: [
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
      ],
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
          assets: [
            {
              name: 'Hagicode.Desktop.Setup.1.2.3.exe',
              path: 'v1.2.3/Hagicode.Desktop.Setup.1.2.3.exe',
              size: 1048576,
              lastModified: null,
            },
          ],
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
    assignMock.mockReset();
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
      expect(screen.getByRole('link', { name: 'Install Hagicode Desktop Now' })).toBeInTheDocument();
    });
  });

  it('keeps download available when canonical data is ready', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData(),
    );

    render(<InstallButton variant="full" locale="en" />);

    expect(await screen.findByRole('link', { name: 'Install Hagicode Desktop Now' })).toHaveAttribute(
      'href',
      expect.stringContaining('Hagicode.Desktop.Setup.1.2.3.exe'),
    );
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
    expect(screen.queryByRole('link', { name: 'Install Hagicode Desktop Now' })).not.toBeInTheDocument();

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
