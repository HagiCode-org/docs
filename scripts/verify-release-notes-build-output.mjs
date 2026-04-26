import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReleaseNotesBuildInput } from './verify-release-notes-build-input.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DOCS_ROOT = path.resolve(SCRIPT_DIR, '..');
const EMPTY_COPY = {
  'zh-CN': '当前语言下还没有可浏览的同步版本',
  en: 'No synchronized release notes are available yet',
};
const LOCALE_ARTIFACTS = {
  'zh-CN': path.join('release-notes', 'index.html'),
  en: path.join('en', 'release-notes', 'index.html'),
};

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function normalizeText(value) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function hasNeedle(haystack, needle) {
  const normalizedNeedle = normalizeText(needle);
  return normalizedNeedle.length > 0 && haystack.includes(normalizedNeedle);
}

function createBodyNeedles(bodyHtml) {
  const text = normalizeText(bodyHtml);
  if (text.length === 0) {
    return [];
  }

  return [text, text.slice(0, Math.min(text.length, 96)).trim()].filter(Boolean);
}

function addIssue(issues, message) {
  issues.push(`[release-notes output] ${message}`);
}

export function verifyReleaseNotesBuildOutput(options = {}) {
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;
  const distDir = options.distDir ?? path.join(docsRoot, 'dist');
  const source = assertReleaseNotesBuildInput({ docsRoot });
  const entries = source.entries;
  const issues = [];

  if (entries.length === 0) {
    return { ok: true, issues, entries };
  }

  const latestEntry = entries[0];
  const detailPath = path.join(source.dataDir, latestEntry.detailPath);
  const detailPayload = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
  const versionLabel = latestEntry.displayTag ?? latestEntry.tag;
  const anchorId = latestEntry.anchorId;

  for (const [locale, artifactRelativePath] of Object.entries(LOCALE_ARTIFACTS)) {
    const artifactPath = path.join(distDir, artifactRelativePath);
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      addIssue(issues, `${locale} artifact is missing for ${versionLabel}: ${artifactPath}`);
      continue;
    }

    if (!artifactPath.startsWith(distDir)) {
      addIssue(issues, `${locale} artifact path is outside dist for ${versionLabel}: ${artifactPath}`);
      continue;
    }

    const html = fs.readFileSync(artifactPath, 'utf8');
    const pageText = normalizeText(html);
    const summary = latestEntry.summary?.[locale] ?? detailPayload.summary?.[locale] ?? '';
    const bodyNeedles = createBodyNeedles(detailPayload.bodyHtml?.[locale]);
    const keepsSummaryOrBody = hasNeedle(pageText, summary)
      || bodyNeedles.some((needle) => pageText.includes(needle));

    if (!html.includes(`id="${anchorId}"`) && !html.includes(`href="#${anchorId}"`)) {
      addIssue(issues, `${locale} artifact ${artifactPath} is missing anchor ${anchorId} for ${versionLabel}`);
    }

    if (!keepsSummaryOrBody) {
      addIssue(issues, `${locale} artifact ${artifactPath} is missing localized summary/body for ${versionLabel}`);
    }

    if (pageText.includes(EMPTY_COPY[locale])) {
      addIssue(issues, `${locale} artifact ${artifactPath} rendered the empty state while index has ${entries.length} entries`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    entries,
    latestEntry,
  };
}

export function assertReleaseNotesBuildOutput(options = {}) {
  const result = verifyReleaseNotesBuildOutput(options);
  if (!result.ok) {
    throw new Error(result.issues.join('\n'));
  }

  return result;
}

function main() {
  try {
    const result = assertReleaseNotesBuildOutput({ docsRoot: process.cwd() });
    if (result.entries.length === 0) {
      console.log('[release-notes output] index has no entries; localized empty states are allowed');
      return;
    }

    console.log(`[release-notes output] verified latest entry ${result.latestEntry.displayTag ?? result.latestEntry.tag} in zh-CN and en artifacts`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
