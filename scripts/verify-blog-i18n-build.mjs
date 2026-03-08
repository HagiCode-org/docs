import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  assert(fs.existsSync(fullPath), `Missing build artifact: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function normalizeText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractByClass(html, className) {
  const pattern = new RegExp(
    `<(?:div|a|span)[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|a|span)>`,
    'g'
  );
  const values = [];
  let match = pattern.exec(html);
  while (match) {
    values.push(normalizeText(match[1]));
    match = pattern.exec(html);
  }
  return values;
}

function hasNonEmptyText(values) {
  return values.some((value) => value.length > 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasLabelText(html, label) {
  const pattern = new RegExp(
    `<span[^>]*class=["'][^"']*\\blabel\\b[^"']*["'][^>]*>\\s*${escapeRegExp(label)}\\s*<\\/span>`,
    'i'
  );
  return pattern.test(html);
}

function pickZhBlogPost() {
  const blogDir = path.join(distDir, 'blog');
  assert(fs.existsSync(blogDir), 'Missing build artifact directory: blog/');

  const slugDir = fs
    .readdirSync(blogDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  assert(Boolean(slugDir), 'No rendered Chinese blog post directory found under dist/blog/');
  return path.join('blog', slugDir, 'index.html');
}

function verifyNavigation() {
  const zhBlogIndex = readFile(path.join('blog', 'index.html'));
  const enBlogIndex = readFile(path.join('en', 'blog', 'index.html'));

  assert(
    hasLabelText(zhBlogIndex, '博客'),
    'Chinese blog index is missing localized Blog label "博客".'
  );
  assert(
    hasLabelText(enBlogIndex, 'Blog'),
    'English blog index is missing localized Blog label "Blog".'
  );

  const zhToEnPattern = /(?:href|value)=["']\/en\/blog\/["']/i;
  const enToZhPattern = /(?:href|value)=["']\/blog\/["']/i;
  assert(zhToEnPattern.test(zhBlogIndex), 'Chinese blog index is missing language route continuity link to /en/blog/.');
  assert(enToZhPattern.test(enBlogIndex), 'English blog index is missing language route continuity link to /blog/.');
}

function verifyAdVisibility() {
  const zhBlogPost = readFile(pickZhBlogPost());

  assert(
    zhBlogPost.includes('blog-header-ad-container') || zhBlogPost.includes('blog-footer-ad'),
    'Blog post is missing ad containers (header/footer).'
  );

  const adTitle = extractByClass(zhBlogPost, 'ad-title');
  const adDescription = extractByClass(zhBlogPost, 'ad-description');
  const adButton = extractByClass(zhBlogPost, 'ad-button');
  const linkTitle = extractByClass(zhBlogPost, 'link-title');
  const linkDesc = extractByClass(zhBlogPost, 'link-desc');
  const linkButton = extractByClass(zhBlogPost, 'link-button');

  assert(hasNonEmptyText(adTitle), 'Blog header ad title text is empty in build output.');
  assert(hasNonEmptyText(adDescription), 'Blog header ad description text is empty in build output.');
  assert(hasNonEmptyText(adButton), 'Blog header ad button text is empty in build output.');
  assert(hasNonEmptyText(linkTitle), 'Blog footer ad title text is empty in build output.');
  assert(hasNonEmptyText(linkDesc), 'Blog footer ad description text is empty in build output.');
  assert(hasNonEmptyText(linkButton), 'Blog footer ad button text is empty in build output.');
}

function main() {
  assert(fs.existsSync(distDir), 'dist directory not found. Run `npm run build` first.');
  verifyNavigation();
  verifyAdVisibility();
  console.log('Blog i18n and ad visibility build checks passed.');
}

main();
