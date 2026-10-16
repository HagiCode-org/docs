/**
 * InstallButton 组件 - 文档站点版本 (React)
 * 支持自动平台检测、下拉菜单选择版本。
 * 运行时仅消费 canonical index，并展示加载/可用/失败状态。
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type {
  AssetType,
  DesktopVersion,
  DownloadAction,
  PlatformGroup,
} from '@shared/desktop';
import {
  detectOS,
  getDownloadActionLabel,
  getArchitectureLabel,
  getAssetTypeLabel,
  getFileExtension,
  getPrimaryDownloadSourceLabel,
  groupAssetsByPlatform,
  PLATFORM_ICONS,
  resolvePrimaryDownloadActionPair,
} from '@shared/desktop-utils';
import type {
  PrimaryDownloadActionPair,
  PrimaryDownloadSourceKey,
} from '@shared/desktop-utils';
import {
  clearDesktopVersionCache,
  DESKTOP_HISTORY_FALLBACK_URL,
  getDesktopVersionData,
} from '@shared/version-manager';
import type {
  DesktopVersionData,
  DesktopVersionState,
} from '@shared/version-manager';
import { gaEventAttributes } from '@hagicode/hagilight-core/analytics-events';
import { getFallbackSteamStoreLink, loadSteamStoreLink } from '@shared/steam-store-link';
import { FEATURE_MAC_DOWNLOAD_ENABLED, FEATURE_SITE_STEAM_ENABLED } from '@/config/features';
import MicrosoftStoreBadge from './MicrosoftStoreBadge';

const PLATFORM_LABELS = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
} as const;

interface DownloadOption {
  label: string;
  url: string;
  size?: string;
  assetType: AssetType;
  sourceActions: DownloadAction[];
}

interface PlatformDownloads {
  platform: 'windows' | 'macos' | 'linux';
  platformLabel: string;
  options: DownloadOption[];
}

interface InstallButtonPrimaryTarget {
  option: DownloadOption | null;
  actions: PrimaryDownloadActionPair;
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-steam-icon="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16.8" cy="7.8" r="2.15" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="9.1" cy="15.1" r="1.45" fill="currentColor" />
      <path
        d="M10.2 14.2L14.7 10.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M15.6 9.2a1.75 1.75 0 1 0 2.4-2.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M7.5 14.6l2.8 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const WINDOWS_STORE_URL = 'https://apps.microsoft.com/detail/9N3PM0N3SVDW';
const GA_INSTALL_LOCATION = 'docs_install_button';

/** Stable Google Analytics label for a desktop installer, shared with the Website's `downloadDesktop*` labels. */
export function getDesktopDownloadGaLabel(assetType: AssetType | string | null | undefined): string {
  const type = String(assetType ?? '');
  if (type.startsWith('windows-')) return 'downloadDesktopWindows';
  if (type.startsWith('macos-')) return 'downloadDesktopMacOS';
  if (type.startsWith('linux-')) return 'downloadDesktopLinux';
  return 'downloadDesktop';
}

interface InstallButtonProps {
  variant?: 'full' | 'compact';
  className?: string;
  initialVersion?: DesktopVersion | null;
  initialPlatforms?: PlatformGroup[];
  versionError?: string | null;
  channel?: 'stable' | 'beta';
  locale?: 'zh' | 'en';
}

export interface InstallButtonStatusDescriptor {
  tone: 'info' | 'warning' | 'error';
  message: string;
  detail: string | null;
}

interface InstallButtonStatusInput {
  runtimeState: DesktopVersionState | null;
  error: string | null;
  failedAttemptSummary: string | null;
  historyFallbackTarget: string | null;
  variant: 'full' | 'compact';
  locale: 'zh' | 'en';
}

function prioritizeCurrentPlatform<T extends { platform: 'windows' | 'macos' | 'linux' }>(
  platforms: T[],
  currentOS: 'windows' | 'macos' | 'linux' | 'unknown',
): T[] {
  if (platforms.length <= 1 || currentOS === 'unknown') {
    return platforms;
  }

  const currentIndex = platforms.findIndex((platform) => platform.platform === currentOS);
  if (currentIndex <= 0) {
    return platforms;
  }

  return [
    platforms[currentIndex],
    ...platforms.slice(0, currentIndex),
    ...platforms.slice(currentIndex + 1),
  ];
}

