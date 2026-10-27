import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssetType, CpuArchitecture } from '@shared/desktop';

import {
  captureSiteEvent,
  SITE_EVENT_STRING_MAX_LENGTH,
  SITE_POSTHOG_EVENTS,
  type SitePropertySpec,
} from './posthog-events';

const FORBIDDEN_SUPER_KEYS = ['site_id', 'site_framework', 'hagilight_version', 'locale', 'page_type'];

function fakePostHog(options: { loaded?: boolean; optedOut?: boolean; throws?: boolean } = {}) {
  const capture = vi.fn((_event: string, _properties?: Record<string, unknown>) => {
    if (options.throws) {
      throw new Error('capture failed');
    }
  });
  const hasOptedOut = vi.fn(() => options.optedOut === true);
  return { __loaded: options.loaded ?? true, capture, has_opted_out_capturing: hasOptedOut };
}

const linuxInput = {
  platform: 'linux',
  architecture: 'x64',
  asset_type: 'linux-appimage',
  source: 'github',
  app_version: '1.2.3',
};

// One valid representative input per table row, plus content that must never be sent.
const REPRESENTATIVE_INPUTS: Record<string, Record<string, unknown>> = {
  download_desktop_windows: { ...linuxInput, platform: 'windows', asset_type: 'windows-setup', source: 'accelerated' },
  download_desktop_macos: { ...linuxInput, platform: 'macos', architecture: 'arm64', asset_type: 'macos-apple' },
  download_desktop_linux: linuxInput,
  open_microsoft_store: { source: 'install_primary' },
  open_steam_store: { source: 'install_shortcut' },
};

const LEAKED_CONTENT = {
  url: 'https://desktop.dl.hagicode.com/v1.2.3/Hagicode.Desktop.AppImage?token=secret',
  fullUrl: 'https://github.com/HagiCode-org/releases/download/v1.2.3/x',
  note: 'free text the visitor typed',
  locale: 'en',
  page_type: 'installation',
  site_id: 'docs',
  site_framework: 'starlight',
  hagilight_version: '0.18.0',
};

function enumValues(name: string, key: string): readonly string[] {
  const spec: SitePropertySpec | undefined = SITE_POSTHOG_EVENTS[name]?.[key];
  if (!spec || spec.kind !== 'enum') {
    throw new Error(`${name}.${key} is not an enum`);
  }
  return spec.values;
}

