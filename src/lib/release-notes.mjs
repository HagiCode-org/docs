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

export function getReleaseNotesLandingEntries(indexPayload, locale = 'zh-CN') {
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  const landingPath = locale === 'en' ? '/en/release-notes/' : '/release-notes/';

  return entries.map((entry) => {
    const repositoryCount = Array.isArray(entry.repositoryRanges) ? entry.repositoryRanges.length : 0;
    const totalCommitCount =
      typeof entry.totalCommitCount === 'number' ? entry.totalCommitCount : 0;
    const bodyHtml = locale === 'en'
      ? entry.landingBodyHtml?.en ?? ''
      : entry.landingBodyHtml?.['zh-CN'] ?? '';

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
