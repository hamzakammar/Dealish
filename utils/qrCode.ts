import { supabase } from "@/app/lib/supabase";
import * as Crypto from "expo-crypto";

export type QRCodeData = {
  deal_id: string;
  token: string;
};

/**
 * Generate a unique QR code token for a deal
 */
export async function generateQRCodeToken(dealId: string): Promise<string | null> {
  try {
    // Check if deal already has a QR code token
    const { data: existingDeal } = await supabase
      .from("deals")
      .select("qr_code_token")
      .eq("id", dealId)
      .single();

    if (existingDeal?.qr_code_token) {
      return existingDeal.qr_code_token;
    }

    const token = Crypto.randomUUID();

    // Update deal with QR code token
    const { error } = await supabase
      .from("deals")
      .update({
        qr_code_token: token,
        qr_code_generated_at: new Date().toISOString(),
      })
      .eq("id", dealId);

    if (error) {
      console.error("Error generating QR code token:", error);
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error generating QR code token:", error);
    return null;
  }
}

/**
 * Create QR code data string from deal ID and token
 */
export function createQRCodeData(dealId: string, token: string): string {
  return `dealish://scan?deal_id=${dealId}&token=${token}`;
}

/**
 * Parse QR code data string
 */
export function parseQRCodeData(qrData: string): QRCodeData | null {
  try {
    // Handle different QR code formats
    if (qrData.startsWith("dealish://")) {
      const url = new URL(qrData);
      const dealId = url.searchParams.get("deal_id");
      const token = url.searchParams.get("token");

      if (dealId && token) {
        return { deal_id: dealId, token };
      }
    }

    // Fallback: try to parse as JSON
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.deal_id && parsed.token) {
        return { deal_id: parsed.deal_id, token: parsed.token };
      }
    } catch {
      // Not JSON, continue
    }

    return null;
  } catch (error) {
    console.error("Error parsing QR code data:", error);
    return null;
  }
}

/**
 * Validate QR code token against deal
 */
export async function validateQRCode(dealId: string, token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("deals")
      .select("id, qr_code_token, is_active, start_at, end_at, is_recurring")
      .eq("id", dealId)
      .eq("qr_code_token", token)
      .single();

    if (error || !data) {
      return false;
    }

    // Check if deal is active
    if (!data.is_active) {
      return false;
    }

    // For one-time deals, check if within date range
    if (!data.is_recurring) {
      const now = new Date();
      if (data.start_at && new Date(data.start_at) > now) {
        return false; // Deal hasn't started
      }
      if (data.end_at && new Date(data.end_at) < now) {
        return false; // Deal has expired
      }
    }

    return true;
  } catch (error) {
    console.error("Error validating QR code:", error);
    return false;
  }
}

/**
 * Record a QR code scan
 */
export async function recordQRCodeScan(
  dealId: string,
  restaurantId: string,
  userId: string
): Promise<void> {
  try {
    await supabase.from("qr_code_scans").insert({
      deal_id: dealId,
      restaurant_id: restaurantId,
      user_id: userId,
      scanned_at: new Date().toISOString(),
    });

    // Send push notification for deal redemption
    try {
      const { sendPushNotification } = await import('./notifications');
      const { data: deal } = await supabase
        .from('deals')
        .select('title, restaurant_id')
        .eq('id', dealId)
        .single();
      
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      if (deal && restaurant) {
        await sendPushNotification(userId, {
          type: 'deal_redeemed',
          title: 'Deal Redeemed!',
          body: `You redeemed: ${deal.title} at ${restaurant.name}`,
          data: {
            deal_id: dealId,
            restaurant_id: restaurantId,
            screen: '/account',
          },
        });
      }
    } catch (notifError) {
      // Don't fail the scan if notification fails
      console.error('Error sending redemption notification:', notifError);
    }
  } catch (error) {
    console.error("Error recording QR code scan:", error);
    // Don't throw - this is for analytics, shouldn't block the flow
  }
}
