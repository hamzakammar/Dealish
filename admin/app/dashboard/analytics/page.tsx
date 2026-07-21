"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type ScanRecord = {
  id: string;
  scanned_at: string;
  deal_id: string;
};

type DealStat = {
  deal_id: string;
  deal_title: string;
  scan_count: number;
  percentage: number;
};

type Restaurant = { id: string; name: string };

const TIME_RANGES = ["1D", "1W", "1M", "3M", "6M"] as const;
type TimeRange = (typeof TIME_RANGES)[number];
const PAGE_SIZE = 25;

export default function AnalyticsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("1W");
  const [totalScans, setTotalScans] = useState(0);
  const [dealStats, setDealStats] = useState<DealStat[]>([]);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      fetchAnalytics();
    }
  }, [selectedRestaurantId, timeRange]);

  const fetchRestaurants = async () => {
    const { data: { user } } = await supabase.auth.getUser();
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
      setSelectedRestaurantId(sortedList[0].id);
    }
    setLoading(false);
  };

  const getStartDate = useCallback(() => {
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case "1D":
        startDate.setDate(now.getDate() - 1);
        break;
      case "1W":
        startDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(now.getMonth() - 6);
        break;
    }
    return startDate;
  }, [timeRange]);

  const fetchAnalytics = async () => {
    if (!selectedRestaurantId) return;

    const now = new Date();
    const startDate = getStartDate();

    const { data: deals } = await supabase
      .from("deals")
      .select("id, title")
      .eq("restaurant_id", selectedRestaurantId);

    const dealIds = (deals || []).map((d) => d.id);
    if (dealIds.length === 0) {
      setTotalScans(0);
      setDealStats([]);
      setChartData([]);
      setChartLabels([]);
      setScanRecords([]);
      setHasMore(false);
      return;
    }

    // Fetch first page of scans for display
    const { data: scans, count } = await supabase
      .from("qr_code_scans")
      .select("id, scanned_at, deal_id", { count: "exact" })
      .in("deal_id", dealIds)
      .gte("scanned_at", startDate.toISOString())
      .order("scanned_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const total = count ?? 0;
    const records = (scans || []) as ScanRecord[];
    setScanRecords(records);
    setHasMore(total > PAGE_SIZE);

    const dealMap: Record<string, string> = {};
    (deals || []).forEach((deal) => {
      dealMap[deal.id] = deal.title;
    });

    // For stats + chart, fetch all scans but only the minimal fields needed
    // Use pagination to avoid loading everything at once for very large datasets
    let allScans: ScanRecord[] = [];
    if (total <= 500) {
      const { data: all } = await supabase
        .from("qr_code_scans")
        .select("id, scanned_at, deal_id")
        .in("deal_id", dealIds)
        .gte("scanned_at", startDate.toISOString())
        .order("scanned_at", { ascending: false })
        .range(0, 499);
      allScans = (all || []) as ScanRecord[];
    } else {
      // For very large datasets, fetch in batches of 500
      let offset = 0;
      while (offset < total) {
        const { data: batch } = await supabase
          .from("qr_code_scans")
          .select("id, scanned_at, deal_id")
          .in("deal_id", dealIds)
          .gte("scanned_at", startDate.toISOString())
          .order("scanned_at", { ascending: false })
          .range(offset, offset + 499);
        if (!batch || batch.length === 0) break;
        allScans = allScans.concat(batch as ScanRecord[]);
        offset += 500;
      }
    }

    const dealScanMap: Record<string, { title: string; count: number }> = {};
    allScans.forEach((scan) => {
      const dealId = scan.deal_id;
      if (dealId) {
        if (!dealScanMap[dealId]) {
          dealScanMap[dealId] = { title: dealMap[dealId] || "Unknown", count: 0 };
        }
        dealScanMap[dealId].count++;
      }
    });

    const maxScans = Math.max(
      ...Object.values(dealScanMap).map((d) => d.count),
      1
    );

    const stats = Object.entries(dealScanMap)
      .map(([deal_id, data]) => ({
        deal_id,
        deal_title: data.title,
        scan_count: data.count,
        percentage: Math.round((data.count / maxScans) * 100),
      }))
      .sort((a, b) => b.scan_count - a.scan_count);

    // Build chart data
    let cData: number[] = [];
    let cLabels: string[] = [];

    switch (timeRange) {
      case "1W": {
        cData = new Array(7).fill(0);
        cLabels = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - (6 - i));
          return date.toLocaleDateString("en-US", { weekday: "short" });
        });
        allScans.forEach((scan) => {
          const scanDate = new Date(scan.scanned_at);
          const daysAgo = Math.floor(
            (now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysAgo >= 0 && daysAgo < 7) {
            cData[6 - daysAgo]++;
          }
        });
        break;
      }
      case "1D": {
        cData = new Array(24).fill(0);
        cLabels = Array.from({ length: 24 }, (_, i) => {
          const hour = (now.getHours() - (23 - i) + 24) % 24;
          return `${hour}:00`;
        });
        allScans.forEach((scan) => {
          const scanDate = new Date(scan.scanned_at);
          const hoursAgo = Math.floor(
            (now.getTime() - scanDate.getTime()) / (1000 * 60 * 60)
          );
          if (hoursAgo >= 0 && hoursAgo < 24) {
            cData[23 - hoursAgo]++;
          }
        });
        break;
      }
      case "1M": {
        cData = new Array(30).fill(0);
        cLabels = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - (29 - i));
          return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        allScans.forEach((scan) => {
          const scanDate = new Date(scan.scanned_at);
          const daysAgo = Math.floor(
            (now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysAgo >= 0 && daysAgo < 30) {
            cData[29 - daysAgo]++;
          }
        });
        break;
      }
      case "3M": {
        cData = new Array(12).fill(0);
        cLabels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
        allScans.forEach((scan) => {
          const scanDate = new Date(scan.scanned_at);
          const weeksAgo = Math.floor(
            (now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
          );
          if (weeksAgo >= 0 && weeksAgo < 12) {
            cData[11 - weeksAgo]++;
          }
        });
        break;
      }
      case "6M": {
        cData = new Array(6).fill(0);
        cLabels = Array.from({ length: 6 }, (_, i) => {
          const date = new Date(now);
          date.setMonth(date.getMonth() - (5 - i));
          return date.toLocaleDateString("en-US", { month: "short" });
        });
        allScans.forEach((scan) => {
          const scanDate = new Date(scan.scanned_at);
          const monthsAgo =
            (now.getFullYear() - scanDate.getFullYear()) * 12 +
            (now.getMonth() - scanDate.getMonth());
          if (monthsAgo >= 0 && monthsAgo < 6) {
            cData[5 - monthsAgo]++;
          }
        });
        break;
      }
    }

    setTotalScans(total);
    setDealStats(stats);
    setChartData(cData);
    setChartLabels(cLabels);
  };

  const loadMoreScans = async () => {
    if (!selectedRestaurantId || loadingMore) return;
    setLoadingMore(true);

    const startDate = getStartDate();
    const { data: deals } = await supabase
      .from("deals")
      .select("id")
      .eq("restaurant_id", selectedRestaurantId);

    const dealIds = (deals || []).map((d) => d.id);
    const offset = scanRecords.length;

    const { data: scans } = await supabase
      .from("qr_code_scans")
      .select("id, scanned_at, deal_id")
      .in("deal_id", dealIds)
      .gte("scanned_at", startDate.toISOString())
      .order("scanned_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const newRecords = (scans || []) as ScanRecord[];
    setScanRecords((prev) => [...prev, ...newRecords]);
    setHasMore(newRecords.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A]" />
      </div>
    );
  }

  const maxChartValue = Math.max(...chartData, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalScans} total scan{totalScans !== 1 ? "s" : ""}
          </p>
        </div>
        {restaurants.length > 1 && (
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

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              timeRange === range
                ? "bg-[#FE902A] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {totalScans === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-gray-300"
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
          <p className="text-lg font-semibold text-gray-900">No data yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Analytics will appear once customers start using your deals
          </p>
        </div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Customer Activity
            </h2>
            <div className="flex items-end justify-between gap-1" style={{ height: 160 }}>
              {chartData.map((value, idx) => (
                <div
                  key={idx}
                  className="flex flex-1 flex-col items-center h-full"
                >
                  <span className="text-[10px] text-gray-400 mb-1">
                    {value > 0 ? value : ""}
                  </span>
                  <div className="flex-1 w-full flex items-end justify-center">
                    <div
                      className="w-full max-w-[24px] rounded-t bg-[#FE902A] transition-all"
                      style={{
                        height: `${Math.max((value / maxChartValue) * 100, value > 0 ? 8 : 2)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 truncate w-full text-center mt-1">
                    {chartLabels[idx]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deal Performance */}
          {dealStats.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Deal Performance
              </h2>
              {dealStats.map((stat) => (
                <div
                  key={stat.deal_id}
                  className="rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {stat.deal_title}
                    </span>
                    <span className="rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#FE902A]">
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#FE902A] transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {stat.scan_count} scan{stat.scan_count !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Scans */}
          {scanRecords.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Scans
              </h2>
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">Deal</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">Scanned At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanRecords.map((scan) => {
                      const dealTitle = dealStats.find((d) => d.deal_id === scan.deal_id)?.deal_title || "Unknown";
                      return (
                        <tr key={scan.id} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2.5 text-gray-900">{dealTitle}</td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {new Date(scan.scanned_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <button
                  onClick={loadMoreScans}
                  disabled={loadingMore}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
