"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Restaurant = { id: string; name: string };
type Invite = {
  id: string;
  code: string;
  restaurant_id: string;
  role: "owner" | "admin";
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  restaurants?: { name: string } | null;
};

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default function AccessCodesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "admin">("admin");
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    setUserId(user.id);

    const { data: memberData } = await supabase
      .from("restaurant_members")
      .select("restaurant:restaurant_id(id, name)")
      .eq("user_id", user.id)
      .eq("role", "owner");

    const rlist = ((memberData || []) as any[])
      .map((m) => m.restaurant)
      .filter(Boolean) as Restaurant[];

    setRestaurants(rlist);

    const restaurantIds = rlist.map((r) => r.id);
    let inviteData: any[] = [];
    if (restaurantIds.length > 0) {
      const { data: iData } = await supabase
        .from("restaurant_invites")
        .select("*, restaurants:restaurant_id(name)")
        .in("restaurant_id", restaurantIds)
        .order("created_at", { ascending: false });
      inviteData = iData || [];
    }

    setInvites(inviteData as unknown as Invite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createInvite = async () => {
    if (!selectedRestaurant || !userId) return;
    setCreating(true);
    setError(null);

    const code = genCode();
    const expires = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: insertError } = await (supabase.from("restaurant_invites") as any).insert([
      {
        code,
        restaurant_id: selectedRestaurant,
        role,
        created_by: userId,
        max_uses: 1,
        expires_at: expires,
      },
    ]);

    if (insertError) {
      setError(insertError.message);
    } else {
      await load();
    }
    setCreating(false);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("Revoke this code? It will stop working immediately.")) return;
    await supabase.from("restaurant_invites").delete().eq("id", id);
    setInvites(invites.filter((i) => i.id !== id));
  };

  const copyCode = (invite: Invite) => {
    navigator.clipboard.writeText(
      `Your Dealish admin access code: ${invite.code}`
    );
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
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
        <h1 className="text-2xl font-bold text-gray-900">Access Codes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate invite codes for your staff
        </p>
      </div>

      {/* Create Code */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Create a code
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Pick a restaurant and role. The person signs up, then enters the code.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Restaurant
            </label>
            <div className="flex flex-wrap gap-2">
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRestaurant(r.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                    selectedRestaurant === r.id
                      ? "bg-[#FE902A] text-white border-[#FE902A]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setRole("owner")}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                  role === "owner"
                    ? "bg-[#FE902A] text-white border-[#FE902A]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Owner (manages restaurant)
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                  role === "admin"
                    ? "bg-[#FE902A] text-white border-[#FE902A]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Admin (scans QR only)
              </button>
            </div>
          </div>

          <button
            onClick={createInvite}
            disabled={creating || !selectedRestaurant}
            className="rounded-xl bg-[#FE902A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-60 transition-colors"
          >
            {creating ? "Generating..." : "Generate Code"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Existing Codes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Existing Codes
        </h2>
        {invites.length === 0 ? (
          <p className="text-sm text-gray-500">No codes yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => {
              const used = invite.use_count >= invite.max_uses;
              const expired = invite.expires_at
                ? new Date(invite.expires_at) < new Date()
                : false;
              const status = used ? "used" : expired ? "expired" : "active";

              return (
                <div
                  key={invite.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex-1">
                    <p className="text-base font-mono font-bold text-gray-900 tracking-wider">
                      {invite.code}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {invite.restaurants?.name || "—"} &middot; {invite.role}{" "}
                      &middot;{" "}
                      <span
                        className={
                          status === "active"
                            ? "text-green-600"
                            : status === "expired"
                            ? "text-red-500"
                            : "text-gray-400"
                        }
                      >
                        {status}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(invite)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="Copy code"
                  >
                    {copiedId === invite.id ? (
                      <svg
                        className="h-4 w-4 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Revoke"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
