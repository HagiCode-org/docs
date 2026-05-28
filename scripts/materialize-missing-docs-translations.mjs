import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCS_BASELINE_AUTHORING_ROOT,
  DOCS_TRANSLATIONS_AUTHORING_ROOT,
  isDocsLocaleDirectory,
} from '../src/lib/docs-content-paths.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDirectory, '..');
const contentRoot = path.join(docsRoot, DOCS_BASELINE_AUTHORING_ROOT);
const translationsRoot = path.join(docsRoot, DOCS_TRANSLATIONS_AUTHORING_ROOT);
const englishRoot = path.join(translationsRoot, 'en-US');
const targetLocales = [
  { code: 'zh-Hant', translateCode: 'zh-TW' },
  { code: 'ja-JP', translateCode: 'ja' },
  { code: 'ko-KR', translateCode: 'ko' },
  { code: 'de-DE', translateCode: 'de' },
  { code: 'fr-FR', translateCode: 'fr' },
  { code: 'es-ES', translateCode: 'es' },
  { code: 'pt-BR', translateCode: 'pt' },
  { code: 'ru-RU', translateCode: 'ru' },
  { code: 'it-IT', translateCode: 'it' },
  { code: 'nl-NL', translateCode: 'nl' },
  { code: 'pl-PL', translateCode: 'pl' },
  { code: 'tr-TR', translateCode: 'tr' },
  { code: 'sv-SE', translateCode: 'sv' },
  { code: 'da-DK', translateCode: 'da' },
  { code: 'fi-FI', translateCode: 'fi' },
  { code: 'nb-NO', translateCode: 'no' },
  { code: 'cs-CZ', translateCode: 'cs' },
  { code: 'hu-HU', translateCode: 'hu' },
  { code: 'ro-RO', translateCode: 'ro' },
  { code: 'bg-BG', translateCode: 'bg' },
  { code: 'el-GR', translateCode: 'el' },
  { code: 'uk-UA', translateCode: 'uk' },
  { code: 'vi-VN', translateCode: 'vi' },
  { code: 'th-TH', translateCode: 'th' },
  { code: 'id-ID', translateCode: 'id' },
  { code: 'pt-PT', translateCode: 'pt' },
  { code: 'es-419', translateCode: 'es' },
];
const separatorTemplate = '|||TRSEP_%ID%|||';
const tokenPattern = /@@TR_[0-9]+@@/gu;
const translatableFrontmatterKeys = new Set(['title', 'description']);
const translatablePropKeys = new Set(['title', 'description']);
const TRANSLATION_REQUEST_DELAY_MS = 800;
const TRANSLATION_MAX_RETRIES = 8;
const TRANSLATION_RETRY_BASE_DELAY_MS = 3000;
const FETCH_TIMEOUT_MS = 60_000;

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isMarkdownFile(fileName) {
  return /\.(?:md|mdx)$/u.test(fileName);
}

