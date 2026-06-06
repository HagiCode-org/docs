import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const TIPS_SNAPSHOT_PATH = path.resolve(process.cwd(), 'src', 'data', 'tips.snapshot.json');
const SOURCE_TIPS_SNAPSHOT_PATH = path.resolve(LIB_DIR, '..', 'data', 'tips.snapshot.json');
const DEFAULT_INDEX_ORIGIN = 'https://index.hagicode.com';

export const TIPS_LOCALES = [
  'zh-CN',
  'zh-Hant',
  'en-US',
  'ja-JP',
  'ko-KR',
  'de-DE',
  'fr-FR',
  'es-ES',
  'pt-BR',
  'ru-RU',
];

const TIP_CATEGORY_LABELS = {
  'zh-CN': {
    project: '项目管理',
    proposal: '提案与范围',
    session: '会话协作',
    'multi-session': '多会话协同',
    agent: 'Agent 分工',
    claude: 'Claude 使用',
    codex: 'Codex 使用',
    'code-server': 'code-server',
    omniroute: 'OmniRoute',
    hagipower: 'HagiPower',
  },
  'zh-Hant': {
    project: '專案管理',
    proposal: '提案與範圍',
    session: '會話協作',
    'multi-session': '多會話協同',
    agent: 'Agent 分工',
    claude: 'Claude 使用',
    codex: 'Codex 使用',
    'code-server': 'code-server',
    omniroute: 'OmniRoute',
    hagipower: 'HagiPower',
  },
  'en-US': {
    project: 'Project Setup',
    proposal: 'Proposals and Scope',
    session: 'Session Workflow',
    'multi-session': 'Multi-Session Coordination',
    agent: 'Agent Roles',
    claude: 'Using Claude',
    codex: 'Using Codex',
    'code-server': 'code-server',
    omniroute: 'OmniRoute',
    hagipower: 'HagiPower',
  },
};

const ARTICLE_COPY = {
  'zh-CN': {
    intro: '这篇 FAQ 会读取文档站在发布构建时同步下来的 Index tips 快照，并按主题整理成便于浏览的建议清单。',
    empty: '当前还没有可展示的 tips 快照。下次发布构建时会自动从 Index 同步最新数据。',
    updatedAtLabel: '数据更新时间',
    totalLabel: '{count} 条 tips',
    dataLocaleLabel: '数据语言',
    sourceLabel: '查看 Index 原始 JSON',
    groupCountLabel: '{count} 条',
  },
  'zh-Hant': {
    intro: '這篇 FAQ 會讀取文件站在發佈建置時同步下來的 Index tips 快照，並按主題整理成便於瀏覽的建議清單。',
    empty: '目前還沒有可展示的 tips 快照。下次發佈建置時會自動從 Index 同步最新資料。',
    updatedAtLabel: '資料更新時間',
    totalLabel: '{count} 條 tips',
    dataLocaleLabel: '資料語言',
    sourceLabel: '檢視 Index 原始 JSON',
    groupCountLabel: '{count} 條',
  },
  'en-US': {
    intro: 'This FAQ reads the tips snapshot synchronized from Index during docs release builds and groups the advice into a browsable article.',
    empty: 'No tips snapshot is available yet. The next release build will automatically synchronize fresh data from Index.',
    updatedAtLabel: 'Updated',
    totalLabel: '{count} tips',
    dataLocaleLabel: 'Data locale',
    sourceLabel: 'View source JSON on Index',
    groupCountLabel: '{count} items',
  },
};

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveTipsSnapshotPath() {
  if (fs.existsSync(TIPS_SNAPSHOT_PATH)) {
    return TIPS_SNAPSHOT_PATH;
  }

  return SOURCE_TIPS_SNAPSHOT_PATH;
}

function canonicalizeLocale(locale) {
  const candidate = String(locale ?? '').trim().replace(/_/gu, '-');
  if (!candidate) {
    return '';
  }

  if (candidate === 'root') {
    return 'zh-CN';
  }

  if (candidate === 'en') {
    return 'en-US';
  }

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate;
  } catch {
    return candidate;
  }
}

