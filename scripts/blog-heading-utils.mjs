import fs from 'node:fs';
import path from 'node:path';

export const blogContentDir = path.resolve(process.cwd(), 'src/content/docs/blog');
export const distDir = path.resolve(process.cwd(), 'dist');

export function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function splitFrontmatter(source) {
  if (!source.startsWith('---\n')) {
    throw new Error('Expected MDX frontmatter to start with `---`.');
  }

  const end = source.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error('Unable to locate the closing frontmatter fence.');
  }

  const frontmatter = source.slice(4, end);
  const body = source.slice(end + 5);
  const bodyStartLine = frontmatter.split('\n').length + 3;

  return { frontmatter, body, bodyStartLine };
}

export function parseFrontmatterTitle(frontmatter) {
  const match = frontmatter.match(/^title:\s*(.+)$/m);
  if (!match) {
    throw new Error('Missing `title` in frontmatter.');
  }

  let title = match[1].trim();
  if (
    (title.startsWith('"') && title.endsWith('"')) ||
    (title.startsWith("'") && title.endsWith("'"))
  ) {
    title = title.slice(1, -1);
  }

  return title;
}

export function scanMarkdownH1s(body, bodyStartLine = 1) {
  const matches = [];
  const lines = body.split('\n');
  let activeFence = null;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (activeFence === marker) {
        activeFence = null;
      } else if (activeFence === null) {
        activeFence = marker;
      }
      continue;
    }

    if (activeFence !== null) {
      continue;
    }

    const headingMatch = line.match(/^#\s+(.*)$/);
    if (headingMatch) {
      matches.push({
        line: bodyStartLine + index,
        text: headingMatch[1].trim(),
      });
    }
  }

  return matches;
}

export function extractH1Texts(html) {
  return Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi), (match) => normalizeText(match[1]));
}

export function hiddenFirstPanelRuleExists(html) {
  return /content-panel:first-of-type[^}]*display\s*:\s*none/i.test(html);
}

export function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function requireFile(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing build artifact: ${relativePath}`);
  }
  return readTextFile(fullPath);
}

export function listRenderedHtmlFiles(relativeDir) {
  const directory = path.join(distDir, relativeDir);
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results = [];
  const queue = [directory];

  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === 'index.html') {
        results.push(path.relative(distDir, fullPath));
      }
    }
  }

  return results.sort();
}

export function getBlogSourceEntries() {
  if (!fs.existsSync(blogContentDir)) {
    throw new Error(`Missing blog content directory: ${blogContentDir}`);
  }

  return fs
    .readdirSync(blogContentDir)
    .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const relativePath = path.join('src/content/docs/blog', name);
      const fullPath = path.join(blogContentDir, name);
      const source = readTextFile(fullPath);
      const { frontmatter, body, bodyStartLine } = splitFrontmatter(source);
      const slug = name.replace(/\.(md|mdx)$/i, '');
      return {
        fullPath,
        relativePath,
        slug,
        title: parseFrontmatterTitle(frontmatter),
        body,
        bodyStartLine,
      };
    });
}
