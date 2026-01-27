import { supabase } from '@/app/lib/supabase';

export type NotificationType = 'new_deal' | 'deal_redeemed' | 'new_partner';

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    deal_id?: string;
    restaurant_id?: string;
    screen?: string;
    [key: string]: any;
  };
};

/**
 * Send push notification via Supabase Edge Function
 * This function calls the Edge Function which handles sending via Expo Push Service
 */
export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling push notification function:', error);
    return false;
  }
}

/**
 * Send notifications to multiple users
 */
export async function sendBulkPushNotifications(
  userIds: string[],
  payload: NotificationPayload
): Promise<number> {
  let successCount = 0;
  
  // Send notifications in parallel (but limit concurrency)
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(userId => sendPushNotification(userId, payload))
    );
    successCount += results.filter(r => r.status === 'fulfilled' && r.value).length;
  }

  return successCount;
}

/**
 * Get users who should receive notifications for a specific event
 * Checks user settings to respect notification preferences
 */
export async function getNotificationRecipients(
  type: NotificationType,
  restaurantId?: string
): Promise<string[]> {
  try {
    let query = supabase
      .from('profiles')
      .select('id, push_token, settings, favourites')
      .not('push_token', 'is', null);

    // For new deal notifications, only send to users who favorited the restaurant
    if (type === 'new_deal' && restaurantId) {
      query = query.contains('favourites', [restaurantId]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notification recipients:', error);
      return [];
    }

    if (!data) return [];

    // Filter by user settings
    return data
      .filter(profile => {
        const settings = profile.settings || {};
        const notifications = settings.notifications || {};

        switch (type) {
          case 'new_deal':
            return notifications.favorites !== false; // Default to true if not set
          case 'deal_redeemed':
            return notifications.visits !== false;
          case 'new_partner':
            return notifications.deals !== false;
          default:
            return true;
        }
      })
      .map(profile => profile.id);
  } catch (error) {
    console.error('Error getting notification recipients:', error);
    return [];
  }
}

/**
 * Notify users about a new deal at a restaurant
 * Call this when a new deal is created (from admin side)
 */
export async function notifyNewDeal(
  dealId: string,
  restaurantId: string,
  dealTitle: string,
  dealDescription?: string
): Promise<void> {
  try {
    // Get restaurant info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      console.error('Restaurant not found for notification');
      return;
    }

    // Get users who favorited this restaurant
    const userIds = await getNotificationRecipients('new_deal', restaurantId);

    if (userIds.length === 0) {
      return; // No recipients
    }

    // Send notifications
    await sendBulkPushNotifications(userIds, {
      type: 'new_deal',
      title: `New Deal at ${restaurant.name}`,
      body: dealTitle + (dealDescription ? ` - ${dealDescription}` : ''),
      data: {
        deal_id: dealId,
        restaurant_id: restaurantId,
        screen: '/map',
      },
    });
  } catch (error) {
    console.error('Error notifying about new deal:', error);
  }
}

/**
 * Notify all users about a new partner restaurant
 * Call this when a restaurant becomes a partner (from admin side)
 */
export async function notifyNewPartner(restaurantId: string): Promise<void> {
  try {
    // Get restaurant info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      console.error('Restaurant not found for notification');
      return;
    }

    // Get all users with notifications enabled
    const userIds = await getNotificationRecipients('new_partner');

    if (userIds.length === 0) {
      return; // No recipients
    }

    // Send notifications
    await sendBulkPushNotifications(userIds, {
      type: 'new_partner',
      title: 'New Partner Restaurant!',
      body: `${restaurant.name} is now a Dealish partner`,
      data: {
        restaurant_id: restaurantId,
        screen: '/map',
      },
    });
  } catch (error) {
    console.error('Error notifying about new partner:', error);
  }
}
