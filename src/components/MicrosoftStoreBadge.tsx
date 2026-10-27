import React, { useEffect } from 'react';

import {
  resolveDocsMicrosoftStoreBadgeLanguage,
  resolveMicrosoftStoreProductId,
} from '@/lib/microsoft-store-badge';

interface MicrosoftStoreBadgeProps {
  href?: string;
  locale?: 'zh' | 'en';
  size?: 'small' | 'large';
  productName?: string;
  ariaLabel?: string;
  className?: string;
  badgeClassName?: string;
  badgeAttributes?: Record<string, string>;
  /** Called when a click lands on the badge (the host span wraps the custom element). */
  onActivate?: () => void;
}

export default function MicrosoftStoreBadge({
  href,
  locale = 'en',
  size = 'small',
  productName = 'HagiCode',
  ariaLabel,
  className,
  badgeClassName,
  badgeAttributes,
  onActivate,
}: MicrosoftStoreBadgeProps) {
  useEffect(() => {
    const src = 'https://get.microsoft.com/badge/ms-store-badge.bundled.js';
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = src;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <span className={className} onClick={onActivate}>
      {React.createElement('ms-store-badge', {
        ...badgeAttributes,
        className: badgeClassName,
        productid: resolveMicrosoftStoreProductId(href),
        productname: productName,
        'window-mode': 'direct',
        theme: 'auto',
        size,
        language: resolveDocsMicrosoftStoreBadgeLanguage(locale),
        animation: 'on',
        'aria-label': ariaLabel,
        title: ariaLabel,
      })}
    </span>
  );
}
