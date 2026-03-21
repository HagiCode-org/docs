import path from 'node:path';
import { promises as fs } from 'node:fs';

const ANCHOR_TAG_PATTERN = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
const RESOURCE_TAG_PATTERN =
  /<(img|script|link|source|video|audio)\b[^>]*\b(src|href|poster)\s*=\s*(["'])(.*?)\3[^>]*>/gi;
const ANCHOR_ID_PATTERN = /\b(?:id|name)\s*=\s*(["'])(.*?)\1/gi;

const ASSET_EXTENSIONS = new Set([
  '.apng',
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.map',
  '.mp3',
  '.mp4',
  '.mjs',
  '.pdf',
  '.png',
  '.svg',
  '.txt',
  '.wav',
  '.webm',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
  '.xml'
]);

const IGNORED_PROTOCOL_PREFIXES = ['blob:', 'data:', 'javascript:', 'mailto:', 'tel:'];

export async function checkLinks(buildDir, options = {}) {
  const files = await walkFiles(buildDir);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const allFiles = new Set(files.map((file) => path.resolve(file)));
  const anchorsByFile = await buildAnchorIndex(htmlFiles);
  const brokenLinks = [];
  const checkedFiles = [];
  const skippedFiles = [];
  let totalLinks = 0;

  for (const htmlFile of htmlFiles) {
    try {
      const html = await fs.readFile(htmlFile, 'utf8');
      const links = extractLinksFromHtml(html, htmlFile).filter(
        (link) => !shouldExcludeLink(link.href, options.exclude)
      );

      checkedFiles.push(htmlFile);
      totalLinks += links.length;

      for (const link of links) {
        const brokenLink = validateLink(link, {
          buildDir,
          allFiles,
          anchorsByFile,
          checkExternal: options.checkExternal === true
        });

        if (brokenLink) {
          brokenLinks.push(brokenLink);
        }
      }
    } catch {
      skippedFiles.push(htmlFile);
    }
  }

  return {
    totalLinks,
    brokenLinks,
    checkedFiles,
    skippedFiles
  };
}

export function extractLinksFromHtml(html, sourceFile) {
  const links = [];

  for (const match of html.matchAll(ANCHOR_TAG_PATTERN)) {
    const href = decodeHtmlAttribute(match[2]).trim();
    if (!href || shouldIgnoreHref(href)) {
      continue;
    }

    links.push({
      href,
      text: stripMarkup(match[3]),
      type: classifyHref(href, 'a'),
      sourceFile
    });
  }

  for (const match of html.matchAll(RESOURCE_TAG_PATTERN)) {
    const href = decodeHtmlAttribute(match[4]).trim();
    if (!href || shouldIgnoreHref(href)) {
      continue;
    }

    links.push({
      href,
      text: '',
      type: classifyHref(href, match[1].toLowerCase()),
      sourceFile
    });
  }

  return links;
}

async function walkFiles(rootDir) {
  const files = [];

  async function visit(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(path.resolve(fullPath));
      }
    }
  }

  await visit(rootDir);
  return files;
}

async function buildAnchorIndex(htmlFiles) {
  const anchorsByFile = new Map();

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, 'utf8');
    const anchors = new Set();

    for (const match of html.matchAll(ANCHOR_ID_PATTERN)) {
      const anchor = decodeHtmlAttribute(match[2]).trim();
      if (anchor) {
        anchors.add(anchor);
      }
    }

    anchorsByFile.set(path.resolve(htmlFile), anchors);
  }

  return anchorsByFile;
}

function validateLink(link, context) {
  if (link.type === 'external') {
    return null;
  }

  if (link.type === 'anchor') {
    const anchorId = extractAnchorId(link.href);
    if (!anchorId) {
      return null;
    }

    if (context.anchorsByFile.get(path.resolve(link.sourceFile))?.has(anchorId)) {
      return null;
    }

    return createBrokenLink(link, `Missing anchor "#${anchorId}"`, 'not-found');
  }

  const target = resolveLocalTarget(link, context.buildDir, context.allFiles);
  if (!target.filePath || !context.allFiles.has(target.filePath)) {
    return createBrokenLink(link, `Missing target "${link.href}"`, 'not-found');
  }

  if (target.anchorId) {
    const anchors = context.anchorsByFile.get(target.filePath);
    if (!anchors || !anchors.has(target.anchorId)) {
      return createBrokenLink(link, `Missing anchor "#${target.anchorId}"`, 'not-found');
    }
  }

  return null;
}

function resolveLocalTarget(link, buildDir, allFiles) {
  const { pathname, anchorId } = splitHref(link.href);
  if (!pathname) {
    return {
      filePath: path.resolve(link.sourceFile),
      anchorId
    };
  }

  const decodedPathname = decodePathname(pathname);
  const baseTarget = decodedPathname.startsWith('/')
    ? path.resolve(buildDir, decodedPathname.replace(/^\/+/, ''))
    : path.resolve(path.dirname(link.sourceFile), decodedPathname);

  const candidates = buildCandidatePaths(baseTarget, decodedPathname);
  const filePath = candidates.find((candidate) => allFiles.has(candidate)) ?? candidates[0] ?? null;

  return { filePath, anchorId };
}

function buildCandidatePaths(baseTarget, rawPathname) {
  const candidates = new Set();
  const extension = path.extname(baseTarget);

  if (rawPathname.endsWith('/')) {
    candidates.add(path.resolve(path.join(baseTarget, 'index.html')));
  }

  candidates.add(path.resolve(baseTarget));

  if (!extension) {
    candidates.add(path.resolve(path.join(baseTarget, 'index.html')));
    candidates.add(path.resolve(`${baseTarget}.html`));
  }

  return [...candidates];
}

function splitHref(href) {
  const trimmedHref = href.trim();
  const hashIndex = trimmedHref.indexOf('#');
  const hash = hashIndex >= 0 ? trimmedHref.slice(hashIndex + 1) : '';
  const pathWithQuery = hashIndex >= 0 ? trimmedHref.slice(0, hashIndex) : trimmedHref;
  const queryIndex = pathWithQuery.indexOf('?');
  const pathname = queryIndex >= 0 ? pathWithQuery.slice(0, queryIndex) : pathWithQuery;

  return {
    pathname,
    anchorId: hash ? decodePathname(hash) : ''
  };
}

function extractAnchorId(href) {
  const { anchorId } = splitHref(href);
  return anchorId;
}

function classifyHref(href, tagName) {
  if (isExternalHref(href)) {
    return 'external';
  }

  if (href.startsWith('#')) {
    return 'anchor';
  }

  const pathname = splitHref(href).pathname;
  if (tagName !== 'a' || isAssetPath(pathname)) {
    return 'asset';
  }

  return 'internal';
}

function isExternalHref(href) {
  return /^(https?:)?\/\//i.test(href);
}

function isAssetPath(pathname) {
  return ASSET_EXTENSIONS.has(path.extname(pathname).toLowerCase());
}

function shouldIgnoreHref(href) {
  const normalizedHref = href.trim().toLowerCase();
  if (!normalizedHref) {
    return true;
  }

  return IGNORED_PROTOCOL_PREFIXES.some((prefix) => normalizedHref.startsWith(prefix));
}

function shouldExcludeLink(href, excludePatterns) {
  if (!Array.isArray(excludePatterns)) {
    return false;
  }

  return excludePatterns.some((pattern) => href.includes(pattern));
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripMarkup(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodePathname(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createBrokenLink(link, error, reason) {
  return {
    ...link,
    error,
    reason
  };
}
