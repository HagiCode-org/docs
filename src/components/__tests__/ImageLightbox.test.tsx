// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lightboxMockState = vi.hoisted(() => ({
  changeZoom: vi.fn(),
}));

vi.mock('yet-another-react-lightbox', async () => {
  const React = await import('react');

  return {
    default: function MockLightbox(props: any) {
      React.useEffect(() => {
        const zoomRef = props.zoom?.ref;

        if (zoomRef && typeof zoomRef === 'object' && 'current' in zoomRef) {
          zoomRef.current = {
            changeZoom: lightboxMockState.changeZoom,
          };
        }

        if (props.open) {
          props.on?.view?.();
        }

        return () => {
          if (zoomRef && typeof zoomRef === 'object' && 'current' in zoomRef) {
            zoomRef.current = null;
          }
        };
      }, [props.on, props.open, props.zoom]);

      if (!props.open) {
        return null;
      }

      return React.createElement('div', { 'data-testid': 'mock-lightbox' });
    },
  };
});

vi.mock('yet-another-react-lightbox/plugins/captions', () => ({ default: {} }));
vi.mock('yet-another-react-lightbox/plugins/counter', () => ({ default: {} }));
vi.mock('yet-another-react-lightbox/plugins/fullscreen', () => ({ default: {} }));
vi.mock('yet-another-react-lightbox/plugins/zoom', () => ({ default: {} }));
vi.mock('yet-another-react-lightbox/styles.css', () => ({}));
vi.mock('yet-another-react-lightbox/plugins/captions.css', () => ({}));
vi.mock('yet-another-react-lightbox/plugins/counter.css', () => ({}));

import ImageLightbox from '../ImageLightbox';

function renderSubject() {
  render(
    <div>
      <article>
        <img
          src="https://example.com/assets/lightbox-diagram.png"
          alt="Wide lightbox behavior diagram"
        />
      </article>
      <ImageLightbox />
    </div>,
  );

  return document.querySelector('article img') as HTMLImageElement;
}

async function openLightbox(layout: 'wide' | 'narrow') {
  document.documentElement.setAttribute('data-docs-content-layout', layout);

  const image = renderSubject();

  await waitFor(() => {
    expect(image).toHaveAttribute('role', 'button');
  });

  fireEvent.click(image);

  await waitFor(() => {
    expect(screen.getByTestId('mock-lightbox')).toBeInTheDocument();
  });
}

describe('ImageLightbox default zoom behavior', () => {
  beforeEach(() => {
    lightboxMockState.changeZoom.mockReset();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-docs-content-layout');

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-docs-content-layout');
  });

  it('does not apply the extra default zoom in wide layout', async () => {
    await openLightbox('wide');

    expect(lightboxMockState.changeZoom).not.toHaveBeenCalled();
  });

  it('preserves the existing default zoom path outside wide layout', async () => {
    await openLightbox('narrow');

    await waitFor(() => {
      expect(lightboxMockState.changeZoom).toHaveBeenCalledWith(2);
    });
  });
});
