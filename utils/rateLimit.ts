import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const TIME_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitData {
  attempts: number[];
  lockedUntil?: number;
}

export async function checkRateLimit(): Promise<{ allowed: boolean; remainingTime?: number }> {
  try {
    const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (!data) {
      return { allowed: true };
    }

    const rateLimitData: RateLimitData = JSON.parse(data);
    const now = Date.now();

    // Check if locked
    if (rateLimitData.lockedUntil && rateLimitData.lockedUntil > now) {
      const remainingTime = Math.ceil((rateLimitData.lockedUntil - now) / 1000);
      return { allowed: false, remainingTime };
    }

    // Remove old attempts outside the time window
    const recentAttempts = rateLimitData.attempts.filter(
      (timestamp) => now - timestamp < TIME_WINDOW_MS
    );

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      // Lock for the remaining time of the oldest attempt
      const oldestAttempt = Math.min(...recentAttempts);
      const lockedUntil = oldestAttempt + TIME_WINDOW_MS;
      const remainingTime = Math.ceil((lockedUntil - now) / 1000);

      await AsyncStorage.setItem(
        RATE_LIMIT_KEY,
        JSON.stringify({ attempts: recentAttempts, lockedUntil })
      );

      return { allowed: false, remainingTime };
    }

    // Update with filtered attempts
    await AsyncStorage.setItem(
      RATE_LIMIT_KEY,
      JSON.stringify({ attempts: recentAttempts, lockedUntil: rateLimitData.lockedUntil })
    );

    return { allowed: true };
  } catch (error) {
    // If there's an error reading, allow the attempt
    return { allowed: true };
  }
}

export async function recordFailedAttempt(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    let rateLimitData: RateLimitData = { attempts: [] };

    if (data) {
      rateLimitData = JSON.parse(data);
      // Remove old attempts
      rateLimitData.attempts = rateLimitData.attempts.filter(
        (timestamp) => now - timestamp < TIME_WINDOW_MS
      );
    }

    rateLimitData.attempts.push(now);

    // Check if we should lock
    if (rateLimitData.attempts.length >= MAX_ATTEMPTS) {
      const oldestAttempt = Math.min(...rateLimitData.attempts);
      rateLimitData.lockedUntil = oldestAttempt + TIME_WINDOW_MS;
    }

    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimitData));
  } catch (error) {
    // Silently fail - don't block auth if storage fails
  }
}

export async function clearRateLimit(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RATE_LIMIT_KEY);
  } catch (error) {
    // Silently fail
  }
}

export function formatRemainingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
}

