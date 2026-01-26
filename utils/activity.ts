import { supabase } from "@/app/lib/supabase";

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
    const existingVisit = profile.recents?.find(activity =>
      activity.restaurant_id === restaurantId &&
      activity.activity_type === 'visit' &&
      activity.created_at > oneHourAgo
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
  amountSaved?: number
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
      activity_type: 'redemption',
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