import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RedeemInviteScreen() {
  const router = useRouter();
  const { refetchProfile } = useAuthContext();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the code your Dealish contact gave you.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('redeem_restaurant_invite', {
        p_code: trimmed,
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) {
        setError(row?.message || 'That code could not be redeemed.');
        setBusy(false);
        return;
      }
      await refetchProfile();
      router.replace('/admin');
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Access</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="key" size={28} color="#FE902A" />
        </View>

        <Text style={styles.title}>Enter your admin access code</Text>

        <View style={styles.adminOnlyBanner}>
          <Ionicons name="information-circle" size={16} color="#92400E" />
          <Text style={styles.adminOnlyText}>
            For restaurant owners & staff only. Customers don&apos;t need a code — just browse deals.
          </Text>
        </View>

        <Text style={styles.help}>
          Your Dealish contact gives you this code. It links your account to your restaurant
          and unlocks the admin dashboard.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="e.g. 7K2Q9P"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, busy && { opacity: 0.6 }]}
          onPress={redeem}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Redeem code</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  body: { padding: 24, gap: 14 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3E2',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  adminOnlyBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 8,
    padding: 12, alignItems: 'flex-start',
  },
  adminOnlyText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18, fontWeight: '600' },
  help: { fontSize: 13, color: '#64748B', lineHeight: 19, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 18, letterSpacing: 2, textAlign: 'center',
    backgroundColor: '#fff', color: '#0F172A', fontWeight: '700',
  },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#FE902A', borderRadius: 10, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
