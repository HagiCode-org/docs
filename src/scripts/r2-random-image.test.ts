// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { R2_IMAGE_ORIGIN, R2_PICK_TIMEOUT_MS, initR2RandomImages, parsePool, pickKey } from './r2-random-image';

const POOL = ['hero-avatars/alpha-01.avif', 'hero-avatars/beta-02.avif', 'hero-avatars/gamma-03.avif'];

/** Seeded generator (mulberry32) so the uniform-pick test is deterministic. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface FakeImage {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

/** Fake Image(): records every created element so a test can fire its load or error. */
function fakeImages() {
  const created: FakeImage[] = [];
  const createImage = () => {
    const image: FakeImage = { src: '', onload: null, onerror: null };
    created.push(image);
    return image as unknown as HTMLImageElement;
  };
  return { created, createImage };
}

function renderSlot(pool: string[] | null = POOL): HTMLPictureElement {
  const poolAttribute = pool ? ` data-r2-pool='${JSON.stringify(pool)}'` : '';
  document.body.innerHTML = `
    <div class="slot-box">
      <picture${poolAttribute}>
        <source type="image/avif" srcset="/_astro/default.avif" />
        <img src="/_astro/default.webp" width="72" height="72" class="slot-art" alt="" aria-hidden="true" />
      </picture>
    </div>`;
  return document.querySelector('picture') as HTMLPictureElement;
}

describe('pickKey', () => {
  it('returns the first and last key for the extreme random values', () => {
    expect(pickKey(POOL, () => 0)).toBe(POOL[0]);
    expect(pickKey(POOL, () => 0.9999999)).toBe(POOL[2]);
  });

  it('returns null for an empty pool', () => {
    expect(pickKey([], () => 0.5)).toBeNull();
  });

  it('picks each entry with equal probability within tolerance', () => {
    const keys = Array.from({ length: 46 }, (_, index) => `hero-avatars/key-${index}.avif`);
    const random = seededRandom(20261021);
    const counts = new Map<string, number>(keys.map((key) => [key, 0]));
    const draws = 46_000;
    for (let index = 0; index < draws; index += 1) {
      const key = pickKey(keys, random)!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const expected = draws / keys.length;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expected * 0.85);
      expect(count).toBeLessThan(expected * 1.15);
    }
  });
});

describe('parsePool', () => {
  it('reads a JSON array of strings', () => {
    expect(parsePool(JSON.stringify(POOL))).toEqual(POOL);
  });

  it('treats anything else as no pool', () => {
    expect(parsePool(null)).toEqual([]);
    expect(parsePool('not json')).toEqual([]);
    expect(parsePool('{"keys":[]}')).toEqual([]);
    expect(parsePool('["ok", 3]')).toEqual([]);
  });
});

describe('initR2RandomImages in the browser', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('the picker must not call fetch');
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('preloads one pool image and swaps it in on load, keeping the same box', async () => {
    const picture = renderSlot();
    const img = picture.querySelector('img') as HTMLImageElement;
    const { created, createImage } = fakeImages();
    const pending = initR2RandomImages(document, { random: () => 0, createImage, saveData: false });

    expect(created).toHaveLength(1);
    expect(created[0].src).toBe(`${R2_IMAGE_ORIGIN}/${POOL[0]}`);
    created[0].onload?.();
    await pending;

    expect(picture.isConnected).toBe(true);
    expect(picture.querySelector('source')).toBeNull();
    expect(img.getAttribute('src')).toBe(`${R2_IMAGE_ORIGIN}/${POOL[0]}`);
    expect(img.getAttribute('width')).toBe('72');
    expect(img.getAttribute('height')).toBe('72');
    expect(img.getAttribute('class')).toBe('slot-art');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('picture')).toHaveLength(1);
  });

  it('keeps the vendored default when the image errors', async () => {
    const picture = renderSlot();
    const img = picture.querySelector('img') as HTMLImageElement;
    const { created, createImage } = fakeImages();
    const pending = initR2RandomImages(document, { random: () => 0, createImage, saveData: false });

    created[0].onerror?.();
    await pending;

    expect(picture.querySelector('source')).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/_astro/default.webp');
    expect(created).toHaveLength(1);
  });

  it('keeps the default and ignores a late load after the timeout', async () => {
    vi.useFakeTimers();
    const picture = renderSlot();
    const img = picture.querySelector('img') as HTMLImageElement;
    const { created, createImage } = fakeImages();
    const pending = initR2RandomImages(document, { random: () => 0, createImage, saveData: false });

    vi.advanceTimersByTime(R2_PICK_TIMEOUT_MS - 1);
    expect(created[0].onload).not.toBeNull();
    vi.advanceTimersByTime(1);
    await pending;

    expect(created[0].onload).toBeNull();
    expect(picture.querySelector('source')).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/_astro/default.webp');
  });

  it('makes no image request when the browser asks for save-data', async () => {
    const picture = renderSlot();
    const img = picture.querySelector('img') as HTMLImageElement;
    const { created, createImage } = fakeImages();
    await initR2RandomImages(document, { random: () => 0, createImage, saveData: true });

    expect(created).toHaveLength(0);
    expect(picture.querySelector('source')).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/_astro/default.webp');
  });

  it('does nothing for a slot with no pool (per-slot opt-out)', async () => {
    const picture = renderSlot(null);
    const { created, createImage } = fakeImages();
    await initR2RandomImages(document, { random: () => 0, createImage, saveData: false });

    expect(created).toHaveLength(0);
    expect(picture.querySelector('source')).not.toBeNull();
  });

  it('issues at most one image request per slot and never runs twice for the same slot', async () => {
    renderSlot();
    const { created, createImage } = fakeImages();
    const first = initR2RandomImages(document, { random: () => 0, createImage, saveData: false });
    created[0].onload?.();
    await first;
    await initR2RandomImages(document, { random: () => 0, createImage, saveData: false });

    expect(created).toHaveLength(1);
  });

  it('uses the origin given by the environment for the request', async () => {
    renderSlot();
    const { created, createImage } = fakeImages();
    const pending = initR2RandomImages(document, {
      origin: 'https://cdn.example.test',
      random: () => 0.99,
      createImage,
      saveData: false,
    });
    expect(created[0].src).toBe(`https://cdn.example.test/${POOL[2]}`);
    created[0].onerror?.();
    await pending;
  });
});
