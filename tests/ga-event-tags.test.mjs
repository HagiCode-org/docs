import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { rehype } from 'rehype';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

const BLOG_POST = 'blog/2026-01-22-github-issues-集成/index.html';
const LOCALIZED_BLOG_POST = `en-US/${BLOG_POST}`;
const DESKTOP_INSTALL_PAGES = ['installation/desktop/index.html', 'en-US/installation/desktop/index.html'];
const STRUCTURED_ARTICLE = 'en-US/faq/claude-vs-hagicode/index.html';

const CATEGORIES = ['download', 'navigation', 'community', 'promotion'];
// Components that Docs embeds in article content on purpose; plain in-content links stay untagged.
const EMBEDDED_CTA_LOCATIONS = ['docs_install_button', 'article_cta'];

const parser = rehype();

function readPage(route) {
  return parser.parse(readFileSync(path.join(distDir, route), 'utf8'));
}

function classes(node) {
  const value = node.properties?.className;
  return Array.isArray(value) ? value : value ? String(value).split(/\s+/) : [];
}

// Every element in the page with its ancestors, outermost first.
function elements(root) {
  const found = [];
  const visit = (node, ancestors) => {
    if (node.type !== 'root' && node.type !== 'element') return;
    if (node.type === 'element') found.push({ node, ancestors });
    for (const child of node.children ?? []) visit(child, node.type === 'element' ? [...ancestors, node] : ancestors);
  };
  visit(root, []);
  return found;
}

function text(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(text).join('');
}

function isTagged(node) {
  return node.properties?.dataGaCategory !== undefined || node.properties?.dataGaLabel !== undefined;
}

function tagOf(node) {
  return {
    category: node.properties.dataGaCategory,
    label: node.properties.dataGaLabel,
    location: node.properties.dataGaLocation,
  };
}

function taggedElements(root) {
  return elements(root).filter(({ node }) => isTagged(node));
}

function tagsAt(root, location) {
  return taggedElements(root)
    .map(({ node }) => tagOf(node))
    .filter((tag) => tag.location === location);
}

const regions = {
  sidebar: ({ node, ancestors }) =>
    [...ancestors, node].some((element) => element.tagName === 'sl-sidebar-pane' || (element.tagName === 'nav' && classes(element).includes('sidebar'))),
  'table of contents': ({ node, ancestors }) =>
    [...ancestors, node].some((element) => element.tagName === 'starlight-toc' || element.tagName === 'mobile-starlight-toc'),
  'edit link': ({ node }) => node.properties?.dataDocsEditLink !== undefined || classes(node).includes('docs-edit-link'),
  'language chooser': ({ node, ancestors }) => [...ancestors, node].some((element) => element.tagName === 'hagilight-language-chooser'),
  search: ({ node, ancestors }) => [...ancestors, node].some((element) => element.tagName === 'site-search'),
};

function assertValidTags(root) {
  for (const { node, ancestors } of taggedElements(root)) {
    const { category, label, location } = tagOf(node);
    assert.ok(CATEGORIES.includes(category), `unknown category ${category}`);
    assert.ok(label?.trim(), 'tag without label');
    assert.ok(location?.trim(), 'tag without location');
    assert.ok(!ancestors.some(isTagged), `tagged element nested in another tagged element: ${label}`);
    assert.notEqual(label.trim(), text(node).trim(), `label repeats link text: ${label}`);
  }
}

// Returns how many elements each untracked region matched, so callers can prove the check is not vacuous.
function assertUntrackedRegions(root) {
  const matched = Object.fromEntries(Object.keys(regions).map((name) => [name, 0]));

  for (const entry of elements(root)) {
    for (const [name, inRegion] of Object.entries(regions)) {
      if (inRegion(entry)) {
        matched[name] += 1;
        assert.ok(!isTagged(entry.node), `${name} element carries a data-ga tag`);
      }
    }
  }

  return matched;
}

