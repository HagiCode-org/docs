/**
 * Client-side language parameter detection and localStorage update
 * This script runs on the docs site to handle ?lang parameter from cross-site links
 */

export function handleLanguageParameter() {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');

  if (!langParam) return;

  // Map language parameter to Starlight format
  const langMapping: Record<string, string> = {
    'zh-CN': 'root',
    'en': 'en',
  };

  const targetLang = langMapping[langParam];

  if (!targetLang) {
    // Invalid language parameter, remove it and reload
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('lang');
    window.location.href = cleanUrl.toString();
    return;
  }

  // Set localStorage for Starlight language preference
  try {
    const route = localStorage.getItem('starlight-route');
    let routeObj = route ? JSON.parse(route) : {};
    routeObj.lang = targetLang;
    localStorage.setItem('starlight-route', JSON.stringify(routeObj));

    // Get current path without language prefix
    let currentPath = window.location.pathname;

    // Remove existing language prefix if present
    if (currentPath.startsWith('/en/')) {
      currentPath = currentPath.slice(3);
    } else if (currentPath === '/en') {
      currentPath = '/';
    }

    // Build target path with correct language prefix
    const targetPath = targetLang === 'en' ? `/en${currentPath || '/'}` : (currentPath || '/');

    // Preserve other query parameters (excluding lang)
    const targetUrl = new URL(targetPath, window.location.origin);
    urlParams.forEach((value, key) => {
      if (key !== 'lang') {
        targetUrl.searchParams.set(key, value);
      }
    });

    // Redirect to target URL
    window.location.href = targetUrl.toString();
  } catch (e) {
    // Silent fallback when localStorage is unavailable
    console.error('Failed to set language preference:', e);
  }
}