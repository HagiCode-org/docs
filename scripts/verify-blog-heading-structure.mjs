import fs from 'node:fs';
import path from 'node:path';

import {
  distDir,
  extractH1Texts,
  getBlogSourceEntries,
  listRenderedHtmlFiles,
  requireFile,
} from './blog-heading-utils.mjs';

const failures = [];
const results = [];
const notes = [];

function assert(condition, route, message) {
  if (!condition) {
    failures.push({ route, message });
    throw new Error(message);
  }
}

function runCheck(name, route, fn) {
  try {
    fn();
    results.push({ name, route, status: 'pass' });
  } catch (error) {
    results.push({ name, route, status: 'fail', detail: error.message });
  }
}

function verifyCollectionRoute(route) {
  const html = requireFile(route);
  const h1s = extractH1Texts(html);

  runCheck('collection_single_h1', route, () => {
    assert(h1s.length === 1, route, `Expected exactly one <h1> on ${route}, found ${h1s.length}.`);
    assert(h1s[0].length > 0, route, `Expected non-empty <h1> text on ${route}.`);
  });
}

function verifyPostRoute(route, expectedTitle) {
  const html = requireFile(route);
  const h1s = extractH1Texts(html);

  runCheck('post_single_h1', route, () => {
    assert(h1s.length === 1, route, `Expected exactly one <h1> on ${route}, found ${h1s.length}.`);
  });

  runCheck('post_title_matches_frontmatter', route, () => {
    assert(h1s[0] === expectedTitle, route, `Expected <h1> "${expectedTitle}" on ${route}, found "${h1s[0] ?? ''}".`);
  });
}

function verifyCollectionRoutes() {
  const collectionRoutes = [
    'blog/index.html',
    'en/blog/index.html',
    ...listRenderedHtmlFiles('blog/tags'),
    ...listRenderedHtmlFiles('en/blog/tags'),
    ...listRenderedHtmlFiles('blog/authors'),
    ...listRenderedHtmlFiles('en/blog/authors'),
  ];

  if (!collectionRoutes.some((route) => route.includes('/authors/'))) {
    notes.push('No author archive pages were generated in this build, so author-route output checks were skipped.');
  }

  for (const route of collectionRoutes) {
    verifyCollectionRoute(route);
  }
}

function verifyPostRoutes() {
  for (const entry of getBlogSourceEntries()) {
    verifyPostRoute(path.posix.join('blog', entry.slug, 'index.html'), entry.title);
    verifyPostRoute(path.posix.join('en/blog', entry.slug, 'index.html'), entry.title);
  }
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory not found. Run `npm run build` first.');
  }

  verifyCollectionRoutes();
  verifyPostRoutes();

  const summary = {
    status: failures.length === 0 ? 'pass' : 'fail',
    checkedRoutes: Array.from(new Set(results.map((result) => result.route))),
    totals: {
      checks: results.length,
      passed: results.filter((result) => result.status === 'pass').length,
      failed: results.filter((result) => result.status === 'fail').length,
    },
    notes,
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'fail',
        failures: [{ route: 'build', message: error.message }],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
