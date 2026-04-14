import path from 'node:path';

import {
  resolveReleaseNotesConfig,
  fetchReleaseNotesSnapshot,
  writeFetchedSnapshot,
} from './release-notes-sync-lib.mjs';

function parseArgs(argv) {
  const options = {
    repoRoot: undefined,
    outputPath: undefined,
    repository: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--repo-root=')) {
      options.repoRoot = argument.slice('--repo-root='.length);
    } else if (argument === '--output') {
      options.outputPath = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--output=')) {
      options.outputPath = argument.slice('--output='.length);
    } else if (argument === '--repository') {
      options.repository = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--repository=')) {
      options.repository = argument.slice('--repository='.length);
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage: node scripts/fetch-release-notes.mjs [options]

Options:
  --repo-root <path>    Override the docs repository root
  --output <path>       Write the fetched snapshot to a JSON file
  --repository <slug>   Override the GitHub repository slug
  -h, --help            Show this help
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const env = options.repository
  ? { ...process.env, DOCS_RELEASE_NOTES_REPOSITORY: options.repository }
  : process.env;
const config = resolveReleaseNotesConfig({ repoRoot: options.repoRoot, env });
const snapshot = await fetchReleaseNotesSnapshot({ config });
const outputPath = options.outputPath
  ? path.resolve(config.repoRoot, options.outputPath)
  : config.fetchOutputPath;

await writeFetchedSnapshot({ snapshot, outputPath });
console.log(`Release-notes snapshot written to ${path.relative(config.repoRoot, outputPath)}`);
