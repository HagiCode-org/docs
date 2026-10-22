/**
 * Random display for decorative R2 slots.
 *
 * Each slot is a <picture data-r2-pool="[...]"> whose default image is already in the static HTML.
 * Once per page view, one object key from the baked pool is picked uniformly, preloaded with a
 * plain Image() (no fetch, so no CORS), and swapped in only if it loads within the timeout.
 * Errors, timeouts and save-data keep the default.
 */

export const R2_IMAGE_ORIGIN = 'https://img-gen.hagicode.com';
export const R2_PICK_TIMEOUT_MS = 3000;

const POOL_ATTRIBUTE = 'data-r2-pool';
const PICKED_ATTRIBUTE = 'data-r2-picked';

export interface R2PickEnvironment {
  origin?: string;
  timeoutMs?: number;
  random?: () => number;
  createImage?: () => HTMLImageElement;
  saveData?: boolean;
  /** A slot hidden by CSS (display: none) is not picked, so no request is made for it. */
  isRendered?: (element: Element) => boolean;
}

/** Uniform pick: every key has the same chance for a random source in [0, 1). */
export function pickKey(keys: readonly string[], random: () => number = Math.random): string | null {
  if (keys.length === 0) return null;
  const index = Math.min(Math.floor(random() * keys.length), keys.length - 1);
  return keys[index] ?? null;
}

/** Reads the baked pool list. Anything other than a JSON array of strings means no pool. */
export function parsePool(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
  } catch {
    return [];
  }
}

function readSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Resolves true only when the image loads before the timeout; a late event is ignored. */
function loadWithin(src: string, timeoutMs: number, createImage: () => HTMLImageElement): Promise<boolean> {
  return new Promise((resolve) => {
    const image = createImage();
    const finish = (loaded: boolean) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = src;
  });
}

/** Replaces the default sources with the pool image; the img keeps its size, class and alt attributes. */
function swapToPoolImage(picture: HTMLPictureElement, img: HTMLImageElement, src: string): void {
  picture.querySelectorAll('source').forEach((source) => source.remove());
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.src = src;
}

/** Runs the pick for every pooled slot on the page once; a slot already handled is skipped. */
export function initR2RandomImages(root: ParentNode = document, environment: R2PickEnvironment = {}): Promise<void[]> {
  const origin = environment.origin ?? R2_IMAGE_ORIGIN;
  const timeoutMs = environment.timeoutMs ?? R2_PICK_TIMEOUT_MS;
  const random = environment.random ?? Math.random;
  const createImage = environment.createImage ?? (() => new Image());
  const saveData = environment.saveData ?? readSaveData();
  const isRendered = environment.isRendered ?? ((element: Element) => element.getClientRects().length > 0);
  const slots = [...root.querySelectorAll<HTMLPictureElement>(`picture[${POOL_ATTRIBUTE}]:not([${PICKED_ATTRIBUTE}])`)];

  return Promise.all(
    slots.map(async (picture) => {
      picture.setAttribute(PICKED_ATTRIBUTE, '');
      if (saveData || !isRendered(picture)) return;
      const key = pickKey(parsePool(picture.getAttribute(POOL_ATTRIBUTE)), random);
      const img = picture.querySelector('img');
      if (!key || !img) return;
      const src = `${origin}/${key}`;
      const loaded = await loadWithin(src, timeoutMs, createImage);
      if (loaded && picture.isConnected) swapToPoolImage(picture, img, src);
    }),
  );
}
