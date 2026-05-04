import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DOCS_LOCALE_SELECTOR_OPTIONS } from '../src/i18n/generated/docs-locale-resources.mjs';
import {
  DOCS_BASELINE_AUTHORING_ROOT,
  DOCS_BASELINE_SOURCE_LOCALE,
  DOCS_TRANSLATIONS_AUTHORING_ROOT,
  isDocsLocaleDirectory,
} from '../src/lib/docs-content-paths.mjs';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContentRoot = path.join(docsRoot, DOCS_BASELINE_AUTHORING_ROOT);
const defaultTranslationRoot = path.join(docsRoot, DOCS_TRANSLATIONS_AUTHORING_ROOT);
const DEFAULT_REPORT_PATH = '.tmp/docs-translation-report.json';
const DEFAULT_HIGH_SIMILARITY_THRESHOLD = 0.98;
const DEFAULT_SAMPLE_LIMIT = 12;
const BASELINE_LOCALE = DOCS_BASELINE_SOURCE_LOCALE;
const markdownFilePattern = /\.(?:md|mdx)$/u;
const alternateMarkdownExtensions = ['.md', '.mdx'];

export const REQUIRED_DOCS_LOCALES = DOCS_LOCALE_SELECTOR_OPTIONS.map((locale) => ({
  code: locale.sourceLocale,
  routeLocale: locale.code,
  contentDirectory: locale.sourceLocale === BASELINE_LOCALE ? '' : locale.sourceLocale,
}));
const ignoredTopLevelDirectories = new Set(['blog', 'img']);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function relativePath(filePath, base = docsRoot) {
  return toPosixPath(path.relative(base, filePath));
}

function inferProjectRoot(rootDirectory, explicitProjectRoot) {
  if (explicitProjectRoot) {
    return path.resolve(explicitProjectRoot);
  }

  const normalized = toPosixPath(rootDirectory);
  if (normalized.endsWith(DOCS_BASELINE_AUTHORING_ROOT)) {
    return path.resolve(rootDirectory, '..', '..', '..');
  }

  return rootDirectory;
}

function parseArgs(argv) {
  const options = {
    contentRoot: defaultContentRoot,
    translationRoot: defaultTranslationRoot,
    reportPath: DEFAULT_REPORT_PATH,
    highSimilarityThreshold: DEFAULT_HIGH_SIMILARITY_THRESHOLD,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    failOnFindings: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--root-dir') {
      options.contentRoot = path.resolve(argv[index + 1] ?? options.contentRoot);
      index += 1;
      continue;
    }

    if (argument === '--report-json') {
      options.reportPath = argv[index + 1] ?? options.reportPath;
      index += 1;
      continue;
    }

    if (argument === '--translations-root-dir') {
      options.translationRoot = path.resolve(argv[index + 1] ?? options.translationRoot);
      index += 1;
      continue;
    }

    if (argument === '--high-similarity-threshold') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new Error(`Invalid --high-similarity-threshold value: ${argv[index + 1]}`);
      }

      options.highSimilarityThreshold = value;
      index += 1;
      continue;
    }

    if (argument === '--sample-limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid --sample-limit value: ${argv[index + 1]}`);
      }

      options.sampleLimit = value;
      index += 1;
      continue;
    }

    if (argument === '--fail-on-findings') {
      options.failOnFindings = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function isMarkdownFile(fileName) {
  return markdownFilePattern.test(fileName);
}

function extractFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return {};
  }

  const closeIndex = raw.indexOf('\n---', 3);
  if (closeIndex === -1) {
    return {};
  }

  const frontmatter = raw.slice(3, closeIndex).trim();
  const values = {};
  for (const line of frontmatter.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^['"]|['"]$/gu, '');
  }

  return values;
}

function stripFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return raw;
  }

  const closeIndex = raw.indexOf('\n---', 3);
  if (closeIndex === -1) {
    return raw;
  }

  return raw.slice(closeIndex + 4);
}

