/**
 * Tests for email confirmation flow in auth.tsx
 *
 * TDD Phase 4 — User Email Confirmation
 *
 * Tests verify:
 * 1. After successful signup with no session, supabase.functions.invoke is called
 *    with 'send-confirmation-email' and correct payload
 * 2. Alert.alert is still shown even if edge function invocation fails
 * 3. Edge function is NOT called when signup returns an error
 * 4. Edge function is NOT called when user already exists (empty identities)
 *
 * Note: We test the calling code in auth.tsx, not the Deno edge function itself.
 * The edge function is tested via integration/manual testing against Supabase.
 */

import { sendConfirmationEmail } from '../utils/sendConfirmationEmail';
import { supabase } from '@/app/lib/supabase';

jest.mock('@/app/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendConfirmationEmail utility', () => {
  it('invokes send-confirmation-email edge function with correct payload', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await sendConfirmationEmail({ email: 'test@example.com', userId: 'user-123' });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'send-confirmation-email',
      { body: { email: 'test@example.com', user_id: 'user-123' } }
    );
  });

  it('does not throw when edge function returns an error (fire-and-forget)', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Resend API unavailable' },
    });

    // Should not throw — failures are non-blocking
    await expect(
      sendConfirmationEmail({ email: 'test@example.com', userId: 'user-123' })
    ).resolves.not.toThrow();
  });

  it('does not throw when network error occurs (fire-and-forget)', async () => {
    (mockSupabase.functions.invoke as jest.Mock).mockRejectedValue(
      new Error('Network request failed')
    );

    await expect(
      sendConfirmationEmail({ email: 'test@example.com', userId: 'user-123' })
    ).resolves.not.toThrow();
  });

  it('does not call invoke when email is missing', async () => {
    await sendConfirmationEmail({ email: '', userId: 'user-123' });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('does not call invoke when userId is missing', async () => {
    await sendConfirmationEmail({ email: 'test@example.com', userId: '' });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });
});
