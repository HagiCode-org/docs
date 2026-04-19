#!/usr/bin/env node

import fs from 'node:fs';

import {
  analyzeBlogSeoEntries,
  applyDescriptionToSource,
  buildBlogSeoReport,
  defaultSyncReportPath,
  lowScoreThreshold,
  writeJsonReport,
} from './blog-seo-description-utils.mjs';

function parseArgs(argv) {
  const options = {
    write: false,
    repairUnusable: false,
    reportPath: defaultSyncReportPath,
    rootDir: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') {
      options.write = true;
      continue;
    }
    if (argument === '--dry-run') {
      options.write = false;
      continue;
    }
    if (argument === '--repair-unusable') {
      options.repairUnusable = true;
      continue;
    }
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
const updates = [];
const preservedManual = [];

for (const entry of analyses) {
  const shouldRepair = options.repairUnusable && entry.canRepairUnusable;
  const shouldWrite = entry.shouldWriteMissing || shouldRepair;
  const nextDescription = shouldWrite ? entry.candidateDescription : entry.resolvedDescription;

  if (!shouldWrite) {
    if (entry.sourceType === 'manual') {
      preservedManual.push(entry.relativePath);
    }
    continue;
  }

  const nextSource = applyDescriptionToSource(entry.source, nextDescription);
  if (options.write) {
    fs.writeFileSync(entry.fullPath, nextSource, 'utf8');
  }

  updates.push({
    relativePath: entry.relativePath,
    locale: entry.locale,
    action: entry.shouldWriteMissing ? 'fill-missing' : 'repair-unusable',
    sourceType: entry.candidateSourceType,
    score: entry.evaluation.score,
    description: nextDescription,
  });
}

const report = buildBlogSeoReport(analyses);
report.mode = options.write ? 'write' : 'dry-run';
report.repairUnusable = options.repairUnusable;
report.updated = updates;
report.preservedManual = preservedManual;

const reportPath = writeJsonReport(options.reportPath, report, { rootDir: options.rootDir });

console.log(`Blog SEO description sync (${options.write ? 'write' : 'dry-run'})`);
console.log(`- scanned: ${report.summary.total}`);
console.log(`- pending updates: ${updates.length}`);
console.log(`- manual descriptions preserved: ${preservedManual.length}`);
console.log(`- low-score entries to review: ${report.summary.lowScore}`);

if (updates.length === 0) {
  console.log('- no files need updates');
} else {
  for (const update of updates) {
    const reviewTag = update.score < lowScoreThreshold ? ' review' : '';
    console.log(
      `- ${update.action}${reviewTag}: ${update.relativePath} [${update.sourceType}] ${update.description}`
    );
  }
}

console.log(`- report: ${reportPath}`);