function normalizeComparableMarkdown(raw) {
  return stripFrontmatter(raw)
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^\s*>+\s?/gmu, '')
    .replace(/[*_~|]/gu, ' ')
    .replace(/\r?\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function createFingerprint(value) {
  return createHash('sha1').update(value).digest('hex');
}

function createTrigramSet(text) {
  const compact = text.replace(/\s+/gu, ' ').trim();
  if (!compact) {
    return new Set();
  }

  if (compact.length < 3) {
    return new Set([compact]);
  }

  const trigrams = new Set();
  for (let index = 0; index <= compact.length - 3; index += 1) {
    trigrams.add(compact.slice(index, index + 3));
  }

  return trigrams;
}

function calculateDiceCoefficient(left, right) {
  if (left.size === 0 && right.size === 0) {
    return 1;
  }

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkBaselineDocs(rootDirectory, currentDirectory = rootDirectory, relativeDirectory = '') {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const docs = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const fullPath = path.join(currentDirectory, entry.name);
    const nextRelativePath = relativeDirectory ? path.posix.join(relativeDirectory, entry.name) : entry.name;

    if (entry.isDirectory()) {
      if (
        !relativeDirectory
        && (ignoredTopLevelDirectories.has(entry.name) || isDocsLocaleDirectory(entry.name))
      ) {
        continue;
      }

      docs.push(...await walkBaselineDocs(rootDirectory, fullPath, nextRelativePath));
      continue;
    }

    if (!entry.isFile() || !isMarkdownFile(entry.name)) {
      continue;
    }

    docs.push(fullPath);
  }

  return docs;
}

function createDocEntry(filePath, rootDirectory) {
  const relativeFilePath = relativePath(filePath, rootDirectory);
  const extension = path.extname(filePath);
  const docKey = relativeFilePath.slice(0, -extension.length);

  return {
    docKey,
    filePath,
    relativeFilePath,
    extension,
  };
}

async function readDoc(filePath, rootDirectory) {
  const raw = await fs.readFile(filePath, 'utf8');
  const frontmatter = extractFrontmatter(raw);
  const normalizedBody = normalizeComparableMarkdown(raw);

  return {
    filePath: relativePath(filePath, rootDirectory),
    title: typeof frontmatter.title === 'string' ? frontmatter.title : '',
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    normalizedBody,
    bodyFingerprint: createFingerprint(normalizedBody),
    trigramSet: createTrigramSet(normalizedBody),
    bodyLength: normalizedBody.length,
  };
}

async function resolveLocalizedDoc(translationRoot, locale, baselineDoc) {
  if (!locale.contentDirectory) {
    return baselineDoc.filePath;
  }

  const stemPath = path.join(translationRoot, locale.contentDirectory, baselineDoc.docKey);

  const candidateExtensions = [
    baselineDoc.extension,
    ...alternateMarkdownExtensions.filter((extension) => extension !== baselineDoc.extension),
  ];

  for (const extension of candidateExtensions) {
    const candidatePath = `${stemPath}${extension}`;
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

async function countLocaleDocs(rootDirectory, translationRoot, locale) {
  if (!locale.contentDirectory) {
    return (await walkBaselineDocs(rootDirectory)).length;
  }

  const localeDirectory = path.join(translationRoot, locale.contentDirectory);
  if (!(await pathExists(localeDirectory))) {
    return 0;
  }

  const docs = await walkBaselineDocs(localeDirectory, localeDirectory, '');
  return docs.length;
}

function createLocaleIssueMap(locales) {
  return new Map(
    locales.map((locale) => [
      locale.code,
        {
          code: locale.code,
          routeLocale: locale.routeLocale,
          directory: locale.contentDirectory || '.',
          docCount: 0,
          missingCount: 0,
          duplicateDocCount: 0,
        similarDocCount: 0,
      },
    ]),
  );
}

function incrementLocaleIssue(localeIssues, localeCode, key) {
  const entry = localeIssues.get(localeCode);
  if (!entry) {
    return;
  }

  entry[key] += 1;
}

export async function generateDocsTranslationReport(options = {}) {
  const rootDirectory = path.resolve(options.contentRoot ?? defaultContentRoot);
  const translationRoot = path.resolve(options.translationRoot ?? defaultTranslationRoot);
  const projectRoot = inferProjectRoot(rootDirectory, options.projectRoot);
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const highSimilarityThreshold = options.highSimilarityThreshold ?? DEFAULT_HIGH_SIMILARITY_THRESHOLD;
  const baselineLocale = REQUIRED_DOCS_LOCALES.find((locale) => locale.code === BASELINE_LOCALE);

  if (!baselineLocale) {
    throw new Error(`Missing baseline locale configuration for ${BASELINE_LOCALE}`);
  }

  const baselineFiles = await walkBaselineDocs(rootDirectory);
  const baselineDocs = baselineFiles.map((filePath) => createDocEntry(filePath, rootDirectory));
  const localeIssues = createLocaleIssueMap(REQUIRED_DOCS_LOCALES);

  for (const locale of REQUIRED_DOCS_LOCALES) {
    const count = await countLocaleDocs(rootDirectory, translationRoot, locale);
    const localeEntry = localeIssues.get(locale.code);
    if (localeEntry) {
      localeEntry.docCount = count;
    }
  }

  const entries = [];

  for (const baselineDoc of baselineDocs.sort((left, right) => left.docKey.localeCompare(right.docKey))) {
    const baselineContent = await readDoc(baselineDoc.filePath, rootDirectory);
    const missingLocales = [];
    const duplicateComparisons = [];
    const similarComparisons = [];
    const localizedEntries = {
      [BASELINE_LOCALE]: {
        path: baselineContent.filePath,
        title: baselineContent.title,
        description: baselineContent.description,
        bodyLength: baselineContent.bodyLength,
      },
    };

    for (const locale of REQUIRED_DOCS_LOCALES) {
      if (locale.code === BASELINE_LOCALE) {
        continue;
      }

      const localizedFilePath = await resolveLocalizedDoc(translationRoot, locale, baselineDoc);
      if (!localizedFilePath) {
        missingLocales.push(locale.code);
        incrementLocaleIssue(localeIssues, locale.code, 'missingCount');
        continue;
      }

      const localizedContent = await readDoc(localizedFilePath, rootDirectory);
      localizedEntries[locale.code] = {
        path: localizedContent.filePath,
        title: localizedContent.title,
        description: localizedContent.description,
        bodyLength: localizedContent.bodyLength,
      };

      if (localizedContent.bodyFingerprint === baselineContent.bodyFingerprint) {
        duplicateComparisons.push({
          baselineLocale: BASELINE_LOCALE,
          locale: locale.code,
          baselinePath: baselineContent.filePath,
          path: localizedContent.filePath,
          sampleTitle: localizedContent.title || baselineContent.title || baselineDoc.docKey,
        });
        incrementLocaleIssue(localeIssues, locale.code, 'duplicateDocCount');
        continue;
      }

      const similarity = calculateDiceCoefficient(baselineContent.trigramSet, localizedContent.trigramSet);
      if (similarity >= highSimilarityThreshold) {
        similarComparisons.push({
          baselineLocale: BASELINE_LOCALE,
          locale: locale.code,
          baselinePath: baselineContent.filePath,
          path: localizedContent.filePath,
          similarity: Number(similarity.toFixed(4)),
        });
        incrementLocaleIssue(localeIssues, locale.code, 'similarDocCount');
      }
    }

    entries.push({
      docKey: baselineDoc.docKey,
      baselineLocale: BASELINE_LOCALE,
      baselinePath: baselineContent.filePath,
      missingLocales,
      duplicateComparisons,
      similarComparisons,
      locales: localizedEntries,
    });
  }

  const localeSummary = [...localeIssues.values()].sort((left, right) => left.code.localeCompare(right.code));
  const findings = entries.filter(
    (entry) => entry.missingLocales.length > 0 || entry.duplicateComparisons.length > 0 || entry.similarComparisons.length > 0,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    rootDirectory: relativePath(rootDirectory, projectRoot) || '.',
    translationRoot: relativePath(translationRoot, projectRoot) || '.',
    reportPath,
    baselineLocale: BASELINE_LOCALE,
    highSimilarityThreshold,
    scope: 'docs-content',
    excludes: ['blog/**', 'img/**'],
    summary: {
      totalBaselineDocs: baselineDocs.length,
      totalLocales: REQUIRED_DOCS_LOCALES.length,
      missingTranslations: entries.reduce((sum, entry) => sum + entry.missingLocales.length, 0),
      exactDuplicateComparisonsVsBaseline: entries.reduce((sum, entry) => sum + entry.duplicateComparisons.length, 0),
      highSimilarityComparisonsVsBaseline: entries.reduce((sum, entry) => sum + entry.similarComparisons.length, 0),
      docsWithFindings: findings.length,
    },
    locales: localeSummary,
    entries,
  };

  if (reportPath) {
    const fullReportPath = path.resolve(projectRoot, reportPath);
    await fs.mkdir(path.dirname(fullReportPath), { recursive: true });
    await fs.writeFile(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    report.outputPath = relativePath(fullReportPath, projectRoot);
  }

  return report;
}

export function printDocsTranslationReport(report, { sampleLimit = DEFAULT_SAMPLE_LIMIT, stdout = console.log } = {}) {
  stdout('Docs translation report');
  stdout(`- baseline locale: ${report.baselineLocale}`);
  stdout(`- baseline docs: ${report.summary.totalBaselineDocs}`);
  stdout(`- locales: ${report.summary.totalLocales}`);
  stdout(`- missing translations: ${report.summary.missingTranslations}`);
  stdout(`- exact duplicate comparisons vs baseline: ${report.summary.exactDuplicateComparisonsVsBaseline}`);
  stdout(`- high-similarity comparisons vs baseline: ${report.summary.highSimilarityComparisonsVsBaseline}`);

  stdout('\nLocale summary');
  for (const locale of report.locales) {
    stdout(
      `- ${locale.code}: docs=${locale.docCount}, missing=${locale.missingCount}, duplicateDocs=${locale.duplicateDocCount}, similarDocs=${locale.similarDocCount}`,
    );
  }

  const samples = report.entries
    .filter((entry) => entry.missingLocales.length > 0 || entry.duplicateComparisons.length > 0 || entry.similarComparisons.length > 0)
    .slice(0, sampleLimit);

  if (samples.length > 0) {
    stdout('\nSamples');
    for (const entry of samples) {
      stdout(`- ${entry.docKey}`);

      if (entry.missingLocales.length > 0) {
        stdout(`  missing: ${entry.missingLocales.join(', ')}`);
      }

      for (const comparison of entry.duplicateComparisons) {
        stdout(`  duplicate-vs-${report.baselineLocale}: ${comparison.locale}`);
      }

      for (const comparison of entry.similarComparisons) {
        stdout(`  similar-vs-${report.baselineLocale}(${comparison.similarity}): ${comparison.locale}`);
      }
    }
  }

  if (report.outputPath) {
    stdout(`\nReport: ${report.outputPath}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = await generateDocsTranslationReport(options);
  printDocsTranslationReport(report, { sampleLimit: options.sampleLimit });

  if (options.failOnFindings && report.summary.docsWithFindings > 0) {
    process.exitCode = 1;
  }

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
