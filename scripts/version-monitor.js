#!/usr/bin/env node

/**
 * Version Monitor Script for Docs Repository
 *
 * This script monitors the version from the official website URL and updates
 * the local version index file for the documentation site.
 * Pull Request creation is handled by the workflow.
 *
 * Multi-Channel Support:
 * - Supports channels field (stable/beta) in version data
 * - Prioritizes stable channel by default
 * - Can be configured to monitor beta channel via PREFERRED_CHANNEL env var
 * - Automatically detects version channel from version string (beta/alpha/rc indicators)
 *
 * Updates the following file:
 * - public/version-index.json
 *
 * Environment Variables:
 * - VERSION_SOURCE_URL: URL to fetch version data (default: https://desktop.dl.hagicode.com/index.json)
 * - REQUEST_TIMEOUT: HTTP request timeout in milliseconds (default: 30000)
 * - MAX_RETRIES: Maximum number of retry attempts (default: 3)
 * - PREFERRED_CHANNEL: Preferred channel to monitor ('stable' or 'beta', default: 'stable')
 *
 * GitHub Outputs:
 * - update_needed: Set to 'true' when version changes
 * - new_version: The new version string
 * - version_channel: The channel of the new version ('stable' or 'beta')
 * - version_source: The source of the version data (e.g., 'channels.stable.latest')
 */

import { promises as fs } from 'fs';

// Logger with levels
const logger = {
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`)
};

// Configuration from environment variables
const config = {
  sourceUrl: process.env.VERSION_SOURCE_URL || 'https://desktop.dl.hagicode.com/index.json',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  retryDelay: 1000 // Base retry delay in milliseconds
};

// Local version data file path
const VERSION_INDEX_FILE = 'public/version-index.json';

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry mechanism using exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = config.maxRetries) {
  const { timeout = config.timeout, ...fetchOptions } = options;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn(`Request timeout (${timeout}ms), attempt ${i + 1}/${maxRetries}`);
      } else {
        logger.warn(`Request failed: ${error.message}, attempt ${i + 1}/${maxRetries}`);
      }

      if (i === maxRetries - 1) {
        throw error;
      }

      const waitTime = Math.pow(2, i) * config.retryDelay;
      logger.debug(`Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }
}

/**
 * Fetch current version from the official website URL
 */
async function fetchCurrentVersion(url, preferredChannel = 'stable') {
  const targetUrl = url || config.sourceUrl;
  logger.info(`Fetching version from: ${targetUrl} (preferred channel: ${preferredChannel})`);

  try {
    const response = await fetchWithRetry(targetUrl, {
      headers: {
        'User-Agent': 'Version-Monitor/1.0'
      }
    });

    const data = await response.json();

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response: not an object');
    }

    let versionInfo;

    if (data.version) {
      const isBeta = data.version.includes('beta') || data.version.includes('alpha') || data.version.includes('rc');
      versionInfo = {
        version: data.version,
        channel: isBeta ? 'beta' : 'stable',
        source: 'direct version field'
      };
    } else {
      versionInfo = extractVersionFromData(data, preferredChannel);
    }

    if (!versionInfo.version) {
      throw new Error('No version found in response data');
    }

    logger.info(`Current version from source: ${versionInfo.version} (channel: ${versionInfo.channel}, source: ${versionInfo.source})`);
    return { ...versionInfo, raw: data };
  } catch (error) {
    logger.error(`Failed to fetch version data: ${error.message}`);
    throw error;
  }
}

/**
 * Extract version from various data structures
 */
