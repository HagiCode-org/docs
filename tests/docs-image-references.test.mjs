import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  auditDocsImageReferences,
  classifyImageTarget,
  main,
} from '../scripts/verify-docs-image-references.mjs';

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'docs-image-references-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

async function listTree(root) {
  const entries = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else {
        entries.push([path.relative(root, entryPath), await readFile(entryPath, 'utf8')]);
      }
    }
  }
  await walk(root);
  return entries.sort();
}

async function withFixture(files, run) {
  const root = await createFixture(files);
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('classifies relative, site-root and remote targets', () => {
  assert.equal(classifyImageTarget('../img/screenshots/x/original.png'), 'relative');
  assert.equal(classifyImageTarget('./img/a.png'), 'relative');
  assert.equal(classifyImageTarget('/article-images/a/b.png'), 'site-root');
  assert.equal(classifyImageTarget('https://example.com/a.png'), 'remote');
  assert.equal(classifyImageTarget('//cdn.example.com/a.png'), 'remote');
  assert.equal(classifyImageTarget('data:image/png;base64,AAAA'), 'remote');
});

test('accepts a relative body image and reports the page as picture-eligible', async () => {
  await withFixture(
    {
      'src/content/docs/guides/a.md': '# A\n\n![Alt](../img/screenshots/x/original.png)\n',
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.deepEqual(result.violations, []);
      assert.equal(result.pictureEligible.length, 1);
      assert.equal(result.pictureEligible[0].file, 'src/content/docs/guides/a.md');
      assert.equal(result.mdxOnly.length, 0);
    },
  );
});

test('rejects a site-root body image with its file and line', async () => {
  await withFixture(
    {
      'src/content/docs/blog/post.mdx': '# Post\n\nIntro\n\n![Alt](/article-images/a/b.png)\n',
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.deepEqual(result.violations, [
        { file: 'src/content/docs/blog/post.mdx', line: 5, target: '/article-images/a/b.png', kind: 'site-root' },
      ]);
    },
  );
});

test('rejects a remote body image', async () => {
  await withFixture(
    {
      'src/content/translations/docs/ja-JP/blog/post.md': '![Alt](https://example.com/a.png)\n',
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].kind, 'remote');
      assert.equal(result.violations[0].line, 1);
    },
  );
});

test('rejects a site-root raw img element in a body', async () => {
  await withFixture(
    {
      'src/content/docs/guides/html.md': 'Text\n\n<img src="/article-images/a/b.png" alt="x">\n',
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].target, '/article-images/a/b.png');
      assert.equal(result.violations[0].line, 3);
    },
  );
});

test('ignores images inside fenced code and inline code', async () => {
  await withFixture(
    {
      'src/content/docs/blog/sample.md': [
        '# Sample',
        '',
        '```md',
        '![Alt](/not-an-image.png)',
        '```',
        '',
        'Use `![Alt](/also-not-an-image.png)` in prose.',
        '',
      ].join('\n'),
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.deepEqual(result.violations, []);
      assert.equal(result.pages.length, 0);
    },
  );
});

test('reports MDX pages with the reason they cannot be wrapped in picture markup', async () => {
  await withFixture(
    {
      'src/content/docs/guides/skills.mdx': [
        "import { CardGrid } from '@astrojs/starlight/components';",
        '',
        '![Skill view](../img/screenshots/skills/view/original.png)',
        '',
      ].join('\n'),
      'src/content/docs/guides/plain.mdx': '![Plain](../img/screenshots/plain/original.png)\n',
      'src/content/docs/guides/plain-md.md': '![Plain](../img/screenshots/plain/original.png)\n',
    },
    async (root) => {
      const result = await auditDocsImageReferences(root);
      assert.deepEqual(result.violations, []);
      assert.equal(result.pictureEligible.length, 1);
      assert.equal(result.pictureEligible[0].file, 'src/content/docs/guides/plain-md.md');
      const reasons = Object.fromEntries(result.mdxOnly.map((page) => [page.file, page.reason]));
      assert.equal(reasons['src/content/docs/guides/skills.mdx'], 'imports components or scripts');
      assert.equal(reasons['src/content/docs/guides/plain.mdx'], 'MDX file without imports');
    },
  );
});

test('does not write or change any file in the tree', async () => {
  await withFixture(
    {
      'src/content/docs/blog/bad.md': '![Alt](/article-images/a/b.png)\n',
      'src/content/docs/guides/ok.md': '![Alt](../img/a.png)\n',
    },
    async (root) => {
      const before = await listTree(root);
      await auditDocsImageReferences(root);
      assert.deepEqual(await listTree(root), before);
    },
  );
});

test('main sets a non-zero exit code for a violating tree', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const previousExitCode = process.exitCode;
  await withFixture(
    {
      'src/content/docs/blog/bad.md': '![Alt](/article-images/a/b.png)\n',
    },
    async (root) => {
      try {
        await main(root);
        assert.equal(process.exitCode, 1);
      } finally {
        process.exitCode = previousExitCode;
      }
    },
  );
});
