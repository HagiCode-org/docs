import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractH1Texts,
  getBlogSourceEntries,
  hiddenFirstPanelRuleExists,
  parseFrontmatterTitle,
  scanMarkdownH1s,
  splitFrontmatter,
} from '../scripts/blog-heading-utils.mjs';

test('scanMarkdownH1s ignores fenced code blocks and returns line numbers', () => {
  const source = `---\ntitle: Example\n---\n\n# Intro\n\n\`\`\`yaml\n# ignored\n\`\`\`\n\n## Details\n`;
  const { body, bodyStartLine } = splitFrontmatter(source);
  const headings = scanMarkdownH1s(body, bodyStartLine);

  assert.deepEqual(headings, [{ line: 5, text: 'Intro' }]);
});

test('parseFrontmatterTitle supports quoted and unquoted titles', () => {
  assert.equal(parseFrontmatterTitle('title: "Quoted Title"'), 'Quoted Title');
  assert.equal(parseFrontmatterTitle('title: Plain Title'), 'Plain Title');
});

test('extractH1Texts normalizes nested markup', () => {
  const html = '<h1><span>Docs</span> <em>Blog</em></h1>';
  assert.deepEqual(extractH1Texts(html), ['Docs Blog']);
});

test('extractH1Texts decodes common HTML entities before comparison', () => {
  const html = '<h1>HagiCode&#39;s &quot;quoting&quot; test</h1>';
  assert.deepEqual(extractH1Texts(html), [`HagiCode's "quoting" test`]);
});

test('hiddenFirstPanelRuleExists detects hidden title panel CSS', () => {
  assert.equal(hiddenFirstPanelRuleExists('.content-panel:first-of-type{display:none}'), true);
  assert.equal(hiddenFirstPanelRuleExists('.content-panel:first-of-type{display:block}'), false);
});

test('getBlogSourceEntries reads localized blog titles from the matching locale directory', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-blog-heading-'));
  fs.mkdirSync(path.join(rootDir, 'src/content/docs/blog'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src/content/docs/en/blog'), { recursive: true });

  fs.writeFileSync(
    path.join(rootDir, 'src/content/docs/blog/example.mdx'),
    '---\ntitle: 中文标题\n---\n\n内容\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'src/content/docs/en/blog/example.mdx'),
    '---\ntitle: English Title\n---\n\nBody\n',
    'utf8',
  );

  const zhEntries = getBlogSourceEntries({ locale: 'zh', rootDir });
  const enEntries = getBlogSourceEntries({ locale: 'en', rootDir });

  assert.equal(zhEntries[0].title, '中文标题');
  assert.equal(enEntries[0].title, 'English Title');
  assert.equal(enEntries[0].locale, 'en');
});
