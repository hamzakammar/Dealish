import { supabase } from "@/app/lib/supabase";

/**
 * Fire-and-forget helper to invoke the send-confirmation-email edge function.
 * Failures are swallowed — a Resend outage must never block the user flow.
 */
export async function sendConfirmationEmail({
  email,
  userId,
}: {
  email: string;
  userId: string;
}): Promise<void> {
  if (!email || !userId) return;

  try {
    await supabase.functions.invoke("send-confirmation-email", {
      body: { email, user_id: userId },
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("sendConfirmationEmail failed (non-blocking):", err);
    }
  }
}
