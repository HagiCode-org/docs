import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCS_ROUTE_LOCALE_OPTIONS,
  getTranslationDirectoryByRouteLocale,
} from '../lib/docs-content-paths.mjs';
import { getStructuredArticleViewModel } from '../lib/articles.mjs';
import type { DocsLocale } from '@/lib/i18n';

type SidebarTranslations = Partial<Record<Exclude<DocsLocale, 'root'>, string>>;
type SidebarSectionKey =
  | 'productOverview'
  | 'quickStart'
  | 'installationGuide'
  | 'faq'
  | 'relatedSoftwareInstallation'
  | 'guides'
  | 'llmGuide'
  | 'aiServiceSubscriptions'
  | 'legal'
  | 'releaseNotes'
  | 'dlc'
  | 'bundles';

type SidebarLinkItem = {
  slug: string;
  label?: string;
  translations?: SidebarTranslations;
};

type SidebarGroupItem = {
  label: string;
  items: SidebarItem[];
};

type SidebarItem = SidebarLinkItem | SidebarGroupItem;

type SidebarEntry = {
  item: SidebarItem;
  order: number;
  sortKey: string;
};

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;
const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../content/docs'
);
const structuredArticlesSnapshotRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/articles.snapshot',
);
const STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG = new Map([
  ['claude-vs-hagicode', 28],
  ['copilot-vs-hagicode', 29],
  ['codex-vs-hagicode', 30],
  ['gemini-vs-hagicode', 31],
  ['opencode-vs-hagicode', 32],
  ['hermes-vs-hagicode', 33],
  ['deepagents-vs-hagicode', 34],
  ['kimi-vs-hagicode', 35],
  ['codebuddy-vs-hagicode', 36],
  ['qoder-vs-hagicode', 37],
  ['kiro-vs-hagicode', 38],
]);

function createTranslations(translations: SidebarTranslations): SidebarTranslations {
  return translations;
}

const SIDEBAR_SECTION_TRANSLATIONS: Record<
  Exclude<DocsLocale, 'root'>,
  Record<SidebarSectionKey, string>
> = {
  'en-US': {
    productOverview: 'Product Overview',
    quickStart: 'Quick Start',
    installationGuide: 'Installation Guide',
    faq: 'FAQ',
    relatedSoftwareInstallation: 'Related Software Installation',
    guides: 'Guides',
    llmGuide: 'LLM Guide',
    aiServiceSubscriptions: 'AI Service Subscriptions',
    legal: 'Legal',
    releaseNotes: 'Release Notes',
    dlc: 'DLC',
    bundles: 'Bundles',
  },
  'zh-Hant': {
    productOverview: '產品概覽',
    quickStart: '快速開始',
    installationGuide: '安裝指南',
    faq: '常見問題',
    relatedSoftwareInstallation: '相關軟體安裝',
    guides: '功能指南',
    llmGuide: '大模型指南',
    aiServiceSubscriptions: 'AI 服務訂閱網站',
    legal: '法律文件',
    releaseNotes: '版本更新說明',
    dlc: 'DLC',
    bundles: '套件組合',
  },
  'fr-FR': {
    productOverview: 'Vue d’ensemble du produit',
    quickStart: 'Démarrage rapide',
    installationGuide: 'Guide d’installation',
    faq: 'FAQ',
    relatedSoftwareInstallation: 'Installation des logiciels associés',
    guides: 'Guides',
    llmGuide: 'Guide LLM',
    aiServiceSubscriptions: 'Abonnements aux services IA',
    legal: 'Documents juridiques',
    releaseNotes: 'Notes de version',
    dlc: 'DLC',
    bundles: 'Packs',
  },
  'de-DE': {
    productOverview: 'Produktübersicht',
    quickStart: 'Schnellstart',
    installationGuide: 'Installationsanleitung',
    faq: 'Häufige Fragen',
    relatedSoftwareInstallation: 'Installation verwandter Software',
    guides: 'Anleitungen',
    llmGuide: 'LLM-Leitfaden',
    aiServiceSubscriptions: 'KI-Dienst-Abonnements',
    legal: 'Rechtliches',
    releaseNotes: 'Versionshinweise',
    dlc: 'DLC',
    bundles: 'Pakete',
  },
  'es-ES': {
    productOverview: 'Descripción general del producto',
    quickStart: 'Inicio rápido',
    installationGuide: 'Guía de instalación',
    faq: 'Preguntas frecuentes',
    relatedSoftwareInstallation: 'Instalación de software relacionado',
    guides: 'Guías',
    llmGuide: 'Guía de LLM',
    aiServiceSubscriptions: 'Suscripciones de servicios de IA',
    legal: 'Documentos legales',
    releaseNotes: 'Notas de la versión',
    dlc: 'DLC',
    bundles: 'Paquetes',
  },
  'ja-JP': {
    productOverview: '製品概要',
    quickStart: 'クイックスタート',
    installationGuide: 'インストールガイド',
    faq: 'よくある質問',
    relatedSoftwareInstallation: '関連ソフトウェアのインストール',
    guides: 'ガイド',
    llmGuide: 'LLM ガイド',
    aiServiceSubscriptions: 'AI サービス購読サイト',
    legal: '法的文書',
    releaseNotes: 'リリースノート',
    dlc: 'DLC',
    bundles: 'バンドル',
  },
  'ko-KR': {
    productOverview: '제품 개요',
    quickStart: '빠른 시작',
    installationGuide: '설치 가이드',
    faq: '자주 묻는 질문',
    relatedSoftwareInstallation: '관련 소프트웨어 설치',
    guides: '가이드',
    llmGuide: 'LLM 가이드',
    aiServiceSubscriptions: 'AI 서비스 구독 사이트',
    legal: '법률 문서',
    releaseNotes: '릴리스 노트',
    dlc: 'DLC',
    bundles: '번들',
  },
  'pt-BR': {
    productOverview: 'Visão geral do produto',
    quickStart: 'Início rápido',
    installationGuide: 'Guia de instalação',
    faq: 'Perguntas frequentes',
    relatedSoftwareInstallation: 'Instalação de software relacionado',
    guides: 'Guias',
    llmGuide: 'Guia de LLM',
    aiServiceSubscriptions: 'Assinaturas de serviços de IA',
    legal: 'Documentos legais',
    releaseNotes: 'Notas de versão',
    dlc: 'DLC',
    bundles: 'Pacotes',
  },
  'ru-RU': {
    productOverview: 'Обзор продукта',
    quickStart: 'Быстрый старт',
    installationGuide: 'Руководство по установке',
    faq: 'Часто задаваемые вопросы',
    relatedSoftwareInstallation: 'Установка связанного ПО',
    guides: 'Руководства',
    llmGuide: 'Руководство по LLM',
    aiServiceSubscriptions: 'Подписки на AI-сервисы',
    legal: 'Юридические документы',
    releaseNotes: 'Примечания к выпуску',
    dlc: 'DLC',
    bundles: 'Наборы',
  },
};

