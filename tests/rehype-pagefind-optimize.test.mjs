import assert from 'node:assert/strict';
import test from 'node:test';

import {
  rehypePagefindOptimize,
  shouldIgnoreForPagefind,
} from '../src/integrations/rehype-pagefind-optimize.mjs';

test('shouldIgnoreForPagefind matches pre and expressive-code wrappers', () => {
  assert.equal(shouldIgnoreForPagefind({ type: 'element', tagName: 'pre', properties: {} }), true);
  assert.equal(
    shouldIgnoreForPagefind({ type: 'element', tagName: 'figure', properties: { className: ['expressive-code'] } }),
    true,
  );
  assert.equal(shouldIgnoreForPagefind({ type: 'element', tagName: 'p', properties: {} }), false);
});

test('rehypePagefindOptimize annotates matching nodes with data-pagefind-ignore', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'element', tagName: 'p', properties: {}, children: [] },
      { type: 'element', tagName: 'pre', properties: {}, children: [] },
      {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['expressive-code'] },
        children: [],
      },
    ],
  };

  rehypePagefindOptimize()(tree);

  assert.equal(tree.children[0].properties['data-pagefind-ignore'], undefined);
  assert.equal(tree.children[1].properties['data-pagefind-ignore'], '');
  assert.equal(tree.children[2].properties['data-pagefind-ignore'], '');
});
