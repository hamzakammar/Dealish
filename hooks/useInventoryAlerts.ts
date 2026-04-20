import { supabase } from '@/app/lib/supabase';
import { InventoryAlertWithProduct } from '@/types/inventory';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useInventoryAlerts(restaurantId: string | null) {
  const [alerts, setAlerts] = useState<InventoryAlertWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      setAlerts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (__DEV__) {
        console.log('Fetching alerts for restaurant:', restaurantId);
      }

      const { data, error: fetchError } = await supabase
        .from('inventory_alerts')
        .select(`
          *,
          product:products(*),
          inventory_item:inventory_items(*)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase error fetching alerts:', fetchError);
        throw fetchError;
      }

      if (__DEV__) {
        console.log('Fetched alerts:', data?.length || 0);
      }
      setAlerts((data || []) as InventoryAlertWithProduct[]);
    } catch (e: unknown) {
      console.error('Error fetching alerts:', e);
      setError(e instanceof Error ? e : new Error('Unknown error'));
      // Don't show alert dialog on initial load - let UI handle it via error state
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error('Failed to load inventory alerts:', message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setAlerts([]);
      return;
    }

    fetchAlerts();
  }, [restaurantId, fetchAlerts]);

  const markAsRead = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('inventory_alerts')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;

      // Refresh alerts list
      await fetchAlerts();

      return true;
    } catch (e: unknown) {
      console.error('Error marking alert as read:', e);
      const message = e instanceof Error ? e.message : 'Failed to update alert.';
      Alert.alert('Error', message);
      return false;
    }
  };

  const dismissAlert = async (id: string) => {
    return markAsRead(id); // Dismissing = marking as read
  };

  const markAllAsRead = async () => {
    if (!restaurantId) return false;

    try {
      const { error: updateError } = await supabase
        .from('inventory_alerts')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId)
        .eq('is_read', false);

      if (updateError) throw updateError;

      // Refresh alerts list
      await fetchAlerts();

      return true;
    } catch (e: unknown) {
      console.error('Error marking all alerts as read:', e);
      const message = e instanceof Error ? e.message : 'Failed to update alerts.';
      Alert.alert('Error', message);
      return false;
    }
  };

  return {
    alerts,
    loading,
    error,
    refetch: fetchAlerts,
    markAsRead,
    dismissAlert,
    markAllAsRead,
  };
}
