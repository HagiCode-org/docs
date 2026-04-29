import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  REQUIRED_BLOG_LOCALES,
  validateBlogI18nCompleteness,
} from './verify-blog-i18n-completeness.mjs';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContentRoot = path.join(docsRoot, 'src/content/docs');
const DEFAULT_REPORT_PATH = '.tmp/blog-translation-report.json';
const DEFAULT_HIGH_SIMILARITY_THRESHOLD = 0.98;
const DEFAULT_SAMPLE_LIMIT = 12;
const BASELINE_LOCALE = 'zh-CN';
const postFilePattern = /\.(?:md|mdx)$/u;
const supportFileNames = new Set(['authors.yml', 'authors.yaml', 'index.yml', 'index.yaml']);

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

function isPostFile(fileName) {
  return postFilePattern.test(fileName);
}

function isSupportFile(fileName) {
  return supportFileNames.has(fileName) || !isPostFile(fileName);
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

async function collectBlogPosts(rootDirectory) {
  const localeMap = new Map();
  const slugMap = new Map();

  for (const locale of REQUIRED_BLOG_LOCALES) {
    const directory = path.join(rootDirectory, locale.blogDir);
    const localeEntry = {
      code: locale.code,
      routeLocale: locale.routeLocale,
      directory: relativePath(directory, rootDirectory),
      postCount: 0,
    };
    localeMap.set(locale.code, localeEntry);

    let files = [];
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => !isSupportFile(fileName))
        .sort((left, right) => left.localeCompare(right));
    } catch {
      continue;
    }

    localeEntry.postCount = files.length;

    for (const fileName of files) {
      const slug = fileName.replace(postFilePattern, '');
      const filePath = path.join(directory, fileName);
      const raw = await fs.readFile(filePath, 'utf8');
      const frontmatter = extractFrontmatter(raw);
      const normalizedBody = normalizeComparableMarkdown(raw);
      const bodyFingerprint = createFingerprint(normalizedBody);

      const post = {
        locale: locale.code,
        routeLocale: locale.routeLocale,
        filePath: relativePath(filePath, rootDirectory),
        title: typeof frontmatter.title === 'string' ? frontmatter.title : '',
        description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
        normalizedBody,
        bodyFingerprint,
        trigramSet: createTrigramSet(normalizedBody),
        bodyLength: normalizedBody.length,
      };

      if (!slugMap.has(slug)) {
        slugMap.set(slug, new Map());
      }

      slugMap.get(slug).set(locale.code, post);
    }
  }

  return { localeMap, slugMap };
}

