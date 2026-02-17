import { supabase } from "@/app/lib/supabase";
import { Deal } from "@/types/restaurant";

/**
 * Calculate the dollar amount a customer saves when redeeming a deal.
 * Returns the savings amount, or 0 if it can't be calculated.
 */
export function calculateSavings(deal: Pick<Deal, 'discount_type' | 'discount_value' | 'original_price'>): number {
  const { discount_type, discount_value, original_price } = deal;

  if (!discount_type) return 0;

  switch (discount_type) {
    case 'percent': {
      // e.g., 20% off a $15 item = $3 saved
      if (discount_value && original_price) {
        return Math.round((original_price * discount_value / 100) * 100) / 100;
      }
      // If no original price, we can't compute exact savings
      return 0;
    }
    case 'fixed': {
      // e.g., $5 off = $5 saved
      return discount_value || 0;
    }
    case 'bogo': {
      // Buy one get one free = savings equal to the item price
      return original_price || 0;
    }
    default:
      return 0;
  }
}

export async function trackVisit(restaurantId: string, dealId?: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('recents')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return;

    // Check if user has visited this restaurant in the last hour to avoid duplicate visits
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const existingVisit = profile.recents?.find((activity: { restaurant_id?: string; activity_type?: string; created_at?: string }) =>
      activity.restaurant_id === restaurantId &&
      activity.activity_type === 'visit' &&
      activity.created_at && activity.created_at > oneHourAgo
    );

    if (existingVisit) {
      return; // Already visited recently
    }

    // Add new visit to recents array
    const newActivity = {
      restaurant_id: restaurantId,
      activity_type: 'visit',
      deal_id: dealId, // Optional: track which deal was scanned
      created_at: new Date().toISOString(),
    };

    const updatedRecents = [...(profile.recents || []), newActivity];

    // Update profile with new recents
    await supabase
      .from('profiles')
      .update({ recents: updatedRecents })
      .eq('id', user.id);

  } catch (error) {
    console.error('Error tracking visit:', error);
  }
}

export async function trackRedemption(
  restaurantId: string,
  dealDescription: string,
  amountSaved?: number,
  dealId?: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('recents')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return;

    // Add new redemption to recents array
    const newActivity = {
      restaurant_id: restaurantId,
      activity_type: 'redemption' as const,
      deal_id: dealId,
      deal_description: dealDescription,
      amount_saved: amountSaved,
      created_at: new Date().toISOString(),
    };

    const updatedRecents = [...(profile.recents || []), newActivity];

    // Update profile with new recents
    await supabase
      .from('profiles')
      .update({ recents: updatedRecents })
      .eq('id', user.id);

  } catch (error) {
    console.error('Error tracking redemption:', error);
  }
}