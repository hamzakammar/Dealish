"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

type ParsedRow = {
  rowIndex: number;
  external_product_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  supplier: string | null;
  quantity: number | null;
  unit_cost: number | null;
  purchase_date: string | null;
  expiration_date: string | null;
  location: string | null;
  notes: string | null;
  status: "active" | "low_stock" | "expired" | null;
  error: string | null;
};

type Field = Exclude<keyof ParsedRow, "rowIndex" | "error">;

const HEADER_ALIASES: Record<string, Field> = {
  "item id": "external_product_id",
  sku: "external_product_id",
  id: "external_product_id",
  name: "name",
  item: "name",
  product: "name",
  "item name": "name",
  "product name": "name",
  description: "description",
  desc: "description",
  details: "description",
  category: "category",
  cat: "category",
  type: "category",
  unit: "unit",
  uom: "unit",
  "unit of measure": "unit",
  supplier: "supplier",
  vendor: "supplier",
  quantity: "quantity",
  qty: "quantity",
  count: "quantity",
  amount: "quantity",
  stock: "quantity",
  "current stock": "quantity",
  "on hand": "quantity",
  "in stock": "quantity",
  "unit cost": "unit_cost",
  unit_cost: "unit_cost",
  cost: "unit_cost",
  price: "unit_cost",
  "unit cost ($)": "unit_cost",
  "cost ($)": "unit_cost",
  "purchase date": "purchase_date",
  received: "purchase_date",
  "received date": "purchase_date",
  "expiration date": "expiration_date",
  expiration: "expiration_date",
  expires: "expiration_date",
  "expiry date": "expiration_date",
  expiry: "expiration_date",
  "best by": "expiration_date",
  "use by": "expiration_date",
  location: "location",
  loc: "location",
  storage: "location",
  notes: "notes",
  note: "notes",
  comments: "notes",
  status: "status",
};

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseCSVLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumber(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[$,\s]/g, ""));
  return isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mo, da, yr] = m;
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseStatus(v: string): ParsedRow["status"] {
  const s = v.toLowerCase();
  if (!s) return null;
  if (s.includes("expired")) return "expired";
  if (s.includes("low")) return "low_stock";
  if (s.includes("ok") || s.includes("good") || s.includes("green"))
    return "active";
  return null;
}

function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const delim = detectDelimiter(lines[i]);
    const cells = parseCSVLine(lines[i], delim).map((c) => c.toLowerCase());
    const fields = new Set<Field>();
    for (const c of cells) {
      const f = HEADER_ALIASES[c];
      if (f) fields.add(f);
    }
    if (fields.has("name") && fields.has("quantity")) return i;
  }
  return -1;
}

function parseSheetText(text: string): {
  rows: ParsedRow[];
  headerError: string | null;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2)
    return {
      rows: [],
      headerError: "Need a header row plus at least one data row.",
    };

  const headerIdx = findHeaderRowIndex(lines);
  if (headerIdx === -1) {
    return {
      rows: [],
      headerError:
        'Could not find a header row containing both a name column (e.g. "Item Name") and a quantity column (e.g. "Current Stock").',
    };
  }

  const delim = detectDelimiter(lines[headerIdx]);
  const rawHeaders = parseCSVLine(lines[headerIdx], delim).map((h) =>
    h.toLowerCase()
  );
  const colMap: Record<number, Field> = {};
  rawHeaders.forEach((h, i) => {
    const mapped = HEADER_ALIASES[h];
    if (mapped) colMap[i] = mapped;
  });

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delim);
    if (cells.every((c) => !c)) continue;

    const row: ParsedRow = {
      rowIndex: i + 1,
      external_product_id: null,
      name: "",
      description: null,
      category: null,
      unit: null,
      supplier: null,
      quantity: null,
      unit_cost: null,
      purchase_date: null,
      expiration_date: null,
      location: null,
      notes: null,
      status: null,
      error: null,
    };
    cells.forEach((cell, idx) => {
      const field = colMap[idx];
      if (!field) return;
      if (field === "name") row.name = cell;
      else if (field === "quantity") row.quantity = parseNumber(cell);
      else if (field === "unit_cost") row.unit_cost = parseNumber(cell);
      else if (field === "purchase_date") row.purchase_date = parseDate(cell);
      else if (field === "expiration_date")
        row.expiration_date = parseDate(cell);
      else if (field === "status") row.status = parseStatus(cell);
      else (row as any)[field] = cell || null;
    });
    if (!row.name) row.error = "Missing name";
    else if (row.quantity == null) row.error = "Missing or invalid quantity";
    else if (row.quantity < 0) row.error = "Quantity must be >= 0";
    rows.push(row);
  }
  return { rows, headerError: null };
}

function parseSheetUrl(
  input: string
): { sheetId: string; gid: string } | null {
  const url = input.trim();
  if (!url) return null;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
}

type Restaurant = { id: string; name: string };

