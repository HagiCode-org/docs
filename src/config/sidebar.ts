import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCS_ROUTE_LOCALE_OPTIONS,
  getTranslationDirectoryByRouteLocale,
} from '../lib/docs-content-paths.mjs';
import type { DocsLocale } from '@/lib/i18n';

type SidebarTranslations = Partial<Record<Exclude<DocsLocale, 'root'>, string>>;

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

function createTranslations(translations: SidebarTranslations): SidebarTranslations {
  return translations;
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

    const translationDirectory = getTranslationDirectoryByRouteLocale(locale.code);
    if (!translationDirectory) {
      translations[locale.code] = fallbackLabel;
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
      translations[locale.code] = fallbackLabel;
      continue;
    }

    translations[locale.code] =
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

export const DOCS_SIDEBAR = [
  {
    label: '产品概述',
    translations: createTranslations({
      'en-US': 'Product Overview',
      'zh-Hant': '產品概覽',
      'ja-JP': '製品概要',
      'ko-KR': '제품 개요',
      'de-DE': 'Produktübersicht',
      'fr-FR': 'Vue d’ensemble du produit',
      'es-ES': 'Descripción general del producto',
      'pt-BR': 'Visão geral do produto',
      'ru-RU': 'Обзор продукта',
    }),
    link: '/product-overview',
  },
  {
    label: '快速开始',
    translations: createTranslations({
      'en-US': 'Quick Start',
      'zh-Hant': '快速開始',
      'ja-JP': 'クイックスタート',
      'ko-KR': '빠른 시작',
      'de-DE': 'Schnellstart',
      'fr-FR': 'Démarrage rapide',
      'es-ES': 'Inicio rápido',
      'pt-BR': 'Início rápido',
      'ru-RU': 'Быстрый старт',
    }),
    items: createAutogeneratedItems('quick-start'),
  },
  {
    label: '安装指南',
    translations: createTranslations({
      'en-US': 'Installation Guide',
      'zh-Hant': '安裝指南',
      'ja-JP': 'インストールガイド',
      'ko-KR': '설치 가이드',
      'de-DE': 'Installationsanleitung',
      'fr-FR': 'Guide d’installation',
      'es-ES': 'Guía de instalación',
      'pt-BR': 'Guia de instalação',
      'ru-RU': 'Руководство по установке',
    }),
    items: createAutogeneratedItems('installation'),
  },
  {
    label: '常见问题',
    translations: createTranslations({
      'en-US': 'FAQ',
      'zh-Hant': '常見問題',
      'ja-JP': 'よくある質問',
      'ko-KR': '자주 묻는 질문',
      'de-DE': 'Häufige Fragen',
      'fr-FR': 'FAQ',
      'es-ES': 'Preguntas frecuentes',
      'pt-BR': 'Perguntas frequentes',
      'ru-RU': 'Часто задаваемые вопросы',
    }),
    items: createAutogeneratedItems('faq'),
  },
  {
    label: '相关软件安装',
    translations: createTranslations({
      'en-US': 'Related Software Installation',
      'zh-Hant': '相關軟體安裝',
      'ja-JP': '関連ソフトウェアのインストール',
      'ko-KR': '관련 소프트웨어 설치',
      'de-DE': 'Installation verwandter Software',
      'fr-FR': 'Installation des logiciels associés',
      'es-ES': 'Instalación de software relacionado',
      'pt-BR': 'Instalação de software relacionado',
      'ru-RU': 'Установка связанного ПО',
    }),
    items: createAutogeneratedItems('related-software-installation', { flatten: true }),
  },
  {
    label: '功能指南',
    translations: createTranslations({
      'en-US': 'Guides',
      'zh-Hant': '功能指南',
      'ja-JP': 'ガイド',
      'ko-KR': '가이드',
      'de-DE': 'Anleitungen',
      'fr-FR': 'Guides',
      'es-ES': 'Guías',
      'pt-BR': 'Guias',
      'ru-RU': 'Руководства',
    }),
    items: createAutogeneratedItems('guides'),
  },
  {
    label: '大模型指南',
    translations: createTranslations({
      'en-US': 'LLM Guide',
      'zh-Hant': '大模型指南',
      'ja-JP': 'LLM ガイド',
      'ko-KR': 'LLM 가이드',
      'de-DE': 'LLM-Leitfaden',
      'fr-FR': 'Guide LLM',
      'es-ES': 'Guía de LLM',
      'pt-BR': 'Guia de LLM',
      'ru-RU': 'Руководство по LLM',
    }),
    items: createAutogeneratedItems('llm-guide'),
  },
  {
    label: 'AI 服务订阅网站',
    translations: createTranslations({
      'en-US': 'AI Service Subscriptions',
      'zh-Hant': 'AI 服務訂閱網站',
      'ja-JP': 'AI サービス購読サイト',
      'ko-KR': 'AI 서비스 구독 사이트',
      'de-DE': 'KI-Dienst-Abonnements',
      'fr-FR': 'Abonnements de services IA',
      'es-ES': 'Suscripciones de servicios de IA',
      'pt-BR': 'Assinaturas de serviços de IA',
      'ru-RU': 'Подписки на AI-сервисы',
    }),
    items: createAutogeneratedItems('ai-service-subscriptions'),
  },
  {
    label: '法律文档',
    translations: createTranslations({
      'en-US': 'Legal',
      'zh-Hant': '法律文件',
      'ja-JP': '法的文書',
      'ko-KR': '법률 문서',
      'de-DE': 'Rechtliches',
      'fr-FR': 'Documents juridiques',
      'es-ES': 'Documentos legales',
      'pt-BR': 'Documentos legais',
      'ru-RU': 'Юридические документы',
    }),
    items: createAutogeneratedItems('legal'),
  },
  {
    label: '版本更新说明',
    translations: createTranslations({
      'en-US': 'Release Notes',
      'zh-Hant': '版本更新說明',
      'ja-JP': 'リリースノート',
      'ko-KR': '릴리스 노트',
      'de-DE': 'Versionshinweise',
      'fr-FR': 'Notes de version',
      'es-ES': 'Notas de la versión',
      'pt-BR': 'Notas de versão',
      'ru-RU': 'Примечания к выпуску',
    }),
    link: '/release-notes',
  },
  {
    label: 'DLC',
    translations: createTranslations({
      'en-US': 'DLC',
      'zh-Hant': 'DLC',
      'ja-JP': 'DLC',
      'ko-KR': 'DLC',
      'de-DE': 'DLC',
      'fr-FR': 'DLC',
      'es-ES': 'DLC',
      'pt-BR': 'DLC',
      'ru-RU': 'DLC',
    }),
    items: createAutogeneratedItems('dlc'),
  },
  {
    label: 'Bundles',
    translations: createTranslations({
      'en-US': 'Bundles',
      'zh-Hant': '套件組合',
      'ja-JP': 'バンドル',
      'ko-KR': '번들',
      'de-DE': 'Bundles',
      'fr-FR': 'Packs',
      'es-ES': 'Paquetes',
      'pt-BR': 'Pacotes',
      'ru-RU': 'Наборы',
    }),
    items: createAutogeneratedItems('bundles'),
  },
];