function extractVersionFromData(data, preferredChannel = 'stable') {
  // Common patterns for version data (legacy support)
  if (data.latestVersion) return { version: data.latestVersion, channel: 'stable', source: 'latestVersion' };
  if (data.currentVersion) return { version: data.currentVersion, channel: 'stable', source: 'currentVersion' };
  if (data.release && data.release.version) return { version: data.release.version, channel: 'stable', source: 'release.version' };

  // Check for channels field (new multi-channel format)
  if (data.channels) {
    logger.info(`Found channels field in data`);

    if (data.channels[preferredChannel] && data.channels[preferredChannel].latest) {
      const version = data.channels[preferredChannel].latest;
      logger.info(`Using ${preferredChannel} channel latest: ${version}`);
      return { version, channel: preferredChannel, source: `channels.${preferredChannel}.latest` };
    }

    if (preferredChannel !== 'stable' && data.channels.stable && data.channels.stable.latest) {
      const version = data.channels.stable.latest;
      logger.info(`Preferred channel not available, using stable channel: ${version}`);
      return { version, channel: 'stable', source: 'channels.stable.latest (fallback)' };
    }

    if (data.channels.beta && data.channels.beta.latest) {
      const version = data.channels.beta.latest;
      logger.info(`Only beta channel available: ${version}`);
      return { version, channel: 'beta', source: 'channels.beta.latest (fallback)' };
    }
  }

  // For versions array, find the latest version
  if (Array.isArray(data.versions) && data.versions.length > 0) {
    logger.info(`Found ${data.versions.length} versions in array`);

    let latestVersion = data.versions[0];
    let latestVersionObj = data.versions[0];

    for (const versionObj of data.versions) {
      const v1 = versionObj.version || versionObj;
      const v2 = latestVersionObj.version || latestVersionObj;

      const comparison = compareVersions(v1, v2);

      if (comparison === 1) {
        latestVersion = v1;
        latestVersionObj = versionObj;
      }
    }

    const isBeta = latestVersion.includes('beta') || latestVersion.includes('alpha') || latestVersion.includes('rc');

    logger.info(`Latest version from array: ${latestVersion} (${isBeta ? 'beta' : 'stable'})`);
    return { version: latestVersion, channel: isBeta ? 'beta' : 'stable', source: 'versions array (auto-detected)' };
  }

  logger.warn('No version found in data');
  return { version: null, channel: null, source: null };
}

/**
 * Load local version from version-index.json
 */
async function loadLocalVersion() {
  try {
    const content = await fs.readFile(VERSION_INDEX_FILE, 'utf-8');
    const data = JSON.parse(content);

    // Check for channels field first (new format)
    if (data.channels && data.channels.stable && data.channels.stable.latest) {
      logger.info('Found channels field in local file');
      const version = data.channels.stable.latest;
      logger.info(`Local version (from stable channel): ${version}`);
      return { version, channel: 'stable', source: 'local channels.stable.latest' };
    }

    if (Array.isArray(data.versions) && data.versions.length > 0) {
      if (data.versions.length === 1) {
        const localVersion = data.versions[0].version;
        logger.info(`Local version (only one): ${localVersion}`);
        return { version: localVersion, channel: 'stable', source: 'local single version' };
      }

      logger.info(`Found ${data.versions.length} versions in local file`);

      let latestVersion = data.versions[0].version;
      let latestVersionObj = data.versions[0];

      for (const versionObj of data.versions) {
        const v1 = versionObj.version;
        const v2 = latestVersionObj.version;

        const comparison = compareVersions(v1, v2);

        if (comparison === 1) {
          latestVersion = v1;
          latestVersionObj = versionObj;
        }
      }

      const isBeta = latestVersion.includes('beta') || latestVersion.includes('alpha') || latestVersion.includes('rc');

      logger.info(`Latest version from local file: ${latestVersion} (${isBeta ? 'beta' : 'stable'})`);
      return { version: latestVersion, channel: isBeta ? 'beta' : 'stable', source: 'local versions array' };
    }

    logger.warn('Local version file exists but contains no versions');
    return null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('Local version file not found, treating as empty state');
      return null;
    }
    logger.error(`Failed to load local version: ${error.message}`);
    return null;
  }
}

/**
 * Update local version index file
 */
async function updateLocalVersionIndex(versionData) {
  const content = JSON.stringify(versionData, null, 2);

  try {
    // Ensure directory exists
    const dirPath = 'public';
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.writeFile(VERSION_INDEX_FILE, content, 'utf-8');
    logger.info(`Version index updated: ${VERSION_INDEX_FILE}`);
  } catch (error) {
    logger.error(`Failed to update version index file: ${error.message}`);
    throw error;
  }
}

/**
 * Parse a semver version string
 */
function parseSemver(version) {
  const v = version.replace(/^v/, '');
  const versionParts = v.split('-');
  const versionNumbers = versionParts[0].split('.');

  const major = parseInt(versionNumbers[0], 10) || 0;
  const minor = parseInt(versionNumbers[1] || '0', 10) || 0;
  const patch = parseInt(versionNumbers[2] || '0', 10) || 0;

  let prerelease = [];
  if (versionParts.length > 1) {
    prerelease = versionParts.slice(1).join('-').split('.').map(id => {
      const num = parseInt(id, 10);
      return isNaN(num) ? id : num;
    });
  }

  return { major, minor, patch, prerelease };
}