function createLocaleIssueMap(localeMap) {
  return new Map(
    [...localeMap.values()].map((locale) => [
      locale.code,
      {
        code: locale.code,
        routeLocale: locale.routeLocale,
        directory: locale.directory,
        postCount: locale.postCount,
        missingCount: 0,
        duplicateSlugCount: 0,
        similarSlugCount: 0,
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

export async function generateBlogTranslationReport(options = {}) {
  const rootDirectory = path.resolve(options.contentRoot ?? defaultContentRoot);
  const projectRoot = inferProjectRoot(rootDirectory, options.projectRoot);
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const highSimilarityThreshold = options.highSimilarityThreshold ?? DEFAULT_HIGH_SIMILARITY_THRESHOLD;
  const completeness = await validateBlogI18nCompleteness({ contentRoot: rootDirectory });
  const { localeMap, slugMap } = await collectBlogPosts(rootDirectory);
  const localeIssues = createLocaleIssueMap(localeMap);
  const entries = [];

  for (const slug of [...slugMap.keys()].sort((left, right) => left.localeCompare(right))) {
    const postsByLocale = slugMap.get(slug);
    const baselinePost = postsByLocale.get(BASELINE_LOCALE) ?? null;
    const missingLocales = REQUIRED_BLOG_LOCALES
      .map((locale) => locale.code)
      .filter((localeCode) => !postsByLocale.has(localeCode));
    const duplicateComparisons = [];
    const similarComparisons = [];
    const duplicateLocaleSet = new Set();
    const similarLocaleSet = new Set();
    const posts = [...postsByLocale.values()].sort((left, right) => left.locale.localeCompare(right.locale));

    if (baselinePost) {
      for (const post of posts) {
        if (post.locale === BASELINE_LOCALE) {
          continue;
        }

        if (post.bodyFingerprint === baselinePost.bodyFingerprint) {
          duplicateComparisons.push({
            baselineLocale: BASELINE_LOCALE,
            locale: post.locale,
            baselinePath: baselinePost.filePath,
            path: post.filePath,
            sampleTitle: post.title || baselinePost.title || slug,
          });
          duplicateLocaleSet.add(post.locale);
          continue;
        }

        const similarity = calculateDiceCoefficient(baselinePost.trigramSet, post.trigramSet);
        if (similarity < highSimilarityThreshold) {
          continue;
        }

        similarComparisons.push({
          baselineLocale: BASELINE_LOCALE,
          locale: post.locale,
          baselinePath: baselinePost.filePath,
          path: post.filePath,
          similarity: Number(similarity.toFixed(4)),
        });
        similarLocaleSet.add(post.locale);
      }
    }

    for (const localeCode of missingLocales) {
      incrementLocaleIssue(localeIssues, localeCode, 'missingCount');
    }

    for (const localeCode of duplicateLocaleSet) {
      incrementLocaleIssue(localeIssues, localeCode, 'duplicateSlugCount');
    }

    for (const localeCode of similarLocaleSet) {
      incrementLocaleIssue(localeIssues, localeCode, 'similarSlugCount');
    }

    entries.push({
      slug,
      baselineLocale: BASELINE_LOCALE,
      baselineMissing: baselinePost === null,
      missingLocales,
      duplicateComparisons,
      similarComparisons,
      locales: Object.fromEntries(
        posts.map((post) => [
          post.locale,
          {
            path: post.filePath,
            title: post.title,
            description: post.description,
            bodyLength: post.bodyLength,
          },
        ]),
      ),
    });
  }

  const localeSummary = [...localeIssues.values()].sort((left, right) => left.code.localeCompare(right.code));
  const findings = entries.filter(
    (entry) => entry.missingLocales.length > 0 || entry.duplicateComparisons.length > 0 || entry.similarComparisons.length > 0,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    rootDirectory: relativePath(rootDirectory, projectRoot) || '.',
    reportPath,
    baselineLocale: BASELINE_LOCALE,
    highSimilarityThreshold,
    summary: {
      totalSlugs: entries.length,
      totalLocales: REQUIRED_BLOG_LOCALES.length,
      missingTranslations: entries.reduce((sum, entry) => sum + entry.missingLocales.length, 0),
      exactDuplicateComparisonsVsBaseline: entries.reduce((sum, entry) => sum + entry.duplicateComparisons.length, 0),
      duplicateLocaleEntries: localeSummary.reduce((sum, locale) => sum + locale.duplicateSlugCount, 0),
      highSimilarityComparisonsVsBaseline: entries.reduce((sum, entry) => sum + entry.similarComparisons.length, 0),
      localeEntriesWithSimilarity: localeSummary.reduce((sum, locale) => sum + locale.similarSlugCount, 0),
      completenessDiagnostics: completeness.diagnostics.length,
      slugsWithFindings: findings.length,
    },
    locales: localeSummary,
    diagnostics: completeness.diagnostics,
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

export function printBlogTranslationReport(report, { sampleLimit = DEFAULT_SAMPLE_LIMIT, stdout = console.log } = {}) {
  stdout('Blog translation report');
  stdout(`- baseline locale: ${report.baselineLocale}`);
  stdout(`- slugs: ${report.summary.totalSlugs}`);
  stdout(`- locales: ${report.summary.totalLocales}`);
  stdout(`- missing translations: ${report.summary.missingTranslations}`);
  stdout(`- exact duplicate comparisons vs baseline: ${report.summary.exactDuplicateComparisonsVsBaseline}`);
  stdout(`- high-similarity comparisons vs baseline: ${report.summary.highSimilarityComparisonsVsBaseline}`);
  stdout(`- completeness diagnostics: ${report.summary.completenessDiagnostics}`);

  stdout('\nLocale summary');
  for (const locale of report.locales) {
    stdout(
      `- ${locale.code}: posts=${locale.postCount}, missing=${locale.missingCount}, duplicateSlugs=${locale.duplicateSlugCount}, similarSlugs=${locale.similarSlugCount}`,
    );
  }

  const samples = report.entries
    .filter((entry) => entry.missingLocales.length > 0 || entry.duplicateComparisons.length > 0 || entry.similarComparisons.length > 0)
    .slice(0, sampleLimit);

  if (samples.length > 0) {
    stdout('\nSamples');
    for (const entry of samples) {
      stdout(`- ${entry.slug}`);

      if (entry.missingLocales.length > 0) {
        stdout(`  missing: ${entry.missingLocales.join(', ')}`);
      }

      if (entry.baselineMissing) {
        stdout(`  baseline-missing: ${entry.baselineLocale}`);
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
  const report = await generateBlogTranslationReport(options);
  printBlogTranslationReport(report, { sampleLimit: options.sampleLimit });

  if (options.failOnFindings && report.summary.slugsWithFindings > 0) {
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
