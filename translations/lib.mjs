// Shared helpers for the doc-translation adapters of this repository (human-owned, read-only logic).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_ROOT = 'src/content/docs'; // zh-CN baseline: the only source language
export const SITE_ROOT = 'src/content/translations/docs'; // where the site reads translations: <SITE_ROOT>/<locale>/<doc>
export const SOURCE_LOCALE = 'zh-CN';
export const LOCALES = ['en-US', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
// Top-level directories of SOURCE_ROOT that are not baseline docs: blog and images have their own flows,
// the locale directories hold generated or legacy copies.
const EXCLUDED_TOP = new Set(['blog', 'img', 'en', ...LOCALES]);

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Baseline docs, sorted: paths relative to SOURCE_ROOT (posix). Same scope as scripts/report-docs-translation-status.mjs. */
export function listSourceDocs() {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!rel && EXCLUDED_TOP.has(entry.name)) continue;
        walk(path.join(dir, entry.name), r);
      } else if (/\.mdx?$/u.test(entry.name)) out.push(r);
    }
  };
  walk(path.join(REPO, SOURCE_ROOT), '');
  return out.sort();
}

function git(args) {
  return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function sourceRevision() {
  try {
    return git(['rev-parse', 'HEAD']).trim();
  } catch {
    return null;
  }
}

/** "Last touched" clock for freshness checks: mtime when the file has uncommitted changes, else last commit time. */
export function makeTouchClock() {
  const dirty = new Set();
  const status = git(['status', '--porcelain', '-z', '--no-renames', '--', SOURCE_ROOT, SITE_ROOT]);
  for (const entry of status.split('\0')) if (entry.length > 3) dirty.add(entry.slice(3));
  return (rel) => {
    if (dirty.has(rel)) return fs.statSync(path.join(REPO, rel)).mtimeMs / 1000;
    const out = git(['log', '-1', '--format=%ct', '--', rel]).trim();
    return out ? Number(out) : 0;
  };
}

export function siteTranslationPath(locale, doc) {
  return `${SITE_ROOT}/${locale}/${doc}`;
}