function convertPlatformGroups(platforms: PlatformGroup[]): PlatformDownloads[] {
  return platforms.map((platform) => ({
    platform: platform.platform,
    platformLabel: PLATFORM_LABELS[platform.platform],
    options: platform.downloads.map((download) => ({
      label: download.filename,
      url: download.url,
      size: download.size,
      assetType: download.assetType,
      sourceActions: download.sourceActions,
    })),
  }));
}

function isUnsupportedPublicDownload(
  download: Pick<DownloadOption, 'assetType' | 'label'>,
): boolean {
  const assetType = String(download.assetType);
  return assetType === 'linux-deb'
    || assetType === 'linux-arm64-deb'
    || download.label.toLowerCase().endsWith('.deb');
}

export function filterSupportedPlatformGroups(platforms: PlatformGroup[]): PlatformGroup[] {
  return platforms
    .map((platform) => ({
      ...platform,
      downloads: platform.downloads.filter((download) => !isUnsupportedPublicDownload({
        assetType: download.assetType,
        label: download.filename,
      })),
    }))
    .filter((platform) => platform.downloads.length > 0);
}

export function resolveDocsInstallPrimaryTarget(
  platformData: PlatformDownloads[],
  userOS: 'windows' | 'macos' | 'linux' | 'unknown',
): InstallButtonPrimaryTarget {
  if (platformData.length === 0) {
    return {
      option: null,
      actions: resolvePrimaryDownloadActionPair(null),
    };
  }

  const userPlatform = platformData.find((platform) => platform.platform === userOS);
  const preferredPlatform = userPlatform ?? platformData[0];
  const preferredOption = preferredPlatform.options[0] ?? null;

  return {
    option: preferredOption,
    actions: resolvePrimaryDownloadActionPair(
      preferredOption ? { sourceActions: preferredOption.sourceActions } : null,
    ),
  };
}

export function getInstallButtonStatusDescriptor({
  runtimeState,
  error,
  failedAttemptSummary,
  historyFallbackTarget,
  variant,
  locale,
}: InstallButtonStatusInput): InstallButtonStatusDescriptor | null {
  const detail = failedAttemptSummary || error;

  if (runtimeState === 'fatal' || error) {
    return {
      tone: 'error',
      message:
        locale === 'en'
          ? variant === 'full' && historyFallbackTarget
            ? 'Unable to load desktop packages. Redirecting to version history...'
            : 'Unable to load desktop packages. Open version history or retry.'
          : variant === 'full' && historyFallbackTarget
            ? '暂时无法加载桌面端安装包，正在跳转到版本历史页。'
            : '暂时无法加载桌面端安装包，可打开版本历史页或重试。',
      detail,
    };
  }

  if (runtimeState === 'local_snapshot') {
    return {
      tone: 'warning',
      message:
        locale === 'en'
          ? 'Primary sources are unavailable. Showing the local snapshot, which may be stale.'
          : '主版本源暂不可用，当前显示站内快照，信息可能滞后。',
      detail,
    };
  }

  if (runtimeState === 'degraded') {
    return {
      tone: 'warning',
      message:
        locale === 'en'
          ? 'Primary source is unavailable. Showing the backup index.'
          : '主版本源暂不可用，当前显示备用索引数据。',
      detail,
    };
  }

  return null;
}

function selectLatestForChannel(
  data: DesktopVersionData,
  channel: 'stable' | 'beta',
): DesktopVersion | null {
  if (data.channels[channel]?.latest) {
    return data.channels[channel].latest;
  }

  if (data.channels.stable.latest) {
    return data.channels.stable.latest;
  }

  return data.latest;
}

