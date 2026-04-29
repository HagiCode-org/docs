import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  REQUIRED_BLOG_LOCALES,
  validateBlogI18nCompleteness,
} from '../scripts/verify-blog-i18n-completeness.mjs';

async function withFixture(fn) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-blog-i18n-'));
  try {
    await fn(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function writePost(root, locale, slug, frontmatter = {}) {
  const directory = path.join(root, locale.blogDir);
  await fs.mkdir(directory, { recursive: true });
  const frontmatterLines = Object.entries({
    title: `${slug} ${locale.code}`,
    date: '2026-04-29',
    ...frontmatter,
  }).map(([key, value]) => `${key}: ${value}`);

  await fs.writeFile(
    path.join(directory, `${slug}.mdx`),
    `---\n${frontmatterLines.join('\n')}\n---\n\nContent for ${locale.code}.\n`,
    'utf8',
  );
}

async function writeCompleteSet(root, slug = '2026-04-29-example') {
  await Promise.all(REQUIRED_BLOG_LOCALES.map((locale) => writePost(root, locale, slug)));
}

test('passes when every required desktop language has matching blog slug', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root);
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, true);
    assert.equal(result.slugCount, 1);
    assert.equal(result.locales.length, REQUIRED_BLOG_LOCALES.length);
  });
});

test('reports a missing language directory', async () => {
  await withFixture(async (root) => {
    await writePost(root, REQUIRED_BLOG_LOCALES[0], '2026-04-29-example');
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, false);
    assert(result.diagnostics.some((diagnostic) => diagnostic.code === 'missing-language-directory'));
  });
});

test('reports a missing localized counterpart file', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root);
    await fs.rm(path.join(root, 'fr-FR/blog/2026-04-29-example.mdx'));
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, false);
    assert(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing-translation' && diagnostic.locale === 'fr-FR',
      ),
    );
  });
});

test('reports unsupported explicit language metadata', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root);
    await writePost(root, REQUIRED_BLOG_LOCALES[0], '2026-04-29-example', { language: 'it-IT' });
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, false);
    assert(result.diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-language'));
  });
});

test('reports route and language metadata conflicts', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root);
    await writePost(root, REQUIRED_BLOG_LOCALES[2], '2026-04-29-example', { language: 'zh-CN' });
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, false);
    assert(result.diagnostics.some((diagnostic) => diagnostic.code === 'route-language-conflict'));
  });
});

test('ignores non-post support files such as authors.yml', async () => {
  await withFixture(async (root) => {
    await writeCompleteSet(root);
    await fs.writeFile(path.join(root, 'blog/authors.yml'), 'hagicode: HagiCode Team\n', 'utf8');
    const result = await validateBlogI18nCompleteness({ contentRoot: root });

    assert.equal(result.ok, true);
  });
});
