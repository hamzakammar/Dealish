import { useAuthContext } from '@/app/providers/auth';
import { ScrapedCandidate, useScrapedDealCandidates } from '@/hooks/useScrapedDealCandidates';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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

export default function DealReviewScreen() {
  const router = useRouter();
  const { profile } = useAuthContext();
  const { candidates, loading, working, isOperator, fetchCandidates, approve, reject } =
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
          <Text style={styles.headerTitle}>Deal Review</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Operators only</Text>
          <Text style={styles.emptyText}>This review queue is restricted to platform operators.</Text>
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
        <Text style={styles.headerTitle}>Deal Review</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchCandidates} />}
      >
        <Text style={styles.subtitle}>
          Auto-detected deals for non-partner restaurants. Approve to publish (shown to users
          with an &quot;unverified&quot; badge), or reject.
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

        {candidates.map((c) => {
          const conf = typeof c.confidence === 'number' ? Math.round(c.confidence * 100) : null;
          const lowConf = conf !== null && conf < 60;
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.restaurantName}>{c.restaurants?.name || 'Unknown restaurant'}</Text>
                {conf !== null && (
                  <View style={[styles.confBadge, lowConf && styles.confBadgeLow]}>
                    <Text style={[styles.confText, lowConf && styles.confTextLow]}>{conf}%</Text>
                  </View>
                )}
              </View>

              <Text style={styles.dealTitle}>{c.title}</Text>
              {c.deal_category && <Text style={styles.category}>{c.deal_category.replace(/_/g, ' ')}</Text>}
              {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={styles.metaText}>{formatSchedule(c)}</Text>
              </View>

              {c.evidence_quote ? (
                <View style={styles.evidence}>
                  <Text style={styles.evidenceLabel}>Evidence</Text>
                  <Text style={styles.evidenceText}>&ldquo;{c.evidence_quote}&rdquo;</Text>
                </View>
              ) : null}

              {c.source_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(c.source_url!)}>
                  <Text style={styles.sourceLink} numberOfLines={1}>
                    {c.source_url}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  disabled={working === c.id}
                  onPress={() => onReject(c)}
                >
                  {working === c.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text style={styles.rejectText}>Reject</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  disabled={working === c.id}
                  onPress={() => onApprove(c)}
                >
                  {working === c.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveText}>Approve &amp; publish</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

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
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  approveBtn: { backgroundColor: '#FE902A' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
