import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { generateQRCodeToken, createQRCodeData } from "@/utils/qrCode";

export function useDealQRCode(dealId: string | null) {
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
      setLoading(true);
      setError(null);

      try {
        // First, check if deal already has a QR code token
        const { data: deal, error: fetchError } = await supabase
          .from("deals")
          .select("qr_code_token")
          .eq("id", dealId)
          .single();

        if (fetchError) throw fetchError;

        let token = deal?.qr_code_token;

        // If no token exists, generate one
        if (!token) {
          token = await generateQRCodeToken(dealId);
          if (!token) {
            throw new Error("Failed to generate QR code token");
          }
        }

        if (mounted) {
          const qrData = createQRCodeData(dealId, token);
          setQrCodeData(qrData);
        }
      } catch (e: any) {
        console.error("Error fetching/generating QR code:", e);
        if (mounted) {
          setError(e);
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
