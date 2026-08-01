/**
 * Tests for the PostHog analytics wrapper (utils/analytics.ts).
 *
 * posthog-react-native is auto-mocked (__mocks__/posthog-react-native.js) so no
 * network/native code runs. We use jest.isolateModules per scenario so the
 * module-level PostHog singleton and env are fresh each time.
 */

const API_KEY_ENV = 'EXPO_PUBLIC_POSTHOG_API_KEY';

type Spies = {
  capture: jest.Mock;
  identify: jest.Mock;
  reset: jest.Mock;
  screen: jest.Mock;
  register: jest.Mock;
};

function load(withKey: boolean): { mod: typeof import('@/utils/analytics'); spies: Spies } {
  let mod!: typeof import('@/utils/analytics');
  let spies!: Spies;
  jest.isolateModules(() => {
    if (withKey) {
      process.env[API_KEY_ENV] = 'phc_test_key';
    } else {
      delete process.env[API_KEY_ENV];
    }
    // Require the (fresh) mock first so we grab its shared spies.
    const PostHog = require('posthog-react-native');
    spies = PostHog.__mocks as Spies;
    mod = require('@/utils/analytics');
  });
  return { mod, spies };
}

afterEach(() => {
  delete process.env[API_KEY_ENV];
  jest.clearAllMocks();
});

describe('analytics — disabled without an API key', () => {
  it('isAnalyticsEnabled() is false and events no-op', () => {
    const { mod, spies } = load(false);
    expect(mod.isAnalyticsEnabled()).toBe(false);
    mod.captureEvent(mod.AnalyticsEvents.APP_OPENED, { foo: 'bar' });
    mod.identifyUser('user-1');
    mod.captureScreen('map');
    expect(spies.capture).not.toHaveBeenCalled();
    expect(spies.identify).not.toHaveBeenCalled();
    expect(spies.screen).not.toHaveBeenCalled();
  });
});

describe('analytics — enabled with an API key', () => {
  it('isAnalyticsEnabled() is true', () => {
    const { mod } = load(true);
    expect(mod.isAnalyticsEnabled()).toBe(true);
  });

  it('captureEvent forwards event name + properties to PostHog', () => {
    const { mod, spies } = load(true);
    mod.captureEvent(mod.AnalyticsEvents.RESTAURANT_OPENED, { restaurant_id: 'r1', authenticated: true });
    expect(spies.capture).toHaveBeenCalledWith('restaurant_opened', {
      restaurant_id: 'r1',
      authenticated: true,
    });
  });

  it('identifyUser uses the id and sends NO PII (no email/phone)', () => {
    const { mod, spies } = load(true);
    mod.identifyUser('supabase-user-123', { authenticated: true });
    expect(spies.identify).toHaveBeenCalledWith('supabase-user-123', { authenticated: true });
    const props = spies.identify.mock.calls[0][1] || {};
    expect(props).not.toHaveProperty('email');
    expect(props).not.toHaveProperty('phone');
  });

  it('identifyUser ignores an empty id', () => {
    const { mod, spies } = load(true);
    mod.identifyUser('');
    expect(spies.identify).not.toHaveBeenCalled();
  });

  it('resetAnalytics resets identity (for logout)', () => {
    const { mod, spies } = load(true);
    mod.resetAnalytics();
    expect(spies.reset).toHaveBeenCalledTimes(1);
  });

  it('captureScreen and registerSuperProperties forward to PostHog', () => {
    const { mod, spies } = load(true);
    mod.captureScreen('map', { path: '/map' });
    mod.registerSuperProperties({ authenticated: false });
    expect(spies.screen).toHaveBeenCalledWith('map', { path: '/map' });
    expect(spies.register).toHaveBeenCalledWith({ authenticated: false });
  });
});

describe('analytics — event catalog', () => {
  it('defines all 16 funnel events with stable names', () => {
    const { mod } = load(true);
    const names = Object.values(mod.AnalyticsEvents);
    expect(names).toEqual(
      expect.arrayContaining([
        'app_opened',
        'first_app_open',
        'onboarding_started',
        'onboarding_completed',
        'login_viewed',
        'login_completed',
        'login_skipped',
        'home_viewed',
        'restaurant_list_viewed',
        'restaurant_opened',
        'deal_viewed',
        'deal_redeemed',
        'search_performed',
        'filter_applied',
        'location_permission_requested',
        'location_permission_granted',
        'location_permission_denied',
      ])
    );
  });
});

describe('analytics — first_app_open proxy', () => {
  it('returns true the first time and false once the flag is set', async () => {
    let mod!: typeof import('@/utils/analytics');
    let AsyncStorage!: { getItem: jest.Mock; setItem: jest.Mock };
    jest.isolateModules(() => {
      process.env[API_KEY_ENV] = 'phc_test_key';
      AsyncStorage = require('@react-native-async-storage/async-storage').default;
      mod = require('@/utils/analytics');
    });

    AsyncStorage.getItem.mockResolvedValueOnce(null);
    await expect(mod.isFirstAppOpen()).resolves.toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('analytics_first_app_open_fired', 'true');

    AsyncStorage.getItem.mockResolvedValueOnce('true');
    await expect(mod.isFirstAppOpen()).resolves.toBe(false);
  });
});
