import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_NOTES_LOCALES = ['zh-CN', 'en'];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DOCS_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DATA_DIR = path.join(DEFAULT_DOCS_ROOT, 'src', 'data', 'release-notes');
const DEFAULT_INDEX_PATH = path.join(DEFAULT_DATA_DIR, 'index.json');

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanHtmlText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function addIssue(issues, message) {
  issues.push(`[release-notes input] ${message}`);
}

export function verifyReleaseNotesBuildInput(options = {}) {
  const docsRoot = options.docsRoot ?? DEFAULT_DOCS_ROOT;
  const dataDir = options.dataDir ?? path.join(docsRoot, 'src', 'data', 'release-notes');
  const indexPath = options.indexPath ?? path.join(dataDir, 'index.json');
  const issues = [];

  if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) {
    addIssue(issues, `missing index file: ${indexPath}`);
    return { ok: false, issues, entries: [] };
  }

  let indexPayload;
  try {
    indexPayload = readJson(indexPath);
  } catch (error) {
    addIssue(issues, `invalid index JSON at ${indexPath}: ${error.message}`);
    return { ok: false, issues, entries: [] };
  }

  if (!isRecord(indexPayload)) {
    addIssue(issues, `index payload must be a JSON object: ${indexPath}`);
    return { ok: false, issues, entries: [] };
  }

  if (!Array.isArray(indexPayload.entries)) {
    addIssue(issues, `index entries must be an array: ${indexPath}`);
    return { ok: false, issues, entries: [] };
  }

  for (const [entryIndex, entry] of indexPayload.entries.entries()) {
    const entryLabel = hasText(entry?.tag) ? entry.tag.trim() : `entry[${entryIndex}]`;

    if (!isRecord(entry)) {
      addIssue(issues, `${entryLabel} must be an object`);
      continue;
    }

    if (!hasText(entry.tag)) {
      addIssue(issues, `${entryLabel} is missing tag`);
    }

    if (!hasText(entry.anchorId)) {
      addIssue(issues, `${entryLabel} is missing anchorId`);
    }

    if (!hasText(entry.detailPath)) {
      addIssue(issues, `${entryLabel} is missing detailPath`);
      continue;
    }

    const detailPath = path.resolve(dataDir, entry.detailPath.trim());
    const relativeDetailPath = path.relative(dataDir, detailPath);
    if (relativeDetailPath.startsWith('..') || path.isAbsolute(relativeDetailPath)) {
      addIssue(issues, `${entryLabel} detailPath escapes release-notes data dir: ${entry.detailPath}`);
      continue;
    }

    if (!fs.existsSync(detailPath) || !fs.statSync(detailPath).isFile()) {
      addIssue(issues, `${entryLabel} missing detail file: ${detailPath}`);
      continue;
    }

    let detailPayload;
    try {
      detailPayload = readJson(detailPath);
    } catch (error) {
      addIssue(issues, `${entryLabel} invalid detail JSON at ${detailPath}: ${error.message}`);
      continue;
    }

    if (!isRecord(detailPayload)) {
      addIssue(issues, `${entryLabel} detail payload must be a JSON object: ${detailPath}`);
      continue;
    }

    for (const locale of RELEASE_NOTES_LOCALES) {
      const summary = entry.summary?.[locale] ?? detailPayload.summary?.[locale];
      const bodyHtml = detailPayload.bodyHtml?.[locale];
      const bodyText = cleanHtmlText(bodyHtml);

      if (!hasText(summary)) {
        addIssue(issues, `${entryLabel} is missing ${locale} summary`);
      }

      if (!hasText(bodyHtml)) {
        addIssue(issues, `${entryLabel} is missing ${locale} bodyHtml in ${detailPath}`);
      } else if (bodyText.length < 12) {
        addIssue(issues, `${entryLabel} ${locale} bodyHtml is too short to publish in ${detailPath}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    entries: indexPayload.entries,
    indexPath,
    dataDir,
  };
}

export function assertReleaseNotesBuildInput(options = {}) {
  const result = verifyReleaseNotesBuildInput(options);
  if (!result.ok) {
    throw new Error(result.issues.join('\n'));
  }

  return result;
}

function main() {
  try {
    const result = assertReleaseNotesBuildInput({
      docsRoot: process.cwd(),
      dataDir: DEFAULT_DATA_DIR,
      indexPath: DEFAULT_INDEX_PATH,
    });
    console.log(`[release-notes input] verified ${result.entries.length} entries`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
