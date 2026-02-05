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
    if (togglingDealId === dealId) return; // Prevent double-clicks
    
    setTogglingDealId(dealId);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ is_active: !currentStatus })
        .eq('id', dealId);

      if (error) throw error;

      // Update local state
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
                .eq('id', dealId);

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
      {/* Header */}
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
          <Ionicons name="arrow-back" size={24} color="#FE902A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Deals</Text>
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
          <Ionicons name="add-circle" size={32} color="#FE902A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {deals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={64} color="#C7C7CC" />
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
          deals.map((deal) => (
            <View key={deal.id} style={styles.dealCard}>
              <View style={styles.dealHeader}>
                <View style={styles.dealTitleRow}>
                  <Text style={styles.dealTitle}>{deal.title}</Text>
                  <Switch
                    value={deal.is_active}
                    onValueChange={() => toggleDealStatus(deal.id, deal.is_active)}
                    trackColor={{ false: '#E5E5EA', true: '#FE902A' }}
                    disabled={isLoading || togglingDealId === deal.id}
                  />
                </View>
                {deal.description && (
                  <Text style={styles.dealDescription}>{deal.description}</Text>
                )}
              </View>

              <View style={styles.dealMeta}>
                {deal.is_recurring ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="repeat" size={16} color="#FE902A" />
                    <Text style={styles.metaText}>Recurring</Text>
                  </View>
                ) : (
                  <>
                    {deal.start_at && (
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={16} color="#8E8E93" />
                        <Text style={styles.metaText}>
                          {new Date(deal.start_at).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    {deal.end_at && (
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={16} color="#8E8E93" />
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
                  style={styles.editButton}
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
                  <Ionicons name="pencil" size={20} color="#FE902A" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteDeal(deal.id)}
                  disabled={isLoading || togglingDealId === deal.id}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  addButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  createButton: {
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dealHeader: {
    marginBottom: 12,
  },
  dealTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  dealDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  dealMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#FFF5EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#FE902A',
    fontWeight: '500',
  },
  dealActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  editButtonText: {
    color: '#FE902A',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
});
