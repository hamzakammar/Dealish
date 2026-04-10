import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// SHA-256 in React Native via expo-crypto
import * as Crypto from 'expo-crypto';

async function sha256(text: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'dlsh_';
  for (let i = 0; i < 40; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

interface ApiKey {
  id: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
}

interface SheetIntegration {
  id: string;
  sheet_id: string;
  sheet_tab: string;
  webhook_url: string | null;
  detected_mapping: Record<string, string | null> | null;
  mapping_confirmed: boolean;
  last_synced_at: string | null;
}

export default function IntegrationsScreen() {
  const { profile } = useAuthContext();
  const colors = useThemeColors();
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [integration, setIntegration] = useState<SheetIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  // New key state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  // Sheet setup state
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTab, setSheetTab] = useState('Sheet1');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Find restaurant owned by this user
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!restaurant) { setLoading(false); return; }
      setRestaurantId(restaurant.id);

      // Load API keys
      const { data: keys } = await supabase
        .from('api_keys')
        .select('id, label, last_used_at, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      setApiKeys(keys || []);

      // Load sheet integration
      const { data: integ } = await supabase
        .from('sheet_integrations')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .single();

      setIntegration(integ || null);
      if (integ?.webhook_url) setWebhookUrl(integ.webhook_url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateKey() {
    if (!restaurantId) return;
    if (!newKeyLabel.trim()) {
      Alert.alert('Error', 'Please enter a label for this key');
      return;
    }
    setGeneratingKey(true);
    try {
      const rawKey = generateKey();
      const hash = await sha256(rawKey);

      const { error } = await supabase.from('api_keys').insert({
        restaurant_id: restaurantId,
        key_hash: hash,
        label: newKeyLabel.trim(),
      });

      if (error) throw error;

      setGeneratedKey(rawKey);
      setNewKeyLabel('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    Alert.alert('Delete Key', 'This will break any Apps Script using this key. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('api_keys').delete().eq('id', keyId);
          await loadData();
        },
      },
    ]);
  }

  function extractSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  async function handleSaveSheet() {
    if (!restaurantId) return;
    const sheetId = extractSheetId(sheetUrl) || sheetUrl.trim();
    if (!sheetId) {
      Alert.alert('Error', 'Please enter a valid Google Sheets URL or Sheet ID');
      return;
    }
    setSavingSheet(true);
    try {
      const payload: any = {
        restaurant_id: restaurantId,
        sheet_id: sheetId,
        sheet_tab: sheetTab.trim() || 'Sheet1',
      };
      if (webhookUrl.trim()) payload.webhook_url = webhookUrl.trim();

      const { error } = await supabase
        .from('sheet_integrations')
        .upsert(payload, { onConflict: 'restaurant_id,sheet_id' });

      if (error) throw error;
      await loadData();
      Alert.alert('Saved', 'Sheet integration saved. Now paste your Apps Script and run detectSchema().');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingSheet(false);
    }
  }

  const s = styles(colors);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#FE902A" />
      </View>
    );
  }

  if (!restaurantId) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>No restaurant found for your account.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
        <Text style={s.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={s.title}>Integrations</Text>
      <Text style={s.subtitle}>Connect your Google Sheets inventory to Dealish</Text>

      {/* ── API Keys ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>API Keys</Text>
        <Text style={s.sectionDesc}>Your Apps Script uses this key to authenticate with Dealish.</Text>

        {generatedKey && (
          <View style={s.keyReveal}>
            <Ionicons name="key" size={18} color="#FE902A" />
            <Text style={s.keyRevealLabel}>Copy this key now — it won't be shown again</Text>
            <TouchableOpacity
              style={s.keyRevealBox}
              onPress={() => {
                Clipboard.setStringAsync(generatedKey);
                Alert.alert('Copied', 'API key copied to clipboard');
              }}
            >
              <Text style={s.keyRevealText} numberOfLines={1}>{generatedKey}</Text>
              <Ionicons name="copy-outline" size={16} color="#FE902A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGeneratedKey(null)}>
              <Text style={s.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {apiKeys.map(key => (
          <View key={key.id} style={s.keyRow}>
            <View style={s.keyInfo}>
              <Text style={s.keyLabel}>{key.label}</Text>
              <Text style={s.keyMeta}>
                Created {new Date(key.created_at).toLocaleDateString()}
                {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' · Never used'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteKey(key.id)}>
              <Ionicons name="trash-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={s.newKeyRow}>
          <TextInput
            style={s.input}
            placeholder="Key label (e.g. Main Sheet)"
            placeholderTextColor={colors.textTertiary}
            value={newKeyLabel}
            onChangeText={setNewKeyLabel}
          />
          <TouchableOpacity
            style={[s.button, generatingKey && s.buttonDisabled]}
            onPress={handleGenerateKey}
            disabled={generatingKey}
          >
            {generatingKey ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buttonText}>Generate Key</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Google Sheet Setup ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Google Sheet</Text>
        <Text style={s.sectionDesc}>
          Paste your Google Sheet URL. We'll detect your columns automatically using AI — no need to reformat your sheet.
        </Text>

        {integration && (
          <View style={s.statusRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
            <Text style={s.statusText}>
              Connected · Sheet ID: {integration.sheet_id.slice(0, 12)}...
              {integration.last_synced_at
                ? ` · Last synced ${new Date(integration.last_synced_at).toLocaleDateString()}`
                : ' · Not synced yet'}
            </Text>
          </View>
        )}

        <TextInput
          style={s.input}
          placeholder="Google Sheet URL or Sheet ID"
          placeholderTextColor={colors.textTertiary}
          value={sheetUrl}
          onChangeText={setSheetUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={s.input}
          placeholder="Tab name (default: Sheet1)"
          placeholderTextColor={colors.textTertiary}
          value={sheetTab}
          onChangeText={setSheetTab}
        />
        <TextInput
          style={s.input}
          placeholder="Apps Script Web App URL (for Dealish → Sheet sync)"
          placeholderTextColor={colors.textTertiary}
          value={webhookUrl}
          onChangeText={setWebhookUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[s.button, savingSheet && s.buttonDisabled]}
          onPress={handleSaveSheet}
          disabled={savingSheet}
        >
          {savingSheet ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buttonText}>Save Sheet</Text>}
        </TouchableOpacity>

        {integration && (
          <View style={s.mappingSection}>
            <Text style={s.mappingTitle}>Detected Column Mapping</Text>
            {integration.detected_mapping ? (
              Object.entries(integration.detected_mapping)
                .filter(([, col]) => col !== null)
                .map(([field, col]) => (
                  <View key={field} style={s.mappingRow}>
                    <Text style={s.mappingField}>{field}</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                    <Text style={s.mappingCol}>{col}</Text>
                  </View>
                ))
            ) : (
              <Text style={s.mappingEmpty}>
                No schema detected yet. Paste the Apps Script into your sheet and run detectSchema().
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── Setup Guide ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Setup Guide</Text>
        {[
          'Generate an API Key above',
          'Open your Google Sheet → Extensions → Apps Script',
          'Paste the Dealish Apps Script (link below)',
          'Fill in API_KEY and RESTAURANT_ID at the top',
          'Run setupTriggers() then detectSchema()',
          'Copy the Web App URL here as the webhook URL',
          'Your deals will now sync automatically',
        ].map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={s.linkButton}
          onPress={() => Linking.openURL('https://github.com/hamzakammar/Dealish/blob/main/docs/sheets-integration/dealish-sheets.gs')}
        >
          <Ionicons name="logo-google" size={16} color="#FE902A" />
          <Text style={s.linkText}>View Apps Script</Text>
        </TouchableOpacity>

        {restaurantId && (
          <TouchableOpacity
            style={s.copyIdButton}
            onPress={() => {
              Clipboard.setStringAsync(restaurantId);
              Alert.alert('Copied', 'Restaurant ID copied to clipboard');
            }}
          >
            <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
            <Text style={s.copyIdText}>Copy Restaurant ID</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 60 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 14 },
    backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backText: { color: colors.text, fontSize: 16, marginLeft: 4 },
    title: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
    section: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sectionDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
    keyReveal: {
      backgroundColor: '#fff8f0',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#FE902A44',
    },
    keyRevealLabel: { fontSize: 12, color: '#FE902A', fontWeight: '600', marginBottom: 8, marginTop: 4 },
    keyRevealBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: '#FE902A44',
      gap: 8,
    },
    keyRevealText: { flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#333' },
    dismissText: { fontSize: 12, color: colors.textSecondary, marginTop: 8, textAlign: 'right' },
    keyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    keyInfo: { flex: 1 },
    keyLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    keyMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    newKeyRow: { marginTop: 12, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      marginBottom: 8,
    },
    button: {
      backgroundColor: '#FE902A',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    statusText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
    mappingSection: { marginTop: 16 },
    mappingTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
    mappingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    mappingField: { fontSize: 12, color: colors.textSecondary, width: 120 },
    mappingCol: { fontSize: 12, color: colors.text, fontWeight: '500', flex: 1 },
    mappingEmpty: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#FE902A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    stepText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#FE902A44',
      borderRadius: 10,
      justifyContent: 'center',
    },
    linkText: { color: '#FE902A', fontSize: 13, fontWeight: '600' },
    copyIdButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      justifyContent: 'center',
    },
    copyIdText: { fontSize: 12, color: colors.textSecondary },
  });
