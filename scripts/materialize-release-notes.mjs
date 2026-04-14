import path from 'node:path';

import {
  resolveReleaseNotesConfig,
  readSnapshotFromFile,
  materializeReleaseNotes,
} from './release-notes-sync-lib.mjs';

function parseArgs(argv) {
  const options = {
    repoRoot: undefined,
    inputPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--repo-root=')) {
      options.repoRoot = argument.slice('--repo-root='.length);
    } else if (argument === '--input') {
      options.inputPath = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--input=')) {
      options.inputPath = argument.slice('--input='.length);
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage: node scripts/materialize-release-notes.mjs [options]

Options:
  --repo-root <path>   Override the docs repository root
  --input <path>       Read the fetched snapshot from a JSON file
  -h, --help           Show this help
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const config = resolveReleaseNotesConfig({ repoRoot: options.repoRoot });
const inputPath = options.inputPath
  ? path.resolve(config.repoRoot, options.inputPath)
  : config.fetchOutputPath;
const snapshot = await readSnapshotFromFile(inputPath);
const result = await materializeReleaseNotes({ snapshot, config });

console.log(`Release-notes docs updated: ${result.writtenFiles.length} managed files`);
