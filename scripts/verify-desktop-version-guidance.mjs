import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const retiredWorkflowToken = new RegExp(['version', 'monitor'].join('-'), 'i');

async function collectFiles(dir, extensions) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(fullPath, extensions);
      }

      if (!extensions.has(path.extname(entry.name))) {
        return [];
      }

      return [fullPath];
    }),
  );

  return files.flat();
}

async function main() {
  const explicitFiles = [
    path.join(docsRoot, 'README.md'),
    path.join(docsRoot, 'README_cn.md'),
    path.join(docsRoot, 'shared', 'src', 'index.ts'),
  ];
  const scriptFiles = await collectFiles(path.join(docsRoot, 'scripts'), new Set(['.mjs']));
  const sharedFiles = await collectFiles(path.join(docsRoot, 'shared', 'src'), new Set(['.ts', '.tsx']));
  const workflowFiles = await collectFiles(path.join(docsRoot, '.github', 'workflows'), new Set(['.yml', '.yaml']));
  const filesToCheck = [...new Set([...explicitFiles, ...scriptFiles, ...sharedFiles, ...workflowFiles])];
  const failures = [];

  for (const filePath of filesToCheck) {
    const content = await readFile(filePath, 'utf8');
    if (retiredWorkflowToken.test(content)) {
      failures.push(path.relative(docsRoot, filePath));
    }
  }

  if (failures.length > 0) {
    console.error('Obsolete desktop-version workflow references found in docs repository content:');
    for (const filePath of failures) {
      console.error(`- ${filePath}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Docs repository desktop version guidance is clean.');
}

await main();
