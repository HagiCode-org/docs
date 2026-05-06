import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  generateBlogTranslationReport,
} from './report-blog-translation-status.mjs';
import {
  generateDocsTranslationReport,
} from './report-docs-translation-status.mjs';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContentRoot = path.join(docsRoot, 'src/content/docs');
const defaultTranslationRoot = path.join(docsRoot, 'src/content/translations/docs');
const DEFAULT_REPORT_PATH = '.tmp/translation-report.json';
const DEFAULT_DOCS_REPORT_PATH = '.tmp/docs-translation-report.json';
const DEFAULT_BLOG_REPORT_PATH = '.tmp/blog-translation-report.json';
const DEFAULT_SAMPLE_LIMIT = 8;
const DEFAULT_HIGH_SIMILARITY_THRESHOLD = 0.98;

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
  if (normalized.endsWith('src/content/docs')) {
    return path.resolve(rootDirectory, '..', '..', '..');
  }

  return rootDirectory;
}

function parseArgs(argv) {
  const options = {
    contentRoot: defaultContentRoot,
    translationRoot: defaultTranslationRoot,
    reportPath: DEFAULT_REPORT_PATH,
    docsReportPath: DEFAULT_DOCS_REPORT_PATH,
    blogReportPath: DEFAULT_BLOG_REPORT_PATH,
    sampleLimit: DEFAULT_SAMPLE_LIMIT,
    highSimilarityThreshold: DEFAULT_HIGH_SIMILARITY_THRESHOLD,
    failOnFindings: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--root-dir') {
      options.contentRoot = path.resolve(argv[index + 1] ?? options.contentRoot);
      index += 1;
      continue;
    }

    if (argument === '--translations-root-dir') {
      options.translationRoot = path.resolve(argv[index + 1] ?? options.translationRoot);
      index += 1;
      continue;
    }

    if (argument === '--report-json') {
      options.reportPath = argv[index + 1] ?? options.reportPath;
      index += 1;
      continue;
    }

    if (argument === '--docs-report-json') {
      options.docsReportPath = argv[index + 1] ?? options.docsReportPath;
      index += 1;
      continue;
    }

    if (argument === '--blog-report-json') {
      options.blogReportPath = argv[index + 1] ?? options.blogReportPath;
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

    if (argument === '--high-similarity-threshold') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new Error(`Invalid --high-similarity-threshold value: ${argv[index + 1]}`);
      }

      options.highSimilarityThreshold = value;
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

function buildLocaleCoverageEntry(localeCode, docsLocale, blogLocale, docsSummary, blogSummary) {
  return {
    code: localeCode,
    routeLocale: docsLocale?.routeLocale ?? blogLocale?.routeLocale ?? localeCode,
    docs: docsLocale
      ? {
          totalBaselineEntries: docsSummary.totalBaselineDocs,
          authoredEntries: docsLocale.docCount,
          translatedEntries: Math.max(docsSummary.totalBaselineDocs - docsLocale.missingCount, 0),
          missingCount: docsLocale.missingCount,
          duplicateCount: docsLocale.duplicateDocCount,
          similarCount: docsLocale.similarDocCount,
        }
      : null,
    blog: blogLocale
      ? {
          totalBaselineEntries: blogSummary.totalSlugs,
          authoredEntries: blogLocale.postCount,
          translatedEntries: Math.max(blogSummary.totalSlugs - blogLocale.missingCount, 0),
          missingCount: blogLocale.missingCount,
          duplicateCount: blogLocale.duplicateSlugCount,
          similarCount: blogLocale.similarSlugCount,
        }
      : null,
  };
}

function summarizeSamples(entries, key, sampleLimit) {
  return entries
    .filter((entry) => entry.missingLocales.length > 0 || entry.duplicateComparisons.length > 0 || entry.similarComparisons.length > 0)
    .slice(0, sampleLimit)
    .map((entry) => ({
      key: entry[key],
      missingLocales: entry.missingLocales,
      duplicateLocales: entry.duplicateComparisons.map((comparison) => comparison.locale),
      similarLocales: entry.similarComparisons.map((comparison) => ({
        locale: comparison.locale,
        similarity: comparison.similarity,
      })),
    }));
}

export async function generateTranslationReport(options = {}) {
  const contentRoot = path.resolve(options.contentRoot ?? defaultContentRoot);
  const translationRoot = path.resolve(options.translationRoot ?? defaultTranslationRoot);
  const projectRoot = inferProjectRoot(contentRoot, options.projectRoot);
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const docsReportPath = options.docsReportPath ?? DEFAULT_DOCS_REPORT_PATH;
  const blogReportPath = options.blogReportPath ?? DEFAULT_BLOG_REPORT_PATH;
  const highSimilarityThreshold = options.highSimilarityThreshold ?? DEFAULT_HIGH_SIMILARITY_THRESHOLD;

  const [docsReport, blogReport] = await Promise.all([
    generateDocsTranslationReport({
      contentRoot,
      translationRoot,
      projectRoot,
      reportPath: docsReportPath,
      highSimilarityThreshold,
    }),
    generateBlogTranslationReport({
      contentRoot,
      projectRoot,
      reportPath: blogReportPath,
      highSimilarityThreshold,
    }),
  ]);

  const localeCodes = [...new Set([
    ...docsReport.locales.map((locale) => locale.code),
    ...blogReport.locales.map((locale) => locale.code),
  ])].sort((left, right) => left.localeCompare(right));

  const docsLocaleMap = new Map(docsReport.locales.map((locale) => [locale.code, locale]));
  const blogLocaleMap = new Map(blogReport.locales.map((locale) => [locale.code, locale]));
  const locales = localeCodes.map((localeCode) =>
    buildLocaleCoverageEntry(
      localeCode,
      docsLocaleMap.get(localeCode) ?? null,
      blogLocaleMap.get(localeCode) ?? null,
      docsReport.summary,
      blogReport.summary,
    ),
  );

  const summary = {
    totalLocales: locales.length,
    totalMissingTranslations: docsReport.summary.missingTranslations + blogReport.summary.missingTranslations,
    totalExactDuplicateComparisonsVsBaseline:
      docsReport.summary.exactDuplicateComparisonsVsBaseline + blogReport.summary.exactDuplicateComparisonsVsBaseline,
    totalHighSimilarityComparisonsVsBaseline:
      docsReport.summary.highSimilarityComparisonsVsBaseline + blogReport.summary.highSimilarityComparisonsVsBaseline,
    totalEntriesWithFindings: docsReport.summary.docsWithFindings + blogReport.summary.slugsWithFindings,
    localesWithMissingTranslations: locales.filter(
      (locale) => (locale.docs?.missingCount ?? 0) > 0 || (locale.blog?.missingCount ?? 0) > 0,
    ).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    rootDirectory: relativePath(contentRoot, projectRoot) || '.',
    translationRoot: relativePath(translationRoot, projectRoot) || '.',
    baselineLocale: docsReport.baselineLocale,
    highSimilarityThreshold,
    summary,
    locales,
    paths: {
      docsReport: docsReport.outputPath ?? docsReportPath,
      blogReport: blogReport.outputPath ?? blogReportPath,
    },
    docs: {
      summary: docsReport.summary,
      outputPath: docsReport.outputPath ?? null,
      samples: summarizeSamples(docsReport.entries, 'docKey', options.sampleLimit ?? DEFAULT_SAMPLE_LIMIT),
    },
    blog: {
      summary: blogReport.summary,
      outputPath: blogReport.outputPath ?? null,
      samples: summarizeSamples(blogReport.entries, 'slug', options.sampleLimit ?? DEFAULT_SAMPLE_LIMIT),
    },
  };

  if (reportPath) {
    const fullReportPath = path.resolve(projectRoot, reportPath);
    await fs.mkdir(path.dirname(fullReportPath), { recursive: true });
    await fs.writeFile(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    report.outputPath = relativePath(fullReportPath, projectRoot);
  }

  return report;
}

function formatCoverage(section) {
  if (!section) {
    return 'n/a';
  }

  return `${section.translatedEntries}/${section.totalBaselineEntries}`;
}

function formatMetric(section, key) {
  if (!section) {
    return 'n/a';
  }

  return String(section[key]);
}

function printSamples(title, samples, stdout) {
  if (samples.length === 0) {
    return;
  }

  stdout(`\n${title}`);
  for (const sample of samples) {
    const details = [];
    if (sample.missingLocales.length > 0) {
      details.push(`missing=${sample.missingLocales.join(', ')}`);
    }
    if (sample.duplicateLocales.length > 0) {
      details.push(`duplicate=${sample.duplicateLocales.join(', ')}`);
    }
    if (sample.similarLocales.length > 0) {
      details.push(
        `similar=${sample.similarLocales.map((entry) => `${entry.locale}(${entry.similarity})`).join(', ')}`,
      );
    }
    stdout(`- ${sample.key}: ${details.join(' | ')}`);
  }
}

export function printTranslationReport(report, { stdout = console.log } = {}) {
  stdout('Translation report');
  stdout(`- baseline locale: ${report.baselineLocale}`);
  stdout(
    `- docs: baseline=${report.docs.summary.totalBaselineDocs}, missing=${report.docs.summary.missingTranslations}, duplicate=${report.docs.summary.exactDuplicateComparisonsVsBaseline}, similar=${report.docs.summary.highSimilarityComparisonsVsBaseline}`,
  );
  stdout(
    `- blog: slugs=${report.blog.summary.totalSlugs}, missing=${report.blog.summary.missingTranslations}, duplicate=${report.blog.summary.exactDuplicateComparisonsVsBaseline}, similar=${report.blog.summary.highSimilarityComparisonsVsBaseline}`,
  );
  stdout(`- locales with missing translations: ${report.summary.localesWithMissingTranslations}`);

  stdout('\nLocale coverage');
  for (const locale of report.locales) {
    stdout(
      `- ${locale.code}: docs=${formatCoverage(locale.docs)} missing=${formatMetric(locale.docs, 'missingCount')} duplicate=${formatMetric(locale.docs, 'duplicateCount')} similar=${formatMetric(locale.docs, 'similarCount')}; blog=${formatCoverage(locale.blog)} missing=${formatMetric(locale.blog, 'missingCount')} duplicate=${formatMetric(locale.blog, 'duplicateCount')} similar=${formatMetric(locale.blog, 'similarCount')}`,
    );
  }

  printSamples('Docs samples', report.docs.samples, stdout);
  printSamples('Blog samples', report.blog.samples, stdout);

  if (report.outputPath) {
    stdout(`\nCombined report: ${report.outputPath}`);
  }

  stdout(`Docs report: ${report.paths.docsReport}`);
  stdout(`Blog report: ${report.paths.blogReport}`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = await generateTranslationReport(options);
  printTranslationReport(report);

  if (options.failOnFindings && report.summary.totalEntriesWithFindings > 0) {
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