describe('captureSiteEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends nothing for an event name that is not in the table', () => {
    const fake = fakePostHog();

    captureSiteEvent('unknown_event', linuxInput, { posthog: fake });
    captureSiteEvent('constructor', linuxInput, { posthog: fake });

    expect(fake.capture).not.toHaveBeenCalled();
  });

  it('drops keys that are not in the event allowlist', () => {
    const fake = fakePostHog();

    captureSiteEvent('download_desktop_linux', { ...linuxInput, extra_key: 'nope' }, { posthog: fake });

    expect(fake.capture).toHaveBeenCalledWith('download_desktop_linux', linuxInput);
  });

  it('drops values that are not primitives or not valid for their kind', () => {
    const fake = fakePostHog();

    captureSiteEvent(
      'download_desktop_linux',
      {
        platform: ['linux'],
        architecture: null,
        asset_type: { value: 'linux-appimage' },
        source: 'Github',
        app_version: { version: '1.2.3' },
      },
      { posthog: fake },
    );

    expect(fake.capture).toHaveBeenCalledWith('download_desktop_linux', {});
  });

  it('truncates strings longer than the 128 character limit', () => {
    const fake = fakePostHog();

    captureSiteEvent('download_desktop_linux', { ...linuxInput, app_version: 'a'.repeat(200) }, { posthog: fake });

    const sent = fake.capture.mock.calls[0]?.[1] ?? {};
    expect(SITE_EVENT_STRING_MAX_LENGTH).toBe(128);
    expect(String(sent.app_version)).toHaveLength(128);
  });

  it('drops super-property keys even when the caller supplies them', () => {
    const fake = fakePostHog();

    captureSiteEvent('download_desktop_linux', { ...linuxInput, ...LEAKED_CONTENT }, { posthog: fake });

    const sent = fake.capture.mock.calls[0]?.[1] ?? {};
    for (const key of FORBIDDEN_SUPER_KEYS) {
      expect(sent).not.toHaveProperty(key);
    }
    expect(sent).toEqual(linuxInput);
  });

  it('sends nothing and does not throw when window.posthog is undefined', () => {
    vi.stubGlobal('window', {});

    expect(() => captureSiteEvent('download_desktop_linux', linuxInput)).not.toThrow();
    expect(() => captureSiteEvent('open_steam_store', { source: 'install_shortcut' })).not.toThrow();
  });

  it('sends nothing and does not throw when there is no window at all', () => {
    vi.stubGlobal('window', undefined);

    expect(() => captureSiteEvent('download_desktop_linux', linuxInput)).not.toThrow();
  });

  it('reads window.posthog when no posthog option is given', () => {
    const fake = fakePostHog();
    vi.stubGlobal('window', { posthog: fake });

    captureSiteEvent('open_steam_store', { source: 'install_shortcut' });

    expect(fake.capture).toHaveBeenCalledWith('open_steam_store', { source: 'install_shortcut' });
  });

  it('queues the event on a stub that has not loaded and does not call has_opted_out_capturing', () => {
    const fake = fakePostHog({ loaded: false });

    captureSiteEvent('download_desktop_linux', linuxInput, { posthog: fake });

    expect(fake.capture).toHaveBeenCalledWith('download_desktop_linux', linuxInput);
    expect(fake.has_opted_out_capturing).not.toHaveBeenCalled();
  });

  it('checks opt-out before sending once the SDK has loaded', () => {
    const fake = fakePostHog({ loaded: true });

    captureSiteEvent('open_steam_store', { source: 'install_shortcut' }, { posthog: fake });

    expect(fake.has_opted_out_capturing).toHaveBeenCalledTimes(1);
    expect(fake.capture).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the visitor has opted out', () => {
    const fake = fakePostHog({ loaded: true, optedOut: true });

    captureSiteEvent('download_desktop_linux', linuxInput, { posthog: fake });

    expect(fake.capture).not.toHaveBeenCalled();
  });

  it('sends nothing when the posthog option is null', () => {
    expect(() => captureSiteEvent('open_steam_store', { source: 'install_shortcut' }, { posthog: null })).not.toThrow();
  });

  it('does not throw when capture throws', () => {
    const fake = fakePostHog({ throws: true });

    expect(() => captureSiteEvent('download_desktop_linux', linuxInput, { posthog: fake })).not.toThrow();
    expect(fake.capture).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the isAllowed gate says no', () => {
    const fake = fakePostHog();

    captureSiteEvent('download_desktop_linux', linuxInput, { posthog: fake, isAllowed: () => false });

    expect(fake.capture).not.toHaveBeenCalled();
  });
});

describe('SITE_POSTHOG_EVENTS table', () => {
  it('sends exactly the allowlisted properties for every event and no URL, free text or super property', () => {
    for (const name of Object.keys(SITE_POSTHOG_EVENTS)) {
      const fake = fakePostHog();

      captureSiteEvent(name, { ...REPRESENTATIVE_INPUTS[name], ...LEAKED_CONTENT }, { posthog: fake });

      expect(fake.capture, name).toHaveBeenCalledTimes(1);
      const [sentName, sent] = fake.capture.mock.calls[0] ?? [];
      expect(sentName).toBe(name);
      expect(Object.keys(sent ?? {}).sort(), name).toEqual(Object.keys(SITE_POSTHOG_EVENTS[name]).sort());
      expect(sent, name).toEqual(REPRESENTATIVE_INPUTS[name]);
      expect(JSON.stringify(sent), name).not.toMatch(/https?:|free text|\?token|HagiCode-org/);
    }
  });

  it('covers exactly the five docs install events', () => {
    expect(Object.keys(SITE_POSTHOG_EVENTS).sort()).toEqual([
      'download_desktop_linux',
      'download_desktop_macos',
      'download_desktop_windows',
      'open_microsoft_store',
      'open_steam_store',
    ]);
  });

  it('names every event in snake_case with the object first and no forbidden super property key', () => {
    for (const [name, properties] of Object.entries(SITE_POSTHOG_EVENTS)) {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)+$/);
      for (const key of Object.keys(properties)) {
        expect(FORBIDDEN_SUPER_KEYS, `${name}.${key}`).not.toContain(key);
      }
    }
  });

  it('pins the desktop enumerations to the shared AssetType and CpuArchitecture enums', () => {
    expect([...enumValues('download_desktop_linux', 'asset_type')].sort()).toEqual(
      [...Object.values(AssetType)].sort(),
    );
    expect([...enumValues('download_desktop_linux', 'architecture')].sort()).toEqual(
      [...Object.values(CpuArchitecture)].sort(),
    );
  });
});
