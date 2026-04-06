/**
 * InstallButton 组件 - 文档站点版本 (React)
 * 支持自动平台检测、下拉菜单选择版本、Docker 版本跳转。
 * 运行时仅消费 canonical index，并展示加载/可用/失败状态。
 */
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import type {
  AssetType,
  DesktopVersion,
  DownloadAction,
  GithubReachabilityState,
  PlatformGroup,
} from '@shared/desktop';
import {
  ensureGithubReachabilityProbe,
  detectOS,
  findFirstGithubReleaseUrl,
  getCachedGithubReachabilityState,
  getDownloadActionLabel,
  getArchitectureLabel,
  getAssetTypeLabel,
  getFileExtension,
  groupAssetsByPlatform,
  PLATFORM_ICONS,
  resolvePrimaryDownloadAction,
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
import { getLink } from '@shared/links';
import { FEATURE_MAC_DOWNLOAD_ENABLED } from '@/config/features';

const MAC_DOWNLOAD_DISABLED_NOTICE = '建议安装 Docker 版本';
const MAC_DOWNLOAD_DISABLED_NOTICE_EN = 'Recommended: Install Docker version';

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
  href: string | null;
  option: DownloadOption | null;
  action: DownloadAction | null;
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
  const platformLabels = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

  return platforms.map((platform) => ({
    platform: platform.platform,
    platformLabel: platformLabels[platform.platform],
    options: platform.downloads.map((download) => ({
      label: download.filename,
      url: download.url,
      size: download.size,
      assetType: download.assetType,
      sourceActions: download.sourceActions,
    })),
  }));
}