function humanizeCategory(category, locale) {
  const labels = TIP_CATEGORY_LABELS[locale] ?? TIP_CATEGORY_LABELS['en-US'];
  if (labels[category]) {
    return labels[category];
  }

  const normalized = String(category ?? '').trim().replace(/-/gu, ' ');
  if (!normalized) {
    return locale === 'zh-CN' || locale === 'zh-Hant' ? '其他' : 'Other';
  }

  if (locale.startsWith('zh')) {
    return normalized;
  }

  return normalized.replace(/\b\w/gu, (match) => match.toUpperCase());
}

export function resolveTipsLocale(locale) {
  const canonicalLocale = canonicalizeLocale(locale);
  if (TIPS_LOCALES.includes(canonicalLocale)) {
    return canonicalLocale;
  }

  const language = canonicalLocale.toLowerCase().split('-')[0];
  switch (language) {
    case 'zh':
      return 'zh-CN';
    case 'en':
      return 'en-US';
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'pt':
      return 'pt-BR';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

function buildLocaleFallbacks(locale) {
  const resolvedLocale = resolveTipsLocale(locale);
  const fallbackOrder = new Set([resolvedLocale]);

  if (resolvedLocale === 'zh-Hant') {
    fallbackOrder.add('zh-CN');
  }

  fallbackOrder.add('en-US');
  fallbackOrder.add('zh-CN');

  return [...fallbackOrder];
}

function formatCopy(copy, templateKey, count) {
  return (copy[templateKey] ?? '').replace('{count}', String(count));
}

export function loadManagedTipsSnapshot(snapshotPath = resolveTipsSnapshotPath()) {
  return readJsonFile(snapshotPath, {
    generatedAt: null,
    source: {
      origin: DEFAULT_INDEX_ORIGIN,
      locales: {},
    },
    locales: {},
  });
}

export function getManagedTipsArticle(locale = 'zh-CN') {
  const resolvedLocale = resolveTipsLocale(locale);
  const snapshot = loadManagedTipsSnapshot();
  const fallbackLocales = buildLocaleFallbacks(resolvedLocale);
  const selectedLocale = fallbackLocales.find((candidate) => Array.isArray(snapshot.locales?.[candidate]?.tips)) ?? resolvedLocale;
  const payload = snapshot.locales?.[selectedLocale] ?? null;
  const copy = ARTICLE_COPY[resolvedLocale] ?? ARTICLE_COPY['en-US'];
  const tips = Array.isArray(payload?.tips) ? payload.tips : [];
  const groupedTips = new Map();

  for (const tip of tips) {
    const category = typeof tip?.category === 'string' && tip.category.trim().length > 0
      ? tip.category.trim()
      : 'other';

    if (!groupedTips.has(category)) {
      groupedTips.set(category, []);
    }

    groupedTips.get(category).push({
      id: typeof tip?.id === 'string' ? tip.id : '',
      text: typeof tip?.text === 'string' ? tip.text : '',
    });
  }

  const groups = [...groupedTips.entries()].map(([category, entries]) => ({
    id: category,
    label: humanizeCategory(category, resolvedLocale),
    countLabel: formatCopy(copy, 'groupCountLabel', entries.length),
    tips: entries,
  }));

  const sourceUrl = snapshot.source?.locales?.[selectedLocale]
    ?? `${snapshot.source?.origin ?? DEFAULT_INDEX_ORIGIN}/tips-${selectedLocale}.json`;

  return {
    copy,
    locale: resolvedLocale,
    dataLocale: payload?.locale ?? selectedLocale,
    updatedAt: payload?.updatedAt ?? null,
    totalTips: tips.length,
    totalLabel: formatCopy(copy, 'totalLabel', tips.length),
    groups,
    sourceUrl,
  };
}
