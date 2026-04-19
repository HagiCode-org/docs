import fs from 'node:fs';
import path from 'node:path';

export const blogLocaleConfigs = [
  {
    locale: 'zh',
    label: 'zh-CN',
    relativeDir: 'src/content/docs/blog',
  },
  {
    locale: 'en',
    label: 'en-US',
    relativeDir: 'src/content/docs/en/blog',
  },
];

export const localeThresholds = {
  zh: {
    recommendedMin: 36,
    recommendedMax: 80,
    targetMax: 84,
    hardMax: 96,
  },
  en: {
    recommendedMin: 90,
    recommendedMax: 156,
    targetMax: 160,
    hardMax: 180,
  },
};

export const defaultSyncReportPath = '.tmp/blog-seo-description-sync-report.json';
export const defaultVerifyReportPath = '.tmp/blog-seo-description-report.json';
export const lowScoreThreshold = 75;

const EN_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
  'your',
]);

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

export function getLocaleThresholds(locale) {
  return localeThresholds[locale] ?? localeThresholds.zh;
}

export function splitFrontmatter(source) {
  if (!source.startsWith('---\n')) {
    throw new Error('Expected MDX frontmatter to start with `---`.');
  }

  const end = source.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error('Unable to locate the closing frontmatter fence.');
  }

  const frontmatter = source.slice(4, end);
  const body = source.slice(end + 5);
  const bodyStartLine = frontmatter.split('\n').length + 3;

  return { frontmatter, body, bodyStartLine };
}

