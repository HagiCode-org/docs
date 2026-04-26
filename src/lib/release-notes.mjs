import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const RELEASE_NOTES_DATA_DIR = path.resolve(LIB_DIR, '..', 'data', 'release-notes');
const RELEASE_NOTES_INDEX_PATH = path.join(RELEASE_NOTES_DATA_DIR, 'index.json');

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadManagedReleaseNotesIndex(indexPath = RELEASE_NOTES_INDEX_PATH) {
  return readJsonFile(indexPath, {
    generatedAt: null,
    source: null,
    entries: [],
  });
}

export function loadManagedReleaseNotesDetails(indexPayload, dataDir = RELEASE_NOTES_DATA_DIR) {
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  const details = new Map();

  for (const entry of entries) {
    const detailPath = typeof entry?.detailPath === 'string' ? entry.detailPath.trim() : '';
    if (detailPath.length === 0) {
      continue;
    }

    const absolutePath = path.join(dataDir, detailPath);
    const detailPayload = readJsonFile(absolutePath, null);
    if (detailPayload) {
      details.set(entry.tag, detailPayload);
      details.set(detailPath, detailPayload);
    }
  }

  return details;
}

export function getReleaseNotesLandingCopy(locale = 'zh-CN') {
  if (locale === 'en') {
    return {
      intro: 'Browse synchronized HagiCode release notes in English. Every published entry is expanded inline with the newest versions first.',
      empty: 'No synchronized release notes are available yet. Run the release-notes sync workflow to publish the first localized release history.',
      repositoryLabel: 'repositories',
      commitLabel: 'commits',
    };
  }

  return {
    intro: '这里会按当前语言直接展开所有已同步的 HagiCode 版本更新说明，最新版本排在最前，方便连续阅读。',
    empty: '当前语言下还没有可浏览的同步版本。运行 release-notes 同步工作流后，这里会自动出现完整的更新历史。',
    repositoryLabel: '个仓库',
    commitLabel: '次提交',
  };
}

export function getReleaseNotesLandingEntries(indexPayload, locale = 'zh-CN', detailEntries = new Map()) {
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  const landingPath = locale === 'en' ? '/en/release-notes/' : '/release-notes/';

  return entries.map((entry) => {
    const repositoryCount = Array.isArray(entry.repositoryRanges) ? entry.repositoryRanges.length : 0;
    const totalCommitCount =
      typeof entry.totalCommitCount === 'number' ? entry.totalCommitCount : 0;
    const detailEntry = detailEntries.get(entry.tag)
      ?? detailEntries.get(entry.detailPath ?? '')
      ?? null;
    const bodyHtml = locale === 'en'
      ? detailEntry?.bodyHtml?.en ?? ''
      : detailEntry?.bodyHtml?.['zh-CN'] ?? '';

    return {
      tag: entry.displayTag ?? entry.tag,
      anchorId: entry.anchorId ?? '',
      anchorHref: entry.anchorId ? `${landingPath}#${entry.anchorId}` : landingPath,
      releaseDate: entry.releaseDate ?? 'Unknown',
      summary:
        locale === 'en'
          ? entry.summary?.en ?? ''
          : entry.summary?.['zh-CN'] ?? '',
      bodyHtml,
      repositoryCount,
      totalCommitCount,
    };
  });
}

export function getManagedReleaseNotesLanding(locale = 'zh-CN') {
  const indexPayload = loadManagedReleaseNotesIndex();
  const detailEntries = loadManagedReleaseNotesDetails(indexPayload);

  return {
    copy: getReleaseNotesLandingCopy(locale),
    entries: getReleaseNotesLandingEntries(indexPayload, locale, detailEntries),
  };
}
