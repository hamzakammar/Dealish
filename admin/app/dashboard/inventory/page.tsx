"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

type InventoryItem = {
  id: string;
  restaurant_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  price: number | null;
  category: string | null;
  is_available: boolean;
};

type Restaurant = { id: string; name: string };

export default function InventoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "", price: "", quantity: "", unit: "", expiry_date: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      fetchInventory();
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

  const fetchInventory = async () => {
    if (!selectedRestaurantId) return;

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", selectedRestaurantId)
      .order("name");

    setItems((data as any[]) || []);
  };

  const toggleAvailability = async (item: InventoryItem) => {
    await supabase
      .from("menu_items")
      .update({ is_available: !item.is_available })
      .eq("id", item.id);

    setItems(
      items.map((i) =>
        i.id === item.id ? { ...i, is_available: !i.is_available } : i
      )
    );
  };

  const addItem = async () => {
    if (!selectedRestaurantId || !newItem.name.trim()) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("menu_items").insert([
      {
        restaurant_id: selectedRestaurantId,
        name: newItem.name.trim(),
        category: newItem.category || null,
        price: newItem.price ? parseFloat(newItem.price) : null,
        quantity: newItem.quantity ? parseInt(newItem.quantity) : null,
        unit: newItem.unit || null,
        expiry_date: newItem.expiry_date || null,
        is_available: true,
      } as any,
    ]);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewItem({ name: "", category: "", price: "", quantity: "", unit: "", expiry_date: "" });
    setShowAddForm(false);
    fetchInventory();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
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
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""}
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
          <Link
            href="/dashboard/inventory/upload"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Bulk Upload
          </Link>
          <Link
            href="/dashboard/inventory/alerts"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Alerts
          </Link>
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-xl bg-[#FE902A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e5811f] transition-colors"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="rounded-2xl border border-[#FE902A] bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Inventory Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              placeholder="Item name *"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            <input
              placeholder="Category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            <input
              placeholder="Quantity"
              type="number"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            <input
              placeholder="Unit (e.g. kg, pcs)"
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
            <input
              type="date"
              placeholder="Expiry date"
              value={newItem.expiry_date}
              onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={addItem}
              disabled={saving || !newItem.name.trim()}
              className="rounded-xl bg-[#FE902A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving..." : "Save Item"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      {items.length === 0 ? (
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
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">No items yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Add inventory items to manage your stock
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Item
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Category
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Price
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Quantity
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Expiry
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpiringSoon =
                    item.expiry_date &&
                    new Date(item.expiry_date).getTime() - Date.now() <
                      3 * 24 * 60 * 60 * 1000;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {item.category || "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-900">
                        {item.price != null ? `$${Number(item.price).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {item.quantity != null
                          ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {item.expiry_date ? (
                          <span
                            className={`text-xs font-medium ${
                              isExpiringSoon
                                ? "text-red-600"
                                : "text-gray-500"
                            }`}
                          >
                            {new Date(item.expiry_date).toLocaleDateString()}
                            {isExpiringSoon && " (soon)"}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            item.is_available !== false
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.is_available !== false
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {item.is_available !== false
                            ? "Available"
                            : "Unavailable"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
