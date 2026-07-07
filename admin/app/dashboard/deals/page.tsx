"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Deal = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  discount_type: string | null;
  discount_value: number | null;
  start_at: string | null;
  end_at: string | null;
  is_recurring: boolean;
  recurrence_days: number[] | null;
  recurrence_start_time: string | null;
  recurrence_end_time: string | null;
  is_active: boolean;
  created_at: string;
};

type Restaurant = { id: string; name: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DealsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [recurrenceStartTime, setRecurrenceStartTime] = useState("11:00");
  const [recurrenceEndTime, setRecurrenceEndTime] = useState("14:00");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      fetchDeals();
    }
  }, [selectedRestaurantId]);

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

  const fetchDeals = async () => {
    if (!selectedRestaurantId) return;

    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("restaurant_id", selectedRestaurantId)
      .order("created_at", { ascending: false });

    if (!error) setDeals(data || []);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setIsRecurring(true);
    setRecurrenceDays([0, 1, 2, 3, 4, 5, 6]);
    setRecurrenceStartTime("11:00");
    setRecurrenceEndTime("14:00");
    setStartAt("");
    setEndAt("");
    setEditingDeal(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (deal: Deal) => {
    setEditingDeal(deal);
    setTitle(deal.title);
    setDescription(deal.description || "");
    setDiscountType(deal.discount_type || "percentage");
    setDiscountValue(deal.discount_value?.toString() || "");
    setIsRecurring(deal.is_recurring);
    setRecurrenceDays(deal.recurrence_days || [0, 1, 2, 3, 4, 5, 6]);
    setRecurrenceStartTime(deal.recurrence_start_time?.substring(0, 5) || "11:00");
    setRecurrenceEndTime(deal.recurrence_end_time?.substring(0, 5) || "14:00");
    setStartAt(deal.start_at ? deal.start_at.substring(0, 16) : "");
    setEndAt(deal.end_at ? deal.end_at.substring(0, 16) : "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !selectedRestaurantId) return;
    setSaving(true);
    setError(null);

    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: discountValue ? parseFloat(discountValue) : null,
      is_recurring: isRecurring,
      recurrence_days: isRecurring ? recurrenceDays : null,
      recurrence_start_time: isRecurring ? recurrenceStartTime + ":00" : null,
      recurrence_end_time: isRecurring ? recurrenceEndTime + ":00" : null,
      start_at: !isRecurring && startAt ? new Date(startAt).toISOString() : null,
      end_at: !isRecurring && endAt ? new Date(endAt).toISOString() : null,
      restaurant_id: selectedRestaurantId,
      is_active: editingDeal ? editingDeal.is_active : true,
    };

    let saveError: any = null;
    if (editingDeal) {
      const { error: err } = await supabase.from("deals").update(payload).eq("id", editingDeal.id);
      saveError = err;
    } else {
      const { error: err } = await supabase.from("deals").insert([payload]);
      saveError = err;
    }

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setShowForm(false);
    resetForm();
    fetchDeals();
  };

  const toggleDealStatus = async (deal: Deal) => {
    await supabase
      .from("deals")
      .update({ is_active: !deal.is_active })
      .eq("id", deal.id);
    setDeals(
      deals.map((d) =>
        d.id === deal.id ? { ...d, is_active: !d.is_active } : d
      )
    );
  };

  const deleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    await supabase.from("deals").delete().eq("id", dealId);
    setDeals(deals.filter((d) => d.id !== dealId));
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
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {deals.length} deal{deals.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={openCreateForm}
            className="rounded-xl bg-[#FE902A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e5811f] transition-colors"
          >
            + New Deal
          </button>
        </div>
      </div>

      {/* Deal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingDeal ? "Edit Deal" : "Create Deal"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder="e.g., 20% off lunch"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A] resize-none"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="bogo">BOGO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                    placeholder={discountType === "percentage" ? "20" : "5.00"}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#FE902A] focus:ring-[#FE902A]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Recurring deal
                  </span>
                </label>
              </div>

              {isRecurring && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setRecurrenceDays((prev) =>
                              prev.includes(idx)
                                ? prev.filter((d) => d !== idx)
                                : [...prev, idx]
                            );
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            recurrenceDays.includes(idx)
                              ? "bg-[#FE902A] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={recurrenceStartTime}
                        onChange={(e) => setRecurrenceStartTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={recurrenceEndTime}
                        onChange={(e) => setRecurrenceEndTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                      />
                    </div>
                  </div>
                </>
              )}

              {!isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="rounded-xl bg-[#FE902A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-60 transition-colors"
              >
                {saving ? "Saving..." : editingDeal ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Deals List */}
      {deals.length === 0 ? (
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">No deals yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Create your first deal to attract customers
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="rounded-2xl border border-gray-100 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {deal.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        deal.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          deal.is_active ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {deal.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {deal.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {deal.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {deal.is_recurring && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Recurring {deal.recurrence_start_time?.substring(0, 5)}-
                        {deal.recurrence_end_time?.substring(0, 5)}
                      </span>
                    )}
                    {deal.discount_value && (
                      <span>
                        {deal.discount_type === "percentage"
                          ? `${deal.discount_value}% off`
                          : deal.discount_type === "fixed"
                          ? `$${deal.discount_value} off`
                          : "BOGO"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleDealStatus(deal)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      deal.is_active
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {deal.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => openEditForm(deal)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteDeal(deal.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
