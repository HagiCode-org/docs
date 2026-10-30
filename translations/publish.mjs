#!/usr/bin/env node
// Publishes skill-accepted translations into the site tree, adapting links the way the existing site translations do.
//   node translations/publish.mjs --locale en-US [--doc faq/index.mdx ...] [--dry-run]
//
// The skill keeps link targets identical to the zh-CN source (its hard check requires that). The site tree needs
// them adapted, because translated pages live one directory deeper and under a locale route:
//   /user-guide/agents#创建-agent        -> /<locale>/user-guide/agents#<slug of the translated heading>
//   ../../installation/windows-store#x   -> unchanged path (still valid under the locale route), fragment mapped
//   ../img/x.png  ./img/x.png            -> ../../img/x.png  ../img/x.png          (relative assets gain one "../")
// Locale parameters (locale="zh-CN", { locale: 'zh-CN' }) follow the target locale; the product video uses "en".
// openspec/omniroute.hagicode.com links switch from /zh-CN/ to /<locale>/. Other http(s)/mailto links, bare "#fragment" links, absolute asset links and anything inside code are left alone.
// Cross-document fragments are mapped by heading position (same index in the source and the translation).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { LOCALES, REPO, SOURCE_ROOT, SITE_ROOT, listSourceDocs } from './lib.mjs';

const require = createRequire(path.join(REPO, 'package.json'));
const GithubSlugger = (await import(require.resolve('github-slugger'))).default;

const ASSET = /\.(png|jpe?g|gif|svg|webp|avif|mp4|webm|pdf|zip)$/iu;
const SCHEME = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;

export function stripFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u);
  return m ? { front: m[0], body: text.slice(m[0].length) } : { front: '', body: text };
}