function hasTranslatableContent(value) {
  return /[A-Za-z]/u.test(value);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectBaselineDocs(currentDirectory, relativeDirectory = '') {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const docs = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (
        !relativeDirectory
        && (isDocsLocaleDirectory(entry.name) || entry.name === 'img')
      ) {
        continue;
      }

      docs.push(...await collectBaselineDocs(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile() && isMarkdownFile(entry.name)) {
      docs.push(relativePath);
    }
  }

  return docs;
}

function createTranslationRegistry() {
  let counter = 0;
  const byKey = new Map();
  const byToken = new Map();

  function request(locale, text) {
    const candidate = text.trim();
    if (!candidate || !hasTranslatableContent(candidate)) {
      return text;
    }

    const key = `${locale}\u0000${text}`;
    const existing = byKey.get(key);
    if (existing) {
      return existing;
    }

    const token = `@@TR_${counter}@@`;
    counter += 1;
    byKey.set(key, token);
    byToken.set(token, { locale, text });
    return token;
  }

  return {
    request,
    entries: byToken,
  };
}

function localizeDocsUrl(url, locale) {
  if (url === '/en-US') {
    return `/${locale}`;
  }

  if (url.startsWith('/en-US/')) {
    return `/${locale}${url.slice('/en-US'.length)}`;
  }

  return url;
}

function translatePlainSegment(text, locale, registry) {
  if (!text) {
    return text;
  }

  const match = text.match(/^(\s*)(.*?)(\s*)$/su);
  if (!match) {
    return text;
  }

  const [, leadingWhitespace, core, trailingWhitespace] = match;
  if (!core || !hasTranslatableContent(core)) {
    return text;
  }

  return `${leadingWhitespace}${registry.request(locale, core)}${trailingWhitespace}`;
}

function translateInlineMarkdown(text, locale, registry) {
  if (!text) {
    return text;
  }

  let result = '';
  let cursor = 0;
  const inlineCodePattern = /`[^`]+`/gu;

  for (const match of text.matchAll(inlineCodePattern)) {
    const [code] = match;
    const index = match.index ?? 0;
    result += translateInlineMarkdownWithoutCode(text.slice(cursor, index), locale, registry);
    result += code;
    cursor = index + code.length;
  }

  result += translateInlineMarkdownWithoutCode(text.slice(cursor), locale, registry);
  return result;
}

function translateInlineMarkdownWithoutCode(text, locale, registry) {
  const markdownLinkPattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/gu;
  let result = '';
  let cursor = 0;

  for (const match of text.matchAll(markdownLinkPattern)) {
    const [fullMatch, imageAlt, imageUrl, linkLabel, linkUrl] = match;
    const index = match.index ?? 0;
    result += translatePlainSegment(text.slice(cursor, index), locale, registry);

    if (imageAlt !== undefined) {
      result += `![${translateInlineMarkdown(imageAlt, locale, registry)}](${localizeDocsUrl(imageUrl, locale)})`;
    } else {
      result += `[${translateInlineMarkdown(linkLabel, locale, registry)}](${localizeDocsUrl(linkUrl, locale)})`;
    }

    cursor = index + fullMatch.length;
  }

  result += translatePlainSegment(text.slice(cursor), locale, registry);
  return result;
}

function translateYamlLine(line, locale, registry) {
  const match = line.match(/^(\s*)([A-Za-z0-9_-]+):(\s*)(.*)$/u);
  if (!match) {
    return line;
  }

  const [, indent, key, spacing, rawValue] = match;
  if (!translatableFrontmatterKeys.has(key) || !rawValue.trim()) {
    return line;
  }

  const trimmedValue = rawValue.trim();
  const quote = trimmedValue.startsWith('"') && trimmedValue.endsWith('"') ? '"'
    : trimmedValue.startsWith("'") && trimmedValue.endsWith("'") ? "'"
      : '';
  const innerValue = quote ? trimmedValue.slice(1, -1) : trimmedValue;
  const translated = translateInlineMarkdown(innerValue, locale, registry);

  return `${indent}${key}:${spacing}${quote}${translated}${quote}`;
}

function translateQuotedProps(line, locale, registry) {
  let nextLine = line.replace(/\bhref="([^"]+)"/gu, (_match, value) => `href="${localizeDocsUrl(value, locale)}"`);

  return nextLine.replace(/\b([A-Za-z0-9:_-]+)="([^"]*)"/gu, (match, key, value) => {
    if (key === 'href') {
      return `${key}="${localizeDocsUrl(value, locale)}"`;
    }

    if (!translatablePropKeys.has(key)) {
      return match;
    }

    return `${key}="${translateInlineMarkdown(value, locale, registry)}"`;
  });
}

function translateTableRow(line, locale, registry) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return line;
  }

  if (/^\|(?:\s*:?-{3,}:?\s*\|)+$/u.test(trimmed)) {
    return line;
  }

  const cells = line.split('|');
  return cells
    .map((cell, index) => {
      if (index === 0 || index === cells.length - 1) {
        return cell;
      }

      return translateInlineMarkdown(cell, locale, registry);
    })
    .join('|');
}

function transformContentLine(line, locale, registry) {
  if (!line.trim()) {
    return line;
  }

  if (line.startsWith('import ')) {
    return line;
  }

  if (line.startsWith('export const steamProducts')) {
    return line.replace(/locale:\s*'en'/u, `locale: '${locale}'`);
  }

  if (line.includes('<ReleaseNotesLanding ')) {
    return line.replace(/locale="en"/u, `locale="${locale}"`);
  }

  if (line.includes('<ProductVideoShowcase ') || line.includes('<InstallButton ')) {
    return line;
  }

  if (line.trim().startsWith('::::') && line.includes('[') && line.endsWith(']')) {
    return line.replace(/^(\s*:{3,}[A-Za-z-]*\[)(.*?)(\]\s*)$/u, (_match, prefix, title, suffix) => {
      return `${prefix}${translateInlineMarkdown(title, locale, registry)}${suffix}`;
    });
  }

  if (line.trim().startsWith('<')) {
    return translateQuotedProps(line, locale, registry);
  }

  if (line.trim().startsWith('|')) {
    return translateTableRow(line, locale, registry);
  }

  if (/^(\s*>\s*)/u.test(line)) {
    return line.replace(/^(\s*>\s*)(.*)$/u, (_match, prefix, content) => `${prefix}${translateInlineMarkdown(content, locale, registry)}`);
  }

  if (/^(\s*#{1,6}\s+)/u.test(line)) {
    return line.replace(/^(\s*#{1,6}\s+)(.*)$/u, (_match, prefix, content) => `${prefix}${translateInlineMarkdown(content, locale, registry)}`);
  }

  if (/^(\s*(?:[-*+]\s+|\d+\.\s+))/u.test(line)) {
    return line.replace(/^(\s*(?:[-*+]\s+|\d+\.\s+))(.*)$/u, (_match, prefix, content) => `${prefix}${translateInlineMarkdown(content, locale, registry)}`);
  }

  return translateInlineMarkdown(translateQuotedProps(line, locale, registry), locale, registry);
}

function buildTranslatedTemplate(source, locale, registry) {
  const lines = source.split(/\r?\n/u);
  const output = [];
  let inFrontmatter = false;
  let frontmatterConsumed = false;
  let inCodeFence = false;

  for (const line of lines) {
    if (!frontmatterConsumed && line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) {
        frontmatterConsumed = true;
      }

      output.push(line);
      continue;
    }

    if (inFrontmatter) {
      output.push(translateYamlLine(line, locale, registry));
      continue;
    }

    if (/^```/u.test(line.trim())) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    output.push(transformContentLine(line, locale, registry));
  }

  return output.join('\n');
}

