/**
 * Hagicode Desktop 工具函数
 * 用于获取和处理版本数据。
 *
 * 文档站运行时仅请求 index 站的 canonical desktop 索引。
 */

import semver from 'semver';

import type {
  DownloadAction,
  DesktopAsset,
  DesktopIndexResponse,
  DesktopPlatform,
  DesktopStructuredSourceKind,
  DownloadSourceKind,
  GithubReachabilityState,
  PlatformDownload,
  PlatformGroup,
  DesktopVersion,
} from './types/desktop';
import { AssetType, CpuArchitecture } from './types/desktop';

export const PRIMARY_INDEX_JSON_URL = 'https://index.hagicode.com/desktop/index.json';
export const BACKUP_INDEX_JSON_URL = 'https://docs.hagicode.com/version-index.json';
export const LOCAL_VERSION_INDEX = '/version-index.json';
const DOWNLOAD_BASE_URL = 'https://desktop.dl.hagicode.com/';
const TIMEOUT_MS = 30000;
const GITHUB_PROBE_TIMEOUT_MS = 1800;
const SOURCE_ACTION_ORDER: Record<DownloadSourceKind, number> = {
  official: 0,
  legacy: 1,
  'github-release': 2,
  torrent: 3,
};

let githubProbeState: GithubReachabilityState = 'unknown';
let githubProbePromise: Promise<GithubReachabilityState> | null = null;
let githubProbeTarget: string | null = null;

export type DesktopVersionSource = 'primary' | 'backup' | 'local' | 'server';

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

const SOURCE_CONFIGS: Array<{ source: Exclude<DesktopVersionSource, 'server'>; url: string }> = [
  { source: 'primary', url: PRIMARY_INDEX_JSON_URL },
  { source: 'backup', url: BACKUP_INDEX_JSON_URL },
  { source: 'local', url: LOCAL_VERSION_INDEX },
];

/**
 * 平台推荐配置
 */
export const PLATFORM_RECOMMENDATIONS: Record<
  DesktopPlatform,
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

function isKnownStructuredSourceKind(kind: string): kind is DesktopStructuredSourceKind {
  return kind === 'official' || kind === 'github-release';
}

function normalizeKnownSourceKind(kind: string | undefined): DesktopStructuredSourceKind | null {
  const normalizedKind = typeof kind === 'string' ? kind.trim().toLowerCase() : '';
  return isKnownStructuredSourceKind(normalizedKind) ? normalizedKind : null;
}

function resolveAbsoluteUrl(urlValue: string): string | null {
  const trimmed = urlValue.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
      try {
        return new URL(trimmed, PRIMARY_INDEX_JSON_URL).toString();
      } catch {
        return null;
      }
    }

    return new URL(trimmed.replace(/^\/+/, ''), DOWNLOAD_BASE_URL).toString();
  }
}

function resolveLegacyAssetUrl(asset: DesktopAsset): string | null {
  if (typeof asset.directUrl === 'string') {
    return resolveAbsoluteUrl(asset.directUrl);
  }

  if (typeof asset.path === 'string' && asset.path.trim().length > 0) {
    return resolveAbsoluteUrl(asset.path);
  }

  return null;
}

function createDownloadAction(
  kind: DownloadSourceKind,
  url: string,
  options?: Partial<Pick<DownloadAction, 'label' | 'isPrimary' | 'isStructured' | 'isLegacyFallback'>>,
): DownloadAction {
  return {
    kind,
    url,
    label: options?.label?.trim() || kind,
    isPrimary: options?.isPrimary === true,
    isStructured: options?.isStructured === true,
    isLegacyFallback: options?.isLegacyFallback === true,
  };
}

export function getDownloadActionLabel(
  kind: DownloadSourceKind,
  locale: 'zh' | 'en' = 'zh',
): string {
  const zhLabels: Record<DownloadSourceKind, string> = {
    official: '官方下载',
    legacy: '官方下载',
    'github-release': 'GitHub Release',
    torrent: '种子下载',
  };
  const enLabels: Record<DownloadSourceKind, string> = {
    official: 'Official Download',
    legacy: 'Official Download',
    'github-release': 'GitHub Release',
    torrent: 'Torrent',
  };

  return (locale === 'en' ? enLabels : zhLabels)[kind];
}

