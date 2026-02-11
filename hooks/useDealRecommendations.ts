import { supabase } from '@/app/lib/supabase';
import { DealRecommendation, DealRecommendationWithProduct } from '@/types/inventory';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useDealRecommendations(restaurantId: string | null) {
  const [recommendations, setRecommendations] = useState<DealRecommendationWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    fetchRecommendations();
  }, [restaurantId]);

  const fetchRecommendations = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('deal_recommendations')
        .select(`
          *,
          product:products(*),
          inventory_item:inventory_items(*)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('urgency_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRecommendations((data || []) as DealRecommendationWithProduct[]);
    } catch (e: any) {
      console.error('Error fetching recommendations:', e);
      setError(e);
      Alert.alert('Error', 'Failed to load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateRecommendationStatus = async (
    id: string,
    status: DealRecommendation['status'],
    dealId?: string
  ) => {
    try {
      const updates: any = { status };
      if (dealId) {
        updates.deal_id = dealId;
      }

      const { data, error: updateError } = await supabase
        .from('deal_recommendations')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          product:products(*),
          inventory_item:inventory_items(*)
        `)
        .single();

      if (updateError) throw updateError;

      // Refresh recommendations list
      await fetchRecommendations();

      return data as DealRecommendationWithProduct;
    } catch (e: any) {
      console.error('Error updating recommendation:', e);
      Alert.alert('Error', e.message || 'Failed to update recommendation.');
      return null;
    }
  };

  const dismissRecommendation = async (id: string) => {
    return updateRecommendationStatus(id, 'dismissed');
  };

  const approveRecommendation = async (id: string) => {
    return updateRecommendationStatus(id, 'approved');
  };

  const rejectRecommendation = async (id: string) => {
    return updateRecommendationStatus(id, 'rejected');
  };

  return {
    recommendations,
    loading,
    error,
    refetch: fetchRecommendations,
    updateRecommendationStatus,
    dismissRecommendation,
    approveRecommendation,
    rejectRecommendation,
  };
}
