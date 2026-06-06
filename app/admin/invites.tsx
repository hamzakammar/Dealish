import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Restaurant = { id: string; name: string };
type Invite = {
  id: string;
  code: string;
  restaurant_id: string;
  role: 'owner' | 'admin';
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  restaurants?: { name: string } | null;
};

function genCode(): string {
  // Avoid ambiguous chars (0/O, 1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default function InvitesScreen() {
  const router = useRouter();
  const { profile } = useAuthContext();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin'>('owner');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rData }, { data: iData }] = await Promise.all([
      supabase.from('restaurants').select('id, name').order('name'),
      supabase
        .from('restaurant_invites')
        .select('*, restaurants:restaurant_id ( name )')
        .order('created_at', { ascending: false }),
    ]);
    setRestaurants((rData as Restaurant[]) || []);
    setInvites((iData as unknown as Invite[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createInvite = async () => {
    if (!selectedRestaurant) {
      Alert.alert('Pick a restaurant', 'Select which restaurant this code is for.');
      return;
    }
    setCreating(true);
    try {
      const code = genCode();
      const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('restaurant_invites').insert([
        {
          code,
          restaurant_id: selectedRestaurant,
          role,
          created_by: profile?.id,
          max_uses: 1,
          expires_at: expires,
        },
      ]);
      if (error) throw error;
      await load();
      const rName = restaurants.find((r) => r.id === selectedRestaurant)?.name || 'the restaurant';
      Alert.alert(
        'Code created',
        `Code ${code} (${role}) for ${rName}. Valid 14 days, single use.`,
        [
          { text: 'OK' },
          { text: 'Share', onPress: () => Share.share({ message: `Your Dealish admin access code: ${code}` }) },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not create the code.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    Alert.alert('Revoke code', 'This code will stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('restaurant_invites').delete().eq('id', id);
          setInvites((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  if (!profile?.is_operator) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Invites</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Operators only</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Invites</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>Create a code</Text>
        <Text style={styles.help}>Pick a restaurant and role. The person signs up, then enters the code.</Text>

        <Text style={styles.label}>Restaurant</Text>
        <View style={styles.chips}>
          {restaurants.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, selectedRestaurant === r.id && styles.chipActive]}
              onPress={() => setSelectedRestaurant(r.id)}
            >
              <Text style={[styles.chipText, selectedRestaurant === r.id && styles.chipTextActive]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Role</Text>
        <View style={styles.chips}>
          {(['owner', 'admin'] as const).map((rl) => (
            <TouchableOpacity
              key={rl}
              style={[styles.chip, role === rl && styles.chipActive]}
              onPress={() => setRole(rl)}
            >
              <Text style={[styles.chipText, role === rl && styles.chipTextActive]}>
                {rl === 'owner' ? 'Owner (manages restaurant)' : 'Admin (scans QR only)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.button, creating && { opacity: 0.6 }]} onPress={createInvite} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate code</Text>}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Existing codes</Text>
        {loading ? (
          <ActivityIndicator color="#FE902A" style={{ marginTop: 20 }} />
        ) : invites.length === 0 ? (
          <Text style={styles.help}>No codes yet.</Text>
        ) : (
          invites.map((i) => {
            const used = i.use_count >= i.max_uses;
            const expired = i.expires_at ? new Date(i.expires_at) < new Date() : false;
            return (
              <View key={i.id} style={styles.inviteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteCode}>{i.code}</Text>
                  <Text style={styles.inviteMeta}>
                    {i.restaurants?.name || '—'} · {i.role} · {used ? 'used' : expired ? 'expired' : 'active'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => Share.share({ message: `Your Dealish admin access code: ${i.code}` })}>
                  <Ionicons name="share-outline" size={20} color="#2563EB" style={{ padding: 6 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => revoke(i.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ padding: 6 }} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  content: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  help: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1' },
  chipActive: { backgroundColor: '#FE902A', borderColor: '#FE902A' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#FE902A', borderRadius: 10, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  inviteCode: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: 2 },
  inviteMeta: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
});
