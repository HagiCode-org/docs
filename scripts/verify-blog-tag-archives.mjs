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

function verifyNoTagDirectory(relativePath) {
  const fullPath = path.join(distDir, relativePath);

  runCheck('tag_archive_directory_removed', relativePath, () => {
    assert(!fs.existsSync(fullPath), relativePath, `Tag archive output should not exist: ${relativePath}`);
  });
}

function verifyNoTagLinks(route) {
  const html = readDistFile(route);

  runCheck('tag_links_removed', route, () => {
    assert(!html.includes('/blog/tags/'), route, `Deprecated tag route link still rendered in ${route}.`);
    assert(!html.includes('/en/blog/tags/'), route, `Deprecated English tag route link still rendered in ${route}.`);
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

  verifyNoTagDirectory(path.posix.join('blog', 'tags'));
  verifyNoTagDirectory(path.posix.join('en', 'blog', 'tags'));
  verifyNoTagLinks(path.posix.join('blog', 'index.html'));
  verifyNoTagLinks(path.posix.join('en', 'blog', 'index.html'));
  printSummaryAndExit();
}

try {
  main();
} catch (error) {
  failures.push({ route: 'build', message: error.message });
  printSummaryAndExit();
}
