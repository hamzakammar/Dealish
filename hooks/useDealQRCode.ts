import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { generateQRCodeToken, createQRCodeData } from "@/utils/qrCode";
import { useAuthContext } from "@/app/providers/auth";

export function useDealQRCode(dealId: string | null) {
  const { session } = useAuthContext();
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setQrCodeData(null);
      return;
    }

    let mounted = true;

    async function fetchOrGenerateQRCode() {
      if (!dealId) return;
      const currentDealId = dealId; // Narrow type for closure
      setLoading(true);
      setError(null);

      try {
        // First, check if deal already has a QR code token
        const { data: deal, error: fetchError } = await supabase
          .from("deals")
          .select("qr_code_token")
          .eq("id", currentDealId)
          .single();

        if (fetchError) throw fetchError;

        let token = deal?.qr_code_token;

        // If no token exists, generate one
        if (!token) {
          token = await generateQRCodeToken(currentDealId);
          if (!token) {
            throw new Error("Failed to generate QR code token");
          }
        }

        if (mounted) {
          const qrData = createQRCodeData(currentDealId, token, session?.user?.id);
          setQrCodeData(qrData);
        }
      } catch (e: unknown) {
        console.error("Error fetching/generating QR code:", e);
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchOrGenerateQRCode();

    return () => {
      mounted = false;
    };
  }, [dealId]);

  return { qrCodeData, loading, error };
}
