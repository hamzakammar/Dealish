import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { Clipboard } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

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
  sync_method: string;
  detected_mapping: Record<string, string | null> | null;
  mapping_confirmed: boolean;
  last_synced_at: string | null;
}

export default function IntegrationsScreen() {
  const { profile, session } = useAuthContext();
  const colors = useThemeColors();
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [integration, setIntegration] = useState<SheetIntegration | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTab, setSheetTab] = useState('Sheet1');
  const [savingSheet, setSavingSheet] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!restaurant) { setLoading(false); return; }
      setRestaurantId(restaurant.id);

      const [keysResult, integResult, tokenResult] = await Promise.all([
        supabase.from('api_keys').select('id, label, last_used_at, created_at')
          .eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }),
        supabase.from('sheet_integrations').select('*')
          .eq('restaurant_id', restaurant.id).single(),
        supabase.from('google_oauth_tokens').select('id')
          .eq('restaurant_id', restaurant.id).single(),
      ]);

      setApiKeys(keysResult.data || []);
      setIntegration(integResult.data || null);
      setHasGoogleToken(!!tokenResult.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectGoogle() {
    if (!restaurantId || !session?.access_token) return;
    setConnectingGoogle(true);

    try {
      // Use Supabase's built-in OAuth — handles redirect back to app via deep link
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'dealish://auth/callback',
          scopes: 'https://www.googleapis.com/auth/spreadsheets',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      // Open browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'dealish://auth/callback');

      if (result.type === 'success') {
        // Extract tokens from the callback URL and store them
        const url = result.url;
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresIn = params.get('expires_in');

        if (accessToken && refreshToken) {
          const expiry = new Date(Date.now() + parseInt(expiresIn || '3600') * 1000).toISOString();

          const { error: upsertErr } = await supabase.from('google_oauth_tokens').upsert({
            user_id: profile.id,
            restaurant_id: restaurantId,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expiry: expiry,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,restaurant_id' });

          if (upsertErr) throw upsertErr;

          await loadData();
          Alert.alert('✅ Connected!', 'Google account connected. Now paste your Sheet URL to start syncing.');
        } else {
          // Tokens not in URL — exchange via edge function
          const code = params.get('code');
          if (code) {
            await exchangeCodeViaEdgeFunction(code);
          } else {
            throw new Error('No tokens or code in callback URL');
          }
        }
      } else if (result.type === 'cancel') {
        // User cancelled, do nothing
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function exchangeCodeViaEdgeFunction(code: string) {
    const resp = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/google-oauth`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          code,
          redirect_uri: 'dealish://auth/callback',
          restaurant_id: restaurantId,
        }),
      }
    );

    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || 'OAuth exchange failed');

    await loadData();
    Alert.alert('✅ Connected!', 'Google account connected. Now paste your Sheet URL to start syncing.');
  }

  function extractSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url.trim() || null;
  }

  async function handleSaveSheet() {
    if (!restaurantId) return;
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      Alert.alert('Error', 'Please enter a valid Google Sheets URL or Sheet ID');
      return;
    }
    setSavingSheet(true);
    try {
      const { error } = await supabase.from('sheet_integrations').upsert({
        restaurant_id: restaurantId,
        sheet_id: sheetId,
        sheet_tab: sheetTab.trim() || 'Sheet1',
        sync_method: hasGoogleToken ? 'oauth_cron' : 'apps_script',
      }, { onConflict: 'restaurant_id,sheet_id' });

      if (error) throw error;
      await loadData();
      Alert.alert('Saved', 'Sheet saved. Sync will run automatically every 5 minutes.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingSheet(false);
    }
  }

  async function handleDisconnectGoogle() {
    if (!restaurantId) return;
    Alert.alert('Disconnect Google', 'Deals will stop syncing from your sheet. Existing deals stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await supabase.from('google_oauth_tokens').delete().eq('restaurant_id', restaurantId);
          await loadData();
        },
      },
    ]);
  }

  async function handleGenerateKey() {
    if (!restaurantId || !newKeyLabel.trim()) {
      Alert.alert('Error', 'Enter a label for this key');
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
    Alert.alert('Delete Key', 'Apps Script using this key will stop working.', [
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

  const s = makeStyles(colors);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#FE902A" /></View>;
  }

  if (!restaurantId) {
    return <View style={s.center}><Text style={s.emptyText}>No restaurant found for your account.</Text></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
        <Text style={s.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={s.title}>Integrations</Text>
      <Text style={s.subtitle}>Sync your Google Sheets inventory to Dealish automatically</Text>

      {/* ── Google Sheets Connection ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text style={s.sectionTitle}>Google Sheets</Text>
          {hasGoogleToken && (
            <View style={s.connectedBadge}>
              <Text style={s.connectedBadgeText}>Connected</Text>
            </View>
          )}
        </View>

        {!hasGoogleToken ? (
          <>
            <Text style={s.sectionDesc}>
              Connect your Google account and paste your Sheet URL. We'll detect your columns automatically and sync your deals every 5 minutes.
            </Text>
            <TouchableOpacity
              style={[s.googleButton, connectingGoogle && s.buttonDisabled]}
              onPress={handleConnectGoogle}
              disabled={connectingGoogle}
            >
              {connectingGoogle ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#fff" />
                  <Text style={s.googleButtonText}>Connect Google Account</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.sectionDesc}>
              Google account connected. {integration ? 'Syncing automatically every 5 minutes.' : 'Now add your Sheet URL below.'}
            </Text>

            {integration && (
              <View style={s.statusRow}>
                <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                <Text style={s.statusText}>
                  Sheet: ...{integration.sheet_id.slice(-8)} · Tab: {integration.sheet_tab}
                  {integration.last_synced_at
                    ? ` · Last synced ${new Date(integration.last_synced_at).toLocaleTimeString()}`
                    : ' · Pending first sync'}
                </Text>
              </View>
            )}

            {integration?.detected_mapping && (
              <View style={s.mappingSection}>
                <Text style={s.mappingTitle}>Detected columns</Text>
                {Object.entries(integration.detected_mapping)
                  .filter(([, col]) => col !== null)
                  .map(([field, col]) => (
                    <View key={field} style={s.mappingRow}>
                      <Text style={s.mappingField}>{field}</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                      <Text style={s.mappingCol}>{col}</Text>
                    </View>
                  ))}
              </View>
            )}

            <TouchableOpacity style={s.disconnectButton} onPress={handleDisconnectGoogle}>
              <Text style={s.disconnectText}>Disconnect Google Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Sheet Settings ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Sheet Settings</Text>
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
        <TouchableOpacity
          style={[s.button, savingSheet && s.buttonDisabled]}
          onPress={handleSaveSheet}
          disabled={savingSheet}
        >
          {savingSheet
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.buttonText}>{integration ? 'Update Sheet' : 'Save Sheet'}</Text>}
        </TouchableOpacity>
      </View>

      {/* ── API Keys (Advanced) ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Advanced: API Keys</Text>
        <Text style={s.sectionDesc}>For real-time sync or custom setups via Google Apps Script.</Text>

        {generatedKey && (
          <View style={s.keyReveal}>
            <Text style={s.keyRevealLabel}>Copy this key now — it won't be shown again</Text>
            <TouchableOpacity
              style={s.keyRevealBox}
              onPress={() => {
                Clipboard.setString(generatedKey);
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
                {new Date(key.created_at).toLocaleDateString()}
                {key.last_used_at ? ` · Used ${new Date(key.last_used_at).toLocaleDateString()}` : ' · Never used'}
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
            {generatingKey
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.buttonText}>Generate Key</Text>}
          </TouchableOpacity>
        </View>

        {restaurantId && (
          <TouchableOpacity
            style={s.copyIdButton}
            onPress={() => {
              Clipboard.setString(restaurantId);
              Alert.alert('Copied', 'Restaurant ID copied');
            }}
          >
            <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
            <Text style={s.copyIdText}>Copy Restaurant ID for Apps Script config</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
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
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
    sectionDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
    connectedBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    connectedBadgeText: { fontSize: 11, color: '#4caf50', fontWeight: '600' },
    googleButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, backgroundColor: '#4285F4', borderRadius: 12, paddingVertical: 14,
    },
    googleButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    statusText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
    mappingSection: { marginBottom: 12 },
    mappingTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    mappingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    mappingField: { fontSize: 12, color: colors.textSecondary, width: 120 },
    mappingCol: { fontSize: 12, color: colors.text, fontWeight: '500' },
    disconnectButton: { marginTop: 4 },
    disconnectText: { fontSize: 13, color: '#ff4444', textAlign: 'right' },
    input: {
      borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
      color: colors.text, backgroundColor: colors.inputBackground, marginBottom: 8,
    },
    button: { backgroundColor: '#FE902A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    keyReveal: {
      backgroundColor: '#fff8f0', borderRadius: 12, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: '#FE902A44',
    },
    keyRevealLabel: { fontSize: 12, color: '#FE902A', fontWeight: '600', marginBottom: 8 },
    keyRevealBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
      borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FE902A44', gap: 8,
    },
    keyRevealText: { flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#333' },
    dismissText: { fontSize: 12, color: colors.textSecondary, marginTop: 8, textAlign: 'right' },
    keyRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    keyInfo: { flex: 1 },
    keyLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    keyMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    newKeyRow: { marginTop: 12 },
    copyIdButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'center' },
    copyIdText: { fontSize: 12, color: colors.textSecondary },
  });
