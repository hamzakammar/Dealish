import { useSquareIntegration } from '@/hooks/useSquareIntegration';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SquareIntegrationScreen() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const {
    connection,
    recentOrders,
    stats,
    loading,
    syncing,
    connect,
    disconnect,
    triggerSync,
  } = useSquareIntegration(restaurantId);

  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      Alert.alert('Connected', 'Square POS is now linked. Syncing catalog...');
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Square', 'This will stop syncing POS data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnect },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Square POS</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!connection ? (
          <View style={styles.connectSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="card-outline" size={48} color="#FE902A" />
            </View>
            <Text style={styles.connectTitle}>Connect Square POS</Text>
            <Text style={styles.connectDescription}>
              Link your Square account to automatically sync inventory, track orders, and see how
              Dealish deals drive revenue at your restaurant.
            </Text>
            <View style={styles.featureList}>
              <FeatureRow icon="sync-outline" text="Auto-sync menu items & inventory" />
              <FeatureRow icon="receipt-outline" text="Track orders tied to deal redemptions" />
              <FeatureRow icon="analytics-outline" text="Revenue analytics from Dealish customers" />
              <FeatureRow icon="notifications-outline" text="Low stock alerts from POS data" />
            </View>
            <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
              <Text style={styles.connectButtonText}>Connect Square</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Connection Status */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected</Text>
                <TouchableOpacity onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.merchantId}>Merchant: {connection.merchant_id}</Text>
              <Text style={styles.locationCount}>
                {connection.location_ids?.length || 0} location{(connection.location_ids?.length || 0) !== 1 ? 's' : ''} linked
              </Text>
            </View>

            {/* Sync Button */}
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
              onPress={triggerSync}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sync-outline" size={18} color="#fff" />
              )}
              <Text style={styles.syncButtonText}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>

            {/* Stats */}
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Total Orders" value={String(stats.totalOrders)} />
              <StatCard label="Revenue" value={formatCents(stats.totalRevenue)} />
              <StatCard label="Dealish Orders" value={String(stats.dealishOrders)} highlight />
              <StatCard label="Dealish Revenue" value={formatCents(stats.dealishRevenue)} highlight />
            </View>

            {stats.totalDiscounts > 0 && (
              <View style={styles.discountBanner}>
                <Ionicons name="pricetag" size={16} color="#FE902A" />
                <Text style={styles.discountText}>
                  Total discounts given: {formatCents(stats.totalDiscounts)}
                </Text>
              </View>
            )}

            {/* Recent Orders */}
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {recentOrders.length === 0 ? (
              <View style={styles.emptyOrders}>
                <Text style={styles.emptyText}>No orders synced yet. Orders will appear after your next POS transaction.</Text>
              </View>
            ) : (
              recentOrders.slice(0, 10).map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderTime}>{formatTime(order.order_created_at)}</Text>
                    {order.deal_id && (
                      <View style={styles.dealishBadge}>
                        <Text style={styles.dealishBadgeText}>Dealish</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.orderDetails}>
                    <Text style={styles.orderTotal}>{formatCents(order.total_cents)}</Text>
                    <Text style={styles.orderItems}>{order.item_count} item{order.item_count !== 1 ? 's' : ''}</Text>
                    {order.discount_cents > 0 && (
                      <Text style={styles.orderDiscount}>-{formatCents(order.discount_cents)} discount</Text>
                    )}
                  </View>
                  {order.line_items && order.line_items.length > 0 && (
                    <View style={styles.lineItems}>
                      {order.line_items.slice(0, 4).map((li: any, i: number) => (
                        <Text key={i} style={styles.lineItemText}>
                          {li.quantity}x {li.name}
                        </Text>
                      ))}
                      {order.line_items.length > 4 && (
                        <Text style={styles.lineItemMore}>+{order.line_items.length - 4} more</Text>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={20} color="#FE902A" />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  contentContainer: { padding: 16, paddingBottom: 40 },
  // Connect section
  connectSection: { alignItems: 'center', paddingVertical: 32 },
  iconContainer: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#FEF7ED',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  connectTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  connectDescription: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 16 },
  featureList: { width: '100%', marginBottom: 32, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  featureText: { fontSize: 14, color: '#334155', fontWeight: '500' },
  connectButton: {
    backgroundColor: '#FE902A', paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 12, width: '100%', alignItems: 'center',
  },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Status
  statusCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
  statusText: { fontSize: 15, fontWeight: '600', color: '#10B981', flex: 1 },
  disconnectText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  merchantId: { fontSize: 13, color: '#64748B' },
  locationCount: { fontSize: 13, color: '#64748B', marginTop: 2 },
  // Sync
  syncButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FE902A', borderRadius: 10, paddingVertical: 12, marginBottom: 20,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Stats
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: '#E2E8F0',
  },
  statCardHighlight: { backgroundColor: '#FEF7ED', borderColor: '#FED7AA' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  statValueHighlight: { color: '#FE902A' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  discountBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF7ED', borderRadius: 8, padding: 12, marginBottom: 16,
  },
  discountText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  // Orders
  emptyOrders: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  orderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderTime: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  dealishBadge: { backgroundColor: '#FEF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  dealishBadgeText: { fontSize: 11, color: '#FE902A', fontWeight: '700' },
  orderDetails: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  orderItems: { fontSize: 13, color: '#64748B' },
  orderDiscount: { fontSize: 13, color: '#10B981', fontWeight: '500' },
  lineItems: { marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  lineItemText: { fontSize: 12, color: '#475569', marginBottom: 2 },
  lineItemMore: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 },
});
