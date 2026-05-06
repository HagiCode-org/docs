import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildClaudeArgs,
  buildClaudePrompt,
  collectTranslationJobs,
  sanitizeClaudeOutput,
} from '../scripts/translate-missing-content-with-claude.mjs';

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

test('buildClaudePrompt embeds translation instructions and file context', () => {
  const prompt = buildClaudePrompt(
    {
      surface: 'docs',
      gapType: 'missing',
      localeCode: 'en-US',
      sourceRelativePath: 'src/content/docs/guides/example.mdx',
      targetRelativePath: 'src/content/translations/docs/en-US/guides/example.mdx',
    },
    '---\ntitle: 示例\n---\n\n# 标题\n',
  );

  assert.match(prompt, /简体中文直接翻译为 en-US/);
  assert.match(prompt, /src\/content\/docs\/guides\/example\.mdx/);
  assert.match(prompt, /src\/content\/translations\/docs\/en-US\/guides\/example\.mdx/);
  assert.match(prompt, /frontmatter 里的 title 和 description 需要翻译/);
});

test('buildClaudeArgs keeps print mode deterministic', () => {
  const args = buildClaudeArgs('translate me', {
    model: 'sonnet',
    agent: 'translator',
  });

  assert.deepEqual(args.slice(0, 6), [
    '--bare',
    '--print',
    '--output-format',
    'text',
    '--no-session-persistence',
    '--model',
  ]);
  assert.equal(args[6], 'sonnet');
  assert.equal(args[7], '--agent');
  assert.equal(args[8], 'translator');
  assert.equal(args.at(-1), 'translate me');
});

test('sanitizeClaudeOutput strips a top-level fenced block', () => {
  assert.equal(
    sanitizeClaudeOutput('```mdx\n---\ntitle: Hello\n---\n\n# Heading\n```'),
    '---\ntitle: Hello\n---\n\n# Heading',
  );
  assert.equal(sanitizeClaudeOutput('plain text\n'), 'plain text');
});
