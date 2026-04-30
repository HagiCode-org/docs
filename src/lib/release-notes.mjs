import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const RELEASE_NOTES_DATA_DIR = path.resolve(process.cwd(), 'src', 'data', 'release-notes');
const SOURCE_RELEASE_NOTES_DATA_DIR = path.resolve(LIB_DIR, '..', 'data', 'release-notes');
const RELEASE_NOTES_INDEX_PATH = path.join(RELEASE_NOTES_DATA_DIR, 'index.json');

function resolveReleaseNotesDataDir() {
  if (fs.existsSync(RELEASE_NOTES_INDEX_PATH)) {
    return RELEASE_NOTES_DATA_DIR;
  }

  return SOURCE_RELEASE_NOTES_DATA_DIR;
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadManagedReleaseNotesIndex(indexPath = path.join(resolveReleaseNotesDataDir(), 'index.json')) {
  return readJsonFile(indexPath, {
    generatedAt: null,
    source: null,
    entries: [],
  });
}

export function loadManagedReleaseNotesDetails(indexPayload, dataDir = resolveReleaseNotesDataDir()) {
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
  const copyByLocale = {
    'zh-CN': {
      intro: '浏览已同步到文档站的 HagiCode 版本更新说明，最新版本会优先显示，并展开对应的摘要与详情。',
      empty: '当前语言下还没有可浏览的同步版本。运行 release-notes 同步工作流后，这里会自动出现完整的更新历史。',
      repositoryLabel: '个仓库',
      commitLabel: '次提交',
    },
    en: {
      intro: 'Browse synchronized HagiCode release notes in English. Every published entry is expanded inline with the newest versions first.',
      empty: 'No synchronized release notes are available yet. Run the release-notes sync workflow to publish the first localized release history.',
      repositoryLabel: 'repositories',
      commitLabel: 'commits',
    },
    'zh-Hant': {
      intro: '瀏覽已同步到文件站的 HagiCode 版本更新說明，最新版本會優先顯示，並展開對應的摘要與詳情。',
      empty: '目前這個語系還沒有可瀏覽的同步版本。執行 release-notes 同步工作流程後，這裡會自動顯示完整的更新歷史。',
      repositoryLabel: '個倉庫',
      commitLabel: '次提交',
    },
    'ja-JP': {
      intro: 'ドキュメントサイトに同期された HagiCode のリリースノートを参照できます。最新バージョンが先頭に表示され、要約と詳細がそのまま展開されます。',
      empty: 'この言語では、まだ同期済みのリリースノートを表示できません。release-notes 同期ワークフローを実行すると、完全な更新履歴がここに表示されます。',
      repositoryLabel: 'リポジトリ',
      commitLabel: 'コミット',
    },
    'ko-KR': {
      intro: '문서 사이트에 동기화된 HagiCode 릴리스 노트를 확인할 수 있습니다. 최신 버전이 먼저 표시되고 요약과 세부 내용이 함께 펼쳐집니다.',
      empty: '이 언어에서는 아직 동기화된 릴리스 노트를 볼 수 없습니다. release-notes 동기화 워크플로를 실행하면 전체 변경 이력이 여기에 표시됩니다.',
      repositoryLabel: '저장소',
      commitLabel: '커밋',
    },
    'de-DE': {
      intro: 'Hier finden Sie die mit der Dokumentationsseite synchronisierten HagiCode-Release-Notes. Die neuesten Versionen stehen oben und zeigen Zusammenfassung und Details direkt inline.',
      empty: 'Für diese Sprache sind noch keine synchronisierten Release-Notes verfügbar. Führen Sie den release-notes-Synchronisierungsworkflow aus, damit hier der vollständige Verlauf erscheint.',
      repositoryLabel: 'Repos',
      commitLabel: 'Commits',
    },
    'fr-FR': {
      intro: 'Consultez les notes de version HagiCode synchronisées sur le site de documentation. Les versions les plus récentes apparaissent en premier avec leur résumé et leurs détails affichés directement.',
      empty: 'Aucune note de version synchronisée n’est encore disponible pour cette langue. Exécutez le workflow de synchronisation release-notes pour publier l’historique complet ici.',
      repositoryLabel: 'dépôts',
      commitLabel: 'commits',
    },
    'es-ES': {
      intro: 'Consulta las notas de versión de HagiCode sincronizadas en el sitio de documentación. Las versiones más recientes aparecen primero y muestran el resumen y los detalles en la misma página.',
      empty: 'Todavía no hay notas de versión sincronizadas disponibles para este idioma. Ejecuta el flujo de sincronización de release-notes para publicar aquí el historial completo.',
      repositoryLabel: 'repositorios',
      commitLabel: 'commits',
    },
    'pt-BR': {
      intro: 'Consulte as notas de versão do HagiCode sincronizadas com o site de documentação. As versões mais recentes aparecem primeiro e exibem o resumo e os detalhes na própria página.',
      empty: 'Ainda não há notas de versão sincronizadas disponíveis para este idioma. Execute o fluxo de sincronização de release-notes para publicar o histórico completo aqui.',
      repositoryLabel: 'repositórios',
      commitLabel: 'commits',
    },
    'ru-RU': {
      intro: 'Здесь собраны заметки о релизах HagiCode, синхронизированные с сайтом документации. Новейшие версии показываются первыми, а их краткое описание и детали раскрываются прямо на странице.',
      empty: 'Для этого языка пока нет синхронизированных заметок о релизах. Запустите workflow синхронизации release-notes, и здесь появится полный журнал изменений.',
      repositoryLabel: 'репозиториев',
      commitLabel: 'коммитов',
    },
  };

  return copyByLocale[locale] ?? copyByLocale.en;
}

function resolveReleaseNotesLandingPath(locale = 'zh-CN') {
  if (locale === 'zh-CN') {
    return '/release-notes/';
  }

  return `/${locale}/release-notes/`;
}

function pickLocalizedEntry(valueByLocale, locale = 'zh-CN') {
  if (!valueByLocale || typeof valueByLocale !== 'object') {
    return '';
  }

  if (locale === 'zh-CN') {
    return valueByLocale['zh-CN'] ?? valueByLocale.en ?? '';
  }

  return valueByLocale.en ?? valueByLocale['zh-CN'] ?? '';
}

export function getReleaseNotesLandingEntries(indexPayload, locale = 'zh-CN', detailEntries = new Map()) {
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  const landingPath = resolveReleaseNotesLandingPath(locale);

  return entries.map((entry) => {
    const repositoryCount = Array.isArray(entry.repositoryRanges) ? entry.repositoryRanges.length : 0;
    const totalCommitCount =
      typeof entry.totalCommitCount === 'number' ? entry.totalCommitCount : 0;
    const detailEntry = detailEntries.get(entry.tag)
      ?? detailEntries.get(entry.detailPath ?? '')
      ?? null;
    const bodyHtml = pickLocalizedEntry(detailEntry?.bodyHtml, locale);

    return {
      tag: entry.displayTag ?? entry.tag,
      anchorId: entry.anchorId ?? '',
      anchorHref: entry.anchorId ? `${landingPath}#${entry.anchorId}` : landingPath,
      releaseDate: entry.releaseDate ?? 'Unknown',
      summary: pickLocalizedEntry(entry.summary, locale),
      bodyHtml,
      repositoryCount,
      totalCommitCount,
    };
  });
}

export function getReleaseNotesTocItems(indexPayload, locale = 'zh-CN') {
  return getReleaseNotesLandingEntries(indexPayload, locale).map((entry) => ({
    text: entry.tag,
    slug: entry.anchorId,
    href: entry.anchorHref,
  })).filter((entry) => entry.slug);
}

export function getManagedReleaseNotesLanding(locale = 'zh-CN') {
  const indexPayload = loadManagedReleaseNotesIndex();
  const detailEntries = loadManagedReleaseNotesDetails(indexPayload);

  return {
    copy: getReleaseNotesLandingCopy(locale),
    entries: getReleaseNotesLandingEntries(indexPayload, locale, detailEntries),
  };
}

export function getManagedReleaseNotesToc(locale = 'zh-CN') {
  const indexPayload = loadManagedReleaseNotesIndex();
  return getReleaseNotesTocItems(indexPayload, locale);
}
