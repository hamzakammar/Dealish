import { supabase } from '@/app/lib/supabase';
import { useEffect, useState } from 'react';

export interface PartnerRequestCount {
  restaurant_id: string;
  count: number;
  pending_count: number;
}

/**
 * Hook to fetch partner request counts for restaurants
 */
export function usePartnerRequests(restaurantIds: string[]) {
  const [requestCounts, setRequestCounts] = useState<Map<string, PartnerRequestCount>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantIds.length === 0) {
      setLoading(false);
      return;
    }

    fetchRequestCounts();
  }, [restaurantIds.join(',')]);

  const fetchRequestCounts = async () => {
    try {
      setLoading(true);
      
      // Fetch counts grouped by restaurant_id
      const { data, error } = await supabase
        .from('partner_requests')
        .select('restaurant_id, status')
        .in('restaurant_id', restaurantIds);

      if (error) throw error;

      // Count requests per restaurant
      const countsMap = new Map<string, PartnerRequestCount>();
      
      restaurantIds.forEach(id => {
        countsMap.set(id, {
          restaurant_id: id,
          count: 0,
          pending_count: 0,
        });
      });

      data?.forEach((request) => {
        const existing = countsMap.get(request.restaurant_id);
        if (existing) {
          existing.count += 1;
          if (request.status === 'pending') {
            existing.pending_count += 1;
          }
        }
      });

      setRequestCounts(countsMap);
    } catch (error) {
      console.error('Error fetching partner request counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRequestCount = (restaurantId: string): PartnerRequestCount => {
    return requestCounts.get(restaurantId) || {
      restaurant_id: restaurantId,
      count: 0,
      pending_count: 0,
    };
  };

  return {
    requestCounts,
    getRequestCount,
    loading,
    refetch: fetchRequestCounts,
  };
}

/**
 * Fetch partner request count for a single restaurant
 */
export async function getPartnerRequestCount(restaurantId: string): Promise<PartnerRequestCount> {
  try {
    const { data, error } = await supabase
      .from('partner_requests')
      .select('status')
      .eq('restaurant_id', restaurantId);

    if (error) throw error;

    const total = data?.length || 0;
    const pending = data?.filter(r => r.status === 'pending').length || 0;

    return {
      restaurant_id: restaurantId,
      count: total,
      pending_count: pending,
    };
  } catch (error) {
    console.error('Error fetching partner request count:', error);
    return {
      restaurant_id: restaurantId,
      count: 0,
      pending_count: 0,
    };
  }
}
