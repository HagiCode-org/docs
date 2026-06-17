import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { materializeDocsContentTree } from '../scripts/materialize-docs-content-tree.mjs';

async function withFixture(fn) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-content-assembly-'));
  try {
    await fn(rootDir);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

async function writeFile(rootDir, relativePath, content) {
  const filePath = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

test('content assembly overlays translations and materializes locale fallback routes', async () => {
  await withFixture(async (rootDir) => {
    await writeFile(
      rootDir,
      'src/content/docs/guides/example.mdx',
      `---
title: 基线文档
---

[Quick Start](../quick-start/)
![Example](../img/example.png)
`,
    );
    await writeFile(
      rootDir,
      'src/content/docs/quick-start/index.mdx',
      `---
title: 快速开始
---

内容
`,
    );
    await writeFile(rootDir, 'src/content/docs/img/example.png', 'binary-placeholder');
    await writeFile(
      rootDir,
      'src/content/translations/docs/en-US/guides/example.mdx',
      `---
title: English Translation
---

Localized body.
`,
    );

    await materializeDocsContentTree({ docsRoot: rootDir });

    const baselineOutput = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/guides/example.mdx'),
      'utf8',
    );
    const englishOutput = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/en-US/guides/example.mdx'),
      'utf8',
    );
    const japaneseFallback = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/ja-JP/guides/example.mdx'),
      'utf8',
    );

    assert.match(baselineOutput, /基线文档/u);
    assert.match(englishOutput, /English Translation/u);
    assert.match(japaneseFallback, /\]\(\/ja-JP\/quick-start\/\)/u);
    assert.match(japaneseFallback, /!\[Example\]\(\.\.\/\.\.\/img\/example\.png\)/u);
  });
});

test('content assembly quotes plain-scalar frontmatter values that contain colons', async () => {
  await withFixture(async (rootDir) => {
    await writeFile(
      rootDir,
      'src/content/docs/blog/example.mdx',
      `---
title: Example Title: Needs YAML quoting
description: Safe summary
tags: [example]
---

Body.
`,
    );

    await materializeDocsContentTree({ docsRoot: rootDir });

    const output = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/blog/example.mdx'),
      'utf8',
    );

    assert.match(output, /^title: "Example Title: Needs YAML quoting"$/mu);
    assert.match(output, /^description: Safe summary$/mu);
  });
});

test('content assembly recovers metadata frontmatter after accidental AI preamble text', async () => {
  await withFixture(async (rootDir) => {
    await writeFile(
      rootDir,
      'src/content/docs/blog/example-with-preamble.mdx',
      `I apologize for the technical difficulties. Please save this file manually:

---

---
title: Example Recovery Title
date: 2026-05-09
tags: [example]
---

Recovered body.
`,
    );

    await materializeDocsContentTree({ docsRoot: rootDir });

    const output = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/blog/example-with-preamble.mdx'),
      'utf8',
    );

    assert.doesNotMatch(output, /technical difficulties/u);
    assert.match(output, /^---\ntitle: Example Recovery Title\ndate: 2026-05-09\ntags: \[example\]\n---/u);
    assert.match(output, /^date: 2026-05-09$/mu);
    assert.match(output, /Recovered body\./u);
  });
});

test('content assembly generates structured article FAQ shells from the snapshot tree', async () => {
  await withFixture(async (rootDir) => {
    await writeFile(
      rootDir,
      'src/content/docs/guides/example.mdx',
      `---
title: 基线文档
---

内容
`,
    );

    await writeFile(
      rootDir,
      'src/data/articles.snapshot/index.json',
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        generatedAt: '2026-06-17T00:00:00.000Z',
        localeIndexes: [
          {
            locale: 'zh-CN',
            path: '/articles/zh-CN/index.json',
            updatedAt: '2026-06-17T00:00:00.000Z',
          },
          {
            locale: 'en-US',
            path: '/articles/en-US/index.json',
            updatedAt: '2026-06-17T00:00:00.000Z',
          },
        ],
      }, null, 2)}
`,
    );
    await writeFile(
      rootDir,
      'src/data/articles.snapshot/zh-CN/index.json',
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        locale: 'zh-CN',
        generatedAt: '2026-06-17T00:00:00.000Z',
        articles: [
          {
            slug: 'claude-vs-hagicode',
            category: 'vs-hagicode',
            path: '/articles/zh-CN/claude-vs-hagicode.json',
            updatedAt: '2026-06-17T00:00:00.000Z',
            title: 'Claude Vs HagiCode 中文版',
            summary: '中文摘要',
          },
        ],
      }, null, 2)}
`,
    );
    await writeFile(
      rootDir,
      'src/data/articles.snapshot/en-US/index.json',
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        locale: 'en-US',
        generatedAt: '2026-06-17T00:00:00.000Z',
        articles: [
          {
            slug: 'claude-vs-hagicode',
            category: 'vs-hagicode',
            path: '/articles/en-US/claude-vs-hagicode.json',
            updatedAt: '2026-06-17T00:00:00.000Z',
            title: 'Claude Vs HagiCode',
            summary: 'English summary',
          },
        ],
      }, null, 2)}
`,
    );
    await writeFile(
      rootDir,
      'src/data/articles.snapshot/zh-CN/claude-vs-hagicode.json',
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        slug: 'claude-vs-hagicode',
        category: 'vs-hagicode',
        locale: 'zh-CN',
        updatedAt: '2026-06-17T00:00:00.000Z',
        seo: {
          title: 'Claude Vs HagiCode 中文版',
          description: '中文描述',
        },
        summary: '中文摘要',
        sections: [
          {
            id: 'summary',
            title: '概述',
            blocks: [
              {
                id: 'intro',
                type: 'rich-text',
                content: ['内容'],
              },
            ],
          },
        ],
      }, null, 2)}
`,
    );
    await writeFile(
      rootDir,
      'src/data/articles.snapshot/en-US/claude-vs-hagicode.json',
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        slug: 'claude-vs-hagicode',
        category: 'vs-hagicode',
        locale: 'en-US',
        updatedAt: '2026-06-17T00:00:00.000Z',
        seo: {
          title: 'Claude Vs HagiCode',
          description: 'English description',
        },
        summary: 'English summary',
        sections: [
          {
            id: 'summary',
            title: 'Summary',
            blocks: [
              {
                id: 'intro',
                type: 'rich-text',
                content: ['Content'],
              },
            ],
          },
        ],
      }, null, 2)}
`,
    );

    await materializeDocsContentTree({ docsRoot: rootDir });

    const rootShell = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/faq/claude-vs-hagicode.mdx'),
      'utf8',
    );
    const englishShell = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/en-US/faq/claude-vs-hagicode.mdx'),
      'utf8',
    );
    const japaneseShell = await fs.readFile(
      path.join(rootDir, 'src/content/.generated/docs/ja-JP/faq/claude-vs-hagicode.mdx'),
      'utf8',
    );

    assert.match(rootShell, /^title: "Claude Vs HagiCode 中文版"$/mu);
    assert.match(rootShell, /<StructuredArticlePage slug="claude-vs-hagicode" locale="zh-CN" \/>/u);
    assert.match(englishShell, /^description: "English description"$/mu);
    assert.match(englishShell, /<StructuredArticlePage slug="claude-vs-hagicode" locale="en-US" \/>/u);
    assert.match(japaneseShell, /^title: "Claude Vs HagiCode"$/mu);
    assert.match(japaneseShell, /<StructuredArticlePage slug="claude-vs-hagicode" locale="ja-JP" \/>/u);
  });
});
