import { Deal } from "@/types/restaurant";
import { supabase } from "@/app/lib/supabase";
import { useThemeColors } from "@/hooks/useThemeColors";
import { calculateSavings } from "@/utils/activity";
import { isRecurringDealActive } from "@/utils/dealActivity";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DealQRCode from "./DealQRCode";

type DealCardProps = {
  deal: Deal;
  isPartner?: boolean;
};

/**
 * Determines the urgency status of a deal for badge display.
 * - "active_now": The deal is currently active
 * - "starts_soon": The deal starts within 1 hour
 * - "today": The deal is active today but not right now
 * - "expired": The deal has ended
 * - null: No specific urgency (e.g., future deal on a different day)
 */
type UrgencyStatus = 'active_now' | 'starts_soon' | 'today' | 'expired' | null;

function getUrgencyStatus(deal: Deal): UrgencyStatus {
  const now = new Date();

  // Check if expired (one-time deals only)
  if (deal.end_at && new Date(deal.end_at) < now) {
    return 'expired';
  }

  // Handle recurring deals using isRecurringDealActive
  if (deal.is_recurring && deal.recurrence_days?.length) {
    // Check if active right now (no lookahead)
    const activeNow = isRecurringDealActive(deal, now, false);
    if (activeNow) return 'active_now';

    // Check if active with lookahead (starts within 1 hour)
    const activeWithLookahead = isRecurringDealActive(deal, now, true);
    if (activeWithLookahead) return 'starts_soon';

    // Check if today is in recurrence days (active today but not right now)
    const currentDay = now.getDay();
    if (deal.recurrence_days.includes(currentDay)) {
      return 'today';
    }

    return null;
  }

  // Handle one-time deals
  if (deal.start_at) {
    const startDate = new Date(deal.start_at);
    const diffMs = startDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      // Already started and not expired
      return 'active_now';
    }

    if (diffMs <= 60 * 60 * 1000) {
      return 'starts_soon';
    }

    // Check if it's today
    const startDay = startDate.toDateString();
    const todayStr = now.toDateString();
    if (startDay === todayStr) {
      return 'today';
    }

    return null;
  }

  // No time constraints — assume active
  return 'active_now';
}

