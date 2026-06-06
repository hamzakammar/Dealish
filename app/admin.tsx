import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import DashboardSidebar from '@/components/DashboardSidebar';
import { Deal, Restaurant } from '@/types/restaurant';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- Demo KPIs: set DEMO_KPIS_OVERRIDE to true only for staged demos ---
const DEMO_KPIS_OVERRIDE = false;
const DEMO_TOTAL_SALES_AMOUNT = 42_800;
const DEMO_AVG_SALE_AMOUNT = 31.75;
// ---------------------------------------------------------------

export default function AdminDashboard() {
  const { profile, isLoading } = useAuthContext();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [averageSale, setAverageSale] = useState(0);
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState("");
  const [isRestaurantDropdownOpen, setIsRestaurantDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!profile || (profile.role !== 'owner' && profile.role !== 'admin'))) {
      try {
        router.replace('/');
      } catch (error) {
        console.error('Navigation error:', error);
      }
      return;
    }

    if (profile?.id) {
      fetchRestaurants();
    }
  }, [profile, isLoading]);

  useEffect(() => {
    if (selectedRestaurantId) {
      fetchDeals();
      fetchSalesStats();
    }
  }, [selectedRestaurantId]);

  // Refetch the restaurant list whenever the screen regains focus, so a newly
  // created restaurant shows up in the dropdown after navigating back.
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) fetchRestaurants();
    }, [profile?.id])
  );

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
      if (data && data.length > 0 && !selectedRestaurantId) {
        setSelectedRestaurantId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setIsLoadingRestaurants(false);
    }
  };

  const fetchDeals = async () => {
    if (!selectedRestaurantId) return;

    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('restaurant_id', selectedRestaurantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  // Demo overrides — values shown for specific restaurants instead of the
  // real qr_code_scans aggregate. Match by id when you have it, otherwise
  // by name. Add or remove entries here.
  const DEMO_SALES_OVERRIDES: { id?: string; name?: string; total: number; average: number }[] = [
    { name: 'Dealish food', total: 12000, average: 24.50 },
  ];

  const fetchSalesStats = async () => {
    if (!selectedRestaurantId) return;

    if (DEMO_KPIS_OVERRIDE) {
      setTotalSales(DEMO_TOTAL_SALES_AMOUNT);
      setAverageSale(DEMO_AVG_SALE_AMOUNT);
      return;
    }

    const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
    const override = DEMO_SALES_OVERRIDES.find(
      o => (o.id && o.id === selectedRestaurantId) || (o.name && o.name === restaurant?.name)
    );
    if (override) {
      setTotalSales(override.total);
      setAverageSale(override.average);
      return;
    }

    try {
      // Get all deals for this restaurant
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('id')
        .eq('restaurant_id', selectedRestaurantId);

      if (dealsError) throw dealsError;

      const dealIds = dealsData?.map(d => d.id) || [];
      
      if (dealIds.length === 0) {
        setTotalSales(0);
        setAverageSale(0);
        return;
      }

      // Get all QR code scans for these deals
      const { data: scansData, error: scansError } = await supabase
        .from('qr_code_scans')
        .select('deal_id, scanned_at')
        .in('deal_id', dealIds);

      if (scansError) throw scansError;

      const totalScans = scansData?.length || 0;
      
      if (totalScans === 0) {
        setTotalSales(0);
        setAverageSale(0);
        return;
      }

      // Get deal recommendations that link deals to menu items
      const { data: recommendationsData, error: recError } = await supabase
        .from('deal_recommendations')
        .select('deal_id, menu_item_id')
        .in('deal_id', dealIds)
        .not('menu_item_id', 'is', null);

      if (recError) throw recError;

      // Create a map of deal_id -> menu_item_id
      const dealToMenuItemMap = new Map<string, string>();
      recommendationsData?.forEach(rec => {
        if (rec.deal_id && rec.menu_item_id) {
          dealToMenuItemMap.set(rec.deal_id, rec.menu_item_id);
        }
      });

      // Get menu items for this restaurant
      const { data: menuItemsData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, price')
        .eq('restaurant_id', selectedRestaurantId)
        .not('price', 'is', null);

      if (menuError) throw menuError;

      // Create a map of menu_item_id -> price
      const menuItemPriceMap = new Map<string, number>();
      menuItemsData?.forEach(item => {
        if (item.id && item.price) {
          menuItemPriceMap.set(item.id, Number(item.price));
        }
      });

      // Calculate total sales and average from actual menu item prices
      let totalSalesAmount = 0;
      let scansWithPrices = 0;

      scansData?.forEach(scan => {
        if (scan.deal_id) {
          const menuItemId = dealToMenuItemMap.get(scan.deal_id);
          if (menuItemId) {
            const price = menuItemPriceMap.get(menuItemId);
            if (price && price > 0) {
              totalSalesAmount += price;
              scansWithPrices++;
            }
          }
        }
      });

      // Calculate average sale
      if (scansWithPrices > 0) {
        const averageSaleAmount = totalSalesAmount / scansWithPrices;
        setTotalSales(totalSalesAmount);
        setAverageSale(averageSaleAmount);
      } else {
        // Fallback: if no menu items linked, use average menu item price for restaurant
        if (menuItemsData && menuItemsData.length > 0) {
          const avgMenuPrice = menuItemsData.reduce((sum, item) => sum + (Number(item.price) || 0), 0) / menuItemsData.length;
          setTotalSales(totalScans * avgMenuPrice);
          setAverageSale(avgMenuPrice);
        } else {
          // No menu items at all - use default estimate
          const defaultAvgSale = 5.03;
          setTotalSales(totalScans * defaultAvgSale);
          setAverageSale(defaultAvgSale);
        }
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      setTotalSales(0);
      setAverageSale(0);
    }
  };

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  // Filter restaurants based on search query
  const filteredRestaurantsForDropdown = useMemo(() => {
    if (!restaurantSearchQuery.trim()) {
      return restaurants;
    }
    const query = restaurantSearchQuery.toLowerCase().trim();
    return restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(query) ||
      restaurant.address?.toLowerCase().includes(query) ||
      restaurant.type?.toLowerCase().includes(query)
    );
  }, [restaurants, restaurantSearchQuery]);

  if (isLoading || isLoadingRestaurants) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

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
      {/* Header with Hamburger Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setIsSidebarOpen(true)}
        >
          <View style={styles.menuButtonContainer}>
            <Ionicons name="menu" size={20} color="#64748B" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* KPI Cards */}
        <View style={styles.kpiSection}>
          <View style={[styles.kpiCard, styles.kpiCardPrimary]}>
            <View style={styles.kpiIconContainer}>
              <Ionicons name="cash" size={24} color="#FE902A" />
            </View>
            <Text style={styles.kpiValue}>{totalSales > 0 ? `${(totalSales / 1000).toFixed(0)}k` : '0'}</Text>
            <Text style={styles.kpiLabel}>Total Sales</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, styles.kpiIconContainerSecondary]}>
              <Ionicons name="stats-chart" size={24} color="#64748B" />
            </View>
            <Text style={styles.kpiValue}>${averageSale.toFixed(2)}</Text>
            <Text style={styles.kpiLabel}>Average Sale</Text>
          </View>
        </View>

        {/* Restaurant Selector with Search */}
        {restaurants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Restaurant</Text>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search restaurants..."
                placeholderTextColor="#94A3B8"
                value={restaurantSearchQuery}
                onChangeText={setRestaurantSearchQuery}
                onFocus={() => setIsRestaurantDropdownOpen(true)}
              />
              {restaurantSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setRestaurantSearchQuery("");
                    setIsRestaurantDropdownOpen(false);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setIsRestaurantDropdownOpen(!isRestaurantDropdownOpen)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownButtonContent}>
                  <Ionicons name="location" size={20} color="#FE902A" />
                  <View style={styles.dropdownButtonText}>
                    <Text style={styles.dropdownButtonTitle}>
                      {selectedRestaurant?.name || "Select a restaurant"}
                    </Text>
                    {selectedRestaurant?.address && (
                      <Text style={styles.dropdownButtonSubtitle} numberOfLines={1}>
                        {selectedRestaurant.address}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons
                  name={isRestaurantDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Inline dropdown list */}
            {isRestaurantDropdownOpen && (
              <View style={styles.dropdownInline}>
                {filteredRestaurantsForDropdown.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={styles.dropdownEmptyText}>No restaurants found</Text>
                  </View>
                ) : (
                  filteredRestaurantsForDropdown.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.dropdownItem,
                        selectedRestaurantId === item.id && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedRestaurantId(item.id);
                        setIsRestaurantDropdownOpen(false);
                        setRestaurantSearchQuery("");
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="location"
                        size={18}
                        color={selectedRestaurantId === item.id ? '#FE902A' : '#94A3B8'}
                      />
                      <View style={styles.dropdownItemContent}>
                        <Text style={[
                          styles.dropdownItemName,
                          selectedRestaurantId === item.id && styles.dropdownItemNameSelected,
                        ]}>
                          {item.name}
                        </Text>
                        {item.address && (
                          <Text style={styles.dropdownItemAddress} numberOfLines={1}>
                            {item.address}
                          </Text>
                        )}
                      </View>
                      {selectedRestaurantId === item.id && (
                        <Ionicons name="checkmark" size={20} color="#FE902A" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* Top Deals Section */}
        {selectedRestaurantId && deals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Deals</Text>
            {deals.map((deal) => (
              <TouchableOpacity
                key={deal.id}
                style={styles.dealCard}
                onPress={() => {
                  router.push({
                    pathname: '/admin/deal-form' as any,
                    params: { restaurantId: selectedRestaurantId, dealId: deal.id }
                  });
                }}
              >
                <View style={styles.dealContent}>
                  <Text style={styles.dealTitle}>{deal.title}</Text>
                  <View style={styles.dealBadge}>
                    <Text style={styles.dealBadgeText}>Active</Text>
                  </View>
                </View>
                {deal.description && (
                  <Text style={styles.dealDescription}>{deal.description}</Text>
                )}
                <View style={styles.dealTime}>
                  <Ionicons name="time-outline" size={14} color="#64748B" />
                  <Text style={styles.dealTimeText}>
                    {deal.is_recurring 
                      ? `Daily ${deal.recurrence_start_time?.substring(0, 5) || ''}-${deal.recurrence_end_time?.substring(0, 5) || ''}`
                      : deal.start_at && deal.end_at
                      ? `${new Date(deal.start_at).toLocaleDateString('en-US', { weekday: 'short' })} ${new Date(deal.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}-${new Date(deal.end_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}`
                      : 'No time specified'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dealMenuButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({
                      pathname: '/admin/deal-form' as any,
                      params: { restaurantId: selectedRestaurantId, dealId: deal.id }
                    });
                  }}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
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
              <View style={[styles.actionIconContainer, { backgroundColor: '#FEF3E2' }]}>
                <Ionicons name="pricetag" size={24} color="#FE902A" />
              </View>
              <Text style={styles.actionCardTitle}>Deals</Text>
              <Text style={styles.actionCardSubtitle}>Manage offers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                try {
                  router.push({
                    pathname: '/admin/inventory' as any,
                    params: { restaurantId: selectedRestaurantId }
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
              disabled={!selectedRestaurantId}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="cube" size={24} color="#0EA5E9" />
              </View>
              <Text style={styles.actionCardTitle}>Inventory</Text>
              <Text style={styles.actionCardSubtitle}>Stock & products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                try {
                  router.push({
                    pathname: '/admin/inventory/alerts' as any,
                    params: { restaurantId: selectedRestaurantId }
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
              disabled={!selectedRestaurantId}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="notifications" size={24} color="#EF4444" />
              </View>
              <Text style={styles.actionCardTitle}>Alerts</Text>
              <Text style={styles.actionCardSubtitle}>Expiring items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
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
              <View style={[styles.actionIconContainer, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="stats-chart" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionCardTitle}>Analytics</Text>
              <Text style={styles.actionCardSubtitle}>Performance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* More Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              try {
                router.push('/qr-scanner');
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="qr-code" size={20} color="#64748B" />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>Scan QR Code</Text>
                <Text style={styles.menuItemSubtitle}>Redeem customer deals</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
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
            <View style={styles.menuItemLeft}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="restaurant" size={20} color="#64748B" />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>Restaurant Settings</Text>
                <Text style={styles.menuItemSubtitle}>Update info and images</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              try {
                router.push({
                  pathname: '/admin/integrations' as any,
                  params: { restaurantId: selectedRestaurantId }
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
            disabled={!selectedRestaurantId}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="git-network-outline" size={20} color="#64748B" />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>Bulk Upload Inventory</Text>
                <Text style={styles.menuItemSubtitle}>Import items from a Google Sheet URL in one click</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {profile?.is_operator && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                try {
                  router.push('/admin/deal-review' as any);
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="sparkles-outline" size={20} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Review Auto-Detected Deals</Text>
                  <Text style={styles.menuItemSubtitle}>Approve deals the agent found for non-partner restaurants</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}

          {profile?.is_operator && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                try {
                  router.push('/admin/invites' as any);
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name="key-outline" size={20} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Admin Access Codes</Text>
                  <Text style={styles.menuItemSubtitle}>Create invite codes for new restaurant owners & staff</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemHighlight]}
            onPress={() => {
              try {
                router.push('/admin/create-restaurant' as any);
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Failed to navigate. Please try again.');
              }
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuItemIcon, { backgroundColor: '#FEF3E2' }]}>
                <Ionicons name="add-circle" size={20} color="#FE902A" />
              </View>
              <View>
                <Text style={[styles.menuItemTitle, { color: '#FE902A' }]}>Add Restaurant</Text>
                <Text style={styles.menuItemSubtitle}>Create a new location</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FE902A" />
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        {restaurants.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="restaurant-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyStateTitle}>No Restaurants</Text>
            <Text style={styles.emptyStateMessage}>
              Get started by creating your first restaurant location.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                try {
                  router.push('/admin/create-restaurant' as any);
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate. Please try again.');
                }
              }}
            >
              <Text style={styles.emptyStateButtonText}>Create Restaurant</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sidebar */}
      <DashboardSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  menuButton: {
    marginRight: 12,
  },
  menuButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  kpiSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardPrimary: {
    borderColor: '#FE902A',
    borderWidth: 2,
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiIconContainerSecondary: {
    backgroundColor: '#F1F5F9',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1002,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FE902A',
    minHeight: 60,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  dropdownButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  dropdownButtonSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 300,
    zIndex: 1003,
    overflow: 'hidden',
  },
  dropdownInline: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFFBF5',
  },
  dropdownItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  dropdownItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  dropdownItemNameSelected: {
    color: '#FE902A',
  },
  dropdownItemAddress: {
    fontSize: 13,
    color: '#64748B',
  },
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  dealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  dealBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dealBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dealDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  dealTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealTimeText: {
    fontSize: 13,
    color: '#64748B',
  },
  dealMenuButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItemHighlight: {
    borderWidth: 1.5,
    borderColor: '#FEF3E2',
    backgroundColor: '#FFFBF5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    marginTop: 40,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 999,
  },
});
