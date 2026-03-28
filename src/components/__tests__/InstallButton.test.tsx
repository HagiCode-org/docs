// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopVersionData } from '@shared/version-manager';
import * as versionManager from '@shared/version-manager';
import InstallButton from '../InstallButton';

vi.mock('@shared/version-manager', async () => {
  const actual = await vi.importActual<typeof import('@shared/version-manager')>('@shared/version-manager');
  return {
    ...actual,
    getDesktopVersionData: vi.fn(),
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(versionManager.getDesktopVersionData).mockReset();
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

  it('blocks download and shows a fatal error when no valid data is available', async () => {
    vi.mocked(versionManager.getDesktopVersionData).mockResolvedValue(
      createVersionData({
        latest: null,
        channels: {
          stable: { latest: null, all: [] },
          beta: { latest: null, all: [] },
        },
        source: null,
        status: 'fatal',
        error: 'Failed to load desktop versions: primary=down',
      }),
    );

    render(<InstallButton variant="full" locale="en" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load a valid desktop version right now');
    expect(alert).toHaveTextContent('primary=down');
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Install Hagicode Desktop Now' })).not.toBeInTheDocument();
  });
});
