import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const contentRoots = ['src/content/docs', 'src/content/translations/docs'];

const markdownImagePattern = /!\[[^\]]*\]\(\s*<?([^\s)>]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*>?\s*\)/gu;
const htmlImagePattern = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/giu;
const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
const statementPattern = /^(?:import|export)\s/u;

export function classifyImageTarget(target) {
  if (target.startsWith('//') || /^[a-z][a-z\d+.-]*:/iu.test(target)) return 'remote';
  if (target.startsWith('/')) return 'site-root';
  return 'relative';
}

function stripFrontmatter(lines) {
  if (lines[0] !== '---') return lines;
  const end = lines.indexOf('---', 1);
  if (end === -1) return lines;
  return lines.map((line, index) => (index <= end ? '' : line));
}

// Blanks fenced code so line numbers stay stable and sample Markdown is not audited.
function stripFencedCode(lines) {
  let open = null;
  return lines.map((line) => {
    const match = line.match(fencePattern);
    if (open) {
      if (match && match[1][0] === open[0] && match[1].length >= open.length && match[2].trim() === '') {
        open = null;
      }
      return '';
    }
    if (match) {
      if (match[1][0] === '`' && match[2].includes('`')) return line;
      open = match[1];
      return '';
    }
    return line;
  });
}

function extractImages(file, lines) {
  const images = [];
  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/`[^`]*`/gu, '');
    for (const match of line.matchAll(markdownImagePattern)) {
      images.push({ file, line: index + 1, target: match[1], syntax: 'markdown' });
    }
    for (const match of line.matchAll(htmlImagePattern)) {
      images.push({ file, line: index + 1, target: match[1] ?? match[2], syntax: 'html' });
    }
  });
  return images;
}

function findImportReason(lines) {
  return lines.some((line) => statementPattern.test(line)) ? 'imports components or scripts' : 'MDX file without imports';
}

async function collectContentFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectContentFiles(entryPath)));
    } else if (/\.mdx?$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

export async function auditDocsImageReferences(root = docsRoot) {
  const files = (await Promise.all(contentRoots.map((relativeRoot) => collectContentFiles(path.join(root, relativeRoot))))).flat();
  const violations = [];
  const pages = [];

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const source = await readFile(filePath, 'utf8');
    const lines = stripFencedCode(stripFrontmatter(source.split(/\r?\n/u)));
    const images = extractImages(relativePath, lines);
    if (images.length === 0) continue;

    for (const image of images) {
      const kind = classifyImageTarget(image.target);
      if (kind !== 'relative') {
        violations.push({ file: relativePath, line: image.line, target: image.target, kind });
      }
    }

    const extension = path.extname(relativePath);
    const hasRelative = images.some((image) => classifyImageTarget(image.target) === 'relative');
    const eligible = extension === '.md' && hasRelative;
    let reason;
    if (eligible) reason = 'picture-eligible';
    else if (extension === '.mdx') reason = findImportReason(lines);
    else reason = 'no relative local image';
    pages.push({ file: relativePath, extension, eligible, reason, imageCount: images.length });
  }

  return {
    scannedFiles: files.length,
    violations,
    pages,
    pictureEligible: pages.filter((page) => page.eligible),
    mdxOnly: pages.filter((page) => !page.eligible),
  };
}

function printReport(result) {
  console.log(`Scanned ${result.scannedFiles} content files; ${result.pages.length} image-bearing pages.`);
  console.log(`Picture-eligible (.md with local relative images): ${result.pictureEligible.length}`);
  console.log(`MDX-only or not eligible: ${result.mdxOnly.length}`);
  for (const page of result.mdxOnly) {
    console.log(`  - ${page.file}: ${page.reason}`);
  }
  if (result.violations.length > 0) {
    console.error(`Found ${result.violations.length} body image reference(s) that are not relative:`);
    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${violation.line}: ${violation.kind} reference "${violation.target}"`);
    }
  }
}

export async function main(root = docsRoot) {
  const result = await auditDocsImageReferences(root);
  printReport(result);
  if (result.violations.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
