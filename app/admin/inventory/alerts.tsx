import { useAuthContext } from '@/app/providers/auth';
import { useInventoryAlerts } from '@/hooks/useInventoryAlerts';
import { formatQuantity } from '@/utils/unitConversion';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AlertFilter = 'all' | 'expiring_soon' | 'expiring_today' | 'expired' | 'slow_moving';

export default function InventoryAlertsScreen() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { profile } = useAuthContext();
  const { alerts, loading, error, refetch, markAsRead, dismissAlert, markAllAsRead } = useInventoryAlerts(restaurantId || null);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const isInitialMountRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        return;
      }
      if (restaurantId) {
        refetch();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurantId])
  );

  const handleDismiss = async (id: string) => {
    Alert.alert(
      'Dismiss Alert',
      'Are you sure you want to dismiss this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            await dismissAlert(id);
          }
        }
      ]
    );
  };

  const handleMarkAllRead = async () => {
    Alert.alert(
      'Mark All as Read',
      'Mark all alerts as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All Read',
          onPress: async () => {
            await markAllAsRead();
          }
        }
      ]
    );
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.alert_type === filter;
  });

  const getAlertTypeStats = () => {
    return {
      all: alerts.length,
      expiring_soon: alerts.filter(a => a.alert_type === 'expiring_soon').length,
      expiring_today: alerts.filter(a => a.alert_type === 'expiring_today').length,
      expired: alerts.filter(a => a.alert_type === 'expired').length,
      slow_moving: alerts.filter(a => a.alert_type === 'slow_moving').length,
    };
  };

  const stats = getAlertTypeStats();

  const getAlertColor = (alertType: string): string => {
    switch (alertType) {
      case 'expired':
        return '#EF4444';
      case 'expiring_today':
        return '#F97316';
      case 'expiring_soon':
        return '#EAB308';
      case 'slow_moving':
        return '#64748B';
      default:
        return '#64748B';
    }
  };

  const getAlertIcon = (alertType: string): string => {
    switch (alertType) {
      case 'expired':
        return 'close-circle';
      case 'expiring_today':
        return 'time';
      case 'expiring_soon':
        return 'warning';
      case 'slow_moving':
        return 'trending-down';
      default:
        return 'information-circle';
    }
  };

  const getFilterLabel = (filterType: AlertFilter): string => {
    switch (filterType) {
      case 'all': return 'All';
      case 'expiring_soon': return 'Expiring Soon';
      case 'expiring_today': return 'Expiring Today';
      case 'expired': return 'Expired';
      case 'slow_moving': return 'Slow Moving';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alerts</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load Alerts</Text>
          <Text style={styles.errorMessage}>
            {error.message || 'An error occurred while loading alerts.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.headerTitle}>Alerts</Text>
          <Text style={styles.headerSubtitle}>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</Text>
        </View>
        {alerts.length > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
            <Ionicons name="checkmark-done" size={22} color="#64748B" />
          </TouchableOpacity>
        )}
        {alerts.length === 0 && <View style={styles.placeholder} />}
      </View>

      {alerts.length > 0 && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['all', 'expiring_today', 'expiring_soon', 'expired', 'slow_moving'] as AlertFilter[]).map((filterType) => (
              <TouchableOpacity
                key={filterType}
                style={[
                  styles.filterButton,
                  filter === filterType && styles.filterButtonActive
                ]}
                onPress={() => setFilter(filterType)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filter === filterType && styles.filterButtonTextActive
                ]}>
                  {getFilterLabel(filterType)}
                </Text>
                {stats[filterType] > 0 && (
                  <View style={[
                    styles.filterBadge,
                    filter === filterType && styles.filterBadgeActive
                  ]}>
                    <Text style={[
                      styles.filterBadgeText,
                      filter === filterType && styles.filterBadgeTextActive
                    ]}>
                      {stats[filterType]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name={filter === 'all' ? 'checkmark-circle' : 'filter'} 
                size={48} 
                color="#CBD5E1" 
              />
            </View>
            <Text style={styles.emptyStateTitle}>
              {filter === 'all' ? 'All Clear!' : `No ${getFilterLabel(filter)} Alerts`}
            </Text>
            <Text style={styles.emptyStateMessage}>
              {filter === 'all' 
                ? 'No expiring or slow-moving inventory items at the moment.'
                : `No ${getFilterLabel(filter).toLowerCase()} alerts found.`}
            </Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {filteredAlerts.map((alert) => {
              const alertColor = getAlertColor(alert.alert_type);
              
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={styles.alertCard}
                  onPress={() => {
                    router.push({
                      pathname: '/admin/inventory/item-form' as any,
                      params: { 
                        restaurantId,
                        itemId: alert.inventory_item_id 
                      }
                    });
                  }}
                >
                  <View style={[styles.alertIndicator, { backgroundColor: alertColor }]} />
                  
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{alert.product.name}</Text>
                        <Text style={styles.productCategory}>
                          {alert.product.category 
                            ? alert.product.category.charAt(0).toUpperCase() + 
                              alert.product.category.slice(1).replace('_', ' ')
                            : 'Uncategorized'}
                          {alert.product.subcategory && 
                            ` • ${alert.product.subcategory.replace('_', ' ')}`}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.dismissButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDismiss(alert.id);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.alertMessage}>
                      <View style={[styles.alertIconContainer, { backgroundColor: alertColor + '15' }]}>
                        <Ionicons 
                          name={getAlertIcon(alert.alert_type) as any} 
                          size={18} 
                          color={alertColor} 
                        />
                      </View>
                      <Text style={styles.messageText}>{alert.message}</Text>
                    </View>

                    <View style={styles.inventoryInfo}>
                      {alert.inventory_item && (
                        <View style={styles.infoRow}>
                          <Ionicons name="cube-outline" size={14} color="#64748B" />
                          <Text style={styles.infoText}>
                            {formatQuantity(
                              alert.inventory_item.quantity,
                              alert.inventory_item.unit
                            )}
                          </Text>
                        </View>
                      )}
                      {alert.days_until_expiration !== null && alert.days_until_expiration !== undefined && (
                        <View style={styles.infoRow}>
                          <Ionicons name="calendar-outline" size={14} color={alertColor} />
                          <Text style={[styles.infoText, { color: alertColor }]}>
                            {alert.days_until_expiration === 0
                              ? 'Expires today'
                              : alert.days_until_expiration < 0
                              ? `Expired ${Math.abs(alert.days_until_expiration)} day${Math.abs(alert.days_until_expiration) === 1 ? '' : 's'} ago`
                              : `Expires in ${alert.days_until_expiration} day${alert.days_until_expiration === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                      )}
                      {alert.days_since_received !== null && alert.days_since_received !== undefined && (
                        <View style={styles.infoRow}>
                          <Ionicons name="time-outline" size={14} color="#64748B" />
                          <Text style={styles.infoText}>
                            Received {alert.days_since_received} day{alert.days_since_received === 1 ? '' : 's'} ago
                          </Text>
                        </View>
                      )}
                      {alert.urgency_score !== null && alert.urgency_score !== undefined && (
                        <View style={styles.infoRow}>
                          <Ionicons name="flag-outline" size={14} color={alertColor} />
                          <Text style={[styles.infoText, { color: alertColor }]}>
                            {alert.urgency_score >= 80 ? 'Urgent' : alert.urgency_score >= 50 ? 'High Priority' : 'Medium Priority'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  markAllButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    gap: 6,
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
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterBadgeTextActive: {
    color: '#FE902A',
  },
  content: {
    flex: 1,
  },
  alertsList: {
    padding: 20,
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  alertIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 13,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  dismissButton: {
    padding: 4,
  },
  alertMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  alertIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  inventoryInfo: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
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
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
