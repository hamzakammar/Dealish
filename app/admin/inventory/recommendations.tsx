import { useAuthContext } from '@/app/providers/auth';
import { useDealRecommendations } from '@/hooks/useDealRecommendations';
import { DealRecommendationWithProduct } from '@/types/inventory';
import { formatQuantity } from '@/utils/unitConversion';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DealRecommendationsScreen() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { profile } = useAuthContext();
  const { recommendations, loading, refetch, approveRecommendation, rejectRecommendation, dismissRecommendation } = useDealRecommendations(restaurantId || null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleCreateDeal = async (recommendation: DealRecommendationWithProduct) => {
    setProcessingId(recommendation.id);
    try {
      // Navigate to deal form with pre-filled data
      router.push({
        pathname: '/admin/deal-form' as any,
        params: {
          restaurantId,
          recommendationId: recommendation.id,
          suggestedTitle: recommendation.suggested_title,
          suggestedDescription: recommendation.suggested_description,
          suggestedDiscount: recommendation.suggested_discount_percent?.toString(),
        }
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    Alert.alert(
      'Dismiss Recommendation',
      'Are you sure you want to dismiss this recommendation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            await dismissRecommendation(id);
          }
        }
      ]
    );
  };

  const getUrgencyColor = (urgencyScore?: number): string => {
    if (!urgencyScore) return '#8E8E93';
    if (urgencyScore >= 80) return '#FF3B30'; // High urgency - red
    if (urgencyScore >= 50) return '#FF9500'; // Medium urgency - orange
    return '#FFCC00'; // Low urgency - yellow
  };

  const getUrgencyLabel = (urgencyScore?: number): string => {
    if (!urgencyScore) return 'Unknown';
    if (urgencyScore >= 80) return 'Urgent';
    if (urgencyScore >= 50) return 'High';
    return 'Medium';
  };

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
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deal Recommendations</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {recommendations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No Recommendations</Text>
            <Text style={styles.emptyStateMessage}>
              We'll generate deal recommendations based on your inventory expiration dates.
            </Text>
          </View>
        ) : (
          <View style={styles.recommendationsList}>
            {recommendations.map((recommendation) => (
              <View key={recommendation.id} style={styles.recommendationCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{recommendation.product.name}</Text>
                    <Text style={styles.productCategory}>
                      {recommendation.product.category 
                        ? recommendation.product.category.charAt(0).toUpperCase() + 
                          recommendation.product.category.slice(1).replace('_', ' ')
                        : 'Uncategorized'}
                      {recommendation.product.subcategory && 
                        ` • ${recommendation.product.subcategory.replace('_', ' ')}`}
                    </Text>
                  </View>
                  <View style={[
                    styles.urgencyBadge,
                    { backgroundColor: getUrgencyColor(recommendation.urgency_score) + '20' }
                  ]}>
                    <Text style={[
                      styles.urgencyText,
                      { color: getUrgencyColor(recommendation.urgency_score) }
                    ]}>
                      {getUrgencyLabel(recommendation.urgency_score)}
                    </Text>
                  </View>
                </View>

                {/* Recommendation Details */}
                <View style={styles.recommendationDetails}>
                  <Text style={styles.recommendationTitle}>
                    {recommendation.suggested_title}
                  </Text>
                  {recommendation.suggested_description && (
                    <Text style={styles.recommendationDescription}>
                      {recommendation.suggested_description}
                    </Text>
                  )}

                  {/* Inventory Info */}
                  {recommendation.inventory_item && (
                    <View style={styles.inventoryInfo}>
                      <View style={styles.infoRow}>
                        <Ionicons name="cube-outline" size={16} color="#8E8E93" />
                        <Text style={styles.infoText}>
                          {formatQuantity(
                            recommendation.inventory_item.quantity,
                            recommendation.inventory_item.unit
                          )}
                        </Text>
                      </View>
                      {recommendation.days_until_expiration !== null && (
                        <View style={styles.infoRow}>
                          <Ionicons name="calendar-outline" size={16} color="#FF3B30" />
                          <Text style={[styles.infoText, { color: '#FF3B30' }]}>
                            {recommendation.days_until_expiration === 0
                              ? 'Expires today'
                              : recommendation.days_until_expiration === 1
                              ? 'Expires tomorrow'
                              : `Expires in ${recommendation.days_until_expiration} days`}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Discount Badge */}
                  {recommendation.suggested_discount_percent && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>
                        {recommendation.suggested_discount_percent}% OFF
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => handleDismiss(recommendation.id)}
                  >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createDealButton,
                      processingId === recommendation.id && styles.createDealButtonDisabled
                    ]}
                    onPress={() => handleCreateDeal(recommendation)}
                    disabled={processingId === recommendation.id}
                  >
                    {processingId === recommendation.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="pricetag-outline" size={16} color="#fff" />
                        <Text style={styles.createDealButtonText}>Create Deal</Text>
                      </>
                    )}
                  </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    marginLeft: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  recommendationsList: {
    padding: 20,
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#8E8E93',
    textTransform: 'capitalize',
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationDetails: {
    marginBottom: 16,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  inventoryInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#000000',
  },
  discountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FE902A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  createDealButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FE902A',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createDealButtonDisabled: {
    opacity: 0.6,
  },
  createDealButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
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
  },
});
