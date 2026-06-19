import { useAuthContext } from '@/app/providers/auth';
import { ScrapedCandidate, useScrapedDealCandidates } from '@/hooks/useScrapedDealCandidates';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { supabase } from '@/app/lib/supabase';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSchedule(c: ScrapedCandidate): string {
  if (c.recurrence_days && c.recurrence_days.length) {
    const days = c.recurrence_days.map((d) => DAYS[d] ?? '?').join(', ');
    const t = (s?: string | null) => (s ? s.slice(0, 5) : '?');
    const window = c.recurrence_start_time || c.recurrence_end_time
      ? ` ${t(c.recurrence_start_time)}–${t(c.recurrence_end_time)}`
      : '';
    return `${days}${window}`;
  }
  if (c.start_at) return `One-time from ${new Date(c.start_at).toLocaleDateString()}`;
  return 'No schedule detected';
}

function EditableCard({
  candidate,
  working,
  onApprove,
  onReject,
  onSave,
}: {
  candidate: ScrapedCandidate;
  working: string | null;
  onApprove: (c: ScrapedCandidate) => void;
  onReject: (c: ScrapedCandidate) => void;
  onSave: (id: string, fields: Partial<ScrapedCandidate>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(candidate.title);
  const [description, setDescription] = useState(candidate.description || '');
  const [startTime, setStartTime] = useState(candidate.recurrence_start_time || '');
  const [endTime, setEndTime] = useState(candidate.recurrence_end_time || '');
  const [days, setDays] = useState<number[]>(candidate.recurrence_days || []);

  const conf = typeof candidate.confidence === 'number' ? Math.round(candidate.confidence * 100) : null;
  const lowConf = conf !== null && conf < 60;

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSave = async () => {
    await onSave(candidate.id, {
      title,
      description: description || null,
      recurrence_start_time: startTime || null,
      recurrence_end_time: endTime || null,
      recurrence_days: days.length > 0 ? days : null,
    });
    setEditing(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.restaurantName}>{candidate.restaurants?.name || 'Unknown restaurant'}</Text>
        {conf !== null && (
          <View style={[styles.confBadge, lowConf && styles.confBadgeLow]}>
            <Text style={[styles.confText, lowConf && styles.confTextLow]}>{conf}%</Text>
          </View>
        )}
      </View>

      {editing ? (
        <View style={styles.editSection}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Deal title" />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            multiline
          />

          <Text style={styles.fieldLabel}>Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((label, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, days.includes(i) && styles.dayChipActive]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[styles.dayChipText, days.includes(i) && styles.dayChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>Start Time</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>End Time</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
              />
            </View>
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.dealTitle}>{candidate.title}</Text>
          {candidate.deal_category && (
            <Text style={styles.category}>{candidate.deal_category.replace(/_/g, ' ')}</Text>
          )}
          {candidate.description ? <Text style={styles.description}>{candidate.description}</Text> : null}

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.metaText}>{formatSchedule(candidate)}</Text>
          </View>

          {candidate.evidence_quote ? (
            <View style={styles.evidence}>
              <Text style={styles.evidenceLabel}>Evidence</Text>
              <Text style={styles.evidenceText}>&ldquo;{candidate.evidence_quote}&rdquo;</Text>
            </View>
          ) : null}

          {candidate.source_url ? (
            <TouchableOpacity onPress={() => Linking.openURL(candidate.source_url!)}>
              <Text style={styles.sourceLink} numberOfLines={1}>
                {candidate.source_url}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {!editing && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="create-outline" size={16} color="#FE902A" />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            disabled={working === candidate.id}
            onPress={() => onReject(candidate)}
          >
            {working === candidate.id ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.rejectText}>Reject</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            disabled={working === candidate.id}
            onPress={() => onApprove(candidate)}
          >
            {working === candidate.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.approveText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  is_operator: boolean;
}

function UserManagement() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, is_operator')
      .order('email');
    if (!error && data) setProfiles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const toggleOperator = async (profileId: string, current: boolean) => {
    setUpdating(profileId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_operator: !current })
      .eq('id', profileId);
    
    if (error) {
      Alert.alert('Error', 'Failed to update operator status.');
    } else {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, is_operator: !current } : p));
    }
    setUpdating(null);
  };

  const updateRole = async (profileId: string, role: string) => {
    setUpdating(profileId);
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profileId);
    
    if (error) {
      Alert.alert('Error', 'Failed to update user role.');
    } else {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role } : p));
    }
    setUpdating(null);
  };

  return (
    <View style={styles.userList}>
      <Text style={styles.sectionHeader}>Manage Platform Access</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#FE902A" />
      ) : (
        profiles.map(p => (
          <View key={p.id} style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userEmail}>{p.email}</Text>
              <Text style={styles.userRole}>Role: {p.role}</Text>
            </View>
            <View style={styles.userActions}>
              <TouchableOpacity 
                style={[styles.roleBtn, p.role === 'admin' && styles.roleBtnActive]}
                onPress={() => updateRole(p.id, p.role === 'admin' ? 'user' : 'admin')}
                disabled={!!updating}
              >
                <Text style={[styles.roleBtnText, p.role === 'admin' && styles.roleBtnTextActive]}>
                  {p.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.opBtn, p.is_operator && styles.opBtnActive]}
                onPress={() => toggleOperator(p.id, p.is_operator)}
                disabled={!!updating}
              >
                <Text style={[styles.opBtnText, p.is_operator && styles.opBtnTextActive]}>
                  {p.is_operator ? 'Revoke Op' : 'Make Operator'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default function DealReviewScreen() {
  const router = useRouter();
  const { profile } = useAuthContext();
  const [tab, setTab] = useState<'deals' | 'users'>('deals');
  const { candidates, loading, working, fetchCandidates, approve, reject, updateCandidate } =
    useScrapedDealCandidates();

  const onApprove = async (c: ScrapedCandidate) => {
    try {
      await approve(c);
    } catch {
      Alert.alert('Error', 'Failed to publish this deal.');
    }
  };
  const onReject = async (c: ScrapedCandidate) => {
    try {
      await reject(c.id);
    } catch {
      Alert.alert('Error', 'Failed to reject this deal.');
    }
  };

  if (!profile?.is_operator) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Operator Dashboard</Text>
          <View style={styles.backButton} />
        </View>
        <div style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Operators only</Text>
          <Text style={styles.emptyText}>This dashboard is restricted to platform operators.</Text>
        </div>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Operator Dashboard</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, tab === 'deals' && styles.tabActive]}
          onPress={() => setTab('deals')}
        >
          <Text style={[styles.tabText, tab === 'deals' && styles.tabTextActive]}>Review Deals</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, tab === 'users' && styles.tabActive]}
          onPress={() => setTab('users')}
        >
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Manage Access</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={tab === 'deals' ? <RefreshControl refreshing={loading} onRefresh={fetchCandidates} /> : undefined}
      >
        {tab === 'deals' ? (
          <>
            <Text style={styles.subtitle}>
              Auto-detected deals. Edit before approving, or reject.
            </Text>

            {loading && candidates.length === 0 && (
              <ActivityIndicator size="large" color="#FE902A" style={{ marginTop: 40 }} />
            )}

            {!loading && candidates.length === 0 && (
              <View style={styles.centered}>
                <Ionicons name="checkmark-done-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Queue is empty</Text>
                <Text style={styles.emptyText}>No pending candidates. Run the agent to populate it.</Text>
              </View>
            )}

            {candidates.map((c) => (
              <EditableCard
                key={c.id}
                candidate={c}
                working={working}
                onApprove={onApprove}
                onReject={onReject}
                onSave={updateCandidate}
              />
            ))}
          </>
        ) : (
          <UserManagement />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FE902A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FE902A' },
  content: { flex: 1 },
  contentContainer: { padding: 16 },
  subtitle: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  restaurantName: { fontSize: 13, fontWeight: '600', color: '#FE902A', flex: 1 },
  confBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  confBadgeLow: { backgroundColor: '#FEE2E2' },
  confText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  confTextLow: { color: '#991B1B' },
  dealTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  category: { fontSize: 12, color: '#64748B', textTransform: 'capitalize', marginBottom: 6 },
  description: { fontSize: 13, color: '#475569', marginBottom: 8, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText: { fontSize: 13, color: '#334155' },
  evidence: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginBottom: 8 },
  evidenceLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 },
  evidenceText: { fontSize: 12, color: '#475569', fontStyle: 'italic', lineHeight: 17 },
  sourceLink: { fontSize: 12, color: '#2563EB', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 },
  editBtn: { backgroundColor: '#FEF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  editText: { color: '#FE902A', fontWeight: '700', fontSize: 14 },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  approveBtn: { backgroundColor: '#FE902A' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editSection: { marginTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayChipActive: { backgroundColor: '#FE902A', borderColor: '#FE902A' },
  dayChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  dayChipTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FE902A',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  userList: { gap: 12 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  userRow: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' },
  userEmail: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  userRole: { fontSize: 12, color: '#64748B' },
  userActions: { gap: 6 },
  roleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  roleBtnActive: { backgroundColor: '#F1F5F9' },
  roleBtnText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  roleBtnTextActive: { color: '#0F172A' },
  opBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F1F5F9' },
  opBtnActive: { backgroundColor: '#FE902A' },
  opBtnText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  opBtnTextActive: { color: '#fff' },
});