function decodeGoogleTranslateResponse(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('Unexpected translation payload format');
  }

  return payload[0]
    .map((segment) => (Array.isArray(segment) ? segment[0] ?? '' : ''))
    .join('');
}

async function translateSingle(locale, translateCode, text) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', translateCode);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  for (let attempt = 0; attempt <= TRANSLATION_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const retryDelay = TRANSLATION_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
      await sleep(retryDelay);
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.ok) {
      const payload = await response.json();
      return decodeGoogleTranslateResponse(payload);
    }

    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === TRANSLATION_MAX_RETRIES) {
      throw new Error(`Translation request failed for ${locale}: ${response.status} ${response.statusText}`);
    }
  }

  throw new Error(`Translation retries exhausted for ${locale}`);
}

async function translateBatch(locale, translateCode, texts) {
  if (texts.length === 0) {
    return [];
  }

  const separator = separatorTemplate.replace('%ID%', `${locale}-${Date.now()}`);
  const joined = texts.join(`\n${separator}\n`);
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', translateCode);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', joined);

  let response;
  for (let attempt = 0; attempt <= TRANSLATION_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const retryDelay = TRANSLATION_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
      await sleep(retryDelay);
    }

    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.ok) {
      break;
    }

    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === TRANSLATION_MAX_RETRIES) {
      throw new Error(`Translation request failed for ${locale}: ${response.status} ${response.statusText}`);
    }
  }

  const payload = await response.json();
  const translated = decodeGoogleTranslateResponse(payload);
  const parts = translated.split(`\n${separator}\n`);
  if (parts.length !== texts.length) {
    console.warn(`Split failed for ${locale} batch (${texts.length} texts → ${parts.length} parts), falling back to individual translation`);
    const individual = [];
    for (const text of texts) {
      individual.push(await translateSingle(locale, translateCode, text));
      await sleep(TRANSLATION_REQUEST_DELAY_MS);
    }
    return individual;
  }

  return parts;
}

