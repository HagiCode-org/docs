#!/usr/bin/env node

import {
  analyzeBlogSeoEntries,
  buildBlogSeoReport,
  defaultVerifyReportPath,
  lowScoreThreshold,
  writeJsonReport,
} from './blog-seo-description-utils.mjs';

function parseArgs(argv) {
  const options = {
    reportPath: defaultVerifyReportPath,
    rootDir: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--report-json') {
      options.reportPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--root-dir') {
      options.rootDir = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const analyses = analyzeBlogSeoEntries({ rootDir: options.rootDir });
const report = buildBlogSeoReport(analyses);
const reportPath = writeJsonReport(options.reportPath, report, { rootDir: options.rootDir });

const failingEntries = analyses.filter((entry) => entry.evaluation.failures.length > 0);
const warningEntries = analyses.filter(
  (entry) => entry.evaluation.failures.length === 0 && entry.evaluation.suggestions.length > 0
);
const lowScoreEntries = analyses.filter(
  (entry) => entry.evaluation.failures.length === 0 && entry.evaluation.score < lowScoreThreshold
);

console.log('Blog SEO description verification');
console.log(`- scanned: ${report.summary.total}`);
console.log(`- manual: ${report.summary.manual}`);
console.log(`- generated: ${report.summary.generated}`);
console.log(`- failing: ${report.summary.failing}`);
console.log(`- low-score review: ${report.summary.lowScore}`);

if (failingEntries.length > 0) {
  console.log('\nFailures');
  for (const entry of failingEntries) {
    console.log(
      `- ${entry.relativePath} [${entry.sourceType}] score=${entry.evaluation.score} failures=${entry.evaluation.failures.join(
        ', '
      )}`
    );
  }
}

if (warningEntries.length > 0) {
  console.log('\nSuggestions');
  for (const entry of warningEntries) {
    console.log(
      `- ${entry.relativePath} [${entry.sourceType}] score=${entry.evaluation.score} suggestions=${entry.evaluation.suggestions.join(
        ', '
      )}`
    );
  }
}

console.log(`\nReport: ${reportPath}`);

if (failingEntries.length > 0) {
  process.exitCode = 1;
} else if (lowScoreEntries.length > 0) {
  console.log('\nLow-score entries remain publishable, but should be reviewed before large backfills.');
}
