(function () {
  if (typeof window === 'undefined') {
    return;
  }

  var DOCS_LANGUAGE_STORAGE_KEY = 'starlight-route';
  var DEFAULT_DOCS_ENTRY_LOCALE = 'en';

  var LOCALE_ROUTES = ['root', 'en', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
  var LOCALE_ALIASES = {
    'en': 'en', 'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en',
    'root': 'root', 'zh': 'root', 'zh-cn': 'root', 'zh-hans': 'root', 'zh-hans-cn': 'root',
    'zh-hant': 'zh-Hant', 'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant', 'zh-hant-tw': 'zh-Hant', 'zh-hant-hk': 'zh-Hant',
    'ja': 'ja-JP', 'ja-jp': 'ja-JP',
    'ko': 'ko-KR', 'ko-kr': 'ko-KR',
    'de': 'de-DE', 'de-de': 'de-DE', 'de-at': 'de-DE', 'de-ch': 'de-DE',
    'fr': 'fr-FR', 'fr-fr': 'fr-FR', 'fr-ca': 'fr-FR', 'fr-be': 'fr-FR',
    'es': 'es-ES', 'es-es': 'es-ES', 'es-mx': 'es-ES', 'es-ar': 'es-ES',
    'pt': 'pt-BR', 'pt-br': 'pt-BR', 'pt-pt': 'pt-BR',
    'ru': 'ru-RU', 'ru-ru': 'ru-RU',
  };

  function parseDocsLocale(value) {
    if (!value) {
      return null;
    }

    var normalized = String(value).trim().toLowerCase().replace(/_/g, '-');
    if (!normalized) {
      return null;
    }

    var mapped = LOCALE_ALIASES[normalized];
    if (mapped) {
      return mapped;
    }

    for (var i = 0; i < LOCALE_ROUTES.length; i++) {
      if (normalized === LOCALE_ROUTES[i].toLowerCase()) {
        return LOCALE_ROUTES[i];
      }
    }

    return null;
  }

  function parseLangFromUrl(url) {
    return url.searchParams.get('lang');
  }

  function stripDocsLocalePrefix(pathname) {
    if (!pathname) {
      return '/';
    }

    var normalized = pathname.charAt(0) === '/' ? pathname : '/' + pathname;

    for (var i = 0; i < LOCALE_ROUTES.length; i++) {
      var routeLocale = LOCALE_ROUTES[i];
      if (routeLocale === 'root') {
        continue;
      }

      if (normalized === '/' + routeLocale) {
        return '/';
      }

      if (normalized.indexOf('/' + routeLocale + '/') === 0) {
        return normalized.slice(routeLocale.length + 1) || '/';
      }
    }

    return normalized;
  }

  function isLandingRoutePath(pathname) {
    return stripDocsLocalePrefix(pathname) === '/';
  }

  function buildDocsRoutePath(locale, originalPath) {
    var normalizedPath = stripDocsLocalePrefix(originalPath || '/');

    if (locale === 'en') {
      return normalizedPath === '/' ? '/en/' : '/en' + normalizedPath;
    }

    if (locale === 'root') {
      return normalizedPath || '/';
    }

    return normalizedPath === '/' ? '/' + locale + '/' : '/' + locale + normalizedPath;
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

  function resolveRouteLocale(requestedLang, storedLocale, clientLanguages) {
    if (requestedLang !== null && requestedLang !== undefined) {
      var requestedLocale = parseDocsLocale(requestedLang);
      return {
        locale: requestedLocale || storedLocale || resolveClientDocsLocale(clientLanguages || []) || DEFAULT_DOCS_ENTRY_LOCALE,
        shouldPersist: requestedLocale !== null,
      };
    }

    if (storedLocale) {
      return {
        locale: storedLocale,
        shouldPersist: false,
      };
    }

    return {
      locale: resolveClientDocsLocale(clientLanguages || []) || DEFAULT_DOCS_ENTRY_LOCALE,
      shouldPersist: true,
    };
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

  function normalizeLandingTargetPath(pathname) {
    if (!pathname) {
      return null;
    }

    var trimmed = String(pathname).trim();
    if (!trimmed) {
      return null;
    }

    var withLeadingSlash = trimmed.charAt(0) === '/' ? trimmed : '/' + trimmed;
    return withLeadingSlash.charAt(withLeadingSlash.length - 1) === '/'
      ? withLeadingSlash
      : withLeadingSlash + '/';
  }

  function getLandingTargetPath(doc) {
    if (!doc || typeof doc.querySelector !== 'function') {
      return null;
    }

    var meta = doc.querySelector('meta[name="hagicode-docs-landing-target"]');
    if (!meta || typeof meta.getAttribute !== 'function') {
      return null;
    }

    return normalizeLandingTargetPath(meta.getAttribute('content'));
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

  function resolveDocsLandingRoute(currentUrl, storedRouteValue, clientLanguages, landingTargetPath) {
    var requestedLang = parseLangFromUrl(currentUrl);
    var storedLocale = getStoredDocsLocale(storedRouteValue);
    var currentPath = currentUrl.pathname || '/';
    var landingPath = isLandingRoutePath(currentPath);
    var resolved = resolveRouteLocale(requestedLang, storedLocale, clientLanguages);
    var resolvedLocale = resolved.locale;
    var shouldPersist = resolved.shouldPersist;
    var targetBasePath = landingTargetPath && landingPath ? landingTargetPath : currentPath;
    var targetPath = buildDocsRoutePath(resolvedLocale, targetBasePath);
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
      shouldRedirect: targetUrl.toString() !== currentUrl.toString() && (landingPath || requestedLang !== null),
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
      var landingTargetPath = getLandingTargetPath(browserWindow.document);
      var resolution = resolveDocsLandingRoute(
        new URL(browserWindow.location.href),
        storedRouteValue,
        getClientLanguages(browserWindow),
        landingTargetPath,
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

  api.applyEntryRouting();

  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = api;
  }
})();
