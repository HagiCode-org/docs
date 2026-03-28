/**
 * InstallButton 组件 - 文档站点版本 (React)
 * 支持自动平台检测、下拉菜单选择版本、Docker 版本跳转。
 * 运行时仅消费 canonical index，并展示加载/可用/失败状态。
 */
import React, { useEffect, useId, useMemo, useState } from 'react';

import type { AssetType, DesktopVersion, PlatformGroup } from '@shared/desktop';
import {
  detectOS,
  getArchitectureLabel,
  getAssetTypeLabel,
  getFileExtension,
  groupAssetsByPlatform,
  PLATFORM_ICONS,
} from '@shared/desktop-utils';
import {
  getDesktopVersionData,
} from '@shared/version-manager';
import type {
  DesktopVersionData,
  DesktopVersionState,
} from '@shared/version-manager';
import { getLink } from '@shared/links';

const MAC_DOWNLOAD_DISABLED_NOTICE = '建议安装 Docker 版本';
const MAC_DOWNLOAD_DISABLED_NOTICE_EN = 'Recommended: Install Docker version';

function parseBooleanFlag(value: string | boolean | undefined, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return defaultValue;
}

const FEATURE_MAC_DOWNLOAD_ENABLED = parseBooleanFlag(
  import.meta.env.VITE_FEATURE_MAC_DOWNLOAD_ENABLED,
  true,
);

interface DownloadOption {
  label: string;
  url: string;
  size?: string;
  assetType: AssetType;
}

interface PlatformDownloads {
  platform: 'windows' | 'macos' | 'linux';
  platformLabel: string;
  options: DownloadOption[];
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
  isLoading: boolean;
  runtimeState: DesktopVersionState | null;
  error: string | null;
  locale: 'zh' | 'en';
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
    })),
  }));
}

export function getInstallButtonStatusDescriptor({
  isLoading,
  runtimeState,
  error,
  locale,
}: InstallButtonStatusInput): InstallButtonStatusDescriptor | null {
  if (runtimeState === 'fatal' || error) {
    return {
      tone: 'error',
      message:
        locale === 'en'
          ? 'Unable to load a valid desktop version right now.'
          : '暂时无法获取可用的桌面端版本。',
      detail: error,
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
        };
  }, [locale]);

  const containerLink = useMemo(() => (
    locale === 'en' ? 'https://hagicode.com/en/container/' : getLink('container')
  ), [locale]);

  useEffect(() => {
    if (initialVersion || initialPlatforms.length > 0 || versionError) {
      return;
    }

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
  }, [channel, initialPlatforms.length, initialVersion, versionError]);

  const buttonId = useId();

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

  const macPlatform = useMemo(
    () => allPlatformData.find((platform) => platform.platform === 'macos') || null,
    [allPlatformData],
  );

  const canDownload = !isLoading && !error && !!version && platformData.length > 0;

  const currentUrl = useMemo(() => {
    if (!canDownload) {
      return null;
    }

    const userOS = detectOS();

    if (!FEATURE_MAC_DOWNLOAD_ENABLED && userOS === 'macos') {
      return null;
    }

    const userPlatform = platformData.find((platform) => platform.platform === userOS);

    if (userPlatform) {
      const recommended = userPlatform.options.find((option) => {
        const label = option.label.toLowerCase();
        if (userOS === 'windows') return label.includes('setup');
        if (userOS === 'macos') return label.includes('arm64');
        if (userOS === 'linux') return label.includes('appimage');
        return false;
      });

      return recommended ? recommended.url : userPlatform.options[0].url;
    }

    return platformData[0]?.options[0]?.url ?? null;
  }, [canDownload, platformData]);

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

  const statusDescriptor = getInstallButtonStatusDescriptor({
    isLoading,
    runtimeState: runtimeData?.status ?? (versionError ? 'fatal' : null),
    error,
    locale,
  });

  return (
    <div className={`install-button-wrapper install-button-wrapper--${variant} ${className}`}>
      <div className="split-button-container">
        {canDownload && currentUrl ? (
          <a
            href={currentUrl}
            className="btn-download-main"
            aria-label={t.installHagicodeDesktop}
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
              aria-haspopup="listbox"
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
              role="listbox"
              aria-label={t.selectDownloadVersion}
            >
              {platformData.map((platformGroup) => (
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
                    return (
                      <li key={option.url} role="none">
                        <a
                          href={option.url}
                          className={`dropdown-item ${isRecommended ? 'dropdown-item-recommended' : ''}`}
                          role="option"
                          download
                          onClick={handleLinkClick}
                        >
                          <span className="dropdown-item-label">
                            {getAssetTypeLabel(option.assetType, locale)}
                            {archLabel && <span className="arch-label"> ({archLabel})</span>}
                            {fileExt && <span className="file-ext-badge">{fileExt}</span>}
                            {isRecommended && <span className="recommended-badge">{t.recommended}</span>}
                          </span>
                          {option.size && (
                            <span className="dropdown-item-size">{option.size}</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
              {!FEATURE_MAC_DOWNLOAD_ENABLED && macPlatform && (
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
                      role="option"
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
                      role="option"
                      onClick={handleLinkClick}
                    >
                      <span className="dropdown-item-label">{t.macContainerCta}</span>
                    </a>
                  </li>
                </>
              )}
              <li role="separator" className="dropdown-separator" />
              <li role="none">
                <a
                  href={containerLink}
                  className="dropdown-item dropdown-item-docker"
                  role="option"
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
        <p
          className={`install-button-status install-button-status--${statusDescriptor.tone}`}
          role={statusDescriptor.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{statusDescriptor.message}</span>
          {statusDescriptor.detail && (
            <span className="install-button-status-detail">{statusDescriptor.detail}</span>
          )}
        </p>
      )}
    </div>
  );
}
