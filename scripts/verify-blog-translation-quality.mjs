import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REQUIRED_BLOG_LOCALES } from './verify-blog-i18n-completeness.mjs';
import {
  extractFrontmatter,
  normalizeComparableMarkdown,
  createTrigramSet,
  calculateDiceCoefficient,
} from './report-blog-translation-status.mjs';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContentRoot = path.join(docsRoot, 'src/content/docs');
const DEFAULT_REPORT_PATH = '.tmp/blog-translation-quality-report.json';
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const postFilePattern = /\.(?:md|mdx)$/u;
const supportFileNames = new Set(['authors.yml', 'authors.yaml', 'index.yml', 'index.yaml']);

const TARGET_LOCALES = REQUIRED_BLOG_LOCALES.filter(
  (locale) => locale.code !== 'en-US' && locale.code !== 'zh-CN',
);

function parseArgs(argv) {
  const options = {
    contentRoot: defaultContentRoot,
    reportPath: DEFAULT_REPORT_PATH,
    similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
    failOnFindings: false,
    locale: null,
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

    if (argument === '--similarity-threshold') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new Error(`Invalid --similarity-threshold value: ${argv[index + 1]}`);
      }
      options.similarityThreshold = value;
      index += 1;
      continue;
    }

    if (argument === '--fail-on-findings') {
      options.failOnFindings = true;
      continue;
    }

    if (argument === '--locale') {
      options.locale = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.locale) {
    const found = TARGET_LOCALES.find((l) => l.code === options.locale);
    if (!found) {
      throw new Error(
        `Unknown locale: ${options.locale}. Supported: ${TARGET_LOCALES.map((l) => l.code).join(', ')}`,
      );
    }
  }

  return options;
}

function isSupportFile(fileName) {
  return supportFileNames.has(fileName) || !postFilePattern.test(fileName);
}

