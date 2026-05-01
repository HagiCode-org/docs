import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExcerptFromMarkdown,
  resolveBlogEntryExcerpt,
  truncateText,
} from '../src/integrations/starlight-blog-no-tags/components/excerpt-utils.mjs';

test('resolveBlogEntryExcerpt prefers explicit excerpt over description and body', () => {
  const entry = {
    data: {
      excerpt: 'Explicit excerpt wins.',
      description: 'Description should not be used.',
    },
    body: '# Title\n\nBody should not be used.',
  };

  assert.equal(resolveBlogEntryExcerpt(entry), 'Explicit excerpt wins.');
});

test('resolveBlogEntryExcerpt falls back to description instead of rendering full content', () => {
  const entry = {
    data: {
      description: 'Compact summary from frontmatter.',
    },
    body: '# Huge Title\n\nA very long body that should stay out of the blog list page.',
  };

  assert.equal(resolveBlogEntryExcerpt(entry), 'Compact summary from frontmatter.');
});

test('createExcerptFromMarkdown strips markdown constructs and excerpt delimiters', () => {
  const excerpt = createExcerptFromMarkdown(
    `# Title\n\nIntro paragraph with [a link](https://example.com).\n\n> Quoted note.\n\n- Bullet one\n- Bullet two\n\n\
\`\`\`ts\nconst ignored = true;\n\`\`\`\n\n<!-- excerpt -->\n\nTrailing content that must not appear.`,
    { maxLength: 120 },
  );

  assert.equal(excerpt, 'Title Intro paragraph with a link. Quoted note. Bullet one Bullet two');
  assert.doesNotMatch(excerpt, /ignored = true/);
  assert.doesNotMatch(excerpt, /Trailing content/);
});

test('createExcerptFromMarkdown truncates long markdown-derived text cleanly', () => {
  const excerpt = createExcerptFromMarkdown(
    '# Title\n\nThis paragraph is intentionally long so the generated excerpt has to be shortened at a reasonable word boundary for the blog list page.',
    { maxLength: 80 },
  );

  assert.equal(excerpt, 'Title This paragraph is intentionally long so the generated excerpt has to be...');
});

test('truncateText preserves short strings and shortens long strings cleanly', () => {
  assert.equal(truncateText('short text', 20), 'short text');
  assert.equal(truncateText('This sentence should be shortened on a word boundary.', 28), 'This sentence should be...');
});