function headingText(raw) {
  return raw
    .replace(/\s*\{#[^}]+\}\s*$/u, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, '')
    .replace(/[*_`]+/gu, (m) => (m.includes('`') ? '' : m.replace(/[*_]/gu, (c) => (c === '*' ? '' : c)))) // keep intraword underscores
    .trim();
}

/** Slugs of every heading outside fenced code, in order (github-slugger, like Starlight). */
export function headingSlugs(text) {
  const slugger = new GithubSlugger();
  const slugs = [];
  let open = null;
  for (const line of stripFrontmatter(text).body.split('\n')) {
    const f = line.match(FENCE);
    if (open) {
      if (f && f[1][0] === open[0] && f[1].length >= open.length) open = null;
      continue;
    }
    if (f) { open = f[1]; continue; }
    const h = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (h) slugs.push(slugger.slug(headingText(h[1])));
  }
  return slugs;
}

function routeOf(doc) {
  return '/' + doc.replace(/\.mdx?$/u, '').replace(/(^|\/)index$/u, '') + '/';
}

function docForRoute(route, docs) {
  const key = route.replace(/^\/+|\/+$/gu, '');
  return docs.find((d) => d.replace(/\.mdx?$/u, '') === key || d.replace(/\.mdx?$/u, '') === (key ? `${key}/index` : 'index')) ?? null;
}

/**
 * Rewrites one link target. ctx = { doc, locale, docs, mapFragment(targetDoc, fragment) -> string|null, warn(msg) }
 */
export function rewriteTarget(target, ctx) {
  // The sibling docs sites publish every locale under their first path segment; the source points at zh-CN.
  if (/^https:\/\/(?:openspec|omniroute)\.hagicode\.com\/zh-CN(?=[/#?]|$)/u.test(target)) {
    return target.replace('/zh-CN', `/${ctx.locale}`);
  }
  if (!target || target.startsWith('#') || SCHEME.test(target)) return target;
  const hash = target.indexOf('#');
  const pathPart = hash === -1 ? target : target.slice(0, hash);
  const frag = hash === -1 ? '' : target.slice(hash + 1);
  if (ASSET.test(pathPart)) {
    if (pathPart.startsWith('/')) return target;
    return `${path.posix.normalize(`../${pathPart}`)}${hash === -1 ? '' : `#${frag}`}`;
  }
  const absolute = pathPart.startsWith('/');
  // Relative page links keep working unchanged (translated pages sit under the same locale route); only absolute
  // page links need the locale prefix. Both need their fragment mapped to the translated heading.
  const route = absolute ? pathPart : path.posix.resolve(routeOf(ctx.doc), pathPart || '.');
  let out = absolute ? `/${ctx.locale}${pathPart === '/' ? '/' : pathPart}` : pathPart;
  if (hash !== -1) {
    let mapped = frag;
    const targetDoc = docForRoute(route, ctx.docs);
    if (!frag) mapped = '';
    else if (!targetDoc) ctx.warn(`fragment on unknown page ${route}#${frag}`);
    else {
      const m = ctx.mapFragment(targetDoc, frag);
      if (m === undefined) ctx.warn(`kept fragment ${route}#${frag}: not a heading of the source page (explicit id or component anchor)`);
      else if (m === null) ctx.warn(`could not map fragment ${route}#${frag}: heading structure of the translated page differs`);
      else mapped = m;
    }
    out += `#${mapped}`;
  }
  return out;
}

/** Rewrites every link target in a document body (frontmatter and fenced code untouched; inline code masked). */
export function rewriteDocument(text, ctx) {
  const { front, body } = stripFrontmatter(text);
  const lines = body.split('\n');
  let open = null;
  const fix = (segment) =>
    segment
      .replace(/(\]\(\s*<?)([^)\s>]*)/gu, (_, pre, t) => pre + rewriteTarget(t, ctx))
      .replace(/(\b(?:href|to|link|src)=)(["'])([^"']+)\2/gu, (_, pre, q, t) => `${pre}${q}${rewriteTarget(t, ctx)}${q}`)
      .replace(/^(\s{0,3}\[[^\]]+\]:\s*<?)(\S+?)(>?(?:\s.*)?)$/u, (_, pre, t, post) => pre + rewriteTarget(t, ctx) + post);
  // Locale parameters in MDX code are source-language values and must follow the target locale. The product video
  // component only ships zh-CN and en, so every non-Chinese locale uses "en" there (and for its anchor id).
  const localize = (segment) =>
    segment
      .replace(/(<ProductVideoShowcase\b[^>]*\blocale=)(["'])zh-CN\2/gu, (_, pre, q) => `${pre}${q}en${q}`)
      .replace(/product-video-showcase-zh-CN/gu, 'product-video-showcase-en')
      .replace(/(\blocale=)(["'])zh-CN\2/gu, (_, pre, q) => `${pre}${q}${ctx.locale}${q}`)
      .replace(/(\blocale:\s*)(["'])zh-CN\2/gu, (_, pre, q) => `${pre}${q}${ctx.locale}${q}`);
  const out = lines.map((line) => {
    const f = line.match(FENCE);
    if (open) {
      if (f && f[1][0] === open[0] && f[1].length >= open[0].length && f[1].length >= open.length) open = null;
      return line;
    }
    if (f && !(f[1][0] === '`' && line.slice(f[0].length).includes('`'))) { open = f[1]; return line; }
    return line.split(/(`+[^`]*`+)/u).map((part, i) => (i % 2 ? part : localize(fix(part)))).join('');
  });
  return front + out.join('\n');
}

export function makeContext({ doc, locale, translatedText, warnings }) {
  const docs = listSourceDocs();
  const cache = new Map();
  const slugsOf = (file) => {
    if (!cache.has(file)) cache.set(file, headingSlugs(fs.readFileSync(path.join(REPO, file), 'utf8')));
    return cache.get(file);
  };
  return {
    doc, locale, docs,
    warn: (m) => warnings.push(m),
    mapFragment(targetDoc, frag) {
      const srcSlugs = slugsOf(`${SOURCE_ROOT}/${targetDoc}`);
      const i = srcSlugs.indexOf(frag);
      if (i === -1) return undefined; // not a heading of the source page: keep the fragment
      const tf = `${SITE_ROOT}/${locale}/${targetDoc}`;
      const own = path.join(REPO, 'translations/locales', locale, 'content', targetDoc);
      const file = targetDoc === doc ? null : fs.existsSync(path.join(REPO, tf)) ? tf : fs.existsSync(own) ? path.relative(REPO, own) : null;
      if (targetDoc === doc && translatedText) {
        const t = headingSlugs(translatedText);
        return t.length === srcSlugs.length ? t[i] : null;
      }
      if (!file) return null;
      const t = slugsOf(file);
      return t.length === srcSlugs.length ? t[i] : null;
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const locale = args[args.indexOf('--locale') + 1];
  if (!LOCALES.includes(locale)) {
    console.error(`usage: publish.mjs --locale <${LOCALES.join('|')}> [--doc <doc> ...] [--dry-run]`);
    process.exit(2);
  }
  const dry = args.includes('--dry-run');
  const content = path.join(REPO, 'translations/locales', locale, 'content');
  let docs = [];
  args.forEach((a, i) => { if (a === '--doc') docs.push(args[i + 1]); });
  if (docs.length === 0) {
    const walk = (dir, rel) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name) : [rel ? `${rel}/${e.name}` : e.name]) : [];
    docs = walk(content, '');
  }
  let failed = false;
  for (const doc of docs) {
    const src = path.join(content, doc);
    if (!fs.existsSync(src)) { console.error(`missing accepted translation: ${src}`); failed = true; continue; }
    const text = fs.readFileSync(src, 'utf8');
    const warnings = [];
    const next = rewriteDocument(text, makeContext({ doc, locale, translatedText: text, warnings }));
    const dest = path.join(REPO, SITE_ROOT, locale, doc);
    if (!dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(`${dest}.tmp`, next);
      fs.renameSync(`${dest}.tmp`, dest);
    }
    console.log(JSON.stringify({ doc, dest: path.relative(REPO, dest), dryRun: dry, warnings }));
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