export default function DealCard({ deal, isPartner = false }: DealCardProps) {
  const colors = useThemeColors();
  const [showQRCode, setShowQRCode] = useState(false);
  const [userVote, setUserVote] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const urgencyStatus = useMemo(() => getUrgencyStatus(deal), [deal]);

  /**
   * Formats a time string "HH:MM:SS" or "HH:MM" into display format like "3:00 PM"
   */
  const formatTimeFromString = (timeString?: string): string | null => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes || 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  /**
   * Formats a date string into a display time like "3:00 PM"
   */
  const formatTime = (dateString?: string): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDayNames = (dayNumbers: number[]): string => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sortedDays = [...dayNumbers].sort((a, b) => a - b);
    const names = sortedDays.map(day => dayNames[day]);

    if (names.length <= 2) {
      return names.join(', ');
    }

    const isConsecutive = sortedDays.every((day, index) =>
      index === 0 || day === sortedDays[index - 1] + 1
    );

    if (isConsecutive && names.length > 2) {
      return `${names[0]}–${names[names.length - 1]}`;
    }

    return names.join(', ');
  };

  /**
   * Returns the time window string, e.g. "3:00 PM – 6:00 PM"
   */
  const getTimeWindow = (): string | null => {
    if (deal.is_recurring && deal.recurrence_start_time && deal.recurrence_end_time) {
      const start = formatTimeFromString(deal.recurrence_start_time);
      const end = formatTimeFromString(deal.recurrence_end_time);
      if (start && end) return `${start} – ${end}`;
      return null;
    }

    if (deal.start_at || deal.end_at) {
      const start = formatTime(deal.start_at);
      const end = formatTime(deal.end_at);
      if (start && end) return `${start} – ${end}`;
      if (start) return `Starts ${start}`;
      if (end) return `Until ${end}`;
    }

    return null;
  };

  /**
   * Returns the days string for recurring deals
   */
  const getDaysLabel = (): string | null => {
    if (deal.is_recurring && deal.recurrence_days && deal.recurrence_days.length > 0) {
      return getDayNames(deal.recurrence_days);
    }
    return null;
  };

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
  const timeWindow = getTimeWindow();
  const daysLabel = getDaysLabel();

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

  const renderUrgencyBadge = () => {
    switch (urgencyStatus) {
      case 'active_now':
        return (
          <View style={[styles.urgencyBadge, styles.urgencyBadgeActive]}>
            <View style={styles.urgencyDot} />
            <Text style={styles.urgencyBadgeActiveText}>Active Now</Text>
          </View>
        );
      case 'starts_soon':
        return (
          <View style={[styles.urgencyBadge, styles.urgencyBadgeSoon]}>
            <Text style={styles.urgencyBadgeSoonText}>Starts Soon</Text>
          </View>
        );
      case 'today':
        return (
          <View style={[styles.urgencyBadge, styles.urgencyBadgeToday]}>
            <Text style={styles.urgencyBadgeTodayText}>Today</Text>
          </View>
        );
      case 'expired':
        return (
          <View style={[styles.urgencyBadge, styles.urgencyBadgeExpired]}>
            <Text style={styles.urgencyBadgeExpiredText}>Expired</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <View style={[styles.dealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header row: title + urgency badge */}
        <View style={styles.dealHeader}>
          <Text style={[styles.dealTitle, { color: colors.text }]} numberOfLines={2}>
            {deal.title}
          </Text>
          {renderUrgencyBadge()}
        </View>

        {/* Time window display */}
        {timeWindow && (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
              {daysLabel ? `${daysLabel} · ${timeWindow}` : timeWindow}
            </Text>
          </View>
        )}

        {/* Prominent discount chip */}
        {discountLabel && (
          <View style={styles.discountRow}>
            <View style={[styles.discountChip, { backgroundColor: colors.isDark ? 'rgba(254, 144, 42, 0.15)' : '#FFF0E5' }]}>
              <Ionicons name="pricetag" size={14} color="#FE902A" />
              <Text style={styles.discountChipText}>{discountLabel}</Text>
            </View>
            {typeof savings === 'number' && savings > 0 && (
              <Text style={styles.savingsText}>Save ${savings.toFixed(2)}</Text>
            )}
          </View>
        )}

        {/* Auto-detected (scraped) deals are unverified by the restaurant */}
        {deal.source === 'scraped' && (
          <View style={styles.unverifiedRow}>
            <Ionicons name="sparkles-outline" size={12} color="#92400E" />
            <Text style={styles.unverifiedText}>Auto-detected · not yet verified by the restaurant</Text>
          </View>
        )}

        {/* Description */}
        {deal.description && (
          <Text style={[styles.dealDescription, { color: colors.textSecondary }]} numberOfLines={4}>
            {deal.description}
          </Text>
        )}

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {deal.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  /* Urgency badges */
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  urgencyBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  urgencyBadgeActiveText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  urgencyBadgeSoon: {
    backgroundColor: '#FFF7ED',
  },
  urgencyBadgeSoonText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '700',
  },
  urgencyBadgeToday: {
    backgroundColor: '#DBEAFE',
  },
  urgencyBadgeTodayText: {
    color: '#1E40AF',
    fontSize: 11,
    fontWeight: '700',
  },
  urgencyBadgeExpired: {
    backgroundColor: '#FEE2E2',
  },
  urgencyBadgeExpiredText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  /* Time window */
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '400',
  },
  /* Discount chip — prominent */
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  discountChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0E5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  discountChipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FE902A",
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
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
  dealDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 10,
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
