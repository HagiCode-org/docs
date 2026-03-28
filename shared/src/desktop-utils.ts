/**
 * Hagicode Desktop 工具函数
 * 用于获取和处理版本数据。
 *
 * 文档站运行时仅请求 index 站的 canonical desktop 索引。
 */

import semver from 'semver';

import type {
  DesktopAsset,
  DesktopIndexResponse,
  PlatformDownload,
  PlatformGroup,
  DesktopVersion,
} from './types/desktop';
import { AssetType } from './types/desktop';

export const PRIMARY_INDEX_JSON_URL = 'https://index.hagicode.com/desktop/index.json';
const DOWNLOAD_BASE_URL = 'https://desktop.dl.hagicode.com/';
const TIMEOUT_MS = 30000;

export type DesktopVersionSource = 'primary' | 'server';

export interface DesktopVersionFetchAttempt {
  source: DesktopVersionSource;
  error: string;
}

export interface DesktopVersionFetchResult {
  data: DesktopIndexResponse;
  source: DesktopVersionSource;
  attempts: DesktopVersionFetchAttempt[];
}

export class DesktopVersionFetchError extends Error {
  attempts: DesktopVersionFetchAttempt[];

  constructor(message: string, attempts: DesktopVersionFetchAttempt[]) {
    super(message);
    this.name = 'DesktopVersionFetchError';
    this.attempts = attempts;
  }
}

const SOURCE_CONFIGS: Array<{ source: DesktopVersionSource; url: string }> = [
  { source: 'primary', url: PRIMARY_INDEX_JSON_URL },
];

/**
 * 平台推荐配置
 */
export const PLATFORM_RECOMMENDATIONS: Record<
  'windows' | 'macos' | 'linux',
  { recommendedType: AssetType; label: string; icon: string }
> = {
  windows: {
    recommendedType: AssetType.WindowsSetup,
    label: 'Windows',
    icon: 'seti:windows',
  },
  macos: {
    recommendedType: AssetType.MacOSApple,
    label: 'macOS',
    icon: 'seti:apple',
  },
  linux: {
    recommendedType: AssetType.LinuxAppImage,
    label: 'Linux',
    icon: 'seti:linux',
  },
};

function compareVersions(v1: string, v2: string): number {
  const cleaned1 = v1.replace(/^v/, '');
  const cleaned2 = v2.replace(/^v/, '');

  const cmp = semver.compare(cleaned1, cleaned2);
  if (cmp < 0) return -1;
  if (cmp > 0) return 1;
  return 0;
}

function normalizeFetchError(error: unknown, source: DesktopVersionSource): Error {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error(`Request timeout while fetching ${source} desktop index`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`Unknown error while fetching ${source} desktop index`);
}

function assertBrowserEnvironment(): void {
  const isBrowser = typeof window !== 'undefined' && typeof fetch !== 'undefined';
  if (!isBrowser) {
    throw new Error('fetchDesktopVersions cannot be called in SSR environment');
  }
}

function isValidChannelInfo(channel: unknown): boolean {
  if (!channel || typeof channel !== 'object') {
    return false;
  }

  const maybeChannel = channel as { latest?: unknown; versions?: unknown };
  return typeof maybeChannel.latest === 'string' && Array.isArray(maybeChannel.versions);
}

function normalizeDesktopIndexPayload(payload: unknown): DesktopIndexResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid desktop index payload: expected object');
  }

  const data = payload as DesktopIndexResponse;
  if (!Array.isArray(data.versions)) {
    throw new Error('Invalid desktop index payload: missing versions array');
  }

  for (const version of data.versions) {
    if (!version || typeof version.version !== 'string' || !Array.isArray(version.assets)) {
      throw new Error('Invalid desktop index payload: malformed version entry');
    }

    if (version.files && !Array.isArray(version.files)) {
      throw new Error('Invalid desktop index payload: malformed file path list');
    }

    for (const asset of version.assets) {
      if (
        !asset ||
        typeof asset.name !== 'string' ||
        typeof asset.path !== 'string' ||
        typeof asset.size !== 'number'
      ) {
        throw new Error('Invalid desktop index payload: malformed asset entry');
      }
    }
  }

  if (data.channels) {
    if (!isValidChannelInfo(data.channels.stable) || !isValidChannelInfo(data.channels.beta)) {
      throw new Error('Invalid desktop index payload: malformed channel data');
    }
  }

  return {
    ...data,
    versions: [...data.versions]
      .map((version) => ({
        ...version,
        assets: [...version.assets],
        files: Array.isArray(version.files) ? [...version.files] : undefined,
      }))
      .sort((a, b) => compareVersions(b.version, a.version)),
    channels: data.channels
      ? {
          stable: {
            latest: data.channels.stable.latest,
            versions: [...data.channels.stable.versions],
          },
          beta: {
            latest: data.channels.beta.latest,
            versions: [...data.channels.beta.versions],
          },
        }
      : undefined,
  };
}