function extractCodeBlocks(raw) {
  const codeBlocks = [];
  const regex = /^(`{3,4})(\S*)\n([\s\S]*?)\n\1$/gmu;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const lines = match[3].split('\n');
    const codeLines = lines.filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('#') && !line.trimStart().startsWith('/*'));
    codeBlocks.push({ lang: match[2], content: codeLines.join('\n') });
  }
  return codeBlocks;
}

function checkNotBaseDuplicate(baseRaw, targetRaw, slug, locale, threshold) {
  const baseNormalized = normalizeComparableMarkdown(baseRaw);
  const targetNormalized = normalizeComparableMarkdown(targetRaw);
  const baseTrigrams = createTrigramSet(baseNormalized);
  const targetTrigrams = createTrigramSet(targetNormalized);
  const similarity = calculateDiceCoefficient(baseTrigrams, targetTrigrams);

  if (similarity >= threshold) {
    return {
      slug,
      locale,
      severity: 'error',
      check: 'base-duplicate',
      message: `Body content is ${Math.round(similarity * 100)}% similar to zh-CN base`,
      similarity: Number(similarity.toFixed(4)),
    };
  }

  return null;
}

function checkFrontmatterTranslated(enRaw, targetRaw, slug, locale) {
  const findings = [];
  const enFm = extractFrontmatter(enRaw);
  const targetFm = extractFrontmatter(targetRaw);

  if (enFm.title && targetFm.title && enFm.title === targetFm.title) {
    findings.push({
      slug,
      locale,
      severity: 'warning',
      check: 'untranslated-title',
      message: `Title is identical to English: "${targetFm.title}"`,
    });
  }

  if (enFm.description && targetFm.description && enFm.description === targetFm.description) {
    findings.push({
      slug,
      locale,
      severity: 'warning',
      check: 'untranslated-description',
      message: `Description is identical to English: "${targetFm.description}"`,
    });
  }

  return findings;
}

function checkCodeBlocksPreserved(enRaw, targetRaw, slug, locale) {
  const findings = [];
  const enBlocks = extractCodeBlocks(enRaw);
  const targetBlocks = extractCodeBlocks(targetRaw);

  if (enBlocks.length !== targetBlocks.length) {
    findings.push({
      slug,
      locale,
      severity: 'error',
      check: 'code-block-count-mismatch',
      message: `Code block count mismatch: English has ${enBlocks.length}, ${locale} has ${targetBlocks.length}`,
      expectedCount: enBlocks.length,
      actualCount: targetBlocks.length,
    });
    return findings;
  }

  for (let i = 0; i < enBlocks.length; i += 1) {
    if (enBlocks[i].content.trimEnd() !== targetBlocks[i].content.trimEnd()) {
      findings.push({
        slug,
        locale,
        severity: 'error',
        check: 'code-block-mismatch',
        message: `Code block ${i} content differs from English source`,
        blockIndex: i,
        lang: enBlocks[i].lang,
      });
    }
  }

  return findings;
}

function checkMarkdownStructure(enRaw, targetRaw, slug, locale) {
  const findings = [];
  const enHeadings = (enRaw.match(/^#{2,6}\s+/gmu) ?? []).length;
  const targetHeadings = (targetRaw.match(/^#{2,6}\s+/gmu) ?? []).length;

  if (enHeadings !== targetHeadings) {
    findings.push({
      slug,
      locale,
      severity: 'warning',
      check: 'heading-count-mismatch',
      message: `Heading count mismatch: English has ${enHeadings}, ${locale} has ${targetHeadings}`,
      expectedCount: enHeadings,
      actualCount: targetHeadings,
    });
  }

  return findings;
}

export async function generateTranslationQualityReport(options = {}) {
  const rootDirectory = path.resolve(options.contentRoot ?? defaultContentRoot);
  const threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const locales = options.locale
    ? TARGET_LOCALES.filter((l) => l.code === options.locale)
    : TARGET_LOCALES;

  const baseBlogDir = path.join(rootDirectory, 'blog');
  let baseFiles;
  try {
    const entries = await fs.readdir(baseBlogDir, { withFileTypes: true });
    baseFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => !isSupportFile(fileName))
      .sort();
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      summary: { totalPosts: 0, localesChecked: locales.length, totalChecks: 0, passed: 0, findings: 0, bySeverity: { error: 0, warning: 0 } },
      locales: [],
      findings: [],
    };
  }

  const findings = [];
  const localeReports = [];

  for (const locale of locales) {
    const targetBlogDir = path.join(rootDirectory, locale.blogDir);
    let localeFindings = 0;
    let localeChecked = 0;

    for (const fileName of baseFiles) {
      const slug = fileName.replace(postFilePattern, '');
      const baseFilePath = path.join(baseBlogDir, fileName);
      const targetFilePath = path.join(targetBlogDir, fileName);

      let baseRaw;
      try {
        baseRaw = await fs.readFile(baseFilePath, 'utf8');
      } catch {
        continue;
      }

      let targetRaw;
      try {
        targetRaw = await fs.readFile(targetFilePath, 'utf8');
      } catch {
        findings.push({
          slug,
          locale: locale.code,
          severity: 'error',
          check: 'missing-file',
          message: `Missing translated file: ${fileName}`,
        });
        localeFindings += 1;
        continue;
      }

      localeChecked += 1;

      const duplicateFinding = checkNotBaseDuplicate(baseRaw, targetRaw, slug, locale.code, threshold);
      if (duplicateFinding) {
        findings.push(duplicateFinding);
        localeFindings += 1;
      }

      const frontmatterFindings = checkFrontmatterTranslated(baseRaw, targetRaw, slug, locale.code);
      findings.push(...frontmatterFindings);
      localeFindings += frontmatterFindings.length;

      const codeBlockFindings = checkCodeBlocksPreserved(baseRaw, targetRaw, slug, locale.code);
      findings.push(...codeBlockFindings);
      localeFindings += codeBlockFindings.length;

      const structureFindings = checkMarkdownStructure(baseRaw, targetRaw, slug, locale.code);
      findings.push(...structureFindings);
      localeFindings += structureFindings.length;
    }

    const totalPosts = baseFiles.length;
    const translated = localeChecked - findings.filter(
      (f) => f.locale === locale.code && f.check === 'base-duplicate',
    ).length;
    const coverage = totalPosts > 0 ? Math.round((translated / totalPosts) * 100) : 0;

    localeReports.push({
      code: locale.code,
      totalPosts,
      checked: localeChecked,
      findings: localeFindings,
      coverage,
    });
  }

  const totalChecks = localeReports.reduce((sum, r) => sum + r.checked * 4, 0);
  const passed = totalChecks - findings.length;

  const report = {
    generatedAt: new Date().toISOString(),
    similarityThreshold: threshold,
    summary: {
      totalPosts: baseFiles.length,
      localesChecked: locales.length,
      totalChecks,
      passed,
      findings: findings.length,
      bySeverity: {
        error: findings.filter((f) => f.severity === 'error').length,
        warning: findings.filter((f) => f.severity === 'warning').length,
      },
    },
    locales: localeReports,
    findings,
  };

  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  if (reportPath) {
    const fullReportPath = path.resolve(docsRoot, reportPath);
    await fs.mkdir(path.dirname(fullReportPath), { recursive: true });
    await fs.writeFile(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    report.outputPath = fullReportPath;
  }

  return report;
}

export function printTranslationQualityReport(report, { stdout = console.log } = {}) {
  stdout('Blog translation quality report');
  stdout(`- posts: ${report.summary.totalPosts}`);
  stdout(`- locales checked: ${report.summary.localesChecked}`);
  stdout(`- total checks: ${report.summary.totalChecks}`);
  stdout(`- passed: ${report.summary.passed}`);
  stdout(`- findings: ${report.summary.findings} (errors: ${report.summary.bySeverity.error}, warnings: ${report.summary.bySeverity.warning})`);

  stdout('\nLocale summary');
  for (const locale of report.locales) {
    const status = locale.coverage === 100 && locale.findings === 0 ? 'ok' : `${locale.findings} findings`;
    stdout(`- ${locale.code}: coverage=${locale.coverage}%, checked=${locale.checked}, ${status}`);
  }

  if (report.findings.length > 0) {
    stdout(`\nFindings (${report.findings.length})`);
    const errors = report.findings.filter((f) => f.severity === 'error');
    const warnings = report.findings.filter((f) => f.severity === 'warning');

    if (errors.length > 0) {
      stdout(`\n  Errors (${errors.length}):`);
      for (const finding of errors.slice(0, 20)) {
        stdout(`  - [${finding.check}] ${finding.locale}/${finding.slug}: ${finding.message}`);
      }
      if (errors.length > 20) {
        stdout(`  ... and ${errors.length - 20} more`);
      }
    }

    if (warnings.length > 0) {
      stdout(`\n  Warnings (${warnings.length}):`);
      for (const finding of warnings.slice(0, 20)) {
        stdout(`  - [${finding.check}] ${finding.locale}/${finding.slug}: ${finding.message}`);
      }
      if (warnings.length > 20) {
        stdout(`  ... and ${warnings.length - 20} more`);
      }
    }
  }

  if (report.outputPath) {
    stdout(`\nReport: ${report.outputPath}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = await generateTranslationQualityReport(options);
  printTranslationQualityReport(report);

  if (options.failOnFindings && report.summary.findings > 0) {
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