function createSectionTranslations(section: SidebarSectionKey): SidebarTranslations {
  return createTranslations(
    Object.fromEntries(
      Object.entries(SIDEBAR_SECTION_TRANSLATIONS).map(([locale, translations]) => [
        locale,
        translations[section],
      ]),
    ) as SidebarTranslations,
  );
}

function readFrontmatter(source: string): string | null {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  return match?.[1] ?? null;
}

function parseOrder(frontmatter: string | null): number {
  if (!frontmatter) {
    return DEFAULT_ORDER;
  }

  const nestedSidebarOrderMatch = frontmatter.match(/^\s{0,2}sidebar:\s*\n(?:[ \t].*\n)*?[ \t]{2}order:\s*(\d+)/m);
  if (nestedSidebarOrderMatch) {
    return Number.parseInt(nestedSidebarOrderMatch[1], 10);
  }

  const sidebarOrderMatch = frontmatter.match(/^\s*sidebar_order:\s*(\d+)/m);
  if (sidebarOrderMatch) {
    return Number.parseInt(sidebarOrderMatch[1], 10);
  }

  const sidebarPositionMatch = frontmatter.match(/^\s*sidebar_position:\s*(\d+)/m);
  if (sidebarPositionMatch) {
    return Number.parseInt(sidebarPositionMatch[1], 10);
  }

  return DEFAULT_ORDER;
}

