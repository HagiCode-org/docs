import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildPiArgs,
  buildPiPrompt,
  collectTranslationJobs,
  sanitizePiOutput,
} from '../scripts/translate-missing-content-with-pi.mjs';

test('collectTranslationJobs plans missing and duplicate work across docs and blog', () => {
  const docsReport = {
    entries: [
      {
        baselinePath: 'guides/example.mdx',
        missingLocales: ['en-US'],
        duplicateComparisons: [{ locale: 'ja-JP' }],
        similarComparisons: [{ locale: 'ko-KR', similarity: 0.99 }],
      },
    ],
  };
  const blogReport = {
    entries: [
      {
        locales: {
          'zh-CN': { path: 'blog/2026-05-06-example.mdx' },
        },
        missingLocales: ['en-US'],
        duplicateComparisons: [{ locale: 'fr-FR' }],
        similarComparisons: [],
      },
    ],
  };

  const jobs = collectTranslationJobs({
    docsReport,
    blogReport,
    contentRoot: '/repo/src/content/docs',
    translationRoot: '/repo/src/content/translations/docs',
    locales: new Set(['en-US', 'ja-JP', 'fr-FR']),
    surfaces: new Set(['docs', 'blog']),
    includeMissing: true,
    includeDuplicates: true,
    includeSimilar: false,
  });

  assert.deepEqual(
    jobs.map((job) => ({
      surface: job.surface,
      gapType: job.gapType,
      localeCode: job.localeCode,
      targetRelativePath: job.targetRelativePath,
    })),
    [
      {
        surface: 'blog',
        gapType: 'missing',
        localeCode: 'en-US',
        targetRelativePath: 'src/content/docs/en-US/blog/2026-05-06-example.mdx',
      },
      {
        surface: 'blog',
        gapType: 'duplicate',
        localeCode: 'fr-FR',
        targetRelativePath: 'src/content/docs/fr-FR/blog/2026-05-06-example.mdx',
      },
      {
        surface: 'docs',
        gapType: 'missing',
        localeCode: 'en-US',
        targetRelativePath: 'src/content/translations/docs/en-US/guides/example.mdx',
      },
      {
        surface: 'docs',
        gapType: 'duplicate',
        localeCode: 'ja-JP',
        targetRelativePath: 'src/content/translations/docs/ja-JP/guides/example.mdx',
      },
    ],
  );
});

test('collectTranslationJobs respects locale and surface filters plus limit', () => {
  const docsReport = {
    entries: [
      {
        baselinePath: 'guide-a.mdx',
        missingLocales: ['en-US', 'ja-JP'],
        duplicateComparisons: [],
        similarComparisons: [],
      },
    ],
  };
  const blogReport = {
    entries: [
      {
        locales: {
          'zh-CN': { path: 'blog/2026-01-01-a.mdx' },
        },
        missingLocales: ['en-US'],
        duplicateComparisons: [],
        similarComparisons: [],
      },
    ],
  };

  const jobs = collectTranslationJobs({
    docsReport,
    blogReport,
    contentRoot: '/repo/src/content/docs',
    translationRoot: '/repo/src/content/translations/docs',
    locales: new Set(['ja-JP']),
    surfaces: new Set(['docs']),
    includeMissing: true,
    includeDuplicates: false,
    includeSimilar: false,
    limit: 1,
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.surface, 'docs');
  assert.equal(jobs[0]?.localeCode, 'ja-JP');
});

test('buildPiPrompt embeds translation instructions and file context', () => {
  const prompt = buildPiPrompt(
    {
      surface: 'docs',
      gapType: 'missing',
      localeCode: 'en-US',
      sourceRelativePath: 'src/content/docs/guides/example.mdx',
      targetRelativePath: 'src/content/translations/docs/en-US/guides/example.mdx',
    },
    '---\ntitle: 示例\n---\n\n# 标题\n',
  );

  assert.match(prompt, /Pi CLI/);
  assert.match(prompt, /简体中文直接翻译为 en-US/);
  assert.match(prompt, /src\/content\/docs\/guides\/example\.mdx/);
  assert.match(prompt, /src\/content\/translations\/docs\/en-US\/guides\/example\.mdx/);
  assert.match(prompt, /frontmatter 里的 title 和 description 需要翻译/);
});

test('buildPiArgs keeps print mode deterministic', () => {
  const args = buildPiArgs('translate me', {
    provider: 'github-copilot',
    model: 'gh/gpt-codex-5.3',
  });

  assert.deepEqual(args.slice(0, 4), [
    '--mode',
    'text',
    '--print',
    '--no-session',
  ]);
  assert.equal(args[4], '--provider');
  assert.equal(args[5], 'github-copilot');
  assert.equal(args[6], '--model');
  assert.equal(args[7], 'gh/gpt-codex-5.3');
  assert.equal(args.at(-1), 'translate me');
});

test('sanitizePiOutput strips a top-level fenced block', () => {
  assert.equal(
    sanitizePiOutput('```mdx\n---\ntitle: Hello\n---\n\n# Heading\n```'),
    '---\ntitle: Hello\n---\n\n# Heading',
  );
  assert.equal(sanitizePiOutput('plain text\n'), 'plain text');
});

test('buildPiArgs omits provider when not supplied', () => {
  const args = buildPiArgs('translate me', {
    model: 'gh/gpt-codex-5.3',
  });

  assert.equal(args.includes('--provider'), false);
  assert.equal(args.includes('--model'), true);
});

test('buildPiPrompt includes locale switching rule for baseline locale', () => {
  const prompt = buildPiPrompt(
    {
      surface: 'blog',
      gapType: 'missing',
      localeCode: 'ja-JP',
      sourceRelativePath: path.join('src', 'content', 'docs', 'blog', 'a.mdx').replaceAll('\\\\', '/'),
      targetRelativePath: 'src/content/docs/ja-JP/blog/a.mdx',
    },
    'language: zh-CN\n',
  );

  assert.match(prompt, /当前值是 zh-CN 或 root/);
  assert.match(prompt, /请改成 ja-JP/);
});
