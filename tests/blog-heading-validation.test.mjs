import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractH1Texts,
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

test('hiddenFirstPanelRuleExists detects hidden title panel CSS', () => {
  assert.equal(hiddenFirstPanelRuleExists('.content-panel:first-of-type{display:none}'), true);
  assert.equal(hiddenFirstPanelRuleExists('.content-panel:first-of-type{display:block}'), false);
});
