import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Restaurant } from '@/types/restaurant';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminDashboard() {
  const { profile, isLoading } = useAuthContext();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(true);

  useEffect(() => {
    // Redirect if not logged in or not an admin/owner
    if (!isLoading && (!profile || (profile.role !== 'owner' && profile.role !== 'admin'))) {
      try {
        router.replace('/');
      } catch (error) {
        console.error('Navigation error:', error);
      }
      return;
    }

    // Fetch restaurants for this owner by owner_id
    if (profile?.id) {
      fetchRestaurants();
    }
  }, [profile, isLoading]);

  const fetchRestaurants = async () => {
    if (!profile?.id) return;

    try {
      setIsLoadingRestaurants(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRestaurants(data || []);
      // Select first restaurant by default
      if (data && data.length > 0 && !selectedRestaurantId) {
        setSelectedRestaurantId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setIsLoadingRestaurants(false);
    }
  };

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  if (isLoading || isLoadingRestaurants) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  // Check for sub_admin role - they only get scanner
  if (profile?.role === 'admin') {
    try {
      router.replace('/qr-scanner');
    } catch (error) {
      console.error('Navigation error:', error);
    }
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/auth');
            } catch (error) {
              console.error('Sign out error:', error);
              // Still try to navigate
              try {
                router.replace('/auth');
              } catch (navError) {
                console.error('Navigation error:', navError);
              }
            }
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Multi-location selector */}
        {restaurants.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Restaurant</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationScroll}>
              {restaurants.map((restaurant) => {
                return (
                  <TouchableOpacity
                    key={restaurant.id}
                    style={[
                      styles.locationCard,
                      selectedRestaurantId === restaurant.id && styles.locationCardSelected
                    ]}
                    onPress={() => setSelectedRestaurantId(restaurant.id)}
                  >
                    <Text style={[
                      styles.locationName,
                      selectedRestaurantId === restaurant.id && styles.locationNameSelected
                    ]}>
                      {restaurant.name}
                    </Text>
                    {restaurant.address && (
                      <Text style={[
                        styles.locationAddress,
                        selectedRestaurantId === restaurant.id && styles.locationAddressSelected
                      ]}>
                        {restaurant.address}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Current restaurant info */}
        {selectedRestaurant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Location</Text>
            <View style={styles.restaurantCard}>
              <Text style={styles.restaurantName}>{selectedRestaurant.name}</Text>
              {selectedRestaurant.address && (
                <Text style={styles.restaurantAddress}>{selectedRestaurant.address}</Text>
              )}
              {selectedRestaurant.phone && (
                <Text style={styles.restaurantPhone}>{selectedRestaurant.phone}</Text>
              )}
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              try {
                router.push({
                  pathname: '/admin/deals' as any,
                  params: { restaurantId: selectedRestaurantId }
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
            disabled={!selectedRestaurantId}
          >
            <Ionicons name="pricetag" size={24} color="#FE902A" />
            <View style={styles.actionButtonText}>
              <Text style={styles.actionButtonTitle}>Manage Deals</Text>
              <Text style={styles.actionButtonSubtitle}>Create, edit, and view deals</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              try {
                router.push('/qr-scanner');
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
          >
            <Ionicons name="qr-code" size={24} color="#FE902A" />
            <View style={styles.actionButtonText}>
              <Text style={styles.actionButtonTitle}>Scan QR Code</Text>
              <Text style={styles.actionButtonSubtitle}>Redeem customer deals</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              try {
                router.push({
                  pathname: '/admin/restaurant' as any,
                  params: { restaurantId: selectedRestaurantId }
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
            disabled={!selectedRestaurantId}
          >
            <Ionicons name="restaurant" size={24} color="#FE902A" />
            <View style={styles.actionButtonText}>
              <Text style={styles.actionButtonTitle}>Restaurant Settings</Text>
              <Text style={styles.actionButtonSubtitle}>Update info and images</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              try {
                router.push({
                  pathname: '/admin/analytics' as any,
                  params: { restaurantId: selectedRestaurantId }
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
            disabled={!selectedRestaurantId}
          >
            <Ionicons name="stats-chart" size={24} color="#FE902A" />
            <View style={styles.actionButtonText}>
              <Text style={styles.actionButtonTitle}>Analytics</Text>
              <Text style={styles.actionButtonSubtitle}>View redemptions and visits</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.addRestaurantButton]}
            onPress={() => {
              try {
                router.push('/admin/create-restaurant' as any);
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
          >
            <Ionicons name="add-circle" size={24} color="#FE902A" />
            <View style={styles.actionButtonText}>
              <Text style={styles.actionButtonTitle}>Add Restaurant</Text>
              <Text style={styles.actionButtonSubtitle}>Create a new location</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* No restaurants warning */}
        {restaurants.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No Restaurants Found</Text>
            <Text style={styles.emptyStateMessage}>
              Get started by creating your first restaurant location.
            </Text>
            <TouchableOpacity
              style={styles.createRestaurantButton}
              onPress={() => {
                try {
                  router.push('/admin/create-restaurant' as any);
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
            >
              <Text style={styles.createRestaurantButtonText}>Create Restaurant</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  locationScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 200,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  locationCardSelected: {
    borderColor: '#FE902A',
    backgroundColor: '#FFF5F0',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  locationNameSelected: {
    color: '#FE902A',
  },
  locationAddress: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  locationAddressSelected: {
    color: '#FE902A',
    opacity: 0.7,
  },
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  restaurantPhone: {
    fontSize: 14,
    color: '#FE902A',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 16,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  actionButtonSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  addRestaurantButton: {
    borderWidth: 2,
    borderColor: '#FE902A',
    backgroundColor: '#FFF5EB',
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
    marginBottom: 24,
  },
  createRestaurantButton: {
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createRestaurantButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