export default function InstallButton({
  variant = 'compact',
  className = '',
  initialVersion = null,
  initialPlatforms = [],
  versionError = null,
  channel = 'stable',
  locale = 'zh',
}: InstallButtonProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const supportedInitialPlatforms = useMemo(
    () => filterSupportedPlatformGroups(initialPlatforms),
    [initialPlatforms],
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [version, setVersion] = useState<DesktopVersion | null>(initialVersion);
  const [platforms, setPlatforms] = useState<PlatformGroup[]>(supportedInitialPlatforms);
  const [error, setError] = useState<string | null>(versionError);
  const [runtimeData, setRuntimeData] = useState<DesktopVersionData | null>(null);
  const [steamStoreLink, setSteamStoreLink] = useState(() => getFallbackSteamStoreLink());
  const [isLoading, setIsLoading] = useState(
    !initialVersion && supportedInitialPlatforms.length === 0 && !versionError,
  );

  const t = useMemo(() => {
    return locale === 'en'
      ? {
          installNow: 'Install Now',
          installHagicodeDesktop: 'Install Hagicode Desktop Now',
          selectOtherVersion: 'Select Other Version',
          selectDownloadVersion: 'Select Download Version',
          recommended: 'Recommended',
          unavailable: 'Unavailable',
          retry: 'Retry',
          openVersionHistory: 'Open version history',
          windowsStoreInstall: 'Install from Microsoft Store',
          windowsStoreAriaLabel: 'Install Hagicode Desktop from Microsoft Store',
          desktopPackages: 'Desktop packages',
          choosePackage: 'Choose the package for your device',
          packageHint: 'Your current platform is listed first, and the default source is clearly tagged.',
          currentVersion: 'Version',
          currentDevice: 'Current device',
          defaultTagged: 'Default source tagged',
        }
      : {
          installNow: '立即安装',
          installHagicodeDesktop: '立即安装 Hagicode Desktop',
          selectOtherVersion: '选择其他版本',
          selectDownloadVersion: '选择下载版本',
          recommended: '⭐推荐',
          unavailable: '暂不可用',
          retry: '重试',
          openVersionHistory: '打开版本历史页',
          windowsStoreInstall: 'Microsoft Store 安装',
          windowsStoreAriaLabel: '通过 Microsoft Store 安装 Hagicode Desktop',
          desktopPackages: 'Desktop 安装包',
          choosePackage: '选择适合当前设备的安装包',
          packageHint: '当前设备对应的平台会优先展示，默认下载源会被明确标记。',
          currentVersion: '当前版本',
          currentDevice: '当前设备',
          defaultTagged: '默认源已标记',
        };
  }, [locale]);

  const steamShortcutLabel = 'Steam';
  const steamShortcutAriaLabel =
    locale === 'en' ? 'Open Hagicode on Steam' : '打开 Hagicode Steam 商店页';
  const windowsStoreShortcutAriaLabel =
    locale === 'en' ? 'Open Hagicode on Microsoft Store' : '打开 Hagicode Microsoft Store 页面';

  const loadRuntimeVersionData = useCallback(() => {
    let mounted = true;

    setIsLoading(true);

    getDesktopVersionData()
      .then((data) => {
        if (!mounted) {
          return;
        }

        const latest = selectLatestForChannel(data, channel);
        const nextPlatforms = latest ? filterSupportedPlatformGroups(groupAssetsByPlatform(latest.assets)) : [];

        setRuntimeData(data);
        setVersion(latest);
        setPlatforms(nextPlatforms);
        setError(data.error);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        setRuntimeData({
          latest: null,
          platforms: [],
          error: message,
          source: null,
          status: 'fatal',
          attempts: [],
          fallbackTarget: DESKTOP_HISTORY_FALLBACK_URL,
          failedAttemptSummary: message,
          channels: {
            stable: { latest: null, all: [] },
            beta: { latest: null, all: [] },
          },
        });
        setVersion(null);
        setPlatforms([]);
        setError(message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [channel]);

  const showSteamShortcut = FEATURE_SITE_STEAM_ENABLED && variant === 'compact' && steamStoreLink.href.length > 0;
  const needsSteamLink = FEATURE_SITE_STEAM_ENABLED && variant === 'compact';

  useEffect(() => {
    if (!needsSteamLink) {
      return undefined;
    }

    let mounted = true;

    void loadSteamStoreLink().then((nextLink) => {
      if (mounted) {
        setSteamStoreLink(nextLink);
      }
    });

    return () => {
      mounted = false;
    };
  }, [needsSteamLink]);

  useEffect(() => {
    if (initialVersion || supportedInitialPlatforms.length > 0 || versionError) {
      return;
    }

    return loadRuntimeVersionData();
  }, [initialVersion, loadRuntimeVersionData, supportedInitialPlatforms.length, versionError]);

  const buttonId = useId();
  const currentOS = useMemo(() => detectOS(), []);

  const allPlatformData = useMemo(() => {
    if (!platforms || platforms.length === 0) {
      return [];
    }

    return convertPlatformGroups(platforms);
  }, [platforms]);

  const platformData = useMemo(() => {
    if (FEATURE_MAC_DOWNLOAD_ENABLED) {
      return allPlatformData;
    }

    return allPlatformData.filter((platform) => platform.platform !== 'macos');
  }, [allPlatformData]);

  const orderedPlatformData = useMemo(
    () => prioritizeCurrentPlatform(platformData, currentOS),
    [currentOS, platformData],
  );
  const currentDevicePlatformLabel = currentOS === 'unknown' ? null : PLATFORM_LABELS[currentOS];


  const canDownload = !isLoading && !error && !!version && platformData.length > 0;

  const primaryTarget = useMemo(() => {
    if (!canDownload) {
      return {
        option: null,
        actions: resolvePrimaryDownloadActionPair(null),
      };
    }

    if (!FEATURE_MAC_DOWNLOAD_ENABLED && currentOS === 'macos') {
      return {
        option: null,
        actions: resolvePrimaryDownloadActionPair(null),
      };
    }

    return resolveDocsInstallPrimaryTarget(orderedPlatformData, currentOS);
  }, [canDownload, currentOS, orderedPlatformData]);

  useEffect(() => {
    if (!isDropdownOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsDropdownOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDropdownOpen]);

  const handleToggleDropdown = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canDownload) {
      return;
    }
    setIsDropdownOpen((open) => !open);
  };

  const handleLinkClick = () => {
    setIsDropdownOpen(false);
  };

  const handleRetry = useCallback(() => {
    clearDesktopVersionCache();
    setRuntimeData(null);
    setVersion(null);
    setPlatforms([]);
    setError(null);
    if (!initialVersion && supportedInitialPlatforms.length === 0 && !versionError) {
      loadRuntimeVersionData();
    }
  }, [initialVersion, loadRuntimeVersionData, supportedInitialPlatforms.length, versionError]);

  const historyFallbackTarget =
    runtimeData?.fallbackTarget ?? (versionError ? DESKTOP_HISTORY_FALLBACK_URL : null);
  const failedAttemptSummary = runtimeData?.failedAttemptSummary ?? error;
  const shouldAutoRedirect =
    variant === 'full' &&
    !isLoading &&
    (runtimeData?.status === 'fatal' || !!versionError) &&
    !!historyFallbackTarget;

  useEffect(() => {
    if (!shouldAutoRedirect || typeof window === 'undefined' || !historyFallbackTarget) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.assign(historyFallbackTarget);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [historyFallbackTarget, shouldAutoRedirect]);

  const statusDescriptor = getInstallButtonStatusDescriptor({
    runtimeState: runtimeData?.status ?? (versionError ? 'fatal' : null),
    error,
    failedAttemptSummary,
    historyFallbackTarget,
    variant,
    locale,
  });
  const primarySourceOrder: PrimaryDownloadSourceKey[] = ['github', 'accelerated'];
  const primarySourceButtons = primarySourceOrder
    .map((source) => ({
      source,
      action: primaryTarget.actions[source],
      label: getPrimaryDownloadSourceLabel(source, locale),
    }))
    .filter((entry) => Boolean(entry.action));
  const preferWindowsStorePrimary = canDownload && currentOS === 'windows';
  const showWindowsStoreShortcut = variant === 'compact' && !preferWindowsStorePrimary;
  const showDisabledPrimaryButtons = primarySourceButtons.length === 0;
  const primaryButtonsDisabled = isLoading || !canDownload || (!FEATURE_MAC_DOWNLOAD_ENABLED && currentOS === 'macos');
  const showDropdownToggle = canDownload && platformData.length > 0;

  return (
    <div
      ref={wrapperRef}
      className={`install-button-wrapper install-button-wrapper--${variant} ${className}`}
    >
      <div
        className={`split-button-container ${variant === 'compact' ? 'split-button-container--segmented' : ''}`}
        data-action-group={variant === 'compact' ? 'segmented' : 'default'}
      >
        {preferWindowsStorePrimary ? (
          <a
            href={WINDOWS_STORE_URL}
            className="btn-download-main"
            aria-label={t.windowsStoreAriaLabel}
            {...gaEventAttributes({
              category: 'store',
              label: 'microsoftStore',
              location: GA_INSTALL_LOCATION,
              url: WINDOWS_STORE_URL,
            })}
          >
            <svg className="download-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="btn-text">{t.windowsStoreInstall}</span>
          </a>
        ) : (
          <div
            className={`install-button-primary-actions ${variant === 'compact' ? 'install-button-primary-actions--grouped' : ''}`}
            data-segment-role="primary-actions"
          >
            {(showDisabledPrimaryButtons
              ? primarySourceOrder
              : primarySourceButtons.map((entry) => entry.source)).map((source) => {
              const configuredEntry = primarySourceButtons.find((entry) => entry.source === source);
              const label = configuredEntry?.label ?? getPrimaryDownloadSourceLabel(source, locale);
              const action = configuredEntry?.action ?? null;
              const buttonClassName = [
                'btn-download-source',
                `btn-download-source--${source}`,
                primaryButtonsDisabled || !action ? 'btn-download-source-disabled' : '',
                isLoading ? 'btn-download-source-loading' : '',
              ]
                .filter(Boolean)
                .join(' ');

              if (primaryButtonsDisabled || !action) {
                return (
                  <button
                    key={source}
                    type="button"
                    className={buttonClassName}
                    disabled
                    aria-disabled="true"
                    aria-label={label}
                  >
                    <svg className="download-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="btn-text">{label}</span>
                  </button>
                );
              }

              return (
                <a
                  key={source}
                  href={action.url}
                  className={buttonClassName}
                  aria-label={`${t.installHagicodeDesktop} (${label})`}
                  {...gaEventAttributes({
                    category: 'download',
                    label: getDesktopDownloadGaLabel(primaryTarget.option?.assetType),
                    location: GA_INSTALL_LOCATION,
                    url: action.url,
                  })}
                >
                  <svg className="download-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="btn-text">{label}</span>
                </a>
              );
            })}
          </div>
        )}

        {showWindowsStoreShortcut && (
          <MicrosoftStoreBadge
            href={WINDOWS_STORE_URL}
            locale={locale}
            aria-label={windowsStoreShortcutAriaLabel}
            className={`ms-store-badge-slot ms-store-badge-slot--${variant}`}
            badgeClassName="ms-store-badge-element"
            badgeAttributes={{
              'data-windows-store-entry': 'docs-header-install',
              ...gaEventAttributes({
                category: 'store',
                label: 'microsoftStore',
                location: GA_INSTALL_LOCATION,
                url: WINDOWS_STORE_URL,
              }),
            }}
          />
        )}

        {showSteamShortcut && (
          <a
            href={steamStoreLink.href}
            className={`btn-download-source btn-download-source--steam btn-download-source--steam-shortcut ${showDropdownToggle ? '' : 'btn-download-source--steam-shortcut-last'}`.trim()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={steamShortcutAriaLabel}
            data-steam-entry="docs-header-install"
            {...gaEventAttributes({
              category: 'store',
              label: 'openSteamStore',
              location: GA_INSTALL_LOCATION,
              url: steamStoreLink.href,
            })}
          >
            <SteamIcon className="download-icon" />
            <span className="btn-text">{steamShortcutLabel}</span>
          </a>
        )}

        {showDropdownToggle && (
          <>
            <button
              className="btn-dropdown-toggle"
              type="button"
              aria-expanded={isDropdownOpen}
              aria-controls={`${buttonId}-menu`}
              aria-haspopup="menu"
              aria-label={t.selectOtherVersion}
              data-segment-role="toggle"
              onClick={handleToggleDropdown}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
              </svg>
            </button>

            {isDropdownOpen && (
              <div
                className="dropdown-menu dropdown-menu-open"
                id={`${buttonId}-menu`}
                role="menu"
                aria-label={t.selectDownloadVersion}
              >
                <div className="dropdown-header" role="presentation">
                  <div className="dropdown-header-copy">
                    <span className="dropdown-eyebrow">{t.desktopPackages}</span>
                    <span className="dropdown-title">{t.choosePackage}</span>
                    <span className="dropdown-description">{t.packageHint}</span>
                  </div>
                  <div className="dropdown-header-meta">
                    {version?.version && (
                      <span className="dropdown-header-badge">{t.currentVersion} {version.version}</span>
                    )}
                    {currentDevicePlatformLabel && (
                      <span className="dropdown-header-badge">{t.currentDevice}: {currentDevicePlatformLabel}</span>
                    )}
                    <span className="dropdown-header-badge">{t.defaultTagged}</span>
                  </div>
                </div>
                <div className="dropdown-body">
                  {orderedPlatformData.map((platformGroup) => (
                    <section
                      key={platformGroup.platform}
                      className={`dropdown-platform-section dropdown-platform-section--${platformGroup.platform} ${platformGroup.platform === currentOS ? 'dropdown-platform-section-current' : ''}`.trim()}
                      role="group"
                      aria-label={platformGroup.platformLabel}
                    >
                      <div className="dropdown-group-label" role="presentation">
                        <div className="dropdown-group-lead">
                          <span className="platform-icon">{PLATFORM_ICONS[platformGroup.platform]}</span>
                          <div className="dropdown-group-text">
                            <span className="platform-name">{platformGroup.platformLabel}</span>
                            <span className="dropdown-group-meta">
                              {locale === 'en'
                                ? `${platformGroup.options.length} package${platformGroup.options.length === 1 ? '' : 's'}`
                                : `${platformGroup.options.length} 个安装包`}
                            </span>
                          </div>
                        </div>
                        <div className="dropdown-group-badges">
                          {platformGroup.platform === currentOS && (
                            <span className="platform-state-badge">{t.currentDevice}</span>
                          )}
                          {version?.version && (
                            <span className="version-tag">{version.version}</span>
                          )}
                        </div>
                      </div>
                      <div className="dropdown-item-stack">
                        {platformGroup.options.map((option, index) => {
                          const archLabel = getArchitectureLabel(option.assetType, locale);
                          const fileExt = getFileExtension(option.assetType);
                          const isRecommended = index === 0;
                          const actionPair = resolvePrimaryDownloadActionPair({
                            sourceActions: option.sourceActions,
                          });
                          const visiblePrimaryActions = primarySourceOrder
                            .map((source) => ({
                              source,
                              action: actionPair[source],
                              label: getPrimaryDownloadSourceLabel(source, locale),
                            }))
                            .filter((entry) => Boolean(entry.action));

                          return (
                            <div
                              key={option.url}
                              className={`dropdown-item dropdown-item-multi-source ${isRecommended ? 'dropdown-item-recommended' : ''}`.trim()}
                            >
                              <div className="dropdown-item-meta">
                                <span className="dropdown-item-label">
                                  {getAssetTypeLabel(option.assetType, locale)}
                                  {archLabel && <span className="arch-label"> ({archLabel})</span>}
                                  {fileExt && <span className="file-ext-badge">{fileExt}</span>}
                                  {isRecommended && <span className="recommended-badge">{t.recommended}</span>}
                                </span>
                                {option.size && (
                                  <span className="dropdown-item-size">{option.size}</span>
                                )}
                              </div>
                              <div className="dropdown-source-actions">
                                {visiblePrimaryActions.map(({ source, action, label }) => (
                                  <a
                                    key={`${option.url}-${source}`}
                                    href={action?.url ?? option.url}
                                    className="dropdown-source-action"
                                    role="menuitem"
                                    download
                                    onClick={handleLinkClick}
                                    {...gaEventAttributes({
                                      category: 'download',
                                      label: getDesktopDownloadGaLabel(option.assetType),
                                      location: GA_INSTALL_LOCATION,
                                      url: action?.url ?? option.url,
                                    })}
                                  >
                                    <span>{label}</span>
                                  </a>
                                ))}
                                {actionPair.secondary.map((action) => (
                                  <a
                                    key={`${option.url}-${action.kind}`}
                                    href={action.url}
                                    className="dropdown-source-action dropdown-source-action-secondary"
                                    role="menuitem"
                                    download
                                    onClick={handleLinkClick}
                                    {...gaEventAttributes({
                                      category: 'download',
                                      label: getDesktopDownloadGaLabel(option.assetType),
                                      location: GA_INSTALL_LOCATION,
                                      url: action.url,
                                    })}
                                  >
                                    <span>{getDownloadActionLabel(action.kind, locale)}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {statusDescriptor && (
        <div
          className={`install-button-status install-button-status--${statusDescriptor.tone}`}
          role={statusDescriptor.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{statusDescriptor.message}</span>
          {statusDescriptor.detail && (
            <span className="install-button-status-detail">{statusDescriptor.detail}</span>
          )}
          {historyFallbackTarget && statusDescriptor.tone === 'error' && (
            <span className="install-button-actions">
              <a
                href={historyFallbackTarget}
                className="install-button-action-link"
              >
                {t.openVersionHistory}
              </a>
              <button
                type="button"
                className="install-button-action-button"
                onClick={handleRetry}
              >
                {t.retry}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
