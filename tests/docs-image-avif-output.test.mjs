import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const BODY_IMAGE_CLASS = 'hagilight-content-image';
const BODY_CLASS_PATTERN = new RegExp(`class="[^"]*\\b${BODY_IMAGE_CLASS}\\b`);

function readRoute(route) {
  return readFileSync(path.join(distDir, route, 'index.html'), 'utf8');
}

function pictureBlocks(html) {
  return [...html.matchAll(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi)].map((match) => match[0]);
}

function bodyPictures(html) {
  return pictureBlocks(html).filter((block) => BODY_CLASS_PATTERN.test(block));
}

function bodyImages(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => BODY_CLASS_PATTERN.test(tag));
}

function sourcesOf(block) {
  return [...block.matchAll(/<source\b[^>]*>/gi)].map((match) => match[0]);
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1];
}

function firstSrcsetUrl(srcset) {
  return srcset.split(',')[0].trim().split(/\s+/)[0];
}

function imageBytes(url) {
  const filePath = path.join(distDir, url.split(/[?#]/)[0].replace(/^\//, ''));
  return readFileSync(filePath);
}

function assertAvif(bytes, url) {
  assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', `${url} is not an ISO BMFF file`);
  assert.ok(
    ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('latin1')),
    `${url} does not carry an AVIF brand`,
  );
}

function assertWebp(bytes, url) {
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF', `${url} is not a RIFF container`);
  assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP', `${url} is not a WebP image`);
}

const ARTICLE_CASES = [
  { route: 'guides/ai-compose-commit', bodyImages: 2 },
  { route: 'en-US/guides/ai-compose-commit', bodyImages: 2 },
];

for (const { route, bodyImages: expected } of ARTICLE_CASES) {
  test(`${route} wraps each body image in AVIF then WebP sources`, () => {
    const html = readRoute(route);
    const pictures = bodyPictures(html);
    assert.equal(pictures.length, expected);

    for (const block of pictures) {
      const sources = sourcesOf(block);
      assert.deepEqual(sources.map((source) => attribute(source, 'type')), ['image/avif', 'image/webp']);

      const img = block.match(/<img\b[^>]*>/i)[0];
      assert.equal(attribute(img, 'loading'), 'lazy');
      assert.equal(attribute(img, 'decoding'), 'async');
      assert.match(img, BODY_CLASS_PATTERN);
      assert.ok(block.indexOf('<img') > block.lastIndexOf('<source'), 'the <img> follows its sources');
    }
  });

  test(`${route} srcset candidates are a real AVIF file and a real WebP file`, () => {
    const [block] = bodyPictures(readRoute(route));
    const [avif, webp] = sourcesOf(block);

    const avifUrl = firstSrcsetUrl(attribute(avif, 'srcset'));
    const webpUrl = firstSrcsetUrl(attribute(webp, 'srcset'));
    assertAvif(imageBytes(avifUrl), avifUrl);
    assertWebp(imageBytes(webpUrl), webpUrl);
  });
}

test('guides/skills wraps each MDX body image in AVIF then WebP sources with lazy and async loading', () => {
  const html = readRoute('guides/skills');
  const pictures = bodyPictures(html);
  assert.equal(pictures.length, 5);

  for (const block of pictures) {
    assert.deepEqual(sourcesOf(block).map((source) => attribute(source, 'type')), ['image/avif', 'image/webp']);
    const img = block.match(/<img\b[^>]*>/i)[0];
    assert.equal(attribute(img, 'loading'), 'lazy');
    assert.equal(attribute(img, 'decoding'), 'async');
  }

  const images = bodyImages(html);
  assert.equal(images.length, 5);
  for (const img of images) {
    assert.equal(attribute(img, 'loading'), 'lazy');
    assert.equal(attribute(img, 'decoding'), 'async');
  }
});

test('non-blog gallery on guides/skills still emits AVIF, WebP and JPEG', () => {
  // The Hagilight footer brand avatar is a WebP-only <picture> owned by the footer, not by the showcase gallery.
  const gallery = pictureBlocks(readRoute('guides/skills')).filter(
    (block) => !BODY_CLASS_PATTERN.test(block) && !/\bhagilight-brand__avatar\b/.test(block),
  );
  assert.ok(gallery.length >= 1, 'the showcase gallery renders at least one picture');

  for (const block of gallery) {
    const sources = sourcesOf(block);
    assert.deepEqual(sources.map((source) => attribute(source, 'type')), ['image/avif', 'image/webp']);

    const img = block.match(/<img\b[^>]*>/i)[0];
    assert.match(attribute(img, 'src'), /\.jpe?g$/i);
  }
});
