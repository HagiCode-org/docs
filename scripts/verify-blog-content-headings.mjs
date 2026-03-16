import { getBlogSourceEntries, scanMarkdownH1s } from './blog-heading-utils.mjs';

const failures = [];
const results = [];

function main() {
  const entries = getBlogSourceEntries();

  for (const entry of entries) {
    const headings = scanMarkdownH1s(entry.body, entry.bodyStartLine);
    if (headings.length === 0) {
      results.push({ file: entry.relativePath, status: 'pass' });
      continue;
    }

    failures.push({
      file: entry.relativePath,
      status: 'fail',
      headings: headings.map((heading) => ({
        line: heading.line,
        text: heading.text,
        duplicatesTitle: heading.text === entry.title,
      })),
    });
  }

  const summary = {
    status: failures.length === 0 ? 'pass' : 'fail',
    totals: {
      files: results.length + failures.length,
      passed: results.length,
      failed: failures.length,
    },
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
        error: error.message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
