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
