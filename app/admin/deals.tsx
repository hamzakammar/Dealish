import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Deal } from '@/types/restaurant';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function DealsManagement() {
  const { profile } = useAuthContext();
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingDealId, setTogglingDealId] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchDeals();
    }
  }, [restaurantId]);

  const fetchDeals = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: ownedRestaurant, error: ownerErr } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', restaurantId)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (ownerErr) throw ownerErr;
      if (!ownedRestaurant) {
        Alert.alert('Error', 'You do not have access to this restaurant');
        router.replace('/admin');
        return;
      }

      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
      Alert.alert('Error', 'Failed to load deals');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDealStatus = async (dealId: string, currentStatus: boolean) => {
    if (togglingDealId === dealId) return;
    
    setTogglingDealId(dealId);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ is_active: !currentStatus })
        .eq('id', dealId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      setDeals(deals.map(deal => 
        deal.id === dealId ? { ...deal, is_active: !currentStatus } : deal
      ));

      Alert.alert('Success', `Deal ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling deal:', error);
      Alert.alert('Error', 'Failed to update deal status');
    } finally {
      setTogglingDealId(null);
    }
  };

  const deleteDeal = async (dealId: string) => {
    Alert.alert(
      'Delete Deal',
      'Are you sure you want to delete this deal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('deals')
                .delete()
                .eq('id', dealId)
                .eq('restaurant_id', restaurantId);

              if (error) throw error;

              setDeals(deals.filter(deal => deal.id !== dealId));
              Alert.alert('Success', 'Deal deleted');
            } catch (error) {
              console.error('Error deleting deal:', error);
              Alert.alert('Error', 'Failed to delete deal');
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('Navigation error:', error);
              router.replace('/admin');
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Deals</Text>
          <Text style={styles.headerSubtitle}>{deals.length} active deal{deals.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            try {
              router.push({
                pathname: '/admin/deal-form' as any,
                params: { restaurantId }
              });
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('Error', 'Failed to navigate. Please try again.');
            }
          }}
          disabled={isLoading}
        >
          <Ionicons name="add-circle" size={28} color="#FE902A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {deals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="pricetag-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyStateTitle}>No Deals Yet</Text>
            <Text style={styles.emptyStateMessage}>
              Create your first deal to attract customers
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                try {
                  router.push({
                    pathname: '/admin/deal-form' as any,
                    params: { restaurantId }
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
              disabled={isLoading}
            >
              <Text style={styles.createButtonText}>Create Deal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dealsList}>
            {deals.map((deal) => (
              <View key={deal.id} style={styles.dealCard}>
                <View style={styles.dealHeader}>
                  <View style={styles.dealTitleRow}>
                    <Text style={styles.dealTitle}>{deal.title}</Text>
                    <View style={[
                      styles.statusIndicator,
                      deal.is_active ? styles.statusIndicatorActive : styles.statusIndicatorInactive
                    ]}>
                      <View style={[
                        styles.statusDot,
                        deal.is_active ? styles.statusDotActive : styles.statusDotInactive
                      ]} />
                      <Text style={[
                        styles.statusText,
                        deal.is_active ? styles.statusTextActive : styles.statusTextInactive
                      ]}>
                        {deal.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  {deal.description && (
                    <Text style={styles.dealDescription}>{deal.description}</Text>
                  )}
                </View>

                <View style={styles.dealMeta}>
                  {deal.is_recurring ? (
                    <View style={styles.metaItem}>
                      <View style={styles.metaIcon}>
                        <Ionicons name="repeat" size={14} color="#FE902A" />
                      </View>
                      <Text style={styles.metaText}>Recurring</Text>
                    </View>
                  ) : (
                    <>
                      {deal.start_at && (
                        <View style={styles.metaItem}>
                          <View style={styles.metaIcon}>
                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                          </View>
                          <Text style={styles.metaText}>
                            {new Date(deal.start_at).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {deal.end_at && (
                        <View style={styles.metaItem}>
                          <View style={styles.metaIcon}>
                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                          </View>
                          <Text style={styles.metaText}>
                            {new Date(deal.end_at).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>

                {deal.tags && deal.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {deal.tags.map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.dealActions}>
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => toggleDealStatus(deal.id, deal.is_active)}
                    disabled={isLoading || togglingDealId === deal.id}
                  >
                    <Switch
                      value={deal.is_active}
                      onValueChange={() => toggleDealStatus(deal.id, deal.is_active)}
                      trackColor={{ false: '#E2E8F0', true: '#FE902A' }}
                      thumbColor="#FFFFFF"
                      disabled={isLoading || togglingDealId === deal.id}
                    />
                    <Text style={styles.toggleButtonText}>
                      {deal.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        try {
                          router.push({
                            pathname: '/admin/deal-form' as any,
                            params: { restaurantId, dealId: deal.id }
                          });
                        } catch (error) {
                          console.error('Navigation error:', error);
                          Alert.alert('Error', 'Failed to navigate. Please try again.');
                        }
                      }}
                      disabled={isLoading}
                    >
                      <Ionicons name="create-outline" size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => deleteDeal(deal.id)}
                      disabled={isLoading || togglingDealId === deal.id}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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
  dealsList: {
    padding: 20,
    gap: 12,
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  dealHeader: {
    marginBottom: 16,
  },
  dealTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusIndicatorActive: {
    backgroundColor: '#F0FDF4',
  },
  statusIndicatorInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#64748B',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#10B981',
  },
  statusTextInactive: {
    color: '#64748B',
  },
  dealDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  dealMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  tag: {
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#FE902A',
    fontWeight: '600',
  },
  dealActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
  createButton: {
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
// cleanup
