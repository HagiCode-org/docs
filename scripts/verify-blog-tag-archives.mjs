import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), process.env.BLOG_DIST_DIR || 'dist');
const blogTagSlug = process.env.BLOG_TAG_SLUG || 'hagicode';
const results = [];
const failures = [];

function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function assert(condition, route, message) {
  if (!condition) {
    failures.push({ route, message });
    throw new Error(message);
  }
}

function readDistFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing build artifact: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, 'utf8');
}

function runCheck(name, route, fn) {
  try {
    fn();
    results.push({ name, route, status: 'pass' });
  } catch (error) {
    results.push({ name, route, status: 'fail', detail: error.message });
  }
}

function extractMainContent(html) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return mainMatch?.[1] ?? html;
}

function extractPostLinks(mainHtml, hrefPrefix) {
  const pattern = new RegExp(
    `<a\\b[^>]*href=["']${hrefPrefix}\\/\\d{4}-\\d{2}-\\d{2}-[^"'#?]+\\/?["'][^>]*>([\\s\\S]*?)<\\/a>`,
    'gi',
  );
  const links = [];

  let match = pattern.exec(mainHtml);
  while (match) {
    links.push(normalizeText(match[1]));
    match = pattern.exec(mainHtml);
  }

  return links.filter((text) => text.length > 0);
}

function verifyRoute(route, hrefPrefix) {
  const html = readDistFile(route);
  const mainHtml = extractMainContent(html);
  const postLinks = extractPostLinks(mainHtml, hrefPrefix);

  runCheck('archive_uses_default_renderer', route, () => {
    assert(
      !mainHtml.includes('blog-header-promo-container') && !mainHtml.includes('blog-footer-promo'),
      route,
      'Tag archive fell back to the blog post ad wrapper instead of archive content.',
    );
  });

  runCheck('archive_contains_post_entries', route, () => {
    assert(
      postLinks.length > 0,
      route,
      `Expected visible blog post entries in ${route} for tag "${blogTagSlug}".`,
    );
  });
}

function printSummaryAndExit() {
  const summary = {
    status: failures.length === 0 ? 'pass' : 'fail',
    checkedRoutes: Array.from(new Set(results.map((result) => result.route))),
    totals: {
      checks: results.length,
      passed: results.filter((result) => result.status === 'pass').length,
      failed: results.filter((result) => result.status === 'fail').length,
    },
    results,
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist directory not found: ${distDir}. Run \`npm run build\` first.`);
  }

  verifyRoute(path.posix.join('blog', 'tags', blogTagSlug, 'index.html'), '/blog');
  verifyRoute(path.posix.join('en', 'blog', 'tags', blogTagSlug, 'index.html'), '/en/blog');
  printSummaryAndExit();
}

try {
  main();
} catch (error) {
  failures.push({ route: 'build', message: error.message });
  printSummaryAndExit();
}
