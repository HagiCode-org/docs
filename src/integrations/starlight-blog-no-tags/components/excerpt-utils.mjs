const DEFAULT_MAX_EXCERPT_LENGTH = 220;
const EXCERPT_DELIMITER_PATTERN = /<!--\s*excerpt\s*-->|\/\*\s*excerpt\s*\*\//giu;

export function resolveBlogEntryExcerpt(entry, options = {}) {
  const maxLength = options.maxLength ?? DEFAULT_MAX_EXCERPT_LENGTH;
  const explicitExcerpt = normalizeOptionalString(entry?.data?.excerpt);
  if (explicitExcerpt) {
    return truncateText(explicitExcerpt, maxLength);
  }

  const description = normalizeOptionalString(entry?.data?.description);
  if (description) {
    return truncateText(description, maxLength);
  }

  const body = typeof entry?.body === 'string' ? entry.body : '';
  return createExcerptFromMarkdown(body, { maxLength });
}

export function createExcerptFromMarkdown(markdown, options = {}) {
  const maxLength = options.maxLength ?? DEFAULT_MAX_EXCERPT_LENGTH;
  const normalized = normalizeMarkdownText(markdown);

  if (!normalized) {
    return '';
  }

  return truncateText(normalized, maxLength);
}

export function truncateText(value, maxLength = DEFAULT_MAX_EXCERPT_LENGTH) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const hardLimit = Math.max(1, maxLength - 3);
  const sliced = normalized.slice(0, hardLimit + 1);
  const softBreakIndex = sliced.lastIndexOf(' ');
  const cutIndex = softBreakIndex >= Math.floor(hardLimit * 0.6) ? softBreakIndex : hardLimit;

  return `${normalized.slice(0, cutIndex).trimEnd()}...`;
}

function normalizeMarkdownText(markdown) {
  return String(markdown ?? '')
    .split(EXCERPT_DELIMITER_PATTERN, 1)[0]
    .replace(/^import\s.+$/gmu, ' ')
    .replace(/^export\s.+$/gmu, ' ')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/~~~[\s\S]*?~~~/gu, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^>+\s?/gmu, '')
    .replace(/^[-*+]\s+/gmu, '')
    .replace(/^\d+\.\s+/gmu, '')
    .replace(/\|/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/gu, ' ').trim();
}