export default function BulkUploadPage() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sheetUrl, setSheetUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

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

    setRestaurants(list);
    if (list.length > 0) {
      setRestaurantId(list[0].id);
    }
    setLoading(false);
  };

  async function handleFetch() {
    setFetchError(null);
    setCsvText("");
    setUploadResult(null);
    const parsed = parseSheetUrl(sheetUrl);
    if (!parsed) {
      setFetchError(
        "That doesn't look like a Google Sheet URL. Paste the link from your browser's address bar."
      );
      return;
    }
    setFetching(true);
    try {
      // Use gviz/tq endpoint which supports CORS for public sheets
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=out:csv&gid=${parsed.gid}`;
      const resp = await fetch(gvizUrl);
      if (!resp.ok) {
        if (
          resp.status === 401 ||
          resp.status === 403 ||
          resp.status === 404
        ) {
          throw new Error(
            'Sheet isn\'t accessible. In Google Sheets: Share > General access > set to "Anyone with the link" (Viewer). Then try again.'
          );
        }
        throw new Error(`Fetch failed: HTTP ${resp.status}`);
      }
      const text = await resp.text();
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        throw new Error(
          'Sheet looks private. In Google Sheets: Share > General access > "Anyone with the link" (Viewer).'
        );
      }
      setCsvText(text);
    } catch (err: any) {
      setFetchError(err.message || String(err));
    } finally {
      setFetching(false);
    }
  }

  const parsed = useMemo(() => parseSheetText(csvText), [csvText]);
  const validRows = parsed.rows.filter((r) => !r.error);
  const errorRows = parsed.rows.filter((r) => r.error);

  async function handleUpload() {
    if (!restaurantId) return;
    if (validRows.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: validRows.length });
    setUploadResult(null);

    let created = 0;
    let updated = 0;
    const failures: { row: number; reason: string }[] = [];

    for (const r of validRows) {
      try {
        // Check if item already exists by name
        const { data: found } = await supabase
          .from("menu_items")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .ilike("name", r.name)
          .limit(1)
          .maybeSingle();

        const menuItemFields: any = {
          name: r.name,
          category: r.category || null,
          price: r.unit_cost || null,
          quantity: r.quantity!,
          unit: r.unit || null,
          expiry_date: r.expiration_date || null,
          is_available: true,
        };

        if (found?.id) {
          const { error: upErr } = await supabase
            .from("menu_items")
            .update(menuItemFields)
            .eq("id", found.id);
          if (upErr) throw new Error(upErr.message);
          updated++;
        } else {
          const { error: iErr } = await supabase
            .from("menu_items")
            .insert({
              restaurant_id: restaurantId,
              ...menuItemFields,
            });
          if (iErr) throw new Error(iErr.message);
          created++;
        }
      } catch (err: any) {
        failures.push({ row: r.rowIndex, reason: err.message || String(err) });
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    setUploading(false);
    setProgress(null);

    const okSummary = `${created} added, ${updated} updated`;
    if (failures.length === 0) {
      setUploadResult(`Success: ${okSummary}.`);
      setCsvText("");
    } else {
      const sample = failures
        .slice(0, 3)
        .map((f) => `Row ${f.row}: ${f.reason}`)
        .join("\n");
      setUploadResult(
        `Partial upload: ${okSummary}, ${failures.length} failed.\n${sample}`
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FE902A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
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
            Bulk Upload Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Import items from a Google Sheet
          </p>
        </div>
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

      {/* Step 1: Paste URL */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          1. Paste your Google Sheet URL
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          In Google Sheets: <strong>Share &gt; General access &gt; &quot;Anyone
          with the link&quot; (Viewer)</strong>, then copy the URL from your
          browser&apos;s address bar.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Recognised columns: Item ID, Item Name, Category, Unit, Current Stock,
          Unit Cost, Status, Notes, Expiration Date, Supplier, Location. Title
          rows are skipped automatically.
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
          />
          <button
            onClick={handleFetch}
            disabled={fetching || !sheetUrl.trim()}
            className="rounded-xl bg-[#FE902A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#e5811f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fetching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Fetch sheet"
            )}
          </button>
        </div>
        {fetchError && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{fetchError}</p>
          </div>
        )}
      </div>

      {/* Step 2: Preview */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          2. Preview
        </h2>
        {parsed.headerError && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 mb-3">
            <p className="text-sm text-red-700">{parsed.headerError}</p>
          </div>
        )}
        {!parsed.headerError && parsed.rows.length === 0 && (
          <p className="text-sm text-gray-500">
            Fetch a sheet above to see a preview.
          </p>
        )}
        {parsed.rows.length > 0 && (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {parsed.rows.slice(0, 30).map((r) => (
                <div
                  key={r.rowIndex}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    r.error
                      ? "border-red-200 bg-red-50/50 opacity-60"
                      : "border-gray-100 bg-gray-50/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.name || "(no name)"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[
                        r.external_product_id,
                        r.quantity != null &&
                          `${r.quantity}${r.unit ? " " + r.unit : ""}`,
                        r.category,
                        r.unit_cost != null && `$${r.unit_cost.toFixed(2)}`,
                        r.status &&
                          (r.status === "low_stock" ? "low" : r.status),
                        r.expiration_date && `exp ${r.expiration_date}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "no extras"}
                    </p>
                    {r.error && (
                      <p className="text-xs text-red-600 mt-0.5">{r.error}</p>
                    )}
                  </div>
                  {r.error ? (
                    <svg
                      className="h-5 w-5 text-red-400 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-green-500 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            {parsed.rows.length > 30 && (
              <p className="text-xs text-gray-400 mt-2">
                ...and {parsed.rows.length - 30} more
              </p>
            )}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-green-600">
                  {validRows.length} ready
                </span>{" "}
                ·{" "}
                <span className="font-medium text-red-500">
                  {errorRows.length} skipped
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || validRows.length === 0}
        className="w-full rounded-2xl bg-[#FE902A] px-6 py-4 text-base font-semibold text-white hover:bg-[#e5811f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Uploading {progress?.done}/{progress?.total}...
          </span>
        ) : (
          `Upload ${validRows.length} item${validRows.length === 1 ? "" : "s"}`
        )}
      </button>

      {/* Upload result */}
      {uploadResult && (
        <div
          className={`rounded-2xl border p-4 ${
            uploadResult.startsWith("Success")
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50"
          }`}
        >
          <p
            className={`text-sm whitespace-pre-line ${
              uploadResult.startsWith("Success")
                ? "text-green-700"
                : "text-yellow-700"
            }`}
          >
            {uploadResult}
          </p>
        </div>
      )}
    </div>
  );
}
