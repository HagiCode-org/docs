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
import { useEffect, useState, useCallback, useRef } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import type { SlotStyles } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/counter.css';

/**
 * Slide interface for lightbox images
 */
interface Slide {
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
}

/**
 * Options for image detection
 */
interface DetectionOptions {
  /** CSS selector for content area scope (defaults to Starlight's .sl-markdown-content) */
  contentSelector?: string;
  /** Whether to exclude images with role="presentation" */
  excludeDecorative?: boolean;
  /** Debounce delay for MutationObserver (ms) */
  debounceDelay?: number;
}

/**
 * Custom hook for detecting images in the document
 *
 * Automatically discovers images within the main content area,
 * extracts metadata, and handles dynamic content updates.
 *
 * @param options - Detection options
 * @returns Array of slide objects for the lightbox
 */
function useImageDetection(options: DetectionOptions = {}): Slide[] {
  const {
    contentSelector = 'article, .sl-markdown-content, [role="main"]',
    excludeDecorative = true,
    debounceDelay = 250,
  } = options;

  const [slides, setSlides] = useState<Slide[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Extract image metadata from an IMG element
   */
  const extractImageMetadata = useCallback((img: HTMLImageElement): Slide | null => {
    const src = img.src || img.currentSrc;
    const alt = img.alt || '';

    // Validate image source
    if (!src || src === window.location.href) {
      return null;
    }

    // Exclude decorative images if configured
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

  /**
   * Detect all images within the content area
   */
  const detectImages = useCallback(() => {
    const contentAreas = document.querySelectorAll(contentSelector);

    if (contentAreas.length === 0) {
      setSlides([]);
      return;
    }

    const imageSet = new Set<string>();
    const newSlides: Slide[] = [];

    contentAreas.forEach((area) => {
      const images = area.querySelectorAll('img');
      images.forEach((img) => {
        const slide = extractImageMetadata(img);
        if (slide && !imageSet.has(slide.src)) {
          imageSet.add(slide.src);
          newSlides.push(slide);
        }
      });
    });

    setSlides(newSlides);
  }, [contentSelector, extractImageMetadata]);

  /**
   * Debounced re-detection for dynamic content
   */
  const scheduleReDetection = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      detectImages();
    }, debounceDelay);
  }, [detectImages, debounceDelay]);

  /**
   * Initial detection and MutationObserver setup
   */
  useEffect(() => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', detectImages);
    } else {
      detectImages();
    }

    // Setup MutationObserver for dynamic content
    const observer = new MutationObserver(() => {
      scheduleReDetection();
    });

    // Observe content areas for changes
    const contentAreas = document.querySelectorAll(contentSelector);
    contentAreas.forEach((area) => {
      observer.observe(area, {
        childList: true,
        subtree: true,
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

/**
 * ImageLightbox Component Props
 */
interface ImageLightboxProps {
  /** CSS selector for content area scope */
  contentSelector?: string;
  /** Whether to exclude decorative images */
  excludeDecorative?: boolean;
  /** Debounce delay for MutationObserver (ms) */
  debounceDelay?: number;
}

const LIGHTBOX_ROOT_CLASS = 'docs-image-lightbox';

/**
 * Main ImageLightbox component
 *
 * Provides automatic image detection and lightbox functionality
 * for documentation pages.
 */
export default function ImageLightbox({
  contentSelector,
  excludeDecorative,
  debounceDelay,
}: ImageLightboxProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const triggerRef = useRef<HTMLElement | null>(null);

  const slides = useImageDetection({ contentSelector, excludeDecorative, debounceDelay });

  /**
   * Handle image click - register click handlers on all images
   */
  useEffect(() => {
    if (slides.length === 0) return;

    // Find all images in content areas
    const selector = contentSelector || 'article, .sl-markdown-content, [role="main"]';
    const contentAreas = document.querySelectorAll(selector);
    const imageElements = new Map<HTMLImageElement, number>();

    contentAreas.forEach((area) => {
      const images = area.querySelectorAll('img');
      images.forEach((img, idx) => {
        // Find matching slide index
        const slideIndex = slides.findIndex((slide) => slide.src === (img.src || img.currentSrc));
        if (slideIndex !== -1) {
          imageElements.set(img, slideIndex);
        }
      });
    });

    /**
     * Handle click on image
     */
    const handleImageClick = (img: HTMLImageElement, index: number) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      triggerRef.current = img;
      setCurrentIndex(index);
      setIsOpen(true);
    };

    /**
     * Handle keyboard Enter on focused images
     */
    const handleKeyDown = (img: HTMLImageElement, index: number) => (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerRef.current = img;
        setCurrentIndex(index);
        setIsOpen(true);
      }
    };

    // Register event listeners
    imageElements.forEach((index, img) => {
      // Make images focusable if they aren't already
      if (!img.getAttribute('tabindex')) {
        img.setAttribute('tabindex', '0');
      }

      // Add ARIA attributes
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `View image ${index + 1} of ${slides.length} in lightbox`);

      // Add cursor style
      (img as HTMLElement).style.cursor = 'pointer';

      img.addEventListener('click', handleImageClick(img, index));
      img.addEventListener('keydown', handleKeyDown(img, index));
    });

    // Cleanup
    return () => {
      imageElements.forEach((index, img) => {
        img.removeEventListener('click', handleImageClick(img, index));
        img.removeEventListener('keydown', handleKeyDown(img, index));
      });
    };
  }, [slides, contentSelector]);

  /**
   * Handle lightbox close - return focus to triggering element
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Return focus to the image that opened the lightbox
    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, []);

  /**
   * Route lightbox chrome through docs theme tokens so an open portal
   * stays in sync with Starlight light/dark theme changes.
   */
  const lightboxStyles: SlotStyles = {
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
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
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
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
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
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    },
    captionsDescription: {
      color: 'var(--docs-lightbox-muted-color)',
      lineHeight: 1.5,
    },
  };

  // Don't render if no slides
  if (slides.length === 0) {
    return null;
  }

  return (
    <>
      {/* Keep document images discoverable as interactive entry points. */}
      <style>{`
        article img,
        .sl-markdown-content img,
        [role="main"] img {
          transition: transform 0.2s ease-in-out;
        }
        article img:hover,
        .sl-markdown-content img:hover,
        [role="main"] img:hover {
          transform: scale(1.02);
        }
        @media (max-width: 768px) {
          article img:hover,
          .sl-markdown-content img:hover,
          [role="main"] img:hover {
            transform: none;
          }
        }
      `}</style>

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
        styles={lightboxStyles}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
          closeOnPullUp: true,
        }}
        zoom={{
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
          entered: () => {
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = `Lightbox opened. Image ${currentIndex + 1} of ${slides.length}. Use arrow keys to navigate, press Escape to close.`;
            document.body.appendChild(announcement);
            setTimeout(() => announcement.remove(), 1000);
          },
        }}
      />
    </>
  );
}
