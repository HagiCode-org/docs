import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCS_ROUTE_LOCALE_OPTIONS,
  getTranslationDirectoryByRouteLocale,
} from '../lib/docs-content-paths.mjs';
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
  'it-IT': {
    productOverview: 'Panoramica del prodotto',
    quickStart: 'Avvio rapido',
    installationGuide: 'Guida all’installazione',
    faq: 'FAQ',
    relatedSoftwareInstallation: 'Installazione del software correlato',
    guides: 'Guide',
    llmGuide: 'Guida LLM',
    aiServiceSubscriptions: 'Abbonamenti ai servizi IA',
    legal: 'Documenti legali',
    releaseNotes: 'Note di rilascio',
    dlc: 'DLC',
    bundles: 'Pacchetti',
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
  'bg-BG': {
    productOverview: 'Общ преглед на продукта',
    quickStart: 'Бърз старт',
    installationGuide: 'Ръководство за инсталиране',
    faq: 'Често задавани въпроси',
    relatedSoftwareInstallation: 'Инсталиране на свързан софтуер',
    guides: 'Ръководства',
    llmGuide: 'Ръководство за LLM',
    aiServiceSubscriptions: 'Абонаменти за AI услуги',
    legal: 'Правни документи',
    releaseNotes: 'Бележки по изданието',
    dlc: 'DLC',
    bundles: 'Пакети',
  },
  'cs-CZ': {
    productOverview: 'Přehled produktu',
    quickStart: 'Rychlý start',
    installationGuide: 'Instalační příručka',
    faq: 'Časté dotazy',
    relatedSoftwareInstallation: 'Instalace souvisejícího softwaru',
    guides: 'Příručky',
    llmGuide: 'LLM příručka',
    aiServiceSubscriptions: 'Předplatné AI služeb',
    legal: 'Právní dokumenty',
    releaseNotes: 'Poznámky k vydání',
    dlc: 'DLC',
    bundles: 'Balíčky',
  },
  'da-DK': {
    productOverview: 'Produktoversigt',
    quickStart: 'Hurtig start',
    installationGuide: 'Installationsvejledning',
    faq: 'Ofte stillede spørgsmål',
    relatedSoftwareInstallation: 'Installation af relateret software',
    guides: 'Vejledninger',
    llmGuide: 'LLM-guide',
    aiServiceSubscriptions: 'AI-tjenesteabonnementer',
    legal: 'Juridiske dokumenter',
    releaseNotes: 'Udgivelsesnoter',
    dlc: 'DLC',
    bundles: 'Pakker',
  },
  'nl-NL': {
    productOverview: 'Productoverzicht',
    quickStart: 'Snel aan de slag',
    installationGuide: 'Installatiehandleiding',
    faq: 'Veelgestelde vragen',
    relatedSoftwareInstallation: 'Installatie van gerelateerde software',
    guides: 'Handleidingen',
    llmGuide: 'LLM-handleiding',
    aiServiceSubscriptions: 'AI-serviceabonnementen',
    legal: 'Juridische documenten',
    releaseNotes: 'Release-opmerkingen',
    dlc: 'DLC',
    bundles: 'Bundels',
  },
  'fi-FI': {
    productOverview: 'Tuotteen yleiskatsaus',
    quickStart: 'Pika-aloitus',
    installationGuide: 'Asennusopas',
    faq: 'Usein kysytyt kysymykset',
    relatedSoftwareInstallation: 'Liittyvien ohjelmistojen asennus',
    guides: 'Oppaat',
    llmGuide: 'LLM-opas',
    aiServiceSubscriptions: 'AI-palvelutilaukset',
    legal: 'Oikeudelliset asiakirjat',
    releaseNotes: 'Julkaisutiedot',
    dlc: 'DLC',
    bundles: 'Paketit',
  },
  'el-GR': {
    productOverview: 'Επισκόπηση προϊόντος',
    quickStart: 'Γρήγορη έναρξη',
    installationGuide: 'Οδηγός εγκατάστασης',
    faq: 'Συχνές ερωτήσεις',
    relatedSoftwareInstallation: 'Εγκατάσταση σχετικού λογισμικού',
    guides: 'Οδηγοί',
    llmGuide: 'Οδηγός LLM',
    aiServiceSubscriptions: 'Συνδρομές υπηρεσιών AI',
    legal: 'Νομικά έγγραφα',
    releaseNotes: 'Σημειώσεις έκδοσης',
    dlc: 'DLC',
    bundles: 'Πακέτα',
  },
  'hu-HU': {
    productOverview: 'Termékáttekintés',
    quickStart: 'Gyors kezdés',
    installationGuide: 'Telepítési útmutató',
    faq: 'GYIK',
    relatedSoftwareInstallation: 'Kapcsolódó szoftverek telepítése',
    guides: 'Útmutatók',
    llmGuide: 'LLM útmutató',
    aiServiceSubscriptions: 'MI-szolgáltatás-előfizetések',
    legal: 'Jogi dokumentumok',
    releaseNotes: 'Kiadási megjegyzések',
    dlc: 'DLC',
    bundles: 'Csomagok',
  },
  'id-ID': {
    productOverview: 'Ikhtisar produk',
    quickStart: 'Mulai Cepat',
    installationGuide: 'Panduan Instalasi',
    faq: 'FAQ',
    relatedSoftwareInstallation: 'Instalasi Perangkat Lunak Terkait',
    guides: 'Panduan',
    llmGuide: 'Panduan LLM',
    aiServiceSubscriptions: 'Langganan Layanan AI',
    legal: 'Dokumen Hukum',
    releaseNotes: 'Catatan Rilis',
    dlc: 'DLC',
    bundles: 'Bundel',
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
  'nb-NO': {
    productOverview: 'Produktoversikt',
    quickStart: 'Hurtigstart',
    installationGuide: 'Installasjonsveiledning',
    faq: 'Vanlige spørsmål',
    relatedSoftwareInstallation: 'Installasjon av relatert programvare',
    guides: 'Veiledninger',
    llmGuide: 'LLM-veiledning',
    aiServiceSubscriptions: 'Abonnementer på AI-tjenester',
    legal: 'Juridiske dokumenter',
    releaseNotes: 'Utgivelsesnotater',
    dlc: 'DLC',
    bundles: 'Pakker',
  },
  'pl-PL': {
    productOverview: 'Przegląd produktu',
    quickStart: 'Szybki start',
    installationGuide: 'Przewodnik instalacji',
    faq: 'Często zadawane pytania',
    relatedSoftwareInstallation: 'Instalacja powiązanego oprogramowania',
    guides: 'Przewodniki',
    llmGuide: 'Przewodnik po LLM',
    aiServiceSubscriptions: 'Subskrypcje usług AI',
    legal: 'Dokumenty prawne',
    releaseNotes: 'Informacje o wydaniu',
    dlc: 'DLC',
    bundles: 'Pakiety',
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
  'pt-PT': {
    productOverview: 'Visão geral do produto',
    quickStart: 'Início rápido',
    installationGuide: 'Guia de instalação',
    faq: 'Perguntas frequentes',
    relatedSoftwareInstallation: 'Instalação de software relacionado',
    guides: 'Guias',
    llmGuide: 'Guia de LLM',
    aiServiceSubscriptions: 'Subscrições de serviços de IA',
    legal: 'Documentos legais',
    releaseNotes: 'Notas de lançamento',
    dlc: 'DLC',
    bundles: 'Pacotes',
  },
  'ro-RO': {
    productOverview: 'Prezentare generală a produsului',
    quickStart: 'Pornire rapidă',
    installationGuide: 'Ghid de instalare',
    faq: 'Întrebări frecvente',
    relatedSoftwareInstallation: 'Instalarea software-ului conex',
    guides: 'Ghiduri',
    llmGuide: 'Ghid LLM',
    aiServiceSubscriptions: 'Abonamente la servicii AI',
    legal: 'Documente legale',
    releaseNotes: 'Note de lansare',
    dlc: 'DLC',
    bundles: 'Pachete',
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
  'es-419': {
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
  'sv-SE': {
    productOverview: 'Produktöversikt',
    quickStart: 'Snabbstart',
    installationGuide: 'Installationsguide',
    faq: 'Vanliga frågor',
    relatedSoftwareInstallation: 'Installation av relaterad programvara',
    guides: 'Guider',
    llmGuide: 'LLM-guide',
    aiServiceSubscriptions: 'AI-tjänsteabonnemang',
    legal: 'Juridiska dokument',
    releaseNotes: 'Versionsanteckningar',
    dlc: 'DLC',
    bundles: 'Paket',
  },
  'th-TH': {
    productOverview: 'ภาพรวมผลิตภัณฑ์',
    quickStart: 'เริ่มต้นอย่างรวดเร็ว',
    installationGuide: 'คู่มือการติดตั้ง',
    faq: 'คำถามที่พบบ่อย',
    relatedSoftwareInstallation: 'การติดตั้งซอฟต์แวร์ที่เกี่ยวข้อง',
    guides: 'คู่มือ',
    llmGuide: 'คู่มือ LLM',
    aiServiceSubscriptions: 'การสมัครใช้บริการ AI',
    legal: 'เอกสารทางกฎหมาย',
    releaseNotes: 'บันทึกประจำรุ่น',
    dlc: 'DLC',
    bundles: 'ชุดรวม',
  },
  'tr-TR': {
    productOverview: 'Ürün genel bakışı',
    quickStart: 'Hızlı başlangıç',
    installationGuide: 'Kurulum kılavuzu',
    faq: 'Sık sorulan sorular',
    relatedSoftwareInstallation: 'İlgili yazılım kurulumu',
    guides: 'Kılavuzlar',
    llmGuide: 'LLM kılavuzu',
    aiServiceSubscriptions: 'AI hizmet abonelikleri',
    legal: 'Yasal belgeler',
    releaseNotes: 'Sürüm notları',
    dlc: 'DLC',
    bundles: 'Paketler',
  },
  'uk-UA': {
    productOverview: 'Огляд продукту',
    quickStart: 'Швидкий старт',
    installationGuide: 'Посібник з інсталяції',
    faq: 'Поширені запитання',
    relatedSoftwareInstallation: 'Встановлення пов’язаного програмного забезпечення',
    guides: 'Посібники',
    llmGuide: 'Посібник з LLM',
    aiServiceSubscriptions: 'Підписки на AI-сервіси',
    legal: 'Юридичні документи',
    releaseNotes: 'Примітки до випуску',
    dlc: 'DLC',
    bundles: 'Набори',
  },
  'vi-VN': {
    productOverview: 'Tổng quan sản phẩm',
    quickStart: 'Bắt đầu nhanh',
    installationGuide: 'Hướng dẫn cài đặt',
    faq: 'Câu hỏi thường gặp',
    relatedSoftwareInstallation: 'Cài đặt phần mềm liên quan',
    guides: 'Hướng dẫn',
    llmGuide: 'Hướng dẫn LLM',
    aiServiceSubscriptions: 'Gói đăng ký dịch vụ AI',
    legal: 'Tài liệu pháp lý',
    releaseNotes: 'Ghi chú phát hành',
    dlc: 'DLC',
    bundles: 'Gói',
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
    items: createAutogeneratedItems('faq'),
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
