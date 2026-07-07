"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

type AlertFilter =
  | "all"
  | "expiring_soon"
  | "expiring_today"
  | "expired"
  | "slow_moving";

type InventoryAlert = {
  id: string;
  alert_type: string;
  message: string;
  is_read: boolean;
  inventory_item_id: string;
  days_until_expiration: number | null;
  days_since_received: number | null;
  urgency_score: number | null;
  product: {
    name: string;
    category: string | null;
    subcategory: string | null;
  };
  inventory_item: {
    quantity: number;
    unit: string | null;
  } | null;
};

type Restaurant = { id: string; name: string };

export default function InventoryAlertsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [tableNotFound, setTableNotFound] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (restaurantId) {
      fetchAlerts();
    }
  }, [restaurantId]);

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

  const fetchAlerts = async () => {
    if (!restaurantId) return;
    setAlertsLoading(true);
    setError(null);
    setTableNotFound(false);

    try {
      const { data, error: fetchErr } = await supabase
        .from("inventory_alerts")
        .select(
          `
          id,
          alert_type,
          message,
          is_read,
          inventory_item_id,
          days_until_expiration,
          days_since_received,
          urgency_score
        `
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_dismissed", false)
        .order("urgency_score", { ascending: false });

      if (fetchErr) {
        // Handle case where table doesn't exist
        if (fetchErr.message?.includes("relation") || fetchErr.code === "42P01" || fetchErr.message?.includes("does not exist")) {
          setTableNotFound(true);
        } else {
          setError(fetchErr.message);
        }
      } else {
        setAlerts((data as any[]) || []);
      }
    } catch (err: any) {
      if (err.message?.includes("relation") || err.message?.includes("does not exist")) {
        setTableNotFound(true);
      } else {
        setError(err.message || "Failed to load alerts");
      }
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to dismiss this alert?"
    );
    if (!confirmed) return;

    await supabase
      .from("inventory_alerts")
      .update({ is_dismissed: true })
      .eq("id", id);

    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const handleMarkAllRead = async () => {
    const confirmed = window.confirm("Mark all alerts as read?");
    if (!confirmed) return;

    const ids = alerts.map((a) => a.id);
    if (ids.length === 0) return;

    await supabase
      .from("inventory_alerts")
      .update({ is_read: true })
      .in("id", ids);

    setAlerts(alerts.map((a) => ({ ...a, is_read: true })));
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") return true;
    return alert.alert_type === filter;
  });

  const stats = {
    all: alerts.length,
    expiring_soon: alerts.filter((a) => a.alert_type === "expiring_soon")
      .length,
    expiring_today: alerts.filter((a) => a.alert_type === "expiring_today")
      .length,
    expired: alerts.filter((a) => a.alert_type === "expired").length,
    slow_moving: alerts.filter((a) => a.alert_type === "slow_moving").length,
  };

  const getAlertColor = (alertType: string) => {
    switch (alertType) {
      case "expired":
        return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" };
      case "expiring_today":
        return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500" };
      case "expiring_soon":
        return { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", dot: "bg-yellow-500" };
      case "slow_moving":
        return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-500" };
      default:
        return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-500" };
    }
  };

  const getFilterLabel = (filterType: AlertFilter): string => {
    switch (filterType) {
      case "all":
        return "All";
      case "expiring_soon":
        return "Expiring Soon";
      case "expiring_today":
        return "Expiring Today";
      case "expired":
        return "Expired";
      case "slow_moving":
        return "Slow Moving";
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
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory"
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg
              className="h-5 w-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inventory Alerts
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {alerts.length} active alert{alerts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
          {alerts.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      {alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(
            [
              "all",
              "expiring_today",
              "expiring_soon",
              "expired",
              "slow_moving",
            ] as AlertFilter[]
          ).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === filterType
                  ? "bg-[#FE902A] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {getFilterLabel(filterType)}
              {stats[filterType] > 0 && (
                <span
                  className={`inline-flex items-center justify-center h-5 min-w-[20px] rounded-full px-1.5 text-xs font-semibold ${
                    filter === filterType
                      ? "bg-white text-[#FE902A]"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {stats[filterType]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Table not found state */}
      {tableNotFound && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
            <svg
              className="h-10 w-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">No Alerts Available</p>
          <p className="text-sm text-gray-500 mt-1">
            Inventory alerts are not configured yet. No expiring or low-stock alerts to show.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !tableNotFound && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button
            onClick={fetchAlerts}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {alertsLoading && !tableNotFound && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A]" />
        </div>
      )}

      {/* Empty state */}
      {!alertsLoading && !error && !tableNotFound && filteredAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
            <svg
              className="h-10 w-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {filter === "all" ? "All Clear!" : `No ${getFilterLabel(filter)} Alerts`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === "all"
              ? "No expiring or slow-moving inventory items at the moment."
              : `No ${getFilterLabel(filter).toLowerCase()} alerts found.`}
          </p>
        </div>
      )}

      {/* Alerts list */}
      {!alertsLoading && !error && !tableNotFound && filteredAlerts.length > 0 && (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const colors = getAlertColor(alert.alert_type);
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border bg-white overflow-hidden ${
                  !alert.is_read ? "border-l-4" : ""
                } ${!alert.is_read ? colors.border : "border-gray-100"}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`h-2 w-2 rounded-full ${colors.dot}`}
                        />
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {alert.product?.name || "Unknown Product"}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {alert.product?.category
                          ? alert.product.category.charAt(0).toUpperCase() +
                            alert.product.category.slice(1).replace("_", " ")
                          : "Uncategorized"}
                        {alert.product?.subcategory &&
                          ` - ${alert.product.subcategory.replace("_", " ")}`}
                      </p>
                      <p className="text-sm text-gray-700">{alert.message}</p>

                      {/* Details row */}
                      <div className="flex flex-wrap gap-4 mt-3">
                        {alert.inventory_item && (
                          <span className="text-xs text-gray-500">
                            Qty: {alert.inventory_item.quantity}
                            {alert.inventory_item.unit
                              ? ` ${alert.inventory_item.unit}`
                              : ""}
                          </span>
                        )}
                        {alert.days_until_expiration !== null &&
                          alert.days_until_expiration !== undefined && (
                            <span className={`text-xs font-medium ${colors.text}`}>
                              {alert.days_until_expiration === 0
                                ? "Expires today"
                                : alert.days_until_expiration < 0
                                ? `Expired ${Math.abs(alert.days_until_expiration)} day${Math.abs(alert.days_until_expiration) === 1 ? "" : "s"} ago`
                                : `Expires in ${alert.days_until_expiration} day${alert.days_until_expiration === 1 ? "" : "s"}`}
                            </span>
                          )}
                        {alert.days_since_received !== null &&
                          alert.days_since_received !== undefined && (
                            <span className="text-xs text-gray-500">
                              Received {alert.days_since_received} day
                              {alert.days_since_received === 1 ? "" : "s"} ago
                            </span>
                          )}
                        {alert.urgency_score !== null &&
                          alert.urgency_score !== undefined && (
                            <span className={`text-xs font-medium ${colors.text}`}>
                              {alert.urgency_score >= 80
                                ? "Urgent"
                                : alert.urgency_score >= 50
                                ? "High Priority"
                                : "Medium Priority"}
                            </span>
                          )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Dismiss alert"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
