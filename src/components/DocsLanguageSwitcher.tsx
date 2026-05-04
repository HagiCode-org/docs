import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import {
  buildDocsCounterpartPath,
  DOCS_LANGUAGE_STORAGE_KEY,
  normalizeDocsRoutePath,
  serializeStoredDocsLocale,
  type DocsLocale,
} from '@/lib/i18n';
import styles from './DocsLanguageSwitcher.module.css';

export interface DocsLanguageSwitcherOption {
  code: DocsLocale;
  label: string;
  lang: string;
}

export interface DocsLanguageSwitcherProps {
  currentLocale: DocsLocale;
  currentPathname: string;
  options: readonly DocsLanguageSwitcherOption[];
  triggerAriaLabel: string;
  dialogTitle: string;
  currentLocaleLabel: string;
  closeLabel: string;
  selectedStateLabel: string;
  onNavigate?: (targetUrl: string) => void;
}

export function buildDocsLocaleNavigationTarget(
  locale: DocsLocale,
  currentUrl: URL,
  currentPathname: string,
): URL {
  const targetUrl = new URL(
    buildDocsCounterpartPath(locale, normalizeDocsRoutePath(currentPathname || currentUrl.pathname)),
    currentUrl.origin,
  );
  targetUrl.search = currentUrl.search;
  targetUrl.hash = currentUrl.hash;
  return targetUrl;
}

export function persistDocsLocaleSelection(locale: DocsLocale): void {
  try {
    const storedRouteValue = localStorage.getItem(DOCS_LANGUAGE_STORAGE_KEY);
    localStorage.setItem(
      DOCS_LANGUAGE_STORAGE_KEY,
      serializeStoredDocsLocale(storedRouteValue, locale),
    );
  } catch {
    // Ignore storage failures so language switching can still navigate for this visit.
  }
}

export default function DocsLanguageSwitcher({
  currentLocale,
  currentPathname,
  options,
  triggerAriaLabel,
  dialogTitle,
  currentLocaleLabel,
  closeLabel,
  selectedStateLabel,
  onNavigate,
}: DocsLanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Partial<Record<DocsLocale, HTMLButtonElement | null>>>({});
  const dialogId = useId();
  const titleId = useId();
  const activeOption = options.find((option) => option.code === currentLocale) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    optionRefs.current[currentLocale]?.focus();

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target) || dialogRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
      triggerRef.current?.focus();
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.body.classList.add('docs-language-switcher-open');
    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.body.classList.remove('docs-language-switcher-open');
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [currentLocale, isOpen]);

  function closeChooser(focusTrigger = false) {
    setIsOpen(false);
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  }

  function focusLocaleOption(locale: DocsLocale) {
    optionRefs.current[locale]?.focus();
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    locale: DocsLocale,
  ) {
    const currentIndex = options.findIndex((option) => option.code === locale);
    if (currentIndex < 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        event.preventDefault();
        const nextOption = options[(currentIndex + 1) % options.length];
        if (nextOption) {
          focusLocaleOption(nextOption.code);
        }
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        event.preventDefault();
        const previousOption = options[(currentIndex - 1 + options.length) % options.length];
        if (previousOption) {
          focusLocaleOption(previousOption.code);
        }
        break;
      }
      case 'Home':
        event.preventDefault();
        if (options[0]) {
          focusLocaleOption(options[0].code);
        }
        break;
      case 'End':
        event.preventDefault();
        if (options[options.length - 1]) {
          focusLocaleOption(options[options.length - 1].code);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeChooser(true);
        break;
      default:
        break;
    }
  }

  function handleSelectLocale(locale: DocsLocale) {
    setIsOpen(false);

    if (locale === currentLocale) {
      triggerRef.current?.focus();
      return;
    }

    persistDocsLocaleSelection(locale);
    const currentUrl = new URL(window.location.href);
    const targetUrl = buildDocsLocaleNavigationTarget(locale, currentUrl, currentPathname);
    if (onNavigate) {
      onNavigate(targetUrl.toString());
      return;
    }

    if (typeof window.location.assign === 'function') {
      window.location.assign(targetUrl.toString());
      return;
    }

    window.location.href = targetUrl.toString();
  }

  const dialogContent = isOpen ? (
    <>
      <button
        type="button"
        className={styles.languageBackdrop}
        aria-label={closeLabel}
        onClick={() => closeChooser(true)}
      />

      <div
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.languageDialog}
      >
        <div className={styles.languageDialogHeader}>
          <div>
            <p id={titleId} className={styles.languageDialogTitle}>
              {dialogTitle}
            </p>
            <p className={styles.languageDialogCurrent}>
              {currentLocaleLabel}
              {': '}
              <strong>{activeOption?.label}</strong>
            </p>
          </div>

          <button
            type="button"
            className={styles.languageDialogClose}
            aria-label={closeLabel}
            onClick={() => closeChooser(true)}
          >
            ×
          </button>
        </div>

        <div className={styles.languageGridScroller}>
          <div className={styles.languageGrid} role="listbox" aria-label={dialogTitle}>
            {options.map((option) => {
              const isSelected = option.code === currentLocale;

              return (
                <button
                  key={option.code}
                  ref={(node) => {
                    optionRefs.current[option.code] = node;
                  }}
                  type="button"
                  role="option"
                  data-locale={option.code}
                  lang={option.lang}
                  aria-selected={isSelected}
                  className={`${styles.languageOptionButton}${isSelected ? ` ${styles.languageOptionSelected}` : ''}`}
                  onClick={() => handleSelectLocale(option.code)}
                  onKeyDown={(event) => handleOptionKeyDown(event, option.code)}
                >
                  <span className={styles.languageOptionLabel}>{option.label}</span>
                  {isSelected ? (
                    <span className={styles.languageOptionSelectedBadge}>
                      {selectedStateLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className={styles.languageSwitcher} data-open={isOpen ? 'true' : 'false'}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.languageTrigger}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        aria-label={`${triggerAriaLabel}: ${activeOption?.label ?? currentLocale}`}
        title={activeOption?.label ?? currentLocale}
        onClick={() => setIsOpen((previousState) => !previousState)}
      >
        <span className={styles.triggerLabel}>{activeOption?.label ?? currentLocale}</span>
        <span className={styles.languageTriggerChevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {dialogContent && typeof document !== 'undefined'
        ? createPortal(dialogContent, document.body)
        : dialogContent}
    </div>
  );
}
