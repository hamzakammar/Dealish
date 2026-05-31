import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  status: 'active' | 'low_stock' | 'expired' | null;
  error: string | null;
};

type Field = Exclude<keyof ParsedRow, 'rowIndex' | 'error'>;

// Generous alias map. Keys are lowercased, trimmed.
const HEADER_ALIASES: Record<string, Field> = {
  'item id': 'external_product_id', 'sku': 'external_product_id', 'id': 'external_product_id',
  'name': 'name', 'item': 'name', 'product': 'name',
  'item name': 'name', 'product name': 'name',
  'description': 'description', 'desc': 'description', 'details': 'description',
  'category': 'category', 'cat': 'category', 'type': 'category',
  'unit': 'unit', 'uom': 'unit', 'unit of measure': 'unit',
  'supplier': 'supplier', 'vendor': 'supplier',
  'quantity': 'quantity', 'qty': 'quantity', 'count': 'quantity', 'amount': 'quantity',
  'stock': 'quantity', 'current stock': 'quantity', 'on hand': 'quantity', 'in stock': 'quantity',
  'unit cost': 'unit_cost', 'unit_cost': 'unit_cost', 'cost': 'unit_cost', 'price': 'unit_cost',
  'unit cost ($)': 'unit_cost', 'cost ($)': 'unit_cost',
  'purchase date': 'purchase_date', 'received': 'purchase_date', 'received date': 'purchase_date',
  'expiration date': 'expiration_date', 'expiration': 'expiration_date',
  'expires': 'expiration_date', 'expiry date': 'expiration_date', 'expiry': 'expiration_date',
  'best by': 'expiration_date', 'use by': 'expiration_date',
  'location': 'location', 'loc': 'location', 'storage': 'location',
  'notes': 'notes', 'note': 'notes', 'comments': 'notes',
  'status': 'status',
};

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function parseCSVLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseNumber(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mo, da, yr] = m;
    if (yr.length === 2) yr = '20' + yr;
    return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseStatus(v: string): ParsedRow['status'] {
  const s = v.toLowerCase();
  if (!s) return null;
  if (s.includes('expired') || s.includes('🔴')) return 'expired';
  if (s.includes('low') || s.includes('🟡') || s.includes('yellow')) return 'low_stock';
  if (s.includes('ok') || s.includes('✅') || s.includes('green') || s.includes('good')) return 'active';
  return null;
}

// Find the row that looks like the actual header (contains a Name-ish + Quantity-ish column).
// Lets us skip title rows like "🍽️ RESTAURANT INVENTORY MANAGEMENT" and "Last Updated: …".
function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const delim = detectDelimiter(lines[i]);
    const cells = parseCSVLine(lines[i], delim).map(c => c.toLowerCase());
    const fields = new Set<Field>();
    for (const c of cells) {
      const f = HEADER_ALIASES[c];
      if (f) fields.add(f);
    }
    if (fields.has('name') && fields.has('quantity')) return i;
  }
  return -1;
}

function parseSheetText(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], headerError: 'Need a header row plus at least one data row.' };

  const headerIdx = findHeaderRowIndex(lines);
  if (headerIdx === -1) {
    return {
      rows: [],
      headerError:
        'Could not find a header row containing both a name column (e.g. "Item Name") and a quantity column (e.g. "Current Stock").',
    };
  }

  const delim = detectDelimiter(lines[headerIdx]);
  const rawHeaders = parseCSVLine(lines[headerIdx], delim).map(h => h.toLowerCase());
  const colMap: Record<number, Field> = {};
  rawHeaders.forEach((h, i) => {
    const mapped = HEADER_ALIASES[h];
    if (mapped) colMap[i] = mapped;
  });

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delim);
    // Skip totally empty rows (just commas/tabs).
    if (cells.every(c => !c)) continue;

    const row: ParsedRow = {
      rowIndex: i + 1,
      external_product_id: null,
      name: '', description: null, category: null, unit: null, supplier: null,
      quantity: null, unit_cost: null, purchase_date: null, expiration_date: null,
      location: null, notes: null, status: null, error: null,
    };
    cells.forEach((cell, idx) => {
      const field = colMap[idx];
      if (!field) return;
      if (field === 'name') row.name = cell;
      else if (field === 'quantity') row.quantity = parseNumber(cell);
      else if (field === 'unit_cost') row.unit_cost = parseNumber(cell);
      else if (field === 'purchase_date') row.purchase_date = parseDate(cell);
      else if (field === 'expiration_date') row.expiration_date = parseDate(cell);
      else if (field === 'status') row.status = parseStatus(cell);
      else (row as any)[field] = cell || null;
    });
    if (!row.name) row.error = 'Missing name';
    else if (row.quantity == null) row.error = 'Missing or invalid quantity';
    else if (row.quantity < 0) row.error = 'Quantity must be ≥ 0';
    rows.push(row);
  }
  return { rows, headerError: null };
}

