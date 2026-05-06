import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  generateBlogTranslationReport,
} from './report-blog-translation-status.mjs';
import {
  generateDocsTranslationReport,
} from './report-docs-translation-status.mjs';
import {
  REQUIRED_BLOG_LOCALES,
} from './verify-blog-i18n-completeness.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(scriptDirectory, '..');
const defaultContentRoot = path.join(docsRoot, 'src/content/docs');
const defaultTranslationRoot = path.join(docsRoot, 'src/content/translations/docs');
const baselineLocale = 'zh-CN';
const validSurfaces = new Set(['docs', 'blog']);
const validGapTypes = new Set(['missing', 'duplicate', 'similar']);
const blogLocaleMap = new Map(REQUIRED_BLOG_LOCALES.map((locale) => [locale.code, locale]));

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

function parseCsvOption(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeLocaleFilter(locales) {
  return new Set(parseCsvOption(locales));
}

function parseArgs(argv) {
  const options = {
    contentRoot: defaultContentRoot,
    translationRoot: defaultTranslationRoot,
    surfaces: new Set(validSurfaces),
    locales: new Set(),
    includeMissing: true,
    includeDuplicates: false,
    includeSimilar: false,
    dryRun: false,
    limit: Number.POSITIVE_INFINITY,
    claudeExecutable: process.env.CLAUDE_EXECUTABLE ?? 'claude',
    model: null,
    agent: null,
    verbose: false,
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

    if (argument === '--surface' || argument === '--surfaces') {
      const surfaces = new Set(parseCsvOption(argv[index + 1]));
      if (surfaces.size === 0 || [...surfaces].some((surface) => !validSurfaces.has(surface))) {
        throw new Error(`Invalid --surface value: ${argv[index + 1]}`);
      }

      options.surfaces = surfaces;
      index += 1;
      continue;
    }

    if (argument === '--locales') {
      options.locales = sanitizeLocaleFilter(argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${argv[index + 1]}`);
      }

      options.limit = value;
      index += 1;
      continue;
    }

    if (argument === '--claude') {
      options.claudeExecutable = argv[index + 1] ?? options.claudeExecutable;
      index += 1;
      continue;
    }

    if (argument === '--model') {
      options.model = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--agent') {
      options.agent = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === '--include-duplicates') {
      options.includeDuplicates = true;
      continue;
    }

    if (argument === '--include-similar') {
      options.includeSimilar = true;
      continue;
    }

    if (argument === '--missing-only') {
      options.includeDuplicates = false;
      options.includeSimilar = false;
      continue;
    }

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--verbose') {
      options.verbose = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function shouldIncludeLocale(localeCode, localeFilter) {
  return localeFilter.size === 0 || localeFilter.has(localeCode);
}

function compareJobs(left, right) {
  return [
    left.surface.localeCompare(right.surface),
    left.localeCode.localeCompare(right.localeCode),
    left.targetRelativePath.localeCompare(right.targetRelativePath),
    left.gapType.localeCompare(right.gapType),
  ].find((value) => value !== 0) ?? 0;
}

function createDocsTargetRelativePath(localeCode, baselineRelativePath) {
  return toPosixPath(path.join('src/content/translations/docs', localeCode, baselineRelativePath));
}

function createBlogTargetRelativePath(localeCode, baselineRelativePath) {
  const locale = blogLocaleMap.get(localeCode);
  if (!locale) {
    throw new Error(`Unsupported blog locale: ${localeCode}`);
  }

  const relativeInsideBlog = baselineRelativePath.startsWith('blog/')
    ? baselineRelativePath.slice('blog/'.length)
    : path.posix.basename(baselineRelativePath);

  return toPosixPath(path.join('src/content/docs', locale.blogDir, relativeInsideBlog));
}

function createJob({
  surface,
  gapType,
  localeCode,
  sourceAbsolutePath,
  sourceRelativePath,
  targetAbsolutePath,
  targetRelativePath,
}) {
  return {
    surface,
    gapType,
    localeCode,
    sourceAbsolutePath,
    sourceRelativePath,
    targetAbsolutePath,
    targetRelativePath,
  };
}

export function collectTranslationJobs({
  docsReport,
  blogReport,
  contentRoot,
  translationRoot,
  locales = new Set(),
  surfaces = new Set(validSurfaces),
  includeMissing = true,
  includeDuplicates = false,
  includeSimilar = false,
  limit = Number.POSITIVE_INFINITY,
}) {
  const jobs = [];

  if (surfaces.has('docs')) {
    for (const entry of docsReport.entries) {
      const baselineRelativePath = entry.baselinePath;
      const sourceAbsolutePath = path.join(contentRoot, baselineRelativePath);

      if (includeMissing) {
        for (const localeCode of entry.missingLocales) {
          if (!shouldIncludeLocale(localeCode, locales)) {
            continue;
          }

          const targetRelativePath = createDocsTargetRelativePath(localeCode, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'docs',
              gapType: 'missing',
              localeCode,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }

      if (includeDuplicates) {
        for (const comparison of entry.duplicateComparisons) {
          if (!shouldIncludeLocale(comparison.locale, locales)) {
            continue;
          }

          const targetRelativePath = createDocsTargetRelativePath(comparison.locale, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'docs',
              gapType: 'duplicate',
              localeCode: comparison.locale,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }

      if (includeSimilar) {
        for (const comparison of entry.similarComparisons) {
          if (!shouldIncludeLocale(comparison.locale, locales)) {
            continue;
          }

          const targetRelativePath = createDocsTargetRelativePath(comparison.locale, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'docs',
              gapType: 'similar',
              localeCode: comparison.locale,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }
    }
  }

  if (surfaces.has('blog')) {
    for (const entry of blogReport.entries) {
      const baselineEntry = entry.locales[baselineLocale];
      if (!baselineEntry?.path) {
        continue;
      }

      const baselineRelativePath = baselineEntry.path;
      const sourceAbsolutePath = path.join(contentRoot, baselineRelativePath);

      if (includeMissing) {
        for (const localeCode of entry.missingLocales) {
          if (!shouldIncludeLocale(localeCode, locales)) {
            continue;
          }

          const targetRelativePath = createBlogTargetRelativePath(localeCode, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'blog',
              gapType: 'missing',
              localeCode,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }

      if (includeDuplicates) {
        for (const comparison of entry.duplicateComparisons) {
          if (!shouldIncludeLocale(comparison.locale, locales)) {
            continue;
          }

          const targetRelativePath = createBlogTargetRelativePath(comparison.locale, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'blog',
              gapType: 'duplicate',
              localeCode: comparison.locale,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }

      if (includeSimilar) {
        for (const comparison of entry.similarComparisons) {
          if (!shouldIncludeLocale(comparison.locale, locales)) {
            continue;
          }

          const targetRelativePath = createBlogTargetRelativePath(comparison.locale, baselineRelativePath);
          jobs.push(
            createJob({
              surface: 'blog',
              gapType: 'similar',
              localeCode: comparison.locale,
              sourceAbsolutePath,
              sourceRelativePath: toPosixPath(path.join('src/content/docs', baselineRelativePath)),
              targetAbsolutePath: path.join(docsRoot, targetRelativePath),
              targetRelativePath,
            }),
          );
        }
      }
    }
  }

  return jobs.sort(compareJobs).slice(0, limit);
}

export function buildClaudePrompt(job, sourceContent) {
  return [
    '你是 HagiCode 文档仓库的专业翻译助手。',
    `请将下面的 Markdown/MDX 文件从简体中文直接翻译为 ${job.localeCode}。`,
    '',
    '严格要求：',
    '1. 只输出完整的目标文件内容，不要输出解释、前言、总结，也不要包裹在 ``` 代码块里。',
    '2. 保留 Markdown/MDX 结构、YAML frontmatter、标题层级、列表、表格、引用块、admonition 和空行结构。',
    '3. 保留代码块、内联代码、命令、URL、锚点、import/export 语句、组件名、属性名、变量名、文件路径、API 名称、产品名。',
    '4. 只翻译面向读者的自然语言文本；frontmatter 里的 title 和 description 需要翻译。',
    `5. 如果文件里有明确表示当前文档语言的字段（例如 language 或 locale，且当前值是 ${baselineLocale} 或 root），请改成 ${job.localeCode}。`,
    '6. 不要省略任何内容。',
    '',
    `上下文：surface=${job.surface} gap=${job.gapType}`,
    `源文件路径：${job.sourceRelativePath}`,
    `目标文件路径：${job.targetRelativePath}`,
    '',
    '源文件内容如下：',
    sourceContent,
  ].join('\n');
}

export function buildClaudeArgs(prompt, options = {}) {
  const args = [
    '--bare',
    '--print',
    '--output-format',
    'text',
    '--no-session-persistence',
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.agent) {
    args.push('--agent', options.agent);
  }

  args.push(prompt);
  return args;
}

export function sanitizeClaudeOutput(output) {
  const trimmed = String(output ?? '').trim();
  const fencedMatch = trimmed.match(/^```[A-Za-z0-9_-]*\n([\s\S]*?)\n```$/u);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function normalizeComparableText(value) {
  return String(value ?? '')
    .replace(/\r\n/gu, '\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

function assertTranslatedOutput(sourceContent, translatedContent, job) {
  if (!translatedContent.trim()) {
    throw new Error(`Claude returned empty output for ${job.targetRelativePath}`);
  }

  if (normalizeComparableText(sourceContent) === normalizeComparableText(translatedContent)) {
    throw new Error(`Claude returned unchanged content for ${job.targetRelativePath}`);
  }
}

async function runClaude(prompt, options = {}) {
  const args = buildClaudeArgs(prompt, options);

  return new Promise((resolve, reject) => {
    const child = spawn(options.claudeExecutable, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
      reject(new Error(detail || `Claude CLI exited with code ${code}`));
    });
  });
}

async function executeJob(job, options) {
  const sourceContent = await fs.readFile(job.sourceAbsolutePath, 'utf8');
  const prompt = buildClaudePrompt(job, sourceContent);

  if (options.dryRun) {
    console.log(`[dry-run] ${job.gapType} ${job.localeCode} ${job.targetRelativePath}`);
    return { wrote: false };
  }

  console.log(`[translate] ${job.gapType} ${job.localeCode} ${job.targetRelativePath}`);
  const rawOutput = await runClaude(prompt, {
    claudeExecutable: options.claudeExecutable,
    cwd: docsRoot,
    model: options.model,
    agent: options.agent,
  });
  const translatedContent = sanitizeClaudeOutput(rawOutput);
  assertTranslatedOutput(sourceContent, translatedContent, job);
  await fs.mkdir(path.dirname(job.targetAbsolutePath), { recursive: true });
  await fs.writeFile(job.targetAbsolutePath, `${translatedContent.trimEnd()}\n`, 'utf8');
  return { wrote: true };
}

function summarizeJobs(jobs) {
  const summary = {
    total: jobs.length,
    docs: 0,
    blog: 0,
    missing: 0,
    duplicate: 0,
    similar: 0,
  };

  for (const job of jobs) {
    summary[job.surface] += 1;
    summary[job.gapType] += 1;
  }

  return summary;
}

export async function translateMissingContentWithClaude(options = {}) {
  const contentRoot = path.resolve(options.contentRoot ?? defaultContentRoot);
  const translationRoot = path.resolve(options.translationRoot ?? defaultTranslationRoot);
  const projectRoot = inferProjectRoot(contentRoot, options.projectRoot);
  const docsReport = await generateDocsTranslationReport({
    contentRoot,
    translationRoot,
    projectRoot,
    reportPath: '',
  });
  const blogReport = await generateBlogTranslationReport({
    contentRoot,
    projectRoot,
    reportPath: '',
  });

  const jobs = collectTranslationJobs({
    docsReport,
    blogReport,
    contentRoot,
    translationRoot,
    locales: options.locales ?? new Set(),
    surfaces: options.surfaces ?? new Set(validSurfaces),
    includeMissing: options.includeMissing ?? true,
    includeDuplicates: options.includeDuplicates ?? false,
    includeSimilar: options.includeSimilar ?? false,
    limit: options.limit ?? Number.POSITIVE_INFINITY,
  });

  const summary = summarizeJobs(jobs);
  console.log(
    `Planned ${summary.total} translation jobs (docs=${summary.docs}, blog=${summary.blog}, missing=${summary.missing}, duplicate=${summary.duplicate}, similar=${summary.similar}).`,
  );

  if (jobs.length === 0) {
    console.log('No translation jobs matched the current filters.');
    return { jobs, written: 0, failed: [] };
  }

  const failed = [];
  let written = 0;

  for (const job of jobs) {
    try {
      const result = await executeJob(job, options);
      if (result.wrote) {
        written += 1;
      }
    } catch (error) {
      failed.push({
        job,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`[failed] ${job.targetRelativePath}: ${failed.at(-1)?.message}`);
    }
  }

  console.log(`Completed translation jobs: wrote=${written}, failed=${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }

  return { jobs, written, failed };
}

export async function main(argv = process.argv.slice(2)) {
  const cliOptions = parseArgs(argv);
  return translateMissingContentWithClaude(cliOptions);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
