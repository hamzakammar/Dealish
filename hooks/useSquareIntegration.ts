import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SQUARE_APP_ID = process.env.EXPO_PUBLIC_SQUARE_APPLICATION_ID || '';
const SQUARE_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/square-oauth-redirect`;

const SQUARE_SCOPES = [
  'ITEMS_READ',
  'ORDERS_READ',
  'MERCHANT_PROFILE_READ',
  'INVENTORY_READ',
].join('+');

export type SquareConnection = {
  id: string;
  restaurant_id: string;
  merchant_id: string;
  location_ids: string[];
  is_active: boolean;
  token_expiry: string;
  updated_at: string;
};

export type SquareOrder = {
  id: string;
  square_order_id: string;
  deal_id: string | null;
  total_cents: number;
  discount_cents: number;
  net_cents: number;
  item_count: number;
  line_items: any[];
  order_created_at: string;
};

export function useSquareIntegration(restaurantId: string | undefined) {
  const { session } = useAuthContext();
  const [connection, setConnection] = useState<SquareConnection | null>(null);
  const [recentOrders, setRecentOrders] = useState<SquareOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('square_oauth_tokens')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .maybeSingle();
    setConnection(data);
    setLoading(false);
  }, [restaurantId]);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('square_orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('order_created_at', { ascending: false })
      .limit(20);
    setRecentOrders(data || []);
  }, [restaurantId]);

  useEffect(() => {
    fetchConnection();
    fetchOrders();
  }, [fetchConnection, fetchOrders]);

  const connect = useCallback(async () => {
    if (!restaurantId || !SQUARE_APP_ID) return;

    const state = `${restaurantId}`;
    const authUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${SQUARE_SCOPES}&session=false&state=${state}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'dealish://oauth-square');

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (code && session?.access_token) {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/square-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, restaurant_id: restaurantId }),
        });

        if (resp.ok) {
          await fetchConnection();
          await triggerSync();
        }
        return resp.ok;
      }
    }
    return false;
  }, [restaurantId, session]);

  const disconnect = useCallback(async () => {
    if (!restaurantId) return;
    await supabase
      .from('square_oauth_tokens')
      .update({ is_active: false })
      .eq('restaurant_id', restaurantId);
    setConnection(null);
  }, [restaurantId]);

  const triggerSync = useCallback(async () => {
    if (!restaurantId || !session?.access_token) return;
    setSyncing(true);
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/square-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ restaurant_id: restaurantId }),
      });
      await fetchOrders();
    } finally {
      setSyncing(false);
    }
  }, [restaurantId, session]);

  const stats = {
    totalOrders: recentOrders.length,
    totalRevenue: recentOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0),
    dealishOrders: recentOrders.filter((o) => o.deal_id).length,
    dealishRevenue: recentOrders.filter((o) => o.deal_id).reduce((sum, o) => sum + (o.total_cents || 0), 0),
    totalDiscounts: recentOrders.reduce((sum, o) => sum + (o.discount_cents || 0), 0),
  };

  return {
    connection,
    recentOrders,
    stats,
    loading,
    syncing,
    connect,
    disconnect,
    triggerSync,
    refetch: fetchConnection,
  };
}