function assertUntaggedContentLinks(root) {
  const contentLinks = elements(root).filter(
    ({ node, ancestors }) => node.tagName === 'a' && ancestors.some((element) => classes(element).includes('sl-markdown-content')),
  );

  assert.ok(contentLinks.length > 0, 'expected in-content links to check');
  for (const { node } of contentLinks) {
    if (!isTagged(node)) continue;
    assert.ok(
      EMBEDDED_CTA_LOCATIONS.includes(node.properties.dataGaLocation),
      `plain in-content link carries a data-ga tag: ${node.properties.href}`,
    );
  }
}

test('blog posts tag the Store, pricing, and promotion calls to action', () => {
  const post = readPage(BLOG_POST);

  assert.deepEqual(tagsAt(post, 'blog_cta'), [
    { category: 'download', label: 'microsoftStore', location: 'blog_cta' },
    { category: 'navigation', label: 'productOverview', location: 'blog_cta' },
  ]);

  const headerAd = tagsAt(post, 'blog_header_ad');
  const footerAd = tagsAt(post, 'blog_footer_ad');
  assert.ok(headerAd.length > 0);
  assert.ok(footerAd.length > 0);
  for (const tag of [...headerAd, ...footerAd]) {
    assert.equal(tag.category, 'promotion');
    assert.match(tag.label, /^[a-z0-9][a-z0-9-]*$/i, 'promotion label is the promotion id, not display text');
  }

  assertValidTags(post);
  assertUntaggedContentLinks(post);

  const matched = assertUntrackedRegions(post);
  for (const [name, count] of Object.entries(matched)) {
    assert.ok(count > 0, `expected the ${name} region to exist on a blog post`);
  }
});

test('blog calls to action report the same labels in every locale', () => {
  const chinese = readPage(BLOG_POST);
  const english = readPage(LOCALIZED_BLOG_POST);

  for (const location of ['blog_cta', 'blog_header_ad', 'blog_footer_ad']) {
    assert.deepEqual(tagsAt(english, location), tagsAt(chinese, location), location);
  }
  assertValidTags(english);
  assertUntrackedRegions(english);
});

test('the desktop install page carries the shared shell tags and no tags on untracked links', () => {
  for (const route of DESKTOP_INSTALL_PAGES) {
    const page = readPage(route);

    assert.ok(tagsAt(page, 'header').length > 0, `${route} header tags`);
    assert.deepEqual(
      tagsAt(page, 'footer').find((tag) => tag.label === 'downloadClient'),
      { category: 'download', label: 'downloadClient', location: 'footer' },
    );
    assertValidTags(page);
    assertUntrackedRegions(page);
    assertUntaggedContentLinks(page);
  }
});

test('structured articles tag nothing outside the shared shell and their CTA slots', () => {
  const article = readPage(STRUCTURED_ARTICLE);
  const allowed = new Set(['header', 'footer', 'article_promotion', 'promoto_banner', ...EMBEDDED_CTA_LOCATIONS]);

  for (const { node } of taggedElements(article)) {
    assert.ok(allowed.has(node.properties.dataGaLocation), `unexpected location ${node.properties.dataGaLocation}`);
  }
  for (const { node } of taggedElements(article)) {
    if (node.properties.dataGaLocation === 'article_cta') {
      assert.ok(['articleCtaPrimary', 'articleCtaSecondary'].includes(node.properties.dataGaLabel));
    }
  }
  assertValidTags(article);
  assertUntrackedRegions(article);
});

// The structured-article snapshot currently defines no CTA, so no built page renders one. Pin the
// markup contract at the source until a built page can exercise it.
test('structured article CTA components tag the primary and secondary slots', () => {
  for (const file of ['StructuredArticleCtaSection.astro', 'StructuredArticleBlocks.astro']) {
    const source = readFileSync(path.join(rootDir, 'src/components', file), 'utf8');

    assert.match(source, /gaEventAttributes\(/);
    assert.match(source, /articleCtaPrimary/);
    assert.match(source, /articleCtaSecondary/);
    assert.match(source, /location: 'article_cta'/);
    assert.match(source, /category: 'navigation'/);
  }
});
