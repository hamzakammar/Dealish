import { useEffect, useState } from "react";
import { mintRedemption, createQRCodeData } from "@/utils/qrCode";
import { useAuthContext } from "@/app/providers/auth";

type UseDealQRCode = {
  qrCodeData: string | null;
  pin: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Mints a fresh single-use redemption token for the given deal and returns the
 * QR payload plus the numeric PIN fallback. A new token is minted each time the
 * modal opens (dealId changes / becomes non-null); the previous unused token is
 * rotated out server-side.
 */
export function useDealQRCode(dealId: string | null): UseDealQRCode {
  const { session } = useAuthContext();
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId || !session?.user?.id) {
      setQrCodeData(null);
      setPin(null);
      setExpiresAt(null);
      return;
    }

    let mounted = true;
    const currentDealId = dealId;

    async function mint() {
      setLoading(true);
      setError(null);

      try {
        const minted = await mintRedemption(currentDealId);
        if (!minted) throw new Error("Could not create a redemption code");

        if (mounted) {
          setQrCodeData(createQRCodeData(minted.token));
          setPin(minted.pin);
          setExpiresAt(minted.expires_at);
        }
      } catch (e: unknown) {
        console.error("Error minting redemption code:", e);
        if (mounted) {
          setError(e instanceof Error ? e : new Error("Unknown error"));
          setQrCodeData(null);
          setPin(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    mint();

    return () => {
      mounted = false;
    };
  }, [dealId, session?.user?.id]);

  return { qrCodeData, pin, expiresAt, loading, error };
}