export function parseFrontmatterScalar(frontmatter, fieldName) {
  const pattern = new RegExp(`^${escapeForRegex(fieldName)}:\\s*(.*)$`, 'm');
  const match = frontmatter.match(pattern);
  if (!match) {
    return null;
  }

  let value = match[1].trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

export function parseFrontmatterTitle(frontmatter) {
  const title = parseFrontmatterScalar(frontmatter, 'title');
  if (!title) {
    throw new Error('Missing `title` in frontmatter.');
  }
  return title;
}

export function stripMarkdownToText(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDescriptionText(value, locale) {
  let normalized = stripMarkdownToText(value)
    .replace(/\s*([,.;!?])\s*/g, '$1 ')
    .replace(/\s*([，。！？；：、])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:!?，。！？；：、\-\s]+/, '')
    .trim();

  if (locale === 'zh') {
    normalized = normalized
      .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
      .replace(/([\u4e00-\u9fff])\s+([，。！？；：、])/g, '$1$2')
      .replace(/([（【《“‘])\s+/g, '$1')
      .replace(/\s+([）】》”’])/g, '$1');
  }

  return compactTechTokens(normalized).trim();
}

export function comparableText(value, locale) {
  return normalizeDescriptionText(value, locale)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
}

export function textLength(value) {
  return Array.from(value ?? '').length;
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactTechTokens(value) {
  return value
    .replace(/\b([A-Za-z]+)\.\s+(js|ts|mdx|md|json|yaml|yml|xml|html|css)\b/gi, '$1.$2')
    .replace(/\b([A-Za-z]+)\.\s+(Libs)\b/g, '$1.$2')
    .replace(/\b([A-Z]{2,})\.\s+([A-Z]{2,})\b/g, '$1.$2')
    .replace(/(^|[\s(])\.\s*NET\b/g, '$1.NET')
    .replace(/\b([a-z]{1,12})\.\s+NET\b/g, '$1 .NET')
    .replace(/([\u4e00-\u9fff])\.\s+NET\b/g, '$1 .NET')
    .replace(/(\d)\.\s+([a-z0-9])/g, '$1.$2');
}

function classifyBlock(block) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  if (lines.every((line) => line.startsWith('import ') || line.startsWith('export '))) {
    return null;
  }

  if (lines.every((line) => /^#{1,6}\s+/.test(line))) {
    return { type: 'heading', text: stripMarkdownToText(lines.join(' ')) };
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    return {
      type: 'quote',
      text: normalizeDescriptionText(lines.map((line) => line.replace(/^>\s?/, '')).join(' '), 'en'),
    };
  }

  if (lines.every((line) => /^([-*+]\s+|\d+\.\s+)/.test(line))) {
    return {
      type: 'list',
      text: normalizeDescriptionText(
        lines.map((line) => line.replace(/^([-*+]\s+|\d+\.\s+)/, '')).join(' '),
        'en'
      ),
    };
  }

  if (lines[0].startsWith('<') && !lines.some((line) => /[.!?。！？：:]/.test(line))) {
    return null;
  }

  if (lines.every((line) => /^!\[/.test(line))) {
    return null;
  }

  return {
    type: 'paragraph',
    text: normalizeDescriptionText(lines.join(' '), 'en'),
  };
}

function collectBodyBlocks(body) {
  const blocks = [];
  const lines = body.split('\n');
  let activeFence = null;
  let current = [];

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (activeFence === null) {
        flush();
        activeFence = marker;
      } else if (activeFence === marker) {
        activeFence = null;
      }
      continue;
    }

    if (activeFence !== null) {
      continue;
    }

    if (trimmed.length === 0) {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks.map(classifyBlock).filter(Boolean);
}

function isBoilerplateParagraph(text, locale) {
  const normalized = normalizeDescriptionText(text, locale);
  if (!normalized) {
    return true;
  }

  if (/^note\[[^\]]+\]/i.test(normalized)) {
    return true;
  }

  if (locale === 'zh') {
    return (
      /^时间语境说明/.test(normalized) ||
      /^全民制作人们大家好/.test(normalized) ||
      /^大家好/.test(normalized) ||
      /^我是[^，。；]{1,24}[，,]/.test(normalized)
    );
  }

  return (
    /^time context notice/i.test(normalized) ||
    /^hello everyone/i.test(normalized) ||
    /^hi everyone/i.test(normalized) ||
    /^i am [^,.]{1,40}[,.]/i.test(normalized)
  );
}

export function extractLeadContent(body, locale) {
  const blocks = collectBodyBlocks(body);
  const quote = blocks.find((block) => block.type === 'quote' && textLength(block.text) >= 16)?.text ?? null;
  const paragraphs = blocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => normalizeDescriptionText(block.text, locale))
    .filter(Boolean);

  const leadParagraph =
    paragraphs.find((paragraph) => !isBoilerplateParagraph(paragraph, locale)) ??
    paragraphs.find(Boolean) ??
    null;

  return {
    quote: quote ? normalizeDescriptionText(quote, locale) : null,
    leadParagraph,
  };
}

function trimDescription(text, locale, maxLength) {
  if (textLength(text) <= maxLength) {
    return text.trim();
  }

  if (locale === 'en') {
    const words = text.split(/\s+/);
    let result = '';

    for (const word of words) {
      const next = result ? `${result} ${word}` : word;
      if (textLength(next) > maxLength) {
        break;
      }
      result = next;
    }

    if (result) {
      return result.replace(/[\s,;:/-]+$/, '').trim();
    }
  }

  return Array.from(text)
    .slice(0, maxLength)
    .join('')
    .replace(/[，。！？；：、,;:!?/\-\s]+$/, '')
    .trim();
}

function descriptionsEquivalent(left, right, locale) {
  const leftComparable = comparableText(left, locale);
  const rightComparable = comparableText(right, locale);
  return Boolean(leftComparable) && leftComparable === rightComparable;
}

function extractTitleKeywords(title, locale) {
  if (locale === 'en') {
    return Array.from(
      new Set(
        (normalizeDescriptionText(title, locale).toLowerCase().match(/[a-z0-9+#.-]+/g) ?? []).filter(
          (word) => word.length >= 4 && !EN_STOP_WORDS.has(word)
        )
      )
    );
  }

  return Array.from(
    new Set(
      (normalizeDescriptionText(title, locale).match(/[\u4e00-\u9fffA-Za-z0-9+#.-]{2,}/gu) ?? []).filter(
        (word) => textLength(word) >= 2
      )
    )
  );
}

function hasWeakKeywordSignal(description, title, locale) {
  const keywords = extractTitleKeywords(title, locale).slice(0, 6);
  if (keywords.length === 0) {
    return false;
  }

  const normalizedDescription = normalizeDescriptionText(description, locale).toLowerCase();
  const hits = keywords.filter((keyword) => normalizedDescription.includes(keyword.toLowerCase()));
  return hits.length === 0;
}

function hasGenericOpening(description, title, locale) {
  const normalizedDescription = normalizeDescriptionText(description, locale);
  if (!normalizedDescription) {
    return false;
  }

  if (!hasWeakKeywordSignal(description, title, locale)) {
    return false;
  }

  if (locale === 'zh') {
    return /^本文(将|会|主要|重点)?/.test(normalizedDescription) || /^这篇文章(将|会|主要)?/.test(normalizedDescription);
  }

  return /^this (article|post) (covers|explains|introduces|walks through)/i.test(normalizedDescription) || /^in this (article|post)/i.test(normalizedDescription);
}

export function generateDescriptionCandidate({ title, quote, leadParagraph, locale }) {
  const thresholds = getLocaleThresholds(locale);
  const normalizedTitle = normalizeDescriptionText(title, locale);
  const normalizedQuote = quote ? normalizeDescriptionText(quote, locale) : null;
  const normalizedLead = leadParagraph ? normalizeDescriptionText(leadParagraph, locale) : null;
  const separator = locale === 'zh' ? '：' : ': ';

  let text = null;
  let sourceType = null;
  const quoteLooksTooGeneric =
    normalizedQuote &&
    hasWeakKeywordSignal(normalizedQuote, normalizedTitle, locale) &&
    hasGenericOpening(normalizedQuote, normalizedTitle, locale);

  if (normalizedQuote && !quoteLooksTooGeneric && !descriptionsEquivalent(normalizedQuote, normalizedTitle, locale)) {
    text = normalizedQuote;
    sourceType = 'generated-quote';
  }

  if (!text && normalizedLead && !descriptionsEquivalent(normalizedLead, normalizedTitle, locale)) {
    text = normalizedLead;
    sourceType = 'generated-lead';
  }

  if (!text && normalizedQuote) {
    text = normalizedQuote;
    sourceType = 'generated-quote';
  }

  if (!text && normalizedLead) {
    text = normalizedLead;
    sourceType = 'generated-lead';
  }

  if (!text) {
    return null;
  }

  const shouldPrefixTitle =
    hasWeakKeywordSignal(text, normalizedTitle, locale) ||
    textLength(text) < Math.floor(thresholds.recommendedMin * 0.75);

  if (shouldPrefixTitle && !text.startsWith(normalizedTitle)) {
    text = normalizeDescriptionText(`${normalizedTitle}${separator}${text}`, locale);
    sourceType = sourceType === 'generated-quote' ? 'generated-title+quote' : 'generated-title+lead';
  }

  text = trimDescription(text, locale, thresholds.targetMax);

  if (hasWeakKeywordSignal(text, normalizedTitle, locale) && !text.startsWith(normalizedTitle)) {
    text = trimDescription(normalizeDescriptionText(`${normalizedTitle}${separator}${text}`, locale), locale, thresholds.targetMax);
    sourceType = sourceType === 'generated-quote' ? 'generated-title+quote' : 'generated-title+lead';
  }

  if (descriptionsEquivalent(text, normalizedTitle, locale) && normalizedLead && !descriptionsEquivalent(normalizedLead, normalizedTitle, locale)) {
    text = trimDescription(normalizeDescriptionText(`${normalizedTitle}${separator}${normalizedLead}`, locale), locale, thresholds.targetMax);
    sourceType = 'generated-title+lead';
  }

  if (descriptionsEquivalent(text, normalizedTitle, locale) && normalizedQuote && !descriptionsEquivalent(normalizedQuote, normalizedTitle, locale)) {
    text = trimDescription(normalizeDescriptionText(`${normalizedTitle}${separator}${normalizedQuote}`, locale), locale, thresholds.targetMax);
    sourceType = 'generated-title+quote';
  }

  return {
    text,
    sourceType,
  };
}

export function scoreDescription({ description, title, locale, sourceType }) {
  const thresholds = getLocaleThresholds(locale);
  const normalizedDescription = normalizeDescriptionText(description ?? '', locale);
  const normalizedTitle = normalizeDescriptionText(title ?? '', locale);
  const length = textLength(normalizedDescription);
  const failures = [];
  const suggestions = [];
  let score = sourceType === 'manual' ? 92 : 84;

  if (!normalizedDescription) {
    failures.push('description-empty');
    return {
      score: 0,
      length,
      thresholds,
      failures,
      suggestions,
      publishable: false,
    };
  }

  if (descriptionsEquivalent(normalizedDescription, normalizedTitle, locale)) {
    failures.push('title-duplicate');
    score -= 40;
  }

  if (length > thresholds.hardMax) {
    failures.push('hard-max-exceeded');
    score -= 30;
  }

  if (length < thresholds.recommendedMin) {
    suggestions.push('too-short');
    score -= 12;
  }

  if (length > thresholds.recommendedMax) {
    suggestions.push('too-long');
    score -= 8;
  }

  if (hasWeakKeywordSignal(normalizedDescription, normalizedTitle, locale)) {
    suggestions.push('weak-keyword-signal');
    score -= 8;
  }

  if (hasGenericOpening(normalizedDescription, normalizedTitle, locale)) {
    suggestions.push('generic-opening');
    score -= 6;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    length,
    thresholds,
    failures,
    suggestions,
    publishable: failures.length === 0,
  };
}

export function listBlogSeoEntries({ rootDir = process.cwd() } = {}) {
  return blogLocaleConfigs.flatMap((config) => {
    const directory = path.resolve(rootDir, config.relativeDir);
    if (!fs.existsSync(directory)) {
      throw new Error(`Missing blog content directory: ${directory}`);
    }

    return fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
      .sort()
      .map((name) => {
        const fullPath = path.join(directory, name);
        const relativePath = toPosixPath(path.relative(rootDir, fullPath));
        const source = fs.readFileSync(fullPath, 'utf8');
        const { frontmatter, body } = splitFrontmatter(source);
        const { quote, leadParagraph } = extractLeadContent(body, config.locale);
        return {
          locale: config.locale,
          localeLabel: config.label,
          fullPath,
          relativePath,
          slug: name.replace(/\.(md|mdx)$/i, ''),
          source,
          frontmatter,
          body,
          title: parseFrontmatterTitle(frontmatter),
          existingDescription: parseFrontmatterScalar(frontmatter, 'description'),
          leadQuote: quote,
          leadParagraph,
        };
      });
  });
}

export function analyzeBlogSeoEntry(entry) {
  const existingDescription = entry.existingDescription === null ? null : normalizeDescriptionText(entry.existingDescription, entry.locale);
  const candidate = generateDescriptionCandidate({
    title: entry.title,
    quote: entry.leadQuote,
    leadParagraph: entry.leadParagraph,
    locale: entry.locale,
  });

  const hasManualDescription = entry.existingDescription !== null;
  const resolvedDescription = hasManualDescription ? existingDescription : candidate?.text ?? '';
  const sourceType = hasManualDescription ? 'manual' : candidate?.sourceType ?? 'missing';
  const evaluation = scoreDescription({
    description: resolvedDescription,
    title: entry.title,
    locale: entry.locale,
    sourceType,
  });

  return {
    ...entry,
    existingDescription,
    candidateDescription: candidate?.text ?? null,
    candidateSourceType: candidate?.sourceType ?? null,
    resolvedDescription,
    sourceType,
    evaluation,
    shouldWriteMissing: !hasManualDescription && Boolean(candidate?.text),
    canRepairUnusable: hasManualDescription && Boolean(candidate?.text) && evaluation.failures.some((failure) => failure === 'description-empty' || failure === 'title-duplicate' || failure === 'hard-max-exceeded'),
  };
}

export function analyzeBlogSeoEntries(options = {}) {
  return listBlogSeoEntries(options).map(analyzeBlogSeoEntry);
}

function toYamlDoubleQuotedScalar(value) {
  return JSON.stringify(value);
}

export function upsertFrontmatterDescription(frontmatter, description) {
  const line = `description: ${toYamlDoubleQuotedScalar(description)}`;
  const existingPattern = /^description:\s*.*$/m;

  if (existingPattern.test(frontmatter)) {
    return frontmatter.replace(existingPattern, line);
  }

  const lines = frontmatter.split('\n');
  const insertAt = lines.findIndex((candidate) => /^(seo|workflow):/.test(candidate));
  if (insertAt === -1) {
    lines.push(line);
  } else {
    lines.splice(insertAt, 0, line);
  }

  return lines.join('\n');
}

export function applyDescriptionToSource(source, description) {
  const { frontmatter, body } = splitFrontmatter(source);
  const updatedFrontmatter = upsertFrontmatterDescription(frontmatter, description);
  return `---\n${updatedFrontmatter}\n---\n${body}`;
}

export function writeJsonReport(reportPath, payload, { rootDir = process.cwd() } = {}) {
  const fullPath = path.resolve(rootDir, reportPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return fullPath;
}

export function buildBlogSeoReport(analyses) {
  const summary = {
    total: analyses.length,
    manual: analyses.filter((entry) => entry.sourceType === 'manual').length,
    generated: analyses.filter((entry) => entry.sourceType.startsWith('generated')).length,
    missing: analyses.filter((entry) => entry.sourceType === 'missing').length,
    failing: analyses.filter((entry) => entry.evaluation.failures.length > 0).length,
    lowScore: analyses.filter(
      (entry) => entry.evaluation.failures.length === 0 && entry.evaluation.score < lowScoreThreshold
    ).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    entries: analyses.map((entry) => ({
      relativePath: entry.relativePath,
      locale: entry.locale,
      title: entry.title,
      sourceType: entry.sourceType,
      candidateSourceType: entry.candidateSourceType,
      description: entry.resolvedDescription,
      candidateDescription: entry.candidateDescription,
      leadQuote: entry.leadQuote,
      leadParagraph: entry.leadParagraph,
      score: entry.evaluation.score,
      length: entry.evaluation.length,
      thresholds: entry.evaluation.thresholds,
      publishable: entry.evaluation.publishable,
      failures: entry.evaluation.failures,
      suggestions: entry.evaluation.suggestions,
    })),
  };
}