/**
 * Pre-release identifier priority
 */
const PRERELEASE_PRIORITY = {
  'alpha': 1,
  'beta': 2,
  'preview': 3,
  'rc': 4,
  'pre': 1
};

/**
 * Compare two pre-release identifier arrays
 */
function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    const idA = a[i] === undefined ? null : a[i];
    const idB = b[i] === undefined ? null : b[i];

    if (idA === null && idB === null) return 0;
    if (idA === null) return -1;
    if (idB === null) return 1;

    if (typeof idA === 'number' && typeof idB === 'number') {
      if (idA < idB) return -1;
      if (idA > idB) return 1;
    } else if (typeof idA === 'string' && typeof idB === 'string') {
      const priorityA = PRERELEASE_PRIORITY[idA] ?? 999;
      const priorityB = PRERELEASE_PRIORITY[idB] ?? 999;

      if (priorityA !== 999 && priorityB !== 999) {
        if (priorityA < priorityB) return -1;
        if (priorityA > priorityB) return 1;
      } else if (priorityA !== 999) {
        return -1;
      } else if (priorityB !== 999) {
        return 1;
      } else {
        const cmp = idA.localeCompare(idB);
        if (cmp !== 0) return cmp < 0 ? -1 : 1;
      }
    } else if (typeof idA === 'number') {
      return -1;
    } else {
      return 1;
    }
  }

  return 0;
}

/**
 * Compare two version strings
 */
function compareVersions(v1, v2) {
  const semver1 = parseSemver(v1);
  const semver2 = parseSemver(v2);

  if (semver1.major !== semver2.major) {
    return semver1.major < semver2.major ? -1 : 1;
  }
  if (semver1.minor !== semver2.minor) {
    return semver1.minor < semver2.minor ? -1 : 1;
  }
  if (semver1.patch !== semver2.patch) {
    return semver1.patch < semver2.patch ? -1 : 1;
  }

  return comparePrerelease(semver1.prerelease, semver2.prerelease);
}

/**
 * Main execution function
 */
async function main() {
  try {
    logger.info('Starting version monitor...');
    logger.debug(`Configuration: ${JSON.stringify({
      sourceUrl: config.sourceUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    })}`);

    const preferredChannel = process.env.PREFERRED_CHANNEL || 'stable';
    logger.info(`Preferred channel: ${preferredChannel}`);

    const { version: currentVersion, channel: currentChannel, source: currentSource, raw: versionData } = await fetchCurrentVersion(null, preferredChannel);

    const localInfo = await loadLocalVersion();
    const localVersion = localInfo?.version;
    const localChannel = localInfo?.channel;

    const hasEmptyState = !localVersion;

    if (!hasEmptyState) {
      logger.info('='.repeat(60));
      logger.info('VERSION COMPARISON START');
      logger.info('='.repeat(60));
      logger.info(`Local version: "${localVersion}" (channel: ${localChannel || 'unknown'}, source: ${localInfo?.source || 'unknown'})`);
      logger.info(`Current version: "${currentVersion}" (channel: ${currentChannel}, source: ${currentSource})`);
      logger.info('-'.repeat(60));

      const versionComparison = compareVersions(currentVersion, localVersion);

      logger.info('-'.repeat(60));
      if (versionComparison === 0) {
        logger.info('✅ Version unchanged - no update needed');
        logger.info('='.repeat(60));
        return;
      }

      const comparisonSymbol = versionComparison === -1 ? '<' : '>';
      logger.info(`📊 Version comparison result: "${currentVersion}" ${comparisonSymbol} "${localVersion}"`);
      logger.info(`🔄 Version changed: ${localVersion} -> ${currentVersion}`);
      logger.info(`📡 Channel info: ${localChannel || 'unknown'} -> ${currentChannel}`);
      logger.info('='.repeat(60));
    } else {
      logger.info('Empty state detected - treating as new version scenario');
      logger.info(`📡 Current channel: ${currentChannel}`);
    }

    await updateLocalVersionIndex(versionData);

    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        `update_needed=true`,
        `new_version=${currentVersion}`,
        `version_channel=${currentChannel}`,
        `version_source=${currentSource}`
      ];
      await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
      logger.info(`Set outputs: update_needed=true, new_version=${currentVersion}, version_channel=${currentChannel}, version_source=${currentSource}`);
    }

    logger.info('Version monitor completed successfully - version index updated');

  } catch (error) {
    logger.error(`Version monitor failed: ${error.message}`);
    throw error;
  }
}

main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
