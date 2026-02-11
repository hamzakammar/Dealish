import { useAuthContext } from '@/app/providers/auth';
import { useInventory, useInventoryStats } from '@/hooks/useInventory';
import { calculateDaysUntilExpiration } from '@/utils/recommendations';
import { formatQuantity } from '@/utils/unitConversion';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InventoryManagement() {
  const { profile } = useAuthContext();
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { inventoryItems, loading, error: inventoryError, refetch, deleteInventoryItem } = useInventory(restaurantId || null);
  const { stats, loading: statsLoading, refetch: refetchStats } = useInventoryStats(restaurantId || null);
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired' | 'low_stock'>('all');
  const isInitialMountRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        return;
      }
      if (restaurantId) {
        refetch();
        refetchStats();
      }
    }, [restaurantId])
  );

  const filteredItems = inventoryItems.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'expired') {
      const days = calculateDaysUntilExpiration(item.expiration_date);
      return days !== null && days < 0;
    }
    if (filter === 'expiring') {
      const days = calculateDaysUntilExpiration(item.expiration_date);
      return days !== null && days >= 0 && days <= 7;
    }
    if (filter === 'low_stock') {
      return item.status === 'low_stock';
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Inventory Item',
      'Are you sure you want to delete this inventory item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteInventoryItem(id);
            if (success) {
              await refetch();
              await refetchStats();
              Alert.alert('Success', 'Inventory item deleted');
            }
          }
        }
      ]
    );
  };

  const getExpirationColor = (expirationDate: string | null | undefined): string => {
    if (!expirationDate) return '#64748B';
    const days = calculateDaysUntilExpiration(expirationDate);
    if (days === null) return '#64748B';
    if (days < 0) return '#EF4444';
    if (days <= 1) return '#F97316';
    if (days <= 7) return '#EAB308';
    return '#10B981';
  };

  const formatExpirationDate = (date: string | null | undefined): string => {
    if (!date) return 'No expiration';
    const days = calculateDaysUntilExpiration(date);
    if (days === null) {
      try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return 'Invalid date';
        return dateObj.toLocaleDateString();
      } catch {
        return 'Invalid date';
      }
    }
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
  };

  if (loading || statsLoading) {
    return (
      <View style={styles.loadingContainer}>
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSubtitle}>{stats?.total_items || 0} items</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            router.push({
              pathname: '/admin/inventory/scanner' as any,
              params: { restaurantId }
            });
          }}
        >
          <Ionicons name="add-circle" size={28} color="#FE902A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="cube" size={20} color="#0EA5E9" />
              </View>
              <Text style={styles.statValue}>{stats.total_items}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.expiring_today}</Text>
              <Text style={styles.statLabel}>Expiring Today</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="warning" size={20} color="#F97316" />
              </View>
              <Text style={[styles.statValue, { color: '#F97316' }]}>{stats.expiring_this_week}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="cash" size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>${stats.total_value.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Total Value</Text>
            </View>
          </View>
        )}

        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['all', 'expiring', 'expired', 'low_stock'] as const).map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  filter === filterOption && styles.filterButtonActive
                ]}
                onPress={() => setFilter(filterOption)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive
                ]}>
                  {filterOption === 'all' ? 'All' : filterOption === 'expiring' ? 'Expiring' : filterOption === 'expired' ? 'Expired' : 'Low Stock'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {inventoryError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.errorText}>Failed to load inventory. Please try again.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                refetch();
                refetchStats();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!inventoryError && filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyStateTitle}>No Inventory Items</Text>
            <Text style={styles.emptyStateMessage}>
              {filter === 'all' 
                ? `Get started by scanning a barcode or adding an item manually.${inventoryItems.length === 0 && stats && stats.total_items > 0 ? '\n\nNote: Some items may have missing product data.' : ''}`
                : `No items match the "${filter}" filter.`}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => {
                  router.push({
                    pathname: '/admin/inventory/scanner' as any,
                    params: { restaurantId }
                  });
                }}
              >
                <Ionicons name="barcode-outline" size={18} color="#fff" />
                <Text style={styles.addItemButtonText}>Scan Barcode</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.itemsList}>
            {filteredItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => {
                  router.push({
                    pathname: '/admin/inventory/item-form' as any,
                    params: { 
                      restaurantId,
                      itemId: item.id 
                    }
                  });
                }}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemCategory}>{item.product.category || 'Uncategorized'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.itemDetailRow}>
                    <Ionicons name="cube-outline" size={16} color="#64748B" />
                    <Text style={styles.itemDetailText}>
                      {formatQuantity(item.quantity, item.unit)}
                    </Text>
                  </View>

                  {item.expiration_date && (
                    <View style={styles.itemDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color={getExpirationColor(item.expiration_date)} />
                      <Text style={[styles.itemDetailText, { color: getExpirationColor(item.expiration_date) }]}>
                        {formatExpirationDate(item.expiration_date)}
                      </Text>
                    </View>
                  )}

                  {item.location && (
                    <View style={styles.itemDetailRow}>
                      <Ionicons name="location-outline" size={16} color="#64748B" />
                      <Text style={styles.itemDetailText}>{item.location}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemFooter}>
                  <View style={[
                    styles.statusBadge,
                    item.status === 'active' ? styles.statusBadgeActive : styles.statusBadgeInactive
                  ]}>
                    <Text style={[
                      styles.statusText,
                      item.status === 'active' ? styles.statusTextActive : styles.statusTextInactive
                    ]}>
                      {item.status}
                    </Text>
                  </View>
                  {item.unit_cost && (
                    <Text style={styles.itemCost}>
                      ${(item.quantity * item.unit_cost).toFixed(2)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FE902A',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemsList: {
    padding: 20,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 13,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: 4,
  },
  itemDetails: {
    marginBottom: 12,
    gap: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemDetailText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#F0FDF4',
  },
  statusBadgeInactive: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusTextActive: {
    color: '#10B981',
  },
  statusTextInactive: {
    color: '#EF4444',
  },
  itemCost: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
