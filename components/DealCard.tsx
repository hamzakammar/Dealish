import { Deal } from "@/types/restaurant";
import { supabase } from "@/app/lib/supabase";
import { useThemeColors } from "@/hooks/useThemeColors";
import { calculateSavings } from "@/utils/activity";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DealQRCode from "./DealQRCode";

type DealCardProps = {
  deal: Deal;
  isPartner?: boolean;
};

export default function DealCard({ deal, isPartner = false }: DealCardProps) {
  const colors = useThemeColors();
  const [showQRCode, setShowQRCode] = useState(false);
  const [userVote, setUserVote] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const formatTime = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const timeString = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    // Format "5:00 PM" -> "5PM" or "12:00 AM" -> "12AM"
    return timeString.replace(/:\d{2}\s/, ''); // Remove ":00 " or ":30 " etc.
  };

  const formatTimeFromString = (timeString?: string) => {
    if (!timeString) return null;
    // timeString is in format "HH:MM:SS" or "HH:MM"
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes || 0, 0);
    const formatted = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatted.replace(/:\d{2}\s/, '');
  };

  const getDayNames = (dayNumbers: number[]): string => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sortedDays = [...dayNumbers].sort((a, b) => a - b);
    const names = sortedDays.map(day => dayNames[day]);
    
    // Format ranges like "Mon-Fri" or "Mon, Wed, Fri"
    if (names.length <= 2) {
      return names.join(', ');
    }
    
    // Check if it's a consecutive range
    const isConsecutive = sortedDays.every((day, index) => 
      index === 0 || day === sortedDays[index - 1] + 1
    );
    
    if (isConsecutive && names.length > 2) {
      return `${names[0]}-${names[names.length - 1]}`;
    }
    
    return names.join(', ');
  };

  const isToday = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const formatTimeRange = () => {
    // Handle recurring deals
    if (deal.is_recurring && deal.recurrence_days && deal.recurrence_start_time && deal.recurrence_end_time) {
      const startTime = formatTimeFromString(deal.recurrence_start_time);
      const endTime = formatTimeFromString(deal.recurrence_end_time);
      const dayNames = getDayNames(deal.recurrence_days);
      
      if (startTime && endTime) {
        return `${dayNames} ${startTime} - ${endTime}`;
      }
      return null;
    }
    
    // Handle one-time deals
    if (!deal.start_at && !deal.end_at) return null;
    
    const startTime = deal.start_at ? formatTime(deal.start_at) : null;
    const endTime = deal.end_at ? formatTime(deal.end_at) : null;
    
    // Check if both start and end are today
    const bothToday = deal.start_at && deal.end_at && 
                      isToday(deal.start_at) && isToday(deal.end_at);
    
    if (bothToday) {
      return `Today ${startTime} - ${endTime}`;
    }
    
    // If only start is today, or if we have both but only one is today
    if (deal.start_at && isToday(deal.start_at) && endTime) {
      return `Today ${startTime} - ${endTime}`;
    }
    
    // Otherwise show both times separately or individually
    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    }
    
    if (startTime) {
      return `Starts: ${startTime}`;
    }
    
    if (endTime) {
      return `Ends: ${endTime}`;
    }
    
    return null;
  };

  const getDealStatus = (): 'active' | 'upcoming' | 'expired' => {
    const now = new Date();
    
    // Check overall validity period if set
    if (deal.end_at && new Date(deal.end_at) < now) {
      return 'expired';
    }
    
    if (deal.start_at && new Date(deal.start_at) > now) {
      return 'upcoming';
    }
    
    // For recurring deals, check if it's active right now
    if (deal.is_recurring) {
      if (!deal.recurrence_days || !deal.recurrence_start_time || !deal.recurrence_end_time) {
        return 'active'; // If recurring but missing fields, assume active
      }
      
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().slice(0, 8);
      
      // Check if today is in recurrence days
      if (!deal.recurrence_days.includes(currentDay)) {
        return 'upcoming'; // Not today, but might be active on another day
      }
      
      // Check if current time is within range
      if (currentTime < deal.recurrence_start_time) {
        return 'upcoming'; // Will be active later today
      }
      
      if (currentTime > deal.recurrence_end_time) {
        return 'upcoming'; // Was active earlier today, will be active again on next occurrence
      }
      
      return 'active';
    }
    
    // For one-time deals
    if (deal.end_at && new Date(deal.end_at) < now) {
      return 'expired';
    }
    
    if (deal.start_at && new Date(deal.start_at) > now) {
      return 'upcoming';
    }
    
    // Otherwise, deal is active
    return 'active';
  };

  const dealStatus = getDealStatus();

  // Format discount label for display
  const getDiscountLabel = (): string | null => {
    if (!deal.discount_type) return null;
    switch (deal.discount_type) {
      case 'percent':
        return deal.discount_value ? `${deal.discount_value}% OFF` : null;
      case 'fixed':
        return deal.discount_value ? `$${deal.discount_value} OFF` : null;
      case 'bogo':
        return 'BOGO';
      default:
        return null;
    }
  };

  const savings = deal.savings_amount ?? calculateSavings(deal);
  const discountLabel = getDiscountLabel();

  const handleFlag = async (type: 'thumbs_up' | 'thumbs_down') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert(
        'Sign in required',
        'Create a free account to flag deals.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/auth' as any) },
        ]
      );
      return;
    }

    const previousVote = userVote;
    setUserVote(type); // optimistic update
    setIsSubmittingVote(true);

    try {
      const { error } = await supabase
        .from('deal_flags')
        .upsert(
          { deal_id: deal.id, user_id: user.id, type },
          { onConflict: 'deal_id,user_id' }
        );
      if (error) throw error;
    } catch {
      setUserVote(previousVote); // rollback on error
    } finally {
      setIsSubmittingVote(false);
    }
  };

  return (
    <>
      <View style={[styles.dealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.dealHeader}>
        <Text style={[styles.dealTitle, { color: colors.text }]} numberOfLines={2}>{deal.title}</Text>
        {dealStatus === 'expired' && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredText}>Expired</Text>
          </View>
        )}
        {dealStatus === 'upcoming' && (
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingText}>Coming Soon</Text>
          </View>
        )}
      </View>

      {/* Auto-detected (scraped) deals are unverified by the restaurant */}
      {deal.source === 'scraped' && (
        <View style={styles.unverifiedRow}>
          <Ionicons name="sparkles-outline" size={12} color="#92400E" />
          <Text style={styles.unverifiedText}>Auto-detected · not yet verified by the restaurant</Text>
        </View>
      )}

      {/* Discount badge */}
      {discountLabel && (
        <View style={styles.discountRow}>
          <View style={styles.discountBadge}>
            <Ionicons name="pricetag" size={12} color="#FE902A" />
            <Text style={styles.discountBadgeText}>{discountLabel}</Text>
          </View>
          {typeof savings === 'number' && savings > 0 && (
            <Text style={styles.savingsText}>Save ${savings.toFixed(2)}</Text>
          )}
        </View>
      )}

      {deal.description && (
        <Text style={[styles.dealDescription, { color: colors.textSecondary }]} numberOfLines={4}>{deal.description}</Text>
      )}

      {deal.tags && deal.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {deal.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {formatTimeRange() && (
        <View style={styles.dateContainer}>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatTimeRange()}
            </Text>
          </View>
        </View>
      )}

      {/* Deal accuracy buttons — only for non-partner venues */}
      {!isPartner && (
        <View style={styles.accuracyRow}>
          <Text style={[styles.accuracyLabel, { color: colors.textSecondary }]}>
            Is this deal accurate?
          </Text>
          <TouchableOpacity
            testID={userVote === 'thumbs_up' ? 'thumbs-up-button-active' : 'thumbs-up-button'}
            style={[
              styles.accuracyButton,
              userVote === 'thumbs_up' && styles.accuracyButtonActiveUp,
            ]}
            onPress={() => handleFlag('thumbs_up')}
            disabled={isSubmittingVote}
            accessibilityLabel="Mark deal as accurate"
          >
            <Ionicons
              name={userVote === 'thumbs_up' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={userVote === 'thumbs_up' ? '#22C55E' : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID={userVote === 'thumbs_down' ? 'thumbs-down-button-active' : 'thumbs-down-button'}
            style={[
              styles.accuracyButton,
              userVote === 'thumbs_down' && styles.accuracyButtonActiveDown,
            ]}
            onPress={() => handleFlag('thumbs_down')}
            disabled={isSubmittingVote}
            accessibilityLabel="Mark deal as inaccurate"
          >
            <Ionicons
              name={userVote === 'thumbs_down' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color={userVote === 'thumbs_down' ? '#EF4444' : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* QR Code Button - Users can show QR codes for restaurants to scan */}
      <TouchableOpacity
        testID="show-qr-button"
        accessibilityLabel="Show QR Code"
        style={styles.qrButton}
        onPress={() => setShowQRCode(true)}
      >
        <Ionicons name="qr-code-outline" size={18} color="#FE902A" />
        <Text style={styles.qrButtonText}>Show QR Code</Text>
      </TouchableOpacity>
    </View>

    <DealQRCode
      deal={deal}
      visible={showQRCode}
      onClose={() => setShowQRCode(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  dealCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  expiredBadge: {
    backgroundColor: "#ffebee",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expiredText: {
    color: "#c62828",
    fontSize: 10,
    fontWeight: "600",
  },
  upcomingBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  upcomingText: {
    color: "#1976d2",
    fontSize: 10,
    fontWeight: "600",
  },
  unverifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  unverifiedText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  discountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5EC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  discountBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FE902A",
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
  },
  dealDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 6,
  },
  tag: {
    backgroundColor: "#FE902A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  dateContainer: {
    marginTop: 4,
    gap: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  accuracyLabel: {
    fontSize: 12,
    flex: 1,
  },
  accuracyButton: {
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  accuracyButtonActiveUp: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  accuracyButtonActiveDown: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FFF5EB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FE902A",
    gap: 6,
  },
  qrButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FE902A",
  },
});