async function fetchDesktopIndexPayload(
  source: DesktopVersionSource,
  url: string,
): Promise<DesktopIndexResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = await response.json();
    return normalizeDesktopIndexPayload(payload);
  } catch (error) {
    throw normalizeFetchError(error, source);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDesktopVersionResult(): Promise<DesktopVersionFetchResult> {
  assertBrowserEnvironment();

  const attempts: DesktopVersionFetchAttempt[] = [];

  for (const candidate of SOURCE_CONFIGS) {
    try {
      const data = await fetchDesktopIndexPayload(candidate.source, candidate.url);
      return {
        data,
        source: candidate.source,
        attempts,
      };
    } catch (error) {
      const normalizedError = normalizeFetchError(error, candidate.source);
      attempts.push({
        source: candidate.source,
        error: normalizedError.message,
      });
    }
  }

  const message = attempts.length > 0
    ? `Failed to load desktop versions: ${attempts.map((attempt) => `${attempt.source}=${attempt.error}`).join('; ')}`
    : 'Failed to load desktop versions';

  throw new DesktopVersionFetchError(message, attempts);
}

/**
 * 获取版本数据。
 * 返回的版本数组已按版本号从高到低排序。
 */
export async function fetchDesktopVersions(): Promise<DesktopIndexResponse> {
  const result = await fetchDesktopVersionResult();
  return result.data;
}

/**
 * 从文件名推断资源类型
 * @param filename - 文件名
 * @returns 资源类型枚举值
 */
export function inferAssetType(filename: string): AssetType {
  const name = filename.toLowerCase();

  if (name.includes('setup') && name.endsWith('.exe')) {
    return AssetType.WindowsSetup;
  }
  if (name.endsWith('.exe')) {
    return AssetType.WindowsPortable;
  }
  if (name.endsWith('.appx')) {
    return AssetType.WindowsStore;
  }

  if (name.includes('arm64') && name.endsWith('.dmg')) {
    return AssetType.MacOSApple;
  }
  if (name.includes('arm64-mac.zip')) {
    return AssetType.MacOSApple;
  }
  if (name.endsWith('.dmg')) {
    return AssetType.MacOSIntel;
  }
  if (name.includes('-mac.zip')) {
    return AssetType.MacOSIntel;
  }

  if (name.endsWith('.appimage')) {
    return AssetType.LinuxAppImage;
  }
  if (name.includes('_amd64.deb')) {
    return AssetType.LinuxDeb;
  }
  if (name.includes('.tar.gz')) {
    return AssetType.LinuxTarball;
  }

  return AssetType.Unknown;
}

export function formatFileSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export const PLATFORM_ICONS: Record<string, string> = {
  macos: '🍎',
  windows: '🪟',
  linux: '🐧',
};

export function getArchitectureLabel(assetType: AssetType, locale: 'zh' | 'en' = 'zh'): string {
  const archLabelsZh: Record<AssetType, string> = {
    [AssetType.MacOSApple]: 'ARM64',
    [AssetType.MacOSIntel]: 'x64',
    [AssetType.WindowsSetup]: 'x64',
    [AssetType.WindowsPortable]: 'x64',
    [AssetType.WindowsStore]: '',
    [AssetType.LinuxAppImage]: '通用',
    [AssetType.LinuxDeb]: 'amd64',
    [AssetType.LinuxTarball]: '通用',
    [AssetType.Source]: '',
    [AssetType.Unknown]: '',
  };

  const archLabelsEn: Record<AssetType, string> = {
    [AssetType.MacOSApple]: 'ARM64',
    [AssetType.MacOSIntel]: 'x64',
    [AssetType.WindowsSetup]: 'x64',
    [AssetType.WindowsPortable]: 'x64',
    [AssetType.WindowsStore]: '',
    [AssetType.LinuxAppImage]: 'Universal',
    [AssetType.LinuxDeb]: 'amd64',
    [AssetType.LinuxTarball]: 'Universal',
    [AssetType.Source]: '',
    [AssetType.Unknown]: '',
  };

  const archLabels = locale === 'en' ? archLabelsEn : archLabelsZh;
  return archLabels[assetType] || '';
}

export function getFileExtension(assetType: AssetType): string {
  const extensions: Record<AssetType, string> = {
    [AssetType.WindowsSetup]: '.exe',
    [AssetType.WindowsPortable]: '.exe',
    [AssetType.WindowsStore]: '.appx',
    [AssetType.MacOSApple]: '.dmg',
    [AssetType.MacOSIntel]: '.dmg',
    [AssetType.LinuxAppImage]: '.AppImage',
    [AssetType.LinuxDeb]: '.deb',
    [AssetType.LinuxTarball]: '.tar.gz',
    [AssetType.Source]: '.zip',
    [AssetType.Unknown]: '',
  };
  return extensions[assetType] || '';
}

export function getAssetTypeLabel(assetType: AssetType, locale: 'zh' | 'en' = 'zh'): string {
  const labelsZh: Record<AssetType, string> = {
    [AssetType.WindowsSetup]: '安装程序',
    [AssetType.WindowsPortable]: '便携版',
    [AssetType.WindowsStore]: 'Microsoft Store',
    [AssetType.MacOSApple]: 'Apple Silicon',
    [AssetType.MacOSIntel]: 'Intel 版',
    [AssetType.LinuxAppImage]: 'AppImage',
    [AssetType.LinuxDeb]: 'Debian 包',
    [AssetType.LinuxTarball]: '压缩包',
    [AssetType.Source]: '源代码',
    [AssetType.Unknown]: '其他',
  };

  const labelsEn: Record<AssetType, string> = {
    [AssetType.WindowsSetup]: 'Installer',
    [AssetType.WindowsPortable]: 'Portable',
    [AssetType.WindowsStore]: 'Microsoft Store',
    [AssetType.MacOSApple]: 'Apple Silicon',
    [AssetType.MacOSIntel]: 'Intel',
    [AssetType.LinuxAppImage]: 'AppImage',
    [AssetType.LinuxDeb]: 'Debian Package',
    [AssetType.LinuxTarball]: 'Tarball',
    [AssetType.Source]: 'Source Code',
    [AssetType.Unknown]: 'Other',
  };

  const labels = locale === 'en' ? labelsEn : labelsZh;
  return labels[assetType] || (locale === 'en' ? 'Unknown' : '未知');
}

export async function getChannelLatestVersion(
  channel: 'stable' | 'beta',
): Promise<DesktopVersion> {
  const data = await fetchDesktopVersions();

  if (!data.channels || !data.channels[channel]) {
    throw new Error(`Channel '${channel}' not available in version data`);
  }

  const channelInfo = data.channels[channel];
  const latestVersionObj = data.versions.find((v) => v.version === channelInfo.latest);

  if (!latestVersionObj) {
    throw new Error(`Version '${channelInfo.latest}' not found in versions array for channel '${channel}'`);
  }

  return latestVersionObj;
}

export async function getAllChannelVersions(
  channel: 'stable' | 'beta',
): Promise<DesktopVersion[]> {
  const data = await fetchDesktopVersions();

  if (!data.channels || !data.channels[channel]) {
    throw new Error(`Channel '${channel}' not available in version data`);
  }

  const channelInfo = data.channels[channel];
  const versionObjects = data.versions.filter((v) => channelInfo.versions.includes(v.version));
  versionObjects.sort((a, b) => compareVersions(b.version, a.version));

  return versionObjects;
}

export function groupAssetsByPlatform(
  assets: DesktopAsset[] | undefined,
): PlatformGroup[] {
  if (!assets || !Array.isArray(assets)) {
    return [];
  }

  const platformGroups = new Map<string, PlatformDownload[]>();

  for (const asset of assets) {
    const assetType = inferAssetType(asset.name);
    if (assetType === AssetType.Unknown) {
      continue;
    }

    let platform: 'windows' | 'macos' | 'linux' | null = null;
    switch (assetType) {
      case AssetType.WindowsSetup:
      case AssetType.WindowsPortable:
      case AssetType.WindowsStore:
        platform = 'windows';
        break;
      case AssetType.MacOSApple:
      case AssetType.MacOSIntel:
        platform = 'macos';
        break;
      case AssetType.LinuxAppImage:
      case AssetType.LinuxDeb:
      case AssetType.LinuxTarball:
        platform = 'linux';
        break;
      default:
        continue;
    }

    if (!platformGroups.has(platform)) {
      platformGroups.set(platform, []);
    }

    platformGroups.get(platform)?.push({
      url: asset.directUrl || `${DOWNLOAD_BASE_URL}${asset.path}`,
      size: formatFileSize(asset.size),
      filename: asset.name,
      assetType,
    });
  }

  const result: PlatformGroup[] = [];
  for (const [platform, downloads] of platformGroups.entries()) {
    const recommendation = PLATFORM_RECOMMENDATIONS[platform as 'windows' | 'macos' | 'linux'];

    downloads.sort((a, b) => {
      if (a.assetType === recommendation.recommendedType) return -1;
      if (b.assetType === recommendation.recommendedType) return 1;
      return 0;
    });

    result.push({
      platform: platform as 'windows' | 'macos' | 'linux',
      downloads,
    });
  }

  return result;
}

export function getRecommendedDownload(
  platform: 'windows' | 'macos' | 'linux',
  downloads: PlatformDownload[],
): PlatformDownload | null {
  const recommendation = PLATFORM_RECOMMENDATIONS[platform];
  const recommended = downloads.find((download) => download.assetType === recommendation.recommendedType);
  return recommended || downloads[0] || null;
}

export function detectOS(): 'windows' | 'macos' | 'linux' | 'unknown' {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const osParam = urlParams.get('os');
    if (osParam) {
      const validOS = ['windows', 'macos', 'linux'];
      const normalizedParam = osParam.toLowerCase();
      if (validOS.includes(normalizedParam)) {
        return normalizedParam as 'windows' | 'macos' | 'linux';
      }
    }

    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) {
      return 'windows';
    }
    if (
      userAgent.includes('Mac') ||
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad') ||
      userAgent.includes('Mac OS')
    ) {
      return 'macos';
    }
    if (userAgent.includes('Linux')) {
      return 'linux';
    }
  }

  return 'unknown';
}
