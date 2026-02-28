import { supabase } from '@/app/lib/supabase';
import { InventoryItem, InventoryItemWithProduct, InventoryStats } from '@/types/inventory';
import { generateAlertForItem } from '@/utils/generateInventoryAlerts';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useInventory(restaurantId: string | null) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setInventoryItems([]);
      return;
    }

    fetchInventory();
  }, [restaurantId]);

  const fetchInventory = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('restaurant_id', restaurantId)
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase query error:', fetchError);
        throw fetchError;
      }

      // Filter out items where product join failed (product was deleted)
      const validItems = (data || []).filter((item: any) => item.product !== null);

      if (__DEV__) {
        console.log(`Fetched ${validItems.length} inventory items (${data?.length || 0} total, ${(data?.length || 0) - validItems.length} with missing products)`);
      }

      setInventoryItems(validItems as InventoryItemWithProduct[]);
    } catch (e: any) {
      console.error('Error fetching inventory:', e);
      setError(e);
      Alert.alert('Error', `Failed to load inventory: ${e.message || 'Unknown error'}`);
      setInventoryItems([]); // Clear items on error
    } finally {
      setLoading(false);
    }
  };

  const addInventoryItem = async (item: Partial<InventoryItem>) => {
    if (!restaurantId) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('inventory_items')
        .insert([{
          ...item,
          restaurant_id: restaurantId,
        }])
        .select(`
          *,
          product:products(*)
        `)
        .single();

      if (insertError) throw insertError;

      // Refresh inventory list
      await fetchInventory();

      // Generate alert if item is expiring or slow-moving
      if (data && restaurantId) {
        try {
          await generateAlertForItem(restaurantId, data.id);
        } catch (error) {
          // Don't fail the operation if alert generation fails
          console.error('Error generating alert:', error);
        }
      }

      return data as InventoryItemWithProduct;
    } catch (e: any) {
      console.error('Error adding inventory item:', e);
      Alert.alert('Error', e.message || 'Failed to add inventory item.');
      return null;
    }
  };

  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('inventory_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(), // Ensure updated_at is refreshed
        })
        .eq('id', id)
        .select(`
          *,
          product:products(*)
        `)
        .single();

      if (updateError) throw updateError;

      // Update local state immediately for instant UI update
      setInventoryItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates, ...data } as InventoryItemWithProduct : item
      ));

      // Refresh inventory list to ensure consistency
      await fetchInventory();

      // Always regenerate alert if expiration_date or received_date changed
      // (or if it's a new item with expiration date)
      const shouldRegenerate = updates.expiration_date !== undefined || 
                               updates.received_date !== undefined ||
                               (data && data.expiration_date);

      if (shouldRegenerate && data && restaurantId) {
        try {
          await generateAlertForItem(restaurantId, data.id);
        } catch (error) {
          // Don't fail the operation if alert generation fails
          console.error('Error generating alert:', error);
        }
      }

      return data as InventoryItemWithProduct;
    } catch (e: any) {
      console.error('Error updating inventory item:', e);
      Alert.alert('Error', e.message || 'Failed to update inventory item.');
      return null;
    }
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state immediately for instant UI update
      setInventoryItems(prev => prev.filter(item => item.id !== id));

      // Refresh inventory list to ensure consistency
      await fetchInventory();

      return true;
    } catch (e: any) {
      console.error('Error deleting inventory item:', e);
      Alert.alert('Error', e.message || 'Failed to delete inventory item.');
      return false;
    }
  };

  return {
    inventoryItems,
    loading,
    error,
    refetch: fetchInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
  };
}

export function useInventoryStats(restaurantId: string | null) {
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const twoWeeksFromNow = new Date(today);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

      // Get all active inventory items with product join (same as main list query)
      // This ensures stats match the list - only count items with valid products
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select(`
          quantity,
          unit_cost,
          expiration_date,
          status,
          product:products(id)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching stats:', error);
        throw error;
      }

      // Filter out items where product join failed (product was deleted)
      const validItems = (items || []).filter((item: any) => item.product !== null);

      const stats: InventoryStats = {
        total_items: validItems.length,
        total_value: 0,
        expiring_today: 0,
        expiring_this_week: 0,
        expiring_next_week: 0,
        low_stock_items: 0,
        expired_items: 0,
      };

      validItems.forEach((item: any) => {
        // Calculate total value
        if (item.unit_cost) {
          stats.total_value += (item.quantity || 0) * item.unit_cost;
        }

        // Count expiring items
        if (item.expiration_date) {
          const expDate = new Date(item.expiration_date);
          expDate.setHours(0, 0, 0, 0);

          if (expDate.getTime() === today.getTime()) {
            stats.expiring_today++;
          } else if (expDate <= weekFromNow) {
            stats.expiring_this_week++;
          } else if (expDate <= twoWeeksFromNow) {
            stats.expiring_next_week++;
          }

          if (expDate < today) {
            stats.expired_items++;
          }
        }
      });

      setStats(stats);
    } catch (e: any) {
      console.error('Error fetching inventory stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setStats(null);
      return;
    }

    fetchStats();
  }, [restaurantId]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
}
