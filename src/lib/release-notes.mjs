export function getReleaseNotesLandingCopy(locale = 'zh-CN') {
  if (locale === 'en') {
    return {
      intro: 'Browse synchronized HagiCode release notes. The latest eligible versions appear first and each card links to both locales.',
      empty: 'No synchronized release notes are available yet. Run the release-notes sync workflow to publish the first version set.',
      readPrimary: 'Read English',
      readSecondary: '查看中文',
      repositoryLabel: 'repositories',
      commitLabel: 'commits',
    };
  }

  return {
    intro: '这里展示已经同步到文档站的 HagiCode 版本更新说明。最新可用版本会排在最前，并同时提供中英文入口。',
    empty: '当前还没有可浏览的同步版本。运行 release-notes 同步工作流后，这里会自动出现版本卡片。',
    readPrimary: '查看中文',
    readSecondary: 'Read English',
    repositoryLabel: '个仓库',
    commitLabel: '次提交',
  };
}

export function getReleaseNotesLandingEntries(indexPayload, locale = 'zh-CN') {
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];

  return entries.map((entry) => {
    const repositoryCount = Array.isArray(entry.repositoryRanges) ? entry.repositoryRanges.length : 0;
    const totalCommitCount =
      typeof entry.totalCommitCount === 'number' ? entry.totalCommitCount : 0;
    const primaryRoute = locale === 'en' ? entry.routes?.en : entry.routes?.['zh-CN'];
    const secondaryRoute = locale === 'en' ? entry.routes?.['zh-CN'] : entry.routes?.en;

    return {
      tag: entry.displayTag ?? entry.tag,
      releaseDate: entry.releaseDate ?? 'Unknown',
      summary:
        locale === 'en'
          ? entry.summary?.en ?? ''
          : entry.summary?.['zh-CN'] ?? '',
      primaryRoute: primaryRoute ?? '#',
      secondaryRoute: secondaryRoute ?? '#',
      repositoryCount,
      totalCommitCount,
    };
  });
}
