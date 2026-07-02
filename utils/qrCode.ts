import { supabase } from "@/app/lib/supabase";

export type QRCodeData = {
  token: string;
  deal_id?: string;
};

export type RedeemResult = {
  ok: boolean;
  message: string;
  saved_amount?: number;
  deal_title?: string;
  out_restaurant_id?: string;
  restaurant_name?: string;
  out_user_id?: string;
};

export type MintedRedemption = {
  redemption_id: string;
  token: string;
  pin: string;
  expires_at: string;
};

/**
 * Customer-side: mint a fresh, single-use, expiring redemption token bound
 * server-side to the current user. Re-calling rotates the token (the previous
 * unused one is voided), so it is safe to call each time the QR modal opens.
 */
export async function mintRedemption(dealId: string): Promise<MintedRedemption | null> {
  try {
    const { data, error } = await supabase.rpc("mint_redemption", {
      p_deal_id: dealId,
    });

    if (error) {
      console.error("Error minting redemption:", error.message);
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.token) return null;
    return row as MintedRedemption;
  } catch (err) {
    console.error("Error minting redemption:", err);
    throw err;
  }
}

/**
 * Merchant-side: redeem a scanned token (or a typed PIN). The customer credited
 * is derived from the bound redemption row on the server, never from the QR.
 */
export async function redeemRedemptionToken(tokenOrPin: string): Promise<RedeemResult> {
  try {
    const { data, error } = await supabase.rpc("redeem_redemption_token", {
      p_token: tokenOrPin,
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
 * Build the QR payload from a minted redemption token. The token is opaque and
 * single-use; no deal id or user id is embedded.
 */
export function createQRCodeData(token: string): string {
  return `dealish://redeem?token=${encodeURIComponent(token)}`;
}

/**
 * Parse a scanned QR payload into a redemption token.
 * Accepts the `dealish://redeem?token=...` form and a bare token fallback.
 */
export function parseQRCodeData(qrData: string): QRCodeData | null {
  try {
    if (qrData.startsWith("dealish://")) {
      const url = new URL(qrData);
      const token = url.searchParams.get("token");
      if (token) {
        const dealId = url.searchParams.get("deal_id") ?? undefined;
        return { token, deal_id: dealId };
      }
      return null;
    }

    // Fallback: JSON payload with a token.
    try {
      const parsed = JSON.parse(qrData);
      if (parsed?.token) {
        return { token: String(parsed.token), deal_id: parsed.deal_id };
      }
    } catch {
      // Not JSON.
    }

    // Fallback: a bare hex token (32 chars from gen_random_bytes(16)).
    if (/^[a-f0-9]{16,}$/i.test(qrData.trim())) {
      return { token: qrData.trim() };
    }

    return null;
  } catch (error) {
    console.error("Error parsing QR code data:", error);
    return null;
  }
}
