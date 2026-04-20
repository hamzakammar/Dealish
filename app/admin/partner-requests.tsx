import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface PartnerRequest {
  id: string;
  restaurant_id: string;
  user_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  user_email?: string;
  user_name?: string;
}

export default function PartnerRequestsScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { profile } = useAuthContext();
  const router = useRouter();
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRequests();
    }
  }, [restaurantId]);

  const fetchRequests = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_requests')
        .select(`
          *,
          profiles:user_id (
            display_name
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests: PartnerRequest[] = (data || []).map((req) => ({
        id: req.id,
        restaurant_id: req.restaurant_id,
        user_id: req.user_id,
        created_at: req.created_at,
        status: req.status,
        user_email: undefined, // email lives in auth.users, not profiles table
        user_name: req.profiles?.display_name,
      }));

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching partner requests:', error);
      Alert.alert('Error', 'Failed to load partner requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setUpdating(requestId);
    try {
      const { error } = await supabase
        .from('partner_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      // Refresh the list
      await fetchRequests();

      // If approved, update restaurant to be a partner
      if (newStatus === 'approved') {
        const request = requests.find(r => r.id === requestId);
        if (request) {
          const { error: restaurantError } = await supabase
            .from('restaurants')
            .update({ partner: true })
            .eq('id', restaurantId);

          if (restaurantError) {
            console.error('Error updating restaurant partner status:', restaurantError);
          }
        }
      }

      Alert.alert('Success', `Request ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating request status:', error);
      Alert.alert('Error', 'Failed to update request status');
    } finally {
      setUpdating(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
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
          style={styles.backButton}
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              router.replace('/admin');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partner Requests</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Requests</Text>
          <Text style={styles.summaryCount}>{requests.length}</Text>
          <View style={styles.summaryBreakdown}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={[styles.summaryValue, { color: '#FF9800' }]}>
                {pendingRequests.length}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Approved</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {requests.filter(r => r.status === 'approved').length}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rejected</Text>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                {requests.filter(r => r.status === 'rejected').length}
              </Text>
            </View>
          </View>
        </View>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUserName}>
                      {request.user_name || request.user_email || 'Unknown User'}
                    </Text>
                    {request.user_email && request.user_name && (
                      <Text style={styles.requestUserEmail}>{request.user_email}</Text>
                    )}
                    <Text style={styles.requestDate}>
                      {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>Pending</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleStatusUpdate(request.id, 'approved')}
                    disabled={updating === request.id}
                  >
                    {updating === request.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleStatusUpdate(request.id, 'rejected')}
                    disabled={updating === request.id}
                  >
                    {updating === request.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="close" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Other Requests */}
        {otherRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Requests</Text>
            {otherRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUserName}>
                      {request.user_name || request.user_email || 'Unknown User'}
                    </Text>
                    {request.user_email && request.user_name && (
                      <Text style={styles.requestUserEmail}>{request.user_email}</Text>
                    )}
                    <Text style={styles.requestDate}>
                      {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      request.status === 'approved' && styles.statusBadgeApproved,
                      request.status === 'rejected' && styles.statusBadgeRejected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        request.status === 'approved' && styles.statusBadgeTextApproved,
                        request.status === 'rejected' && styles.statusBadgeTextRejected,
                      ]}
                    >
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {requests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No Partner Requests</Text>
            <Text style={styles.emptyStateMessage}>
              Users can request this restaurant to become a partner from the app.
            </Text>
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFF5EB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FE902A',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FE902A',
    marginBottom: 16,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  requestUserEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeApproved: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeRejected: {
    backgroundColor: '#F44336',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextApproved: {
    color: '#FFFFFF',
  },
  statusBadgeTextRejected: {
    color: '#FFFFFF',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