function parseSheetUrl(input: string): { sheetId: string; gid: string } | null {
  const url = input.trim();
  if (!url) return null;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  // gid can live in either query (?gid=N) or fragment (#gid=N).
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

export default function IntegrationsScreen() {
  const { profile } = useAuthContext();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ restaurantId?: string }>();

  const goBackSafely = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/admin');
    }
  }, [navigation, router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackSafely();
        return true;
      });
      return () => sub.remove();
    }, [goBackSafely])
  );

  const [restaurantId, setRestaurantId] = useState<string | null>(
    typeof params.restaurantId === 'string' ? params.restaurantId : null
  );
  const [loading, setLoading] = useState(!params.restaurantId);

  const [sheetUrl, setSheetUrl] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (restaurantId) return; // already supplied by route param
    (async () => {
      if (!profile?.id) return;
      setLoading(true);
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setRestaurantId(data?.id ?? null);
      setLoading(false);
    })();
  }, [profile, restaurantId]);

  async function handleFetch() {
    setFetchError(null);
    setCsvText('');
    const parsed = parseSheetUrl(sheetUrl);
    if (!parsed) {
      setFetchError("That doesn't look like a Google Sheet URL. Paste the link from your browser's address bar.");
      return;
    }
    setFetching(true);
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/export?format=csv&gid=${parsed.gid}`;
      const resp = await fetch(exportUrl);
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
          throw new Error(
            "Sheet isn't accessible. In Google Sheets: Share → General access → set to \"Anyone with the link\" (Viewer). Then try again."
          );
        }
        throw new Error(`Fetch failed: HTTP ${resp.status}`);
      }
      const text = await resp.text();
      // Google returns an HTML login page (status 200) when the sheet is private.
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error(
          "Sheet looks private. In Google Sheets: Share → General access → \"Anyone with the link\" (Viewer)."
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
  const validRows = parsed.rows.filter(r => !r.error);
  const errorRows = parsed.rows.filter(r => r.error);

  async function handleUpload() {
    if (!restaurantId) return;
    if (validRows.length === 0) {
      Alert.alert('Nothing to upload', 'Add at least one valid row.');
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: validRows.length });

    let created = 0;
    let updated = 0;
    const failures: { row: number; reason: string }[] = [];

    for (const r of validRows) {
      try {
        // Idempotent import: re-uploading the same sheet UPDATES rows instead of
        // duplicating them (products has no SKU/name uniqueness constraint).
        // Match by SKU (external_product_id) when present, else by name in this restaurant.
        let existingProductId: string | null = null;
        if (r.external_product_id) {
          const { data: found } = await supabase
            .from('products')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('external_product_id', r.external_product_id)
            .limit(1)
            .maybeSingle();
          existingProductId = found?.id ?? null;
        } else {
          const { data: found } = await supabase
            .from('products')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .ilike('name', r.name)
            .limit(1)
            .maybeSingle();
          existingProductId = found?.id ?? null;
        }

        const productFields = {
          name: r.name,
          description: r.description ?? undefined,
          category: r.category ?? undefined,
          unit: r.unit || 'each',
          supplier: r.supplier ?? undefined,
          external_product_id: r.external_product_id ?? undefined,
          external_system: r.external_product_id ? 'sheet_upload' : undefined,
        };

        let productId = existingProductId;
        if (productId) {
          const { error: upErr } = await supabase.from('products').update(productFields).eq('id', productId);
          if (upErr) throw new Error(upErr.message);
        } else {
          const { data: product, error: pErr } = await supabase
            .from('products')
            .insert({ restaurant_id: restaurantId, ...productFields })
            .select('id')
            .single();
          if (pErr || !product) throw new Error(pErr?.message || 'Product insert failed');
          productId = product.id;
        }

        const inventoryFields = {
          quantity: r.quantity!,
          unit: r.unit || 'each',
          unit_cost: r.unit_cost ?? undefined,
          purchase_date: r.purchase_date ?? undefined,
          expiration_date: r.expiration_date ?? undefined,
          location: r.location ?? undefined,
          supplier: r.supplier ?? undefined,
          notes: r.notes ?? undefined,
          status: r.status ?? 'active',
        };

        // One inventory row per product for sheet imports: update the latest existing row, else insert.
        const { data: existingItem } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingItem?.id) {
          const { error: iuErr } = await supabase.from('inventory_items').update(inventoryFields).eq('id', existingItem.id);
          if (iuErr) throw new Error(iuErr.message);
        } else {
          const { error: iErr } = await supabase
            .from('inventory_items')
            .insert({ restaurant_id: restaurantId, product_id: productId, ...inventoryFields });
          if (iErr) throw new Error(iErr.message);
        }

        if (existingProductId) updated++; else created++;
      } catch (err: any) {
        failures.push({ row: r.rowIndex, reason: err.message || String(err) });
      }
      setProgress(p => p ? { ...p, done: p.done + 1 } : p);
    }

    setUploading(false);
    setProgress(null);

    const okSummary = `${created} added, ${updated} updated`;
    if (failures.length === 0) {
      Alert.alert(
        'Uploaded',
        `${okSummary}.`,
        [{ text: 'OK', onPress: () => { setCsvText(''); goBackSafely(); } }]
      );
    } else {
      const sample = failures.slice(0, 3).map(f => `Row ${f.row}: ${f.reason}`).join('\n');
      const more = failures.length > 3 ? `\n…and ${failures.length - 3} more` : '';
      Alert.alert('Partial upload', `${okSummary}, ${failures.length} failed.\n\n${sample}${more}`);
    }
  }

  const s = makeStyles(colors);

  if (loading) {
    return (
      <View style={[s.screenRoot, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.center}>
          <ActivityIndicator color="#FE902A" />
        </View>
      </View>
    );
  }
  if (!restaurantId) {
    return (
      <View style={[s.screenRoot, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.center}>
          <Text style={s.emptyText}>No restaurant found for your account.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screenRoot, { backgroundColor: colors.background }]}>
      <View
        style={[
          s.topHeader,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={s.headerBackButton}
          onPress={goBackSafely}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleBlock}>
          <Text style={[s.headerScreenTitle, { color: colors.text }]} numberOfLines={1}>
            Bulk Upload Inventory
          </Text>
          <Text style={[s.headerScreenSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            Google Sheet import
          </Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        style={s.scrollFlex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.introLine, { color: colors.textSecondary }]}>
          Import items directly from a Google Sheet URL.
        </Text>

      <View style={s.section}>
        <Text style={s.sectionTitle}>1. Paste your Google Sheet URL</Text>
        <Text style={s.sectionDesc}>
          In Google Sheets: <Text style={s.bold}>Share → General access → "Anyone with the link" (Viewer)</Text>,
          then copy the URL from your browser's address bar and paste it below. Title rows like
          "RESTAURANT INVENTORY MANAGEMENT" or "Last Updated:" are skipped automatically.
        </Text>
        <Text style={s.sectionDesc}>
          <Text style={s.bold}>Recognised columns:</Text> <Text style={s.mono}>Item ID</Text>,{' '}
          <Text style={s.mono}>Item Name</Text>, <Text style={s.mono}>Category</Text>,{' '}
          <Text style={s.mono}>Unit</Text>, <Text style={s.mono}>Current Stock</Text>,{' '}
          <Text style={s.mono}>Unit Cost</Text>, <Text style={s.mono}>Status</Text>,{' '}
          <Text style={s.mono}>Notes</Text>, <Text style={s.mono}>Expiration Date</Text>,{' '}
          <Text style={s.mono}>Supplier</Text>, <Text style={s.mono}>Location</Text>.
          {' '}Other columns (Par Level, On Order, Projected Stock, Total Value) are ignored.
        </Text>
        <TextInput
          style={s.urlInput}
          placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=…"
          placeholderTextColor={colors.textTertiary}
          value={sheetUrl}
          onChangeText={setSheetUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleFetch}
        />
        <TouchableOpacity
          style={[s.fetchButton, (fetching || !sheetUrl.trim()) && s.buttonDisabled]}
          onPress={handleFetch}
          disabled={fetching || !sheetUrl.trim()}
        >
          {fetching
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.fetchButtonText}>Fetch sheet</Text>}
        </TouchableOpacity>
        {fetchError && (
          <View style={s.errorBox}><Text style={s.errorText}>{fetchError}</Text></View>
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>2. Preview</Text>
        {parsed.headerError && (
          <View style={s.errorBox}><Text style={s.errorText}>{parsed.headerError}</Text></View>
        )}
        {!parsed.headerError && parsed.rows.length === 0 && (
          <Text style={s.sectionDesc}>Fetch a sheet above to see a preview.</Text>
        )}
        {parsed.rows.slice(0, 20).map(r => (
          <View key={r.rowIndex} style={[s.previewRow, r.error && s.previewRowError]}>
            <View style={{ flex: 1 }}>
              <Text style={s.previewTitle} numberOfLines={1}>
                {r.name || <Text style={s.previewMuted}>(no name)</Text>}
              </Text>
              <Text style={s.previewMeta} numberOfLines={1}>
                {[
                  r.external_product_id,
                  r.quantity != null && `${r.quantity}${r.unit ? ' ' + r.unit : ''}`,
                  r.category,
                  r.unit_cost != null && `$${r.unit_cost.toFixed(2)}`,
                  r.status && (r.status === 'low_stock' ? 'low' : r.status),
                  r.expiration_date && `exp ${r.expiration_date}`,
                ].filter(Boolean).join(' · ') || <Text style={s.previewMuted}>no extras</Text>}
              </Text>
              {r.error && <Text style={s.previewError}>{r.error}</Text>}
            </View>
            <Ionicons
              name={r.error ? 'close-circle' : 'checkmark-circle'}
              size={18}
              color={r.error ? '#ff4444' : '#4caf50'}
            />
          </View>
        ))}
        {parsed.rows.length > 20 && (
          <Text style={s.previewMeta}>…and {parsed.rows.length - 20} more</Text>
        )}
        {parsed.rows.length > 0 && (
          <Text style={s.summary}>
            {validRows.length} ready · {errorRows.length} skipped
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[s.button, (uploading || validRows.length === 0) && s.buttonDisabled]}
        onPress={handleUpload}
        disabled={uploading || validRows.length === 0}
      >
        {uploading
          ? (
            <View style={s.uploadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              {progress && (
                <Text style={s.buttonText}>Uploading {progress.done}/{progress.total}…</Text>
              )}
            </View>
          )
          : <Text style={s.buttonText}>
              Upload {validRows.length} item{validRows.length === 1 ? '' : 's'}
            </Text>}
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    screenRoot: { flex: 1 },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerBackButton: {
      padding: 12,
      marginRight: 4,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    headerScreenTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.25,
    },
    headerScreenSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    headerSpacer: {
      width: 44,
    },
    scrollFlex: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 14 },
    introLine: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    section: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    sectionDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
    bold: { fontWeight: '700', color: colors.text },
    mono: { fontFamily: 'monospace', fontSize: 12, color: colors.text },
    urlInput: {
      borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 12, fontSize: 14,
      color: colors.text, backgroundColor: colors.inputBackground,
      marginBottom: 10,
    },
    fetchButton: {
      backgroundColor: '#FE902A', borderRadius: 12, paddingVertical: 12,
      alignItems: 'center', marginBottom: 4,
    },
    fetchButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    errorBox: { backgroundColor: '#ffebee', borderRadius: 8, padding: 10, marginBottom: 10 },
    errorText: { color: '#c62828', fontSize: 13 },
    previewRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    previewRowError: { opacity: 0.6 },
    previewTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    previewMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    previewMuted: { color: colors.textTertiary, fontStyle: 'italic' },
    previewError: { fontSize: 11, color: '#ff4444', marginTop: 2 },
    summary: { fontSize: 13, color: colors.textSecondary, marginTop: 10, textAlign: 'right' },
    button: {
      backgroundColor: '#FE902A', borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
// 2026-05-01
