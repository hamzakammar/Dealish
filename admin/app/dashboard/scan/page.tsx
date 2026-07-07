"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Restaurant = { id: string; name: string };

export default function ScanRedeemPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [codeInput, setCodeInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }

    const { data: memberData } = await supabase
      .from("restaurant_members")
      .select("restaurant:restaurant_id(id, name)")
      .eq("user_id", user.id)
      .eq("role", "owner");

    const list = ((memberData || []) as any[])
      .map((m) => m.restaurant)
      .filter(Boolean) as Restaurant[];

    const sortedList = list.sort((a, b) => a.name.localeCompare(b.name));

    setRestaurants(sortedList);
    if (sortedList.length > 0) {
      setRestaurantId(sortedList[0].id);
    }
    setLoading(false);
  };

  function parseQRCodeData(qrData: string): {
    deal_id: string;
    token: string;
    user_id?: string;
  } | null {
    try {
      // Handle dealish:// URL format
      if (qrData.startsWith("dealish://")) {
        const url = new URL(qrData);
        const dealId = url.searchParams.get("deal_id");
        const token = url.searchParams.get("token");
        if (dealId && token) {
          const userId = url.searchParams.get("user_id") ?? undefined;
          return { deal_id: dealId, token, user_id: userId };
        }
      }
      // Try JSON format
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.deal_id && parsed.token) {
          return { deal_id: parsed.deal_id, token: parsed.token, user_id: parsed.user_id };
        }
      } catch {
        // Not JSON
      }
      return null;
    } catch {
      return null;
    }
  }

  const handleRedeem = async () => {
    if (!codeInput.trim() || processing) return;

    setProcessing(true);
    setResult(null);

    try {
      const qrData = parseQRCodeData(codeInput.trim());

      if (!qrData) {
        setResult({
          ok: false,
          message:
            "Invalid code format. Expected a dealish:// URL or JSON with deal_id and token.",
        });
        setProcessing(false);
        return;
      }

      // Get current user as fallback
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const targetUserId = qrData.user_id || user?.id;

      if (!targetUserId) {
        setResult({ ok: false, message: "No user found to attribute this redemption to." });
        setProcessing(false);
        return;
      }

      // Call the redeem_deal_scan RPC
      const { data, error } = await supabase.rpc("redeem_deal_scan", {
        p_deal_id: qrData.deal_id,
        p_token: qrData.token,
        p_user_id: targetUserId,
      });

      if (error) {
        setResult({ ok: false, message: error.message });
        setProcessing(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setResult({ ok: false, message: "No response from server." });
        setProcessing(false);
        return;
      }

      if (row.ok) {
        setResult({
          ok: true,
          message: `Deal "${row.deal_title || ""}" has been redeemed successfully.`,
        });
        setCodeInput("");
      } else {
        setResult({
          ok: false,
          message: row.message || "This deal could not be redeemed.",
        });
      }
    } catch (error: any) {
      setResult({
        ok: false,
        message: error.message || "Failed to process redemption.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Scan / Redeem Deal
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter a QR code string or deal redemption code to process a customer redemption
        </p>
      </div>

      {/* Restaurant selector */}
      {restaurants.length > 1 && (
        <select
          value={restaurantId || ""}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
        >
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      {/* Main card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-[#FEF3E2] flex items-center justify-center">
            <svg
              className="h-6 w-6 text-[#FE902A]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Enter Redemption Code
            </h2>
            <p className="text-sm text-gray-500">
              Paste the QR code data from the customer&apos;s device
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRedeem();
              }
            }}
            placeholder='dealish://scan?deal_id=...&token=...&user_id=...'
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A] resize-none font-mono"
          />

          <button
            onClick={handleRedeem}
            disabled={processing || !codeInput.trim()}
            className="w-full rounded-xl bg-[#FE902A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
            ) : (
              "Redeem Deal"
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`mt-4 rounded-xl border p-4 ${
              result.ok
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <svg
                  className="h-5 w-5 text-green-500 shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-500 shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <p
                className={`text-sm ${
                  result.ok ? "text-green-700" : "text-red-700"
                }`}
              >
                {result.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Format help */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Accepted Formats
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">
              Dealish URL format:
            </p>
            <code className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1 block">
              dealish://scan?deal_id=UUID&token=TOKEN&user_id=UUID
            </code>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">
              JSON format:
            </p>
            <code className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1 block">
              {`{"deal_id": "UUID", "token": "TOKEN", "user_id": "UUID"}`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
