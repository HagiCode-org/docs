import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const results = [];
const failures = [];

function assert(condition, message, route) {
  if (!condition) {
    failures.push({ message, route });
    throw new Error(message);
  }
}

function readFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing build artifact: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractByClass(html, className) {
  const pattern = new RegExp(
    `<(?:div|a|span|button)[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|a|span|button)>`,
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

function hasUnresolvedBlogI18nKey(html) {
  return /starlightBlog\.[a-zA-Z0-9._-]+/.test(html);
}

function pickLatestBlogPostDir(prefix) {
  const blogDir = path.join(distDir, prefix, 'blog');
  if (!fs.existsSync(blogDir)) {
    throw new Error(`Missing build artifact directory: ${path.join(prefix, 'blog/')}`);
  }

  const slugDir = fs
    .readdirSync(blogDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  if (!slugDir) {
    throw new Error(`No rendered blog post directory found under ${path.join(prefix, 'blog/')}`);
  }

  return path.join(prefix, 'blog', slugDir, 'index.html');
}

function runCheck(name, route, fn) {
  try {
    fn();
    results.push({ name, route, status: 'pass' });
  } catch (error) {
    results.push({ name, route, status: 'fail', detail: error.message });
  }
}

function verifyNavigation() {
  const zhRoute = 'blog/index.html';
  const enRoute = 'en/blog/index.html';
  const zhBlogIndex = readFile(zhRoute);
  const enBlogIndex = readFile(enRoute);

  runCheck('zh_blog_label', zhRoute, () => {
    assert(
      hasLabelText(zhBlogIndex, '博客'),
      'Chinese blog index is missing localized Blog label "博客".',
      zhRoute
    );
  });

  runCheck('en_blog_label', enRoute, () => {
    assert(
      hasLabelText(enBlogIndex, 'Blog'),
      'English blog index is missing localized Blog label "Blog".',
      enRoute
    );
  });

  runCheck('route_continuity_zh_to_en', zhRoute, () => {
    const zhToEnPattern = /(?:href|value)=["']\/en\/blog\/["']/i;
    assert(
      zhToEnPattern.test(zhBlogIndex),
      'Chinese blog index is missing route continuity link to /en/blog/.',
      zhRoute
    );
  });

  runCheck('route_continuity_en_to_zh', enRoute, () => {
    const enToZhPattern = /(?:href|value)=["']\/blog\/["']/i;
    assert(
      enToZhPattern.test(enBlogIndex),
      'English blog index is missing route continuity link to /blog/.',
      enRoute
    );
  });

  runCheck('zh_sidebar_i18n_keys_resolved', zhRoute, () => {
    assert(
      !hasUnresolvedBlogI18nKey(zhBlogIndex),
      'Chinese blog index still contains unresolved starlight-blog i18n keys.',
      zhRoute
    );
  });

  runCheck('en_sidebar_i18n_keys_resolved', enRoute, () => {
    assert(
      !hasUnresolvedBlogI18nKey(enBlogIndex),
      'English blog index still contains unresolved starlight-blog i18n keys.',
      enRoute
    );
  });
}

function verifyAdVisibility() {
  const zhPostRoute = pickLatestBlogPostDir('');
  const enPostRoute = pickLatestBlogPostDir('en');

  for (const route of [zhPostRoute, enPostRoute]) {
    const html = readFile(route);

    runCheck('ad_container_presence', route, () => {
      assert(
        html.includes('blog-header-promo-container') || html.includes('blog-footer-promo'),
        'Blog post is missing ad containers (header/footer).',
        route
      );
    });

    runCheck('ad_header_text', route, () => {
      const adTitle = extractByClass(html, 'promo-title');
      const adDescription = extractByClass(html, 'promo-description');
      const adButton = extractByClass(html, 'promo-button');

      assert(hasNonEmptyText(adTitle), 'Blog header ad title text is empty in build output.', route);
      assert(
        hasNonEmptyText(adDescription),
        'Blog header ad description text is empty in build output.',
        route
      );
      assert(hasNonEmptyText(adButton), 'Blog header ad button text is empty in build output.', route);
    });

    runCheck('ad_footer_text', route, () => {
      const linkTitle = extractByClass(html, 'promo-link-title');
      const linkDesc = extractByClass(html, 'promo-link-desc');
      const linkButton = extractByClass(html, 'promo-link-button');

      assert(hasNonEmptyText(linkTitle), 'Blog footer ad title text is empty in build output.', route);
      assert(hasNonEmptyText(linkDesc), 'Blog footer ad description text is empty in build output.', route);
      assert(hasNonEmptyText(linkButton), 'Blog footer ad button text is empty in build output.', route);
    });

    runCheck('post_i18n_keys_resolved', route, () => {
      assert(
        !hasUnresolvedBlogI18nKey(html),
        'Blog post page still contains unresolved starlight-blog i18n keys.',
        route
      );
    });
  }
}

function printSummaryAndExit() {
  const summary = {
    status: failures.length === 0 ? 'pass' : 'fail',
    checkedRoutes: Array.from(new Set(results.map((item) => item.route))),
    totals: {
      checks: results.length,
      passed: results.filter((item) => item.status === 'pass').length,
      failed: results.filter((item) => item.status === 'fail').length,
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
    throw new Error('dist directory not found. Run `npm run build` first.');
  }

  verifyNavigation();
  verifyAdVisibility();
  printSummaryAndExit();
}

try {
  main();
} catch (error) {
  failures.push({ message: error.message, route: 'build' });
  printSummaryAndExit();
}
