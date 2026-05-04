import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

import {
  analyzeBlogSeoEntry,
  extractLeadContent,
  scoreDescription,
} from '../scripts/blog-seo-description-utils.mjs';

function makeTempBlogRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-blog-seo-'));
  fs.mkdirSync(path.join(rootDir, 'src/content/docs/blog'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src/content/translations/docs/en-US/blog'), { recursive: true });
  return rootDir;
}

test('extractLeadContent skips note-like lead paragraphs and keeps the first valid paragraph', () => {
  const body = `
note[时间语境说明] 本文记录的是发布当时的版本状态。

真正的正文首段会说明 Vault 系统如何帮助 AI 复用跨项目知识。

\`\`\`ts
const ignored = true;
\`\`\`
`;

  const lead = extractLeadContent(body, 'zh');

  assert.equal(lead.leadParagraph, '真正的正文首段会说明 Vault 系统如何帮助 AI 复用跨项目知识。');
});

test('analyzeBlogSeoEntry preserves manual description over generated candidates', () => {
  const entry = {
    locale: 'en',
    localeLabel: 'en-US',
    fullPath: '/tmp/example.mdx',
    relativePath: 'src/content/translations/docs/en-US/blog/example.mdx',
    slug: 'example',
    source: 'unused',
    frontmatter: 'title: Example title\ndescription: Manual description',
    body: '> Generated lead that should not replace the manual field.',
    title: 'Example title',
    existingDescription: 'Manual description',
    leadQuote: 'Generated lead that should not replace the manual field.',
    leadParagraph: 'Generated lead that should not replace the manual field.',
  };

  const analysis = analyzeBlogSeoEntry(entry);

  assert.equal(analysis.sourceType, 'manual');
  assert.equal(analysis.resolvedDescription, 'Manual description');
  assert.equal(analysis.shouldWriteMissing, false);
});

test('scoreDescription applies different zh and en thresholds', () => {
  const mediumText = 'A'.repeat(50);
  const zhScore = scoreDescription({
    description: mediumText,
    title: '中文标题',
    locale: 'zh',
    sourceType: 'generated-lead',
  });
  const enScore = scoreDescription({
    description: mediumText,
    title: 'English title',
    locale: 'en',
    sourceType: 'generated-lead',
  });

  assert.equal(zhScore.suggestions.includes('too-short'), false);
  assert.equal(enScore.suggestions.includes('too-short'), true);
});

test('verify script writes a machine-readable report and fails on unusable descriptions', () => {
  const rootDir = makeTempBlogRepo();
  const reportPath = '.tmp/test-blog-seo-report.json';

  fs.writeFileSync(
    path.join(rootDir, 'src/content/docs/blog/failing.mdx'),
    `---\ntitle: 重复标题\ndescription: 重复标题\n---\n\n## 重复标题\n\n正文。\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'src/content/translations/docs/en-US/blog/passing.mdx'),
    `---\ntitle: Useful English Title\ndescription: Helpful summary about the verified English blog workflow.\n---\n\n## Useful English Title\n\nBody.\n`,
    'utf8',
  );

  let status = 0;
  let stdout = '';

  try {
    stdout = execFileSync(
      'node',
      ['./scripts/verify-blog-seo-descriptions.mjs', '--root-dir', rootDir, '--report-json', reportPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
  } catch (error) {
    status = error.status ?? 1;
    stdout = error.stdout ?? '';
  }

  const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), 'utf8'));

  assert.equal(status, 1);
  assert.match(stdout, /Blog SEO description verification/);
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.failing, 1);
  assert.equal(report.entries.some((entry) => entry.failures.includes('title-duplicate')), true);
});