function parseTitle(frontmatter: string | null): string | null {
  if (!frontmatter) {
    return null;
  }

  const titleMatch = frontmatter.match(/^\s*title:\s*["']?(.+?)["']?\s*$/m);
  return titleMatch?.[1] ?? null;
}

function readDocMetadata(relativeDocPath: string) {
  const source = readFileSync(path.join(docsRoot, relativeDocPath), 'utf8');
  const frontmatter = readFrontmatter(source);

  return {
    order: parseOrder(frontmatter),
    title: parseTitle(frontmatter),
  };
}

function readTranslationDocMetadata(sourceLocale: string, relativeDocPath: string) {
  const source = readFileSync(
    path.join(
      docsRoot,
      '..',
      'translations',
      'docs',
      sourceLocale,
      relativeDocPath
    ),
    'utf8'
  );
  const frontmatter = readFrontmatter(source);

  return {
    order: parseOrder(frontmatter),
    title: parseTitle(frontmatter),
  };
}

function toSlug(relativeDocPath: string) {
  const withoutExtension = relativeDocPath.replace(/\.(md|mdx)$/u, '');
  return withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension;
}

function getDirectoryLabel(relativeDirectoryPath: string) {
  for (const extension of MARKDOWN_EXTENSIONS) {
    const indexPath = path.join(relativeDirectoryPath, `index${extension}`);
    if (!existsSync(path.join(docsRoot, indexPath))) {
      continue;
    }

    const metadata = readDocMetadata(indexPath);
    if (metadata.title) {
      return metadata.title;
    }
  }

  return path.basename(relativeDirectoryPath);
}

function compareSidebarEntries(a: SidebarEntry, b: SidebarEntry) {
  if (a.order !== b.order) {
    return a.order - b.order;
  }

  return a.sortKey.localeCompare(b.sortKey, 'zh-CN');
}

function buildDocTranslations(relativeDocPath: string, fallbackLabel: string): SidebarTranslations {
  const translations: SidebarTranslations = {};

  for (const locale of DOCS_ROUTE_LOCALE_OPTIONS) {
    if (locale.code === 'root') {
      continue;
    }

    const localeCode = locale.code as Exclude<DocsLocale, 'root'>;
    const translationDirectory = getTranslationDirectoryByRouteLocale(localeCode);
    if (!translationDirectory) {
      translations[localeCode] = fallbackLabel;
      continue;
    }

    const translationPath = path.join(
      docsRoot,
      '..',
      'translations',
      'docs',
      translationDirectory,
      relativeDocPath
    );
    if (!existsSync(translationPath)) {
      translations[localeCode] = fallbackLabel;
      continue;
    }

    translations[localeCode] =
      readTranslationDocMetadata(translationDirectory, relativeDocPath).title ?? fallbackLabel;
  }

  return translations;
}

function buildFlattenedSidebarEntries(relativeDirectoryPath: string): SidebarEntry[] {
  const absoluteDirectoryPath = path.join(docsRoot, relativeDirectoryPath);
  const directoryEntries = readdirSync(absoluteDirectoryPath, { withFileTypes: true });
  const sidebarEntries: SidebarEntry[] = [];

  for (const entry of directoryEntries) {
    if (entry.name.startsWith('_')) {
      continue;
    }

    const relativeEntryPath = path.posix.join(relativeDirectoryPath, entry.name);
    if (entry.isDirectory()) {
      sidebarEntries.push(...buildFlattenedSidebarEntries(relativeEntryPath));
      continue;
    }

    const extension = path.extname(entry.name);
    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      continue;
    }

    const metadata = readDocMetadata(relativeEntryPath);
    sidebarEntries.push({
      item: {
        slug: toSlug(relativeEntryPath),
        label: metadata.title ?? undefined,
        translations: metadata.title
          ? buildDocTranslations(relativeEntryPath, metadata.title)
          : undefined,
      },
      order: metadata.order,
      sortKey: relativeEntryPath,
    });
  }

  return sidebarEntries;
}

function buildDirectorySidebarItems(relativeDirectoryPath: string): SidebarItem[] {
  const absoluteDirectoryPath = path.join(docsRoot, relativeDirectoryPath);
  const directoryEntries = readdirSync(absoluteDirectoryPath, { withFileTypes: true });
  const sidebarEntries: SidebarEntry[] = [];

  for (const entry of directoryEntries) {
    if (entry.name.startsWith('_')) {
      continue;
    }

    const relativeEntryPath = path.posix.join(relativeDirectoryPath, entry.name);
    if (entry.isDirectory()) {
      const items = buildDirectorySidebarItems(relativeEntryPath);
      if (items.length === 0) {
        continue;
      }

      let order = DEFAULT_ORDER;
      for (const extension of MARKDOWN_EXTENSIONS) {
        const indexPath = path.posix.join(relativeEntryPath, `index${extension}`);
        if (!existsSync(path.join(docsRoot, indexPath))) {
          continue;
        }

        order = readDocMetadata(indexPath).order;
        break;
      }

      sidebarEntries.push({
        item: {
          label: getDirectoryLabel(relativeEntryPath),
          items,
        },
        order,
        sortKey: relativeEntryPath,
      });
      continue;
    }

    const extension = path.extname(entry.name);
    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      continue;
    }

    const metadata = readDocMetadata(relativeEntryPath);
    sidebarEntries.push({
      item: {
        slug: toSlug(relativeEntryPath),
      },
      order: entry.name.startsWith('index.') ? -1 : metadata.order,
      sortKey: relativeEntryPath,
    });
  }

  return sidebarEntries.sort(compareSidebarEntries).map(({ item }) => item);
}

