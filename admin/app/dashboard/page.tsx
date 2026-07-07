"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(null);
  const [totalSales, setTotalSales] = useState(0);
  const [averageSale, setAverageSale] = useState(0);
  const [activeDeals, setActiveDeals] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      fetchStats();
    }
  }, [selectedRestaurantId]);

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
      .select("restaurant:restaurant_id(*)")
      .eq("user_id", user.id)
      .eq("role", "owner");

    const list = ((memberData || []) as any[])
      .map((m) => m.restaurant)
      .filter(Boolean) as Restaurant[];

    const sortedList = list.sort((a, b) => a.name.localeCompare(b.name));

    setRestaurants(sortedList);
    if (sortedList.length > 0) {
      setSelectedRestaurantId(sortedList[0].id);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!selectedRestaurantId) return;

    // Fetch active deals count
    const { data: deals } = await supabase
      .from("deals")
      .select("id")
      .eq("restaurant_id", selectedRestaurantId)
      .eq("is_active", true);

    setActiveDeals(deals?.length || 0);

    // Fetch sales stats from QR scans
    const { data: allDeals } = await supabase
      .from("deals")
      .select("id")
      .eq("restaurant_id", selectedRestaurantId);

    const dealIds = allDeals?.map((d) => d.id) || [];
    if (dealIds.length === 0) {
      setTotalSales(0);
      setAverageSale(0);
      return;
    }

    const { data: scans } = await supabase
      .from("qr_code_scans")
      .select("id")
      .in("deal_id", dealIds);

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("id, price")
      .eq("restaurant_id", selectedRestaurantId)
      .not("price", "is", null);

    const totalScans = scans?.length || 0;
    if (menuItems && menuItems.length > 0) {
      const avgPrice =
        menuItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0) /
        menuItems.length;
      setTotalSales(totalScans * avgPrice);
      setAverageSale(avgPrice);
    } else {
      setTotalSales(0);
      setAverageSale(0);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your restaurant performance
          </p>
        </div>

        {/* Restaurant selector */}
        {restaurants.length > 0 && (
          <select
            value={selectedRestaurantId || ""}
            onChange={(e) => setSelectedRestaurantId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border-2 border-[#FE902A] bg-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-[#FEF3E2] flex items-center justify-center">
              <svg
                className="h-5 w-5 text-[#FE902A]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${totalSales > 1000 ? `${(totalSales / 1000).toFixed(1)}k` : totalSales.toFixed(0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Sales</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${averageSale.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Average Sale</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeDeals}</p>
          <p className="text-sm text-gray-500 mt-1">Active Deals</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Link
            href="/dashboard/deals"
            className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 p-6 hover:border-[#FE902A] hover:shadow-sm transition-all"
          >
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Deals</span>
          </Link>

          <Link
            href="/dashboard/inventory"
            className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 p-6 hover:border-[#FE902A] hover:shadow-sm transition-all"
          >
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Inventory</span>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 p-6 hover:border-[#FE902A] hover:shadow-sm transition-all"
          >
            <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">
              Analytics
            </span>
          </Link>

          <Link
            href="/dashboard/settings"
            className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 p-6 hover:border-[#FE902A] hover:shadow-sm transition-all"
          >
            <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Settings</span>
          </Link>

          <Link
            href="/dashboard/restaurants/new"
            className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 p-6 hover:border-[#FE902A] hover:shadow-sm transition-all"
          >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 text-center">New Restaurant</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
