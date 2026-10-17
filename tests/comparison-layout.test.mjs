import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPARISON_SECTION_ROLES,
  fillCopyTemplate,
  findDecisionPair,
  groupDecisionBlocks,
  resolveComparisonLayout,
  splitInlineCode,
} from '../src/lib/comparison-layout.mjs';
import { getStructuredArticleViewModel, listStructuredArticleSlugs } from '../src/lib/articles.mjs';

function sevenSections({ headers = ['Aspect', 'Claude Code', 'HagiCode'] } = {}) {
  return COMPARISON_SECTION_ROLES.map((role, index) => ({
    id: `s-${index + 1}`,
    title: role,
    blocks: index === 1 ? [{ id: 'table', type: 'comparison-table', headers, rows: [] }] : [{ id: `b-${index}`, type: 'rich-text', content: ['x'] }],
  }));
}

test('resolveComparisonLayout recognises the seven-section contract and reads both display names from the table', () => {
  const layout = resolveComparisonLayout(sevenSections());
  assert.deepEqual(layout.roles, COMPARISON_SECTION_ROLES);
  assert.equal(layout.agentName, 'Claude Code');
  assert.equal(layout.hagicodeName, 'HagiCode');
});

test('resolveComparisonLayout returns null for any other shape', () => {
  assert.equal(resolveComparisonLayout(undefined), null);
  assert.equal(resolveComparisonLayout(sevenSections().slice(0, 3)), null);
  assert.equal(resolveComparisonLayout(sevenSections({ headers: ['Aspect', 'HagiCode'] })), null);

  const noTable = sevenSections();
  noTable[1].blocks = [{ id: 'x', type: 'rich-text', content: ['x'] }];
  assert.equal(resolveComparisonLayout(noTable), null);
});

test('groupDecisionBlocks merges the two choose lists where the first one stood and keeps the rest', () => {
  const blocks = [
    { id: 'a-choose-agent', type: 'bullet-list', items: ['one'] },
    { id: 'a-choose-hagicode', type: 'bullet-list', items: ['two'] },
    { id: 'a-not-a-fit', type: 'callout', tone: 'warning', content: ['x'] },
  ];

  const grouped = groupDecisionBlocks(blocks);
  assert.deepEqual(grouped.map((block) => block.type), ['decision-split', 'callout']);
  assert.equal(grouped[0].agent, blocks[0]);
  assert.equal(grouped[0].hagicode, blocks[1]);
});

test('groupDecisionBlocks leaves blocks alone when the pair is incomplete', () => {
  const blocks = [{ id: 'a-choose-agent', type: 'bullet-list', items: ['one'] }];
  assert.equal(findDecisionPair(blocks), null);
  assert.equal(groupDecisionBlocks(blocks), blocks);
});

test('splitInlineCode turns backtick spans into code segments and leaves a lone backtick literal', () => {
  assert.deepEqual(splitInlineCode('Run `claude --version`, then `claude`.'), [
    { code: false, text: 'Run ' },
    { code: true, text: 'claude --version' },
    { code: false, text: ', then ' },
    { code: true, text: 'claude' },
    { code: false, text: '.' },
  ]);
  assert.deepEqual(splitInlineCode('50% off ` today'), [{ code: false, text: '50% off ` today' }]);
  assert.deepEqual(splitInlineCode(''), []);
});

test('fillCopyTemplate fills known placeholders and keeps unknown ones', () => {
  assert.equal(fillCopyTemplate('Choose {name} when', { name: 'Pi' }), 'Choose Pi when');
  assert.equal(fillCopyTemplate('{missing}', {}), '{missing}');
});

test('every shipped en-US and zh-CN article follows the seven-section contract with a complete decision pair', () => {
  for (const locale of ['en-US', 'zh-CN']) {
    for (const slug of listStructuredArticleSlugs()) {
      const { sections } = getStructuredArticleViewModel(slug, locale);
      const layout = resolveComparisonLayout(sections);
      assert.ok(layout, `${locale}/${slug} should match the comparison layout`);
      assert.ok(findDecisionPair(sections[3].blocks), `${locale}/${slug} should have a choose-agent and choose-hagicode pair`);
    }
  }
});