export function resolveDocsInstallPrimaryTarget(
  platformData: PlatformDownloads[],
  githubState: GithubReachabilityState,
  userOS: 'windows' | 'macos' | 'linux' | 'unknown',
): InstallButtonPrimaryTarget {
  if (platformData.length === 0) {
    return {
      href: null,
      option: null,
      action: null,
    };
  }

  const userPlatform = platformData.find((platform) => platform.platform === userOS);
  const preferredPlatform = userPlatform ?? platformData[0];
  const preferredOption = preferredPlatform.options[0] ?? null;
  const action = preferredOption
    ? resolvePrimaryDownloadAction({ sourceActions: preferredOption.sourceActions }, githubState)
    : null;

  return {
    href: action?.url ?? preferredOption?.url ?? null,
    option: preferredOption,
    action,
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [version, setVersion] = useState<DesktopVersion | null>(initialVersion);
  const [platforms, setPlatforms] = useState<PlatformGroup[]>(initialPlatforms);
  const [error, setError] = useState<string | null>(versionError);
  const [runtimeData, setRuntimeData] = useState<DesktopVersionData | null>(null);
  const [githubReachabilityState, setGithubReachabilityState] = useState<GithubReachabilityState>(
    () => getCachedGithubReachabilityState(),
  );
  const [isLoading, setIsLoading] = useState(
    !initialVersion && initialPlatforms.length === 0 && !versionError,
  );

  const t = useMemo(() => {
    return locale === 'en'
      ? {
          installNow: 'Install Now',
          installHagicodeDesktop: 'Install Hagicode Desktop Now',
          selectOtherVersion: 'Select Other Version',
          selectDownloadVersion: 'Select Download Version',
          recommended: 'Recommended',
          containerDeployment: 'Container Deployment',
          macInDevelopmentNotice: MAC_DOWNLOAD_DISABLED_NOTICE_EN,
          macContainerCta: 'Go to Container page',
          unavailable: 'Unavailable',
          retry: 'Retry',
          openVersionHistory: 'Open version history',
        }
      : {
          installNow: '立即安装',
          installHagicodeDesktop: '立即安装 Hagicode Desktop',
          selectOtherVersion: '选择其他版本',
          selectDownloadVersion: '选择下载版本',
          recommended: '⭐推荐',
          containerDeployment: '容器部署',
          macInDevelopmentNotice: MAC_DOWNLOAD_DISABLED_NOTICE,
          macContainerCta: '前往 Container 页面',
          unavailable: '暂不可用',
          retry: '重试',
          openVersionHistory: '打开版本历史页',
        };
  }, [locale]);

  const containerLink = useMemo(() => (
    locale === 'en' ? 'https://hagicode.com/en/container/' : getLink('container')
  ), [locale]);

  const loadRuntimeVersionData = useCallback(() => {
    let mounted = true;

    setIsLoading(true);

    getDesktopVersionData()
      .then((data) => {
        if (!mounted) {
          return;
        }

        const latest = selectLatestForChannel(data, channel);
        const nextPlatforms = latest ? groupAssetsByPlatform(latest.assets) : [];

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

  useEffect(() => {
    if (initialVersion || initialPlatforms.length > 0 || versionError) {
      return;
    }

    return loadRuntimeVersionData();
  }, [initialPlatforms.length, initialVersion, loadRuntimeVersionData, versionError]);

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

  const macPlatform = useMemo(
    () => allPlatformData.find((platform) => platform.platform === 'macos') || null,
    [allPlatformData],
  );
  const showMacDisabledFirst = !FEATURE_MAC_DOWNLOAD_ENABLED && !!macPlatform && currentOS === 'macos';

  const canDownload = !isLoading && !error && !!version && platformData.length > 0;

  useEffect(() => {
    const probeUrl = findFirstGithubReleaseUrl(platforms);
    const cachedState = getCachedGithubReachabilityState();
    setGithubReachabilityState(cachedState);

    if (!probeUrl || (cachedState !== 'unknown' && cachedState !== 'probing')) {
      return;
    }

    let mounted = true;
    void ensureGithubReachabilityProbe(probeUrl).then((state) => {
      if (mounted) {
        setGithubReachabilityState(state);
      }
    });

    return () => {
      mounted = false;
    };
  }, [platforms]);

  const primaryTarget = useMemo(() => {
    if (!canDownload) {
      return {
        href: null,
        option: null,
        action: null,
      };
    }

    if (!FEATURE_MAC_DOWNLOAD_ENABLED && currentOS === 'macos') {
      return {
        href: null,
        option: null,
        action: null,
      };
    }

    return resolveDocsInstallPrimaryTarget(orderedPlatformData, githubReachabilityState, currentOS);
  }, [canDownload, currentOS, githubReachabilityState, orderedPlatformData]);

  useEffect(() => {
    const handleClickOutside = () => {
      setIsDropdownOpen(false);
    };

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }

    return undefined;
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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
    if (!initialVersion && initialPlatforms.length === 0 && !versionError) {
      loadRuntimeVersionData();
    }
  }, [initialPlatforms.length, initialVersion, loadRuntimeVersionData, versionError]);

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

  const macDisabledSection = !FEATURE_MAC_DOWNLOAD_ENABLED && macPlatform ? (
    <>
      <div
        className={`dropdown-group-label platform--${macPlatform.platform}`}
        role="presentation"
      >
        <span className="platform-icon">{PLATFORM_ICONS[macPlatform.platform]}</span>
        <span className="platform-name">{macPlatform.platformLabel}</span>
        {version?.version && (
          <span className="version-tag">{version.version}</span>
        )}
      </div>
      <li role="none">
        <span
          className="dropdown-item dropdown-item-disabled"
          role="presentation"
          aria-disabled="true"
        >
          <span className="dropdown-item-label">macOS</span>
          <span className="dropdown-item-disabled-notice">{t.macInDevelopmentNotice}</span>
        </span>
      </li>
      <li role="none">
        <a
          href={containerLink}
          className="dropdown-item"
          role="menuitem"
          onClick={handleLinkClick}
        >
          <span className="dropdown-item-label">{t.macContainerCta}</span>
        </a>
      </li>
    </>
  ) : null;

  return (
    <div className={`install-button-wrapper install-button-wrapper--${variant} ${className}`}>
      <div className="split-button-container">
        {canDownload && primaryTarget.href ? (
          <a
            href={primaryTarget.href}
            className="btn-download-main"
            aria-label={`${t.installHagicodeDesktop}${primaryTarget.action ? ` (${getDownloadActionLabel(primaryTarget.action.kind, locale)})` : ''}`}
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
            <span className="btn-text">{t.installNow}</span>
          </a>
        ) : (
          <button
            type="button"
            className={`btn-download-main btn-download-main-disabled ${isLoading ? 'btn-download-main-loading' : ''}`}
            disabled
            aria-disabled="true"
            aria-label={t.unavailable}
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
            <span className="btn-text">{isLoading ? t.installNow : t.unavailable}</span>
          </button>
        )}

        {canDownload && platformData.length > 0 && (
          <>
            <button
              className="btn-dropdown-toggle"
              type="button"
              aria-expanded={isDropdownOpen}
              aria-controls={`${buttonId}-menu`}
              aria-haspopup="menu"
              aria-label={t.selectOtherVersion}
              onClick={handleToggleDropdown}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
              </svg>
            </button>

            <ul
              className={`dropdown-menu ${isDropdownOpen ? 'dropdown-menu-open' : ''}`}
              id={`${buttonId}-menu`}
              role="menu"
              aria-label={t.selectDownloadVersion}
            >
              {showMacDisabledFirst && macDisabledSection}
              {orderedPlatformData.map((platformGroup) => (
                <React.Fragment key={platformGroup.platform}>
                  <div
                    className={`dropdown-group-label platform--${platformGroup.platform}`}
                    role="presentation"
                  >
                    <span className="platform-icon">{PLATFORM_ICONS[platformGroup.platform]}</span>
                    <span className="platform-name">{platformGroup.platformLabel}</span>
                    {version?.version && (
                      <span className="version-tag">{version.version}</span>
                    )}
                  </div>
                  {platformGroup.options.map((option, index) => {
                    const archLabel = getArchitectureLabel(option.assetType, locale);
                    const fileExt = getFileExtension(option.assetType);
                    const isRecommended = index === 0;
                    const resolvedAction = resolvePrimaryDownloadAction(
                      { sourceActions: option.sourceActions },
                      githubReachabilityState,
                    );
                    return (
                      <li key={option.url} role="none">
                        <div className={`dropdown-item dropdown-item-multi-source ${isRecommended ? 'dropdown-item-recommended' : ''}`}>
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
                            {option.sourceActions.map((action) => {
                              const isSmartDefault = resolvedAction?.kind === action.kind;
                              return (
                                <a
                                  key={`${option.url}-${action.kind}`}
                                  href={action.url}
                                  className={`dropdown-source-action ${isSmartDefault ? 'dropdown-source-action-default' : ''}`}
                                  role="menuitem"
                                  download
                                  onClick={handleLinkClick}
                                >
                                  <span>{getDownloadActionLabel(action.kind, locale)}</span>
                                  {isSmartDefault && (
                                    <span className="dropdown-source-action-badge">
                                      {locale === 'en' ? 'Default' : '默认'}
                                    </span>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
              {!showMacDisabledFirst && macDisabledSection}
              <li role="separator" className="dropdown-separator" />
              <li role="none">
                <a
                  href={containerLink}
                  className="dropdown-item dropdown-item-docker"
                  role="menuitem"
                  onClick={handleLinkClick}
                >
                  <svg className="docker-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
                  </svg>
                  <span className="dropdown-item-label">{t.containerDeployment}</span>
                  <svg className="external-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </li>
            </ul>
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