function createAutogeneratedItems(
  directory: string,
  options?: {
    flatten?: boolean;
  }
): SidebarItem[] {
  if (options?.flatten) {
    return buildFlattenedSidebarEntries(directory)
      .sort(compareSidebarEntries)
      .map(({ item }) => item);
  }

  return buildDirectorySidebarItems(directory);
}

function buildStructuredArticleSidebarEntries(): SidebarEntry[] {
  const rootManifestPath = path.join(structuredArticlesSnapshotRoot, 'index.json');
  if (!existsSync(rootManifestPath)) {
    return [];
  }

  const rootManifest = JSON.parse(readFileSync(rootManifestPath, 'utf8')) as {
    localeIndexes?: Array<{ locale?: string }>;
  };
  const slugs = new Set<string>();

  for (const localeIndex of rootManifest.localeIndexes ?? []) {
    if (typeof localeIndex?.locale !== 'string' || localeIndex.locale.length === 0) {
      continue;
    }

    const localeManifestPath = path.join(
      structuredArticlesSnapshotRoot,
      localeIndex.locale,
      'index.json',
    );
    if (!existsSync(localeManifestPath)) {
      continue;
    }

    const localeManifest = JSON.parse(readFileSync(localeManifestPath, 'utf8')) as {
      articles?: Array<{ slug?: string }>;
    };

    for (const article of localeManifest.articles ?? []) {
      if (typeof article?.slug === 'string' && article.slug.length > 0) {
        slugs.add(article.slug);
      }
    }
  }

  return [...slugs].map((slug) => {
    const rootArticle = getStructuredArticleViewModel(slug, 'root', {
      snapshotRoot: structuredArticlesSnapshotRoot,
    });
    const translations = Object.fromEntries(
      DOCS_ROUTE_LOCALE_OPTIONS.filter((locale) => locale.code !== 'root').map((locale) => {
        return [
          locale.code,
          getStructuredArticleViewModel(slug, locale.code, {
            snapshotRoot: structuredArticlesSnapshotRoot,
          }).title,
        ];
      }),
    ) as SidebarTranslations;

    return {
      item: {
        slug: `faq/${slug}`,
        label: rootArticle.title,
        translations,
      },
      order: STRUCTURED_ARTICLE_SIDEBAR_ORDER_BY_SLUG.get(slug) ?? DEFAULT_ORDER,
      sortKey: `faq/${slug}`,
    };
  });
}

function createFaqSidebarItems(): SidebarItem[] {
  return [
    ...buildFlattenedSidebarEntries('faq'),
    ...buildStructuredArticleSidebarEntries(),
  ]
    .sort(compareSidebarEntries)
    .map(({ item }) => item);
}

export const DOCS_SIDEBAR = [
  {
    label: '产品概述',
    translations: createSectionTranslations('productOverview'),
    link: '/product-overview',
  },
  {
    label: '快速开始',
    translations: createSectionTranslations('quickStart'),
    items: createAutogeneratedItems('quick-start'),
  },
  {
    label: '安装指南',
    translations: createSectionTranslations('installationGuide'),
    items: createAutogeneratedItems('installation'),
  },
  {
    label: '常见问题',
    translations: createSectionTranslations('faq'),
    items: createFaqSidebarItems(),
  },
  {
    label: '相关软件安装',
    translations: createSectionTranslations('relatedSoftwareInstallation'),
    items: createAutogeneratedItems('related-software-installation', { flatten: true }),
  },
  {
    label: '功能指南',
    translations: createSectionTranslations('guides'),
    items: createAutogeneratedItems('guides'),
  },
  {
    label: '大模型指南',
    translations: createSectionTranslations('llmGuide'),
    items: createAutogeneratedItems('llm-guide'),
  },
  {
    label: 'AI 服务订阅网站',
    translations: createSectionTranslations('aiServiceSubscriptions'),
    items: createAutogeneratedItems('ai-service-subscriptions'),
  },
  {
    label: '法律文档',
    translations: createSectionTranslations('legal'),
    items: createAutogeneratedItems('legal'),
  },
  {
    label: '版本更新说明',
    translations: createSectionTranslations('releaseNotes'),
    link: '/release-notes',
  },
  {
    label: 'DLC',
    translations: createSectionTranslations('dlc'),
    items: createAutogeneratedItems('dlc'),
  },
  {
    label: 'Bundles',
    translations: createSectionTranslations('bundles'),
    items: createAutogeneratedItems('bundles'),
  },
];
