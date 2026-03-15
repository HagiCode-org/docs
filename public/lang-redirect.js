(function () {
  if (typeof window === 'undefined') {
    return;
  }

  var DOCS_LANGUAGE_STORAGE_KEY = 'starlight-route';
  var DEFAULT_DOCS_ENTRY_LOCALE = 'en';

  function parseDocsLocale(value) {
    if (!value) {
      return null;
    }

    var normalized = String(value).trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === 'en' || normalized.indexOf('en-') === 0) {
      return 'en';
    }

    if (
      normalized === 'root' ||
      normalized === 'zh' ||
      normalized === 'zh-cn' ||
      normalized.indexOf('zh-') === 0
    ) {
      return 'root';
    }

    return null;
  }

  function parseLangFromUrl(url) {
    return url.searchParams.get('lang');
  }

  function stripDocsLocalePrefix(pathname) {
    if (!pathname || pathname === '/en') {
      return '/';
    }

    if (pathname.indexOf('/en/') === 0) {
      return pathname.slice(3) || '/';
    }

    return pathname;
  }

  function isEnglishDocsPath(pathname) {
    return pathname === '/en' || pathname.indexOf('/en/') === 0;
  }

  function isLandingRoutePath(pathname) {
    return stripDocsLocalePrefix(pathname) === '/';
  }

  function buildDocsRoutePath(locale, originalPath) {
    var normalizedPath = stripDocsLocalePrefix(originalPath || '/');

    if (locale === 'en') {
      return normalizedPath === '/' ? '/en/' : '/en' + normalizedPath;
    }

    return normalizedPath || '/';
  }

  function getStoredDocsLocale(storageValue) {
    if (!storageValue) {
      return null;
    }

    try {
      var parsed = JSON.parse(storageValue);
      return parseDocsLocale(parsed.lang);
    } catch (_error) {
      return null;
    }
  }

  function serializeStoredDocsLocale(storageValue, locale) {
    var routeObj = {};

    if (storageValue) {
      try {
        routeObj = JSON.parse(storageValue);
      } catch (_error) {
        routeObj = {};
      }
    }

    routeObj.lang = locale;
    return JSON.stringify(routeObj);
  }

  function resolveDocsEntryLocale(requestedLang, storedLocale, clientLanguages) {
    if (requestedLang !== null && requestedLang !== undefined) {
      return parseDocsLocale(requestedLang) || DEFAULT_DOCS_ENTRY_LOCALE;
    }

    return (
      parseDocsLocale(storedLocale) ||
      resolveClientDocsLocale(clientLanguages || []) ||
      DEFAULT_DOCS_ENTRY_LOCALE
    );
  }

  function resolveClientDocsLocale(clientLanguages) {
    if (!Array.isArray(clientLanguages)) {
      return null;
    }

    for (var index = 0; index < clientLanguages.length; index += 1) {
      var locale = parseDocsLocale(clientLanguages[index]);
      if (locale) {
        return locale;
      }
    }

    return null;
  }

  function getClientLanguages(win) {
    if (win.navigator && Array.isArray(win.navigator.languages) && win.navigator.languages.length > 0) {
      return win.navigator.languages.filter(function (language) {
        return typeof language === 'string';
      });
    }

    if (win.navigator && typeof win.navigator.language === 'string') {
      return [win.navigator.language];
    }

    return [];
  }

  function buildTargetUrl(currentUrl, targetPath) {
    var targetUrl = new URL(targetPath, currentUrl.origin);

    currentUrl.searchParams.forEach(function (value, key) {
      if (key !== 'lang') {
        targetUrl.searchParams.set(key, value);
      }
    });

    targetUrl.hash = currentUrl.hash;
    return targetUrl;
  }

  function resolveDocsLandingRoute(currentUrl, storedRouteValue, clientLanguages) {
    var requestedLang = parseLangFromUrl(currentUrl);
    var storedLocale = getStoredDocsLocale(storedRouteValue);
    var currentPath = currentUrl.pathname || '/';
    var landingPath = isLandingRoutePath(currentPath);
    var resolvedLocale;
    var shouldPersist = false;

    if (requestedLang !== null) {
      resolvedLocale = resolveDocsEntryLocale(requestedLang, storedLocale);
      shouldPersist = true;
    } else if (landingPath && !isEnglishDocsPath(currentPath)) {
      resolvedLocale = resolveDocsEntryLocale(null, storedLocale, clientLanguages);
      shouldPersist = true;
    } else if (isEnglishDocsPath(currentPath)) {
      resolvedLocale = 'en';
    } else if (storedLocale === 'root') {
      resolvedLocale = 'root';
    } else {
      resolvedLocale = 'en';
    }

    var shouldResolvePath =
      requestedLang !== null || landingPath || (!isEnglishDocsPath(currentPath) && resolvedLocale === 'en');
    var targetPath = shouldResolvePath
      ? buildDocsRoutePath(resolvedLocale, currentPath)
      : currentPath;
    var targetUrl = buildTargetUrl(currentUrl, targetPath);

    return {
      currentPath: currentPath,
      targetPath: targetPath,
      targetUrl: targetUrl.toString(),
      resolvedLocale: resolvedLocale,
      requestedLang: requestedLang,
      storedLocale: storedLocale,
      isLandingPath: landingPath,
      shouldPersist: shouldPersist,
      shouldRedirect: targetUrl.toString() !== currentUrl.toString(),
    };
  }

  function getStoredRouteValue(win) {
    try {
      return win.localStorage.getItem(DOCS_LANGUAGE_STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  }

  function persistResolvedLocale(win, previousValue, locale) {
    try {
      win.localStorage.setItem(
        DOCS_LANGUAGE_STORAGE_KEY,
        serializeStoredDocsLocale(previousValue, locale),
      );
    } catch (_error) {
      // Ignore storage failures so navigation still works for this visit.
    }
  }

  function navigate(win, targetUrl) {
    if (win.location && typeof win.location.replace === 'function') {
      win.location.replace(targetUrl);
      return;
    }

    win.location.href = targetUrl;
  }

  var api = {
    DOCS_LANGUAGE_STORAGE_KEY: DOCS_LANGUAGE_STORAGE_KEY,
    DEFAULT_DOCS_ENTRY_LOCALE: DEFAULT_DOCS_ENTRY_LOCALE,
    buildDocsRoutePath: buildDocsRoutePath,
    isLandingRoutePath: isLandingRoutePath,
    parseDocsLocale: parseDocsLocale,
    resolveDocsLandingRoute: resolveDocsLandingRoute,
    lastResolution: null,
    applyEntryRouting: function applyEntryRouting(win) {
      var browserWindow = win || window;
      var storedRouteValue = getStoredRouteValue(browserWindow);
      var resolution = resolveDocsLandingRoute(
        new URL(browserWindow.location.href),
        storedRouteValue,
        getClientLanguages(browserWindow),
      );

      api.lastResolution = resolution;

      if (resolution.shouldPersist) {
        persistResolvedLocale(browserWindow, storedRouteValue, resolution.resolvedLocale);
      }

      if (resolution.shouldRedirect) {
        navigate(browserWindow, resolution.targetUrl);
      }

      return resolution;
    },
  };

  window.__HAGICODE_DOCS_ENTRY__ = api;
  api.applyEntryRouting(window);
})();
