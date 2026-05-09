/**
 * ImageLightbox Component
 *
 * Provides a lightbox overlay for viewing images in documentation pages.
 * Features:
 * - Automatic image detection from main content area
 * - Click-to-open lightbox with zoom capability
 * - Navigation between images (arrows, keyboard, touch gestures)
 * - Fullscreen support
 * - Starlight theme integration (dark/light mode)
 * - Keyboard navigation and accessibility support
 *
 * @see https://yet-another-react-lightbox.com
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import type { SlotStyles, ZoomRef } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/counter.css';

import {
  DOCS_CONTENT_LAYOUT_ATTRIBUTE,
  DOCS_CONTENT_LAYOUT_WIDE,
} from '../lib/docs-content-layout.mjs';

interface Slide {
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
}

interface DetectionOptions {
  contentSelector?: string;
  excludeDecorative?: boolean;
  debounceDelay?: number;
}

interface ImageLightboxProps {
  contentSelector?: string;
  excludeDecorative?: boolean;
  debounceDelay?: number;
}

const DEFAULT_CONTENT_SELECTOR = 'article, .sl-markdown-content, [role="main"]';
const LIGHTBOX_ROOT_CLASS = 'docs-image-lightbox';
const INTERACTIVE_IMAGE_ATTRIBUTE = 'data-docs-lightbox-trigger';
const INTERACTIVE_IMAGE_CSS = `
  img[${INTERACTIVE_IMAGE_ATTRIBUTE}='true'] {
    cursor: pointer;
    transition: transform 0.2s ease-in-out;
  }

  img[${INTERACTIVE_IMAGE_ATTRIBUTE}='true']:hover {
    transform: scale(1.02);
  }

  @media (max-width: 768px) {
    img[${INTERACTIVE_IMAGE_ATTRIBUTE}='true']:hover {
      transform: none;
    }
  }
`;

const LIGHTBOX_STYLES: SlotStyles = {
  container: {
    backgroundColor: 'var(--docs-lightbox-overlay-bg)',
  },
  toolbar: {
    gap: '0.5rem',
    padding: 'var(--docs-lightbox-toolbar-padding)',
  },
  button: {
    color: 'var(--docs-lightbox-button-color)',
    backgroundColor: 'var(--docs-lightbox-button-bg)',
    border: '1px solid var(--docs-lightbox-button-border)',
    borderRadius: 'var(--docs-lightbox-control-radius)',
    boxShadow: 'var(--docs-lightbox-control-shadow)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  },
  navigationPrev: {
    marginInlineStart: '0.75rem',
  },
  navigationNext: {
    marginInlineEnd: '0.75rem',
  },
  captionsTitleContainer: {
    backgroundColor: 'var(--docs-lightbox-surface-bg)',
    border: '1px solid var(--docs-lightbox-surface-border)',
    borderRadius: 'var(--docs-lightbox-surface-radius)',
    boxShadow: 'var(--docs-lightbox-surface-shadow)',
    color: 'var(--docs-lightbox-text-color)',
    maxWidth: 'min(34rem, calc(100% - 1.5rem))',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  captionsTitle: {
    color: 'var(--docs-lightbox-text-color)',
    fontWeight: 600,
  },
  captionsDescriptionContainer: {
    backgroundColor: 'var(--docs-lightbox-surface-bg)',
    border: '1px solid var(--docs-lightbox-surface-border)',
    borderRadius: 'var(--docs-lightbox-surface-radius)',
    boxShadow: 'var(--docs-lightbox-surface-shadow)',
    color: 'var(--docs-lightbox-text-color)',
    maxWidth: 'min(42rem, calc(100% - 1.5rem))',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  captionsDescription: {
    color: 'var(--docs-lightbox-muted-color)',
    lineHeight: 1.5,
  },
};

function areSlidesEqual(previousSlides: Slide[], nextSlides: Slide[]): boolean {
  if (previousSlides.length !== nextSlides.length) {
    return false;
  }

  for (let index = 0; index < previousSlides.length; index += 1) {
    const previousSlide = previousSlides[index];
    const nextSlide = nextSlides[index];

    if (
      previousSlide?.src !== nextSlide?.src
      || previousSlide?.alt !== nextSlide?.alt
      || previousSlide?.title !== nextSlide?.title
      || previousSlide?.width !== nextSlide?.width
      || previousSlide?.height !== nextSlide?.height
    ) {
      return false;
    }
  }

  return true;
}

function containsRelevantImageNode(node: Node): boolean {
  if (node instanceof HTMLImageElement) {
    return true;
  }

  return node instanceof Element && (node.matches('img') || node.querySelector('img') !== null);
}

function isWideDocsContentLayout(root: Element | null = document.documentElement): boolean {
  return root?.getAttribute(DOCS_CONTENT_LAYOUT_ATTRIBUTE) === DOCS_CONTENT_LAYOUT_WIDE;
}

function useImageDetection(options: DetectionOptions = {}): Slide[] {
  const {
    contentSelector = DEFAULT_CONTENT_SELECTOR,
    excludeDecorative = true,
    debounceDelay = 250,
  } = options;

  const [slides, setSlides] = useState<Slide[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const extractImageMetadata = useCallback((img: HTMLImageElement): Slide | null => {
    const src = img.currentSrc || img.src;
    const alt = img.alt || '';

    if (!src || src === window.location.href) {
      return null;
    }

    if (excludeDecorative && (img.getAttribute('role') === 'presentation' || alt === '')) {
      return null;
    }

    return {
      src,
      alt,
      title: img.title || alt,
      width: img.naturalWidth || img.width || undefined,
      height: img.naturalHeight || img.height || undefined,
    };
  }, [excludeDecorative]);

  const detectImages = useCallback(() => {
    const contentAreas = document.querySelectorAll(contentSelector);

    if (contentAreas.length === 0) {
      setSlides((previousSlides) => (previousSlides.length === 0 ? previousSlides : []));
      return;
    }

    const imageSet = new Set<string>();
    const nextSlides: Slide[] = [];

    contentAreas.forEach((area) => {
      area.querySelectorAll('img').forEach((img) => {
        const slide = extractImageMetadata(img);

        if (!slide || imageSet.has(slide.src)) {
          return;
        }

        imageSet.add(slide.src);
        nextSlides.push(slide);
      });
    });

    setSlides((previousSlides) => (
      areSlidesEqual(previousSlides, nextSlides) ? previousSlides : nextSlides
    ));
  }, [contentSelector, extractImageMetadata]);

  const scheduleReDetection = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      detectImages();
    }, debounceDelay);
  }, [debounceDelay, detectImages]);

  useEffect(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', detectImages);
    } else {
      detectImages();
    }

    const observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some((mutation) => {
        if (mutation.type === 'attributes') {
          return mutation.target instanceof HTMLImageElement;
        }

        return Array.from(mutation.addedNodes).some(containsRelevantImageNode)
          || Array.from(mutation.removedNodes).some(containsRelevantImageNode);
      });

      if (hasRelevantChange) {
        scheduleReDetection();
      }
    });

    document.querySelectorAll(contentSelector).forEach((area) => {
      observer.observe(area, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'alt', 'title', 'role'],
      });
    });

    return () => {
      document.removeEventListener('DOMContentLoaded', detectImages);
      observer.disconnect();

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [contentSelector, detectImages, scheduleReDetection]);

  return slides;
}

export default function ImageLightbox({
  contentSelector,
  excludeDecorative,
  debounceDelay,
}: ImageLightboxProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<ZoomRef | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const announcementTimeoutRef = useRef<number | null>(null);

  const slides = useImageDetection({ contentSelector, excludeDecorative, debounceDelay });

  useEffect(() => {
    if (slides.length === 0) {
      return;
    }

    const slideIndexBySrc = new Map(slides.map((slide, index) => [slide.src, index]));

    document.querySelectorAll(contentSelector ?? DEFAULT_CONTENT_SELECTOR).forEach((area) => {
      area.querySelectorAll('img').forEach((img) => {
        const slideIndex = slideIndexBySrc.get(img.currentSrc || img.src);

        if (slideIndex === undefined) {
          return;
        }

        if (!img.hasAttribute('tabindex')) {
          img.setAttribute('tabindex', '0');
        }

        img.setAttribute('role', 'button');
        img.setAttribute(INTERACTIVE_IMAGE_ATTRIBUTE, 'true');
        img.setAttribute('aria-label', `View image ${slideIndex + 1} of ${slides.length} in lightbox`);
      });
    });
  }, [contentSelector, slides]);

  useEffect(() => {
    if (slides.length === 0) {
      return;
    }

    const selector = contentSelector ?? DEFAULT_CONTENT_SELECTOR;
    const slideIndexBySrc = new Map(slides.map((slide, index) => [slide.src, index]));
    const contentAreas = Array.from(document.querySelectorAll(selector));

    if (contentAreas.length === 0) {
      return;
    }

    const openLightboxFromImage = (img: HTMLImageElement) => {
      const slideIndex = slideIndexBySrc.get(img.currentSrc || img.src);

      if (slideIndex === undefined) {
        return;
      }

      triggerRef.current = img;
      setCurrentIndex(slideIndex);
      setIsOpen(true);
    };

    const resolveInteractiveImage = (target: EventTarget | null): HTMLImageElement | null => {
      if (!(target instanceof Element)) {
        return null;
      }

      const image = target.closest('img');

      if (!(image instanceof HTMLImageElement)) {
        return null;
      }

      if (!image.closest(selector)) {
        return null;
      }

      return slideIndexBySrc.has(image.currentSrc || image.src) ? image : null;
    };

    const handleClick = (event: Event) => {
      const image = resolveInteractiveImage(event.target);

      if (!image) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openLightboxFromImage(image);
    };

    const handleKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const image = resolveInteractiveImage(event.target);

      if (!image) {
        return;
      }

      event.preventDefault();
      openLightboxFromImage(image);
    };

    contentAreas.forEach((area) => {
      area.addEventListener('click', handleClick);
      area.addEventListener('keydown', handleKeyDown);
    });

    return () => {
      contentAreas.forEach((area) => {
        area.removeEventListener('click', handleClick);
        area.removeEventListener('keydown', handleKeyDown);
      });
    };
  }, [contentSelector, slides]);

  const handleClose = useCallback(() => {
    setIsOpen(false);

    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, []);

  const handleView = useCallback(() => {
    if (zoomFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomFrameRef.current);
    }

    if (isWideDocsContentLayout()) {
      zoomFrameRef.current = null;
      return;
    }

    zoomFrameRef.current = window.requestAnimationFrame(() => {
      zoomFrameRef.current = window.requestAnimationFrame(() => {
        zoomRef.current?.changeZoom(2);
        zoomFrameRef.current = null;
      });
    });
  }, []);

  useEffect(() => () => {
    if (zoomFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomFrameRef.current);
    }

    if (announcementTimeoutRef.current !== null) {
      window.clearTimeout(announcementTimeoutRef.current);
    }
  }, []);

  if (slides.length === 0) {
    return null;
  }

  return (
    <>
      <style>{INTERACTIVE_IMAGE_CSS}</style>

      <Lightbox
        className={LIGHTBOX_ROOT_CLASS}
        open={isOpen}
        close={handleClose}
        index={currentIndex}
        slides={slides}
        plugins={[Captions, Fullscreen, Counter, Zoom]}
        counter={{
          container: {
            className: `${LIGHTBOX_ROOT_CLASS}__counter`,
          },
        }}
        carousel={{
          finite: slides.length === 1,
          preload: 2,
        }}
        styles={LIGHTBOX_STYLES}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
          closeOnPullUp: true,
        }}
        zoom={{
          ref: zoomRef,
          scrollToZoom: true,
          minZoom: 1,
          maxZoomPixelRatio: 4,
          doubleClickMaxStops: 2,
          zoomInMultiplier: 2,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
          keyboardMoveDistance: 50,
        }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
        }}
        on={{
          view: handleView,
          entered: () => {
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = `Lightbox opened. Image ${currentIndex + 1} of ${slides.length}. Use arrow keys to navigate, press Escape to close.`;
            document.body.appendChild(announcement);

            if (announcementTimeoutRef.current !== null) {
              window.clearTimeout(announcementTimeoutRef.current);
            }

            announcementTimeoutRef.current = window.setTimeout(() => {
              announcement.remove();
              announcementTimeoutRef.current = null;
            }, 1000);
          },
        }}
      />
    </>
  );
}
