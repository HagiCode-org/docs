// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DocsLanguageSwitcher, {
  buildDocsLocaleNavigationTarget,
  persistDocsLocaleSelection,
} from './DocsLanguageSwitcher';

const options = [
  { code: 'root', label: '简体中文', lang: 'zh-CN' },
  { code: 'en-US', label: 'English', lang: 'en-US' },
  { code: 'fr-FR', label: 'Français', lang: 'fr-FR' },
] as const;

describe('DocsLanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/product-overview/?tab=pricing#install');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderSwitcher(
    currentLocale: 'root' | 'en-US' | 'fr-FR' = 'en-US',
    onNavigate?: (targetUrl: string) => void,
  ) {
    return render(
      <DocsLanguageSwitcher
        currentLocale={currentLocale}
        currentPathname="/product-overview/"
        options={options}
        triggerAriaLabel="Select language"
        dialogTitle="Select language"
        currentLocaleLabel="Current language"
        closeLabel="Close language dialog"
        selectedStateLabel="Selected"
        onNavigate={onNavigate}
      />,
    );
  }

  it('opens the chooser, renders all options, and closes on Escape', () => {
    renderSwitcher('en-US');

    const trigger = screen.getByRole('button', { name: /Select language/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(options.length);
    expect(screen.getByRole('option', { name: /English/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports keyboard navigation across locale options', () => {
    renderSwitcher('en-US');

    fireEvent.click(screen.getByRole('button', { name: /Select language/i }));

    const englishOption = screen.getByRole('option', { name: /English/i });
    englishOption.focus();
    fireEvent.keyDown(englishOption, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Français/i }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /简体中文/i }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Français/i }));
  });

  it('closes without navigation when selecting the active locale', () => {
    const onNavigate = vi.fn();
    renderSwitcher('en-US', onNavigate);

    fireEvent.click(screen.getByRole('button', { name: /Select language/i }));
    fireEvent.click(screen.getByRole('option', { name: /English/i }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('persists the selected locale before navigating to the counterpart route', () => {
    localStorage.setItem('starlight-route', JSON.stringify({ path: '/product-overview/', lang: 'root' }));
    const onNavigate = vi.fn();
    renderSwitcher('en-US', onNavigate);

    fireEvent.click(screen.getByRole('button', { name: /Select language/i }));
    fireEvent.click(screen.getByRole('option', { name: /Français/i }));

    expect(onNavigate).toHaveBeenCalledWith(
      new URL('/fr-FR/product-overview/?tab=pricing#install', window.location.origin).toString(),
    );
    expect(JSON.parse(localStorage.getItem('starlight-route') ?? '{}')).toEqual({
      path: '/product-overview/',
      lang: 'fr-FR',
    });
  });
});

describe('DocsLanguageSwitcher helpers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('builds counterpart navigation targets that preserve query strings and hashes', () => {
    const targetUrl = buildDocsLocaleNavigationTarget(
      'fr-FR',
      new URL('https://docs.hagicode.com/en-US/product-overview/?tab=pricing#install'),
      '/en-US/product-overview/',
    );

    expect(targetUrl.toString()).toBe(
      'https://docs.hagicode.com/fr-FR/product-overview/?tab=pricing#install',
    );
  });

  it('preserves unrelated starlight-route fields when persisting the locale', () => {
    localStorage.setItem(
      'starlight-route',
      JSON.stringify({ path: '/en-US/product-overview/', lang: 'en-US', version: 'latest' }),
    );

    persistDocsLocaleSelection('fr-FR');

    expect(JSON.parse(localStorage.getItem('starlight-route') ?? '{}')).toEqual({
      path: '/en-US/product-overview/',
      lang: 'fr-FR',
      version: 'latest',
    });
  });
});
