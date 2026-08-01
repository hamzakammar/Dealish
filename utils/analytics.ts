/**
 * PostHog analytics — thin, crash-safe wrapper around `posthog-react-native`.
 *
 * Design goals:
 * - Config comes ONLY from env (`EXPO_PUBLIC_POSTHOG_API_KEY`, optional
 *   `EXPO_PUBLIC_POSTHOG_HOST`). The key is never hardcoded. When no key is set
 *   (dev without analytics, tests, static export) every function is a safe no-op.
 * - No autocapture: we construct the bare client (not `PostHogProvider`) so the
 *   SDK never auto-fires lifecycle/navigation events. All events are explicit,
 *   which is what prevents duplicate/rerender-driven events.
 * - Never throws: analytics must not be able to crash the app, so every call is
 *   wrapped and failures are swallowed (logged in __DEV__).
 * - No PII: we identify by the Supabase user id only. Callers must not pass
 *   email/phone/etc. as properties.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';

/** Canonical event names. Use these constants — never inline string literals. */
export const AnalyticsEvents = {
  APP_OPENED: 'app_opened',
  /** Install/activation proxy — see docs/analytics.md ("Downloads vs usage"). */
  FIRST_APP_OPEN: 'first_app_open',
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  LOGIN_VIEWED: 'login_viewed',
  LOGIN_COMPLETED: 'login_completed',
  LOGIN_SKIPPED: 'login_skipped',
  HOME_VIEWED: 'home_viewed',
  RESTAURANT_LIST_VIEWED: 'restaurant_list_viewed',
  RESTAURANT_OPENED: 'restaurant_opened',
  DEAL_VIEWED: 'deal_viewed',
  DEAL_REDEEMED: 'deal_redeemed',
  SEARCH_PERFORMED: 'search_performed',
  FILTER_APPLIED: 'filter_applied',
  LOCATION_PERMISSION_REQUESTED: 'location_permission_requested',
  LOCATION_PERMISSION_GRANTED: 'location_permission_granted',
  LOCATION_PERMISSION_DENIED: 'location_permission_denied',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export type AnalyticsProperties = Record<string, unknown>;

// PostHog's SDK types require JSON-serializable values. Our public API accepts
// `unknown` for caller ergonomics; we narrow at the SDK boundary. Values are
// expected to be JSON-safe (string/number/boolean/null/array) in practice.
type PostHogProps = Record<string, any>;

const FIRST_OPEN_FLAG = 'analytics_first_app_open_fired';
const DEFAULT_HOST = 'https://us.i.posthog.com';

// Read env lazily inside functions. Expo's Babel plugin still statically inlines
// `process.env.EXPO_PUBLIC_*` member expressions here, and reading lazily lets
// tests set the vars before the client is first constructed.
function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_POSTHOG_API_KEY || undefined;
}
function host(): string {
  return process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
}

/** True when a PostHog key is configured; analytics is otherwise a no-op. */
export function isAnalyticsEnabled(): boolean {
  return Boolean(apiKey());
}

let client: PostHog | null = null;
let constructAttempted = false;

function getClient(): PostHog | null {
  const key = apiKey();
  if (!key) return null;
  if (client || constructAttempted) return client;
  constructAttempted = true;
  try {
    client = new PostHog(key, {
      host: host(),
      // Batch a little so we don't fire a request per event.
      flushAt: 20,
      flushInterval: 10_000,
    });
  } catch (e) {
    if (__DEV__) console.warn('[analytics] failed to init PostHog', e);
    client = null;
  }
  return client;
}

/** Construct the client eagerly at app start (safe to call more than once). */
export function initAnalytics(): void {
  getClient();
}

/** Capture a product event. No-ops when analytics is disabled. */
export function captureEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture(event, properties as PostHogProps);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] capture failed', event, e);
  }
}

/**
 * Identify the current user by their Supabase user id. Do NOT pass email/phone
 * or other PII — only non-identifying traits (e.g. role, authenticated flag).
 */
export function identifyUser(userId: string, properties: AnalyticsProperties = {}): void {
  const ph = getClient();
  if (!ph || !userId) return;
  try {
    ph.identify(userId, properties as PostHogProps);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] identify failed', e);
  }
}

/** Reset identity (call on logout) so the next user isn't merged with this one. */
export function resetAnalytics(): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.reset();
  } catch (e) {
    if (__DEV__) console.warn('[analytics] reset failed', e);
  }
}

/** Track a screen view. Callers must dedupe so rerenders don't double-fire. */
export function captureScreen(name: string, properties: AnalyticsProperties = {}): void {
  const ph = getClient();
  if (!ph || !name) return;
  try {
    ph.screen(name, properties as PostHogProps);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] screen failed', e);
  }
}

/**
 * Register a super property sent with every subsequent event (e.g. the global
 * `authenticated` flag). No-ops when disabled.
 */
export function registerSuperProperties(properties: AnalyticsProperties): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.register(properties as PostHogProps);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] register failed', e);
  }
}

/**
 * Returns true exactly once per install — on the first launch after install.
 * Used to emit `first_app_open` as our install/activation proxy (real store
 * download counts are not available inside the app; see docs/analytics.md).
 * The flag persists in AsyncStorage so reinstalls (which clear it) re-activate.
 */
export async function isFirstAppOpen(): Promise<boolean> {
  try {
    const already = await AsyncStorage.getItem(FIRST_OPEN_FLAG);
    if (already === 'true') return false;
    await AsyncStorage.setItem(FIRST_OPEN_FLAG, 'true');
    return true;
  } catch {
    // If storage is unavailable, don't fabricate a first-open event.
    return false;
  }
}
