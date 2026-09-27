import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), process.env.BLOG_DIST_DIR || 'dist');
const results = [];
const failures = [];

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

function verifyTagIndex(relativePath) {
  const fullPath = path.join(distDir, relativePath);

  runCheck('tag_index_rendered', relativePath, () => {
    const html = readDistFile(path.posix.join(relativePath, 'index.html'));
    assert(html.includes('tag-directory'), relativePath, `Tag directory is missing from ${relativePath}.`);
    assert(html.includes('tag-section'), relativePath, `Tag sections are missing from ${relativePath}.`);
  });

  runCheck('per_tag_archive_routes_removed', relativePath, () => {
    assert(
      !fs.readdirSync(fullPath, { withFileTypes: true }).some((entry) => entry.isDirectory()),
      relativePath,
      `Per-tag archive directories should not exist under ${relativePath}.`,
    );
  });
}

function verifyTagIndexLinks(route, expectedPrefix) {
  const html = readDistFile(route);
  const tagLinks = [...html.matchAll(/href="([^"]*\/blog\/tags\/[^"]*)"/gu)].map((match) => match[1]);

  runCheck('tag_links_target_index_anchors', route, () => {
    assert(tagLinks.length > 0, route, `No tag-index links rendered in ${route}.`);
    assert(
      tagLinks.every((href) => href.startsWith(expectedPrefix) && href.includes('/blog/tags/#')),
      route,
      `Tag links should target localized index anchors in ${route}.`,
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

  verifyTagIndex(path.posix.join('blog', 'tags'));
  verifyTagIndex(path.posix.join('en-US', 'blog', 'tags'));
  verifyTagIndexLinks(path.posix.join('blog', 'index.html'), '/blog/tags/#');
  verifyTagIndexLinks(path.posix.join('en-US', 'blog', 'index.html'), '/en-US/blog/tags/#');
  printSummaryAndExit();
}

try {
  main();
} catch (error) {
  failures.push({ route: 'build', message: error.message });
  printSummaryAndExit();
}