export function normalizeDownloadActions(asset: DesktopAsset): DownloadAction[] {
  const actions: DownloadAction[] = [];
  const seen = new Set<string>();

  const addAction = (action: DownloadAction | null) => {
    if (!action) {
      return;
    }

    const key = `${action.kind}:${action.url.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    actions.push(action);
  };

  const structuredSources = Array.isArray(asset.downloadSources)
    ? asset.downloadSources
        .map((source) => {
          const kind = normalizeKnownSourceKind(source?.kind);
          const url = typeof source?.url === 'string' ? resolveAbsoluteUrl(source.url) : null;
          if (!kind || !url) {
            return null;
          }

          return createDownloadAction(kind, url, {
            label: source?.label,
            isPrimary: source?.primary === true,
            isStructured: true,
          });
        })
        .filter((source): source is DownloadAction => Boolean(source))
    : [];

  const legacyUrl = resolveLegacyAssetUrl(asset);
  const hasStructuredSources = structuredSources.length > 0;
  const officialStructured = structuredSources.find((source) => source.kind === 'official') ?? null;
  const githubStructured = structuredSources.find((source) => source.kind === 'github-release') ?? null;

  if (officialStructured) {
    addAction(officialStructured);
  } else if (legacyUrl) {
    addAction(
      createDownloadAction(hasStructuredSources ? 'official' : 'legacy', legacyUrl, {
        label: hasStructuredSources ? 'official' : 'legacy',
        isPrimary: !githubStructured,
        isLegacyFallback: true,
      }),
    );
  }

  if (githubStructured) {
    addAction(githubStructured);
  }

  const torrentUrl =
    typeof asset.torrentUrl === 'string' ? resolveAbsoluteUrl(asset.torrentUrl) : null;
  if (torrentUrl) {
    addAction(
      createDownloadAction('torrent', torrentUrl, {
        label: 'torrent',
      }),
    );
  }

  actions.sort((left, right) => {
    const priorityDiff = SOURCE_ACTION_ORDER[left.kind] - SOURCE_ACTION_ORDER[right.kind];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });

  return actions;
}

export function getDownloadAction(
  download: Pick<PlatformDownload, 'sourceActions'> | null | undefined,
  kind: DownloadSourceKind,
): DownloadAction | null {
  if (!download) {
    return null;
  }

  return download.sourceActions.find((action) => action.kind === kind) ?? null;
}

function getSafeFallbackAction(
  download: Pick<PlatformDownload, 'sourceActions'> | null | undefined,
): DownloadAction | null {
  return (
    getDownloadAction(download, 'official') ??
    getDownloadAction(download, 'legacy') ??
    (download?.sourceActions[0] ?? null)
  );
}

export function resolvePrimaryDownloadAction(
  download: Pick<PlatformDownload, 'sourceActions'> | null | undefined,
  githubState: GithubReachabilityState,
): DownloadAction | null {
  if (!download) {
    return null;
  }

  const githubAction = getDownloadAction(download, 'github-release');
  if (githubState === 'reachable' && githubAction) {
    return githubAction;
  }

  return getSafeFallbackAction(download) ?? githubAction ?? null;
}

export function findFirstGithubReleaseUrl(platformGroups: PlatformGroup[] | undefined): string | null {
  if (!platformGroups) {
    return null;
  }

  for (const platformGroup of platformGroups) {
    for (const download of platformGroup.downloads) {
      const githubAction = getDownloadAction(download, 'github-release');
      if (githubAction) {
        return githubAction.url;
      }
    }
  }

  return null;
}

function normalizeGithubProbeUrl(urlValue?: string | null): string {
  if (typeof urlValue === 'string' && urlValue.trim().length > 0) {
    try {
      const parsed = new URL(urlValue);
      if (parsed.hostname.endsWith('github.com')) {
        return new URL('/favicon.ico', parsed.origin).toString();
      }
    } catch {
      // ignore invalid values and fall back to the default target
    }
  }

  return 'https://github.com/favicon.ico';
}

export function getCachedGithubReachabilityState(): GithubReachabilityState {
  return githubProbeState;
}

export function resetGithubReachabilityProbeCache(): void {
  githubProbeState = 'unknown';
  githubProbePromise = null;
  githubProbeTarget = null;
}

export async function ensureGithubReachabilityProbe(
  probeUrl?: string | null,
): Promise<GithubReachabilityState> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return 'unknown';
  }

  if (githubProbeState === 'reachable' || githubProbeState === 'unreachable') {
    return githubProbeState;
  }

  const normalizedTarget = normalizeGithubProbeUrl(probeUrl);
  if (githubProbePromise && githubProbeTarget === normalizedTarget) {
    return githubProbePromise;
  }

  githubProbeState = 'probing';
  githubProbeTarget = normalizedTarget;
  githubProbePromise = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), GITHUB_PROBE_TIMEOUT_MS);

    try {
      await fetch(normalizedTarget, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      githubProbeState = 'reachable';
      return githubProbeState;
    } catch {
      githubProbeState = 'unreachable';
      return githubProbeState;
    } finally {
      window.clearTimeout(timeoutId);
      githubProbePromise = null;
    }
  })();

  return githubProbePromise;
}

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

function normalizeDesktopVersionEntry(version: unknown): DesktopVersion {
  if (!version || typeof version !== 'object') {
    throw new Error('Invalid desktop index payload: malformed version entry');
  }

  const candidate = version as DesktopVersion & {
    files?: DesktopAsset[] | string[];
  };

  const rawAssets = Array.isArray(candidate.assets)
    ? candidate.assets
    : Array.isArray(candidate.files) && candidate.files.every((item) => item && typeof item === 'object')
      ? candidate.files as DesktopAsset[]
      : null;

  if (typeof candidate.version !== 'string' || !rawAssets) {
    throw new Error('Invalid desktop index payload: malformed version entry');
  }

  for (const asset of rawAssets) {
    if (
      !asset ||
      typeof asset.name !== 'string' ||
      typeof asset.path !== 'string' ||
      typeof asset.size !== 'number'
    ) {
      throw new Error('Invalid desktop index payload: malformed asset entry');
    }
  }

  const normalizedFiles = Array.isArray(candidate.files)
    ? (candidate.files as Array<DesktopAsset | string>)
        .map((item) => (typeof item === 'string' ? item : item.path))
        .filter((item): item is string => typeof item === 'string')
    : undefined;

  return {
    version: candidate.version,
    assets: rawAssets.map((asset) => ({ ...asset })),
    files: normalizedFiles,
  };
}

function normalizeDesktopIndexPayload(payload: unknown): DesktopIndexResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid desktop index payload: expected object');
  }

  const data = payload as DesktopIndexResponse;
  if (!Array.isArray(data.versions)) {
    throw new Error('Invalid desktop index payload: missing versions array');
  }

  const normalizedVersions = data.versions.map((version) => normalizeDesktopVersionEntry(version));

  if (data.channels) {
    if (!isValidChannelInfo(data.channels.stable) || !isValidChannelInfo(data.channels.beta)) {
      throw new Error('Invalid desktop index payload: malformed channel data');
    }
  }

  return {
    ...data,
    versions: normalizedVersions
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

  if (name.includes('arm64') && name.endsWith('.appimage')) {
    return AssetType.LinuxArm64AppImage;
  }
  if (name.endsWith('.appimage')) {
    return AssetType.LinuxAppImage;
  }
  if (name.includes('arm64') && name.includes('.deb')) {
    return AssetType.LinuxArm64Deb;
  }
  if (name.includes('_amd64.deb')) {
    return AssetType.LinuxDeb;
  }
  if (name.includes('arm64') && name.includes('.tar.gz')) {
    return AssetType.LinuxArm64Tarball;
  }
  if (name.includes('.tar.gz')) {
    return AssetType.LinuxTarball;
  }

  return AssetType.Unknown;
}

export function inferArchitecture(assetType: AssetType): CpuArchitecture {
  switch (assetType) {
    case AssetType.MacOSApple:
    case AssetType.LinuxArm64AppImage:
    case AssetType.LinuxArm64Deb:
    case AssetType.LinuxArm64Tarball:
      return CpuArchitecture.ARM64;
    case AssetType.WindowsSetup:
    case AssetType.WindowsPortable:
    case AssetType.WindowsStore:
    case AssetType.MacOSIntel:
    case AssetType.LinuxAppImage:
    case AssetType.LinuxDeb:
    case AssetType.LinuxTarball:
      return CpuArchitecture.X64;
    default:
      return CpuArchitecture.Unknown;
  }
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
    [AssetType.LinuxArm64AppImage]: 'ARM64',
    [AssetType.LinuxDeb]: 'amd64',
    [AssetType.LinuxArm64Deb]: 'ARM64',
    [AssetType.LinuxTarball]: '通用',
    [AssetType.LinuxArm64Tarball]: 'ARM64',
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
    [AssetType.LinuxArm64AppImage]: 'ARM64',
    [AssetType.LinuxDeb]: 'amd64',
    [AssetType.LinuxArm64Deb]: 'ARM64',
    [AssetType.LinuxTarball]: 'Universal',
    [AssetType.LinuxArm64Tarball]: 'ARM64',
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
    [AssetType.LinuxArm64AppImage]: '.AppImage',
    [AssetType.LinuxDeb]: '.deb',
    [AssetType.LinuxArm64Deb]: '.deb',
    [AssetType.LinuxTarball]: '.tar.gz',
    [AssetType.LinuxArm64Tarball]: '.tar.gz',
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
    [AssetType.LinuxArm64AppImage]: 'AppImage (ARM64)',
    [AssetType.LinuxDeb]: 'Debian 包',
    [AssetType.LinuxArm64Deb]: 'Debian 包 (ARM64)',
    [AssetType.LinuxTarball]: '压缩包',
    [AssetType.LinuxArm64Tarball]: '压缩包 (ARM64)',
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
    [AssetType.LinuxArm64AppImage]: 'AppImage (ARM64)',
    [AssetType.LinuxDeb]: 'Debian Package',
    [AssetType.LinuxArm64Deb]: 'Debian Package (ARM64)',
    [AssetType.LinuxTarball]: 'Tarball',
    [AssetType.LinuxArm64Tarball]: 'Tarball (ARM64)',
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

  const platformGroups = new Map<DesktopPlatform, PlatformDownload[]>();
  const architectures = new Map<DesktopPlatform, Set<CpuArchitecture>>();

  for (const asset of assets) {
    const assetType = inferAssetType(asset.name);
    if (assetType === AssetType.Unknown) {
      continue;
    }

    let platform: DesktopPlatform | null = null;
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
      case AssetType.LinuxArm64AppImage:
      case AssetType.LinuxDeb:
      case AssetType.LinuxArm64Deb:
      case AssetType.LinuxTarball:
      case AssetType.LinuxArm64Tarball:
        platform = 'linux';
        break;
      default:
        continue;
    }

    const architecture = inferArchitecture(assetType);

    if (!platformGroups.has(platform)) {
      platformGroups.set(platform, []);
      architectures.set(platform, new Set());
    }

    const sourceActions = normalizeDownloadActions(asset);
    const safeAction = getSafeFallbackAction({ sourceActions }) ?? sourceActions[0];
    if (!safeAction) {
      continue;
    }

    platformGroups.get(platform)?.push({
      url: safeAction.url,
      size: formatFileSize(asset.size),
      filename: asset.name,
      assetType,
      architecture,
      sourceActions,
    });
    architectures.get(platform)?.add(architecture);
  }

  const result: PlatformGroup[] = [];
  for (const [platform, downloads] of platformGroups.entries()) {
    const recommendation = PLATFORM_RECOMMENDATIONS[platform];

    downloads.sort((a, b) => {
      if (a.assetType === recommendation.recommendedType) return -1;
      if (b.assetType === recommendation.recommendedType) return 1;
      return 0;
    });

    result.push({
      platform,
      downloads,
      architectures: Array.from(architectures.get(platform) ?? []),
    });
  }

  return result;
}

export function getRecommendedDownload(
  platform: DesktopPlatform,
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
