import { supabase } from "@/app/lib/supabase";
import * as Crypto from "expo-crypto";

export type QRCodeData = {
  deal_id: string;
  token: string;
  user_id?: string;
};

export type RedeemResult = {
  ok: boolean;
  message: string;
  saved_amount?: number;
  deal_title?: string;
  out_restaurant_id?: string;
  restaurant_name?: string;
};

/**
 * Redeem a deal scan via the server-side SECURITY DEFINER RPC `verify_redemption`.
 * 
 * Uses SHA-256 hashing for secure token verification.
 * 
 * The scanner runs on the owner/admin device, so it cannot insert qr_code_scans or
 * update the customer's profile directly (RLS blocks cross-user writes). The RPC
 * validates the token + deal/restaurant active state + merchant ownership, records
 * the scan, and attributes visit/savings to the CUSTOMER (p_user_id).
 */
export async function redeemDealScan(
  dealId: string,
  token: string,
  userId: string
): Promise<RedeemResult> {
  try {
    // Generate SHA-256 hash of the token for secure verification
    const hashedToken = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );

    const { data, error } = await supabase.rpc("verify_redemption", {
      p_deal_id: dealId,
      p_token_hash: hashedToken,
      p_user_id: userId,
    });

    if (error) return { ok: false, message: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, message: "No response from server" };
    return row as RedeemResult;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to redeem deal",
    };
  }
}

/**
 * Generate a unique QR code token for a deal and store its SHA-256 hash
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
    const hashedToken = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );

    // Update deal with QR code token and its hash
    const { error } = await supabase
      .from("deals")
      .update({
        qr_code_token: token,
        qr_code_token_hash: hashedToken,
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
export function createQRCodeData(dealId: string, token: string, userId?: string): string {
  const base = `dealish://scan?deal_id=${dealId}&token=${token}`;
  return userId ? `${base}&user_id=${userId}` : base;
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
        const userId = url.searchParams.get("user_id") ?? undefined;
        return { deal_id: dealId, token, user_id: userId };
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