async function resolveTranslationsForLocale(targetLocale, registry) {
  const resolved = new Map();
  const entries = [...registry.entries.entries()].filter(([, entry]) => entry.locale === targetLocale.code);
  const batch = [];
  let batchLength = 0;

  async function flush() {
    if (batch.length === 0) {
      return;
    }

    const translatedParts = await translateBatch(
      targetLocale.code,
      targetLocale.translateCode,
      batch.map((entry) => entry.text),
    );

    batch.forEach((entry, index) => {
      resolved.set(entry.token, translatedParts[index]);
    });

    await sleep(TRANSLATION_REQUEST_DELAY_MS);

    batch.length = 0;
    batchLength = 0;
  }

  for (const [token, entry] of entries) {
    const projectedLength = batchLength + entry.text.length + 32;
    if (batch.length >= 24 || projectedLength >= 2800) {
      await flush();
    }

    batch.push({ token, text: entry.text });
    batchLength += entry.text.length + 32;
  }

  await flush();

  return resolved;
}

function materializeTemplate(template, translations) {
  return template.replace(tokenPattern, (token) => translations.get(token) ?? token);
}

async function main() {
  const baselineDocs = await collectBaselineDocs(contentRoot);
  let totalCreated = 0;

  for (const locale of targetLocales) {
    const localeRegistry = createTranslationRegistry();
    const localePendingFiles = [];

    for (const relativeDocPath of baselineDocs) {
      const destinationPath = path.join(contentRoot, locale.code, relativeDocPath);
      const localizedOutputPath = path.join(translationsRoot, locale.code, relativeDocPath);
      if (await pathExists(localizedOutputPath)) {
        continue;
      }

      const englishSourcePath = path.join(englishRoot, relativeDocPath);
      const source = await fs.readFile(englishSourcePath, 'utf8');
      const template = buildTranslatedTemplate(source, locale.code, localeRegistry);
      localePendingFiles.push({ locale: locale.code, relativeDocPath, destinationPath: localizedOutputPath, template });
    }

    if (localePendingFiles.length === 0) {
      console.log(`${locale.code}: no missing docs.`);
      continue;
    }

    try {
      const translations = await resolveTranslationsForLocale(locale, localeRegistry);

      for (const file of localePendingFiles) {
        const content = materializeTemplate(file.template, translations);
        await fs.mkdir(path.dirname(file.destinationPath), { recursive: true });
        await fs.writeFile(file.destinationPath, content, 'utf8');
        console.log(`created ${file.locale}/${toPosixPath(file.relativeDocPath)}`);
      }

      console.log(`${locale.code}: created ${localePendingFiles.length} docs.`);
      totalCreated += localePendingFiles.length;
    } catch (error) {
      console.error(`${locale.code}: FAILED - ${error.message}`);
    }
  }

  console.log(`Total created: ${totalCreated} locale docs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
