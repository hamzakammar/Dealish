import { Deal } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type DealCardProps = {
  deal: Deal;
};

export default function DealCard({ deal }: DealCardProps) {
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

  return (
    <View style={styles.dealCard}>
      <View style={styles.dealHeader}>
        <Text style={styles.dealTitle}>{deal.title}</Text>
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

      {deal.description && (
        <Text style={styles.dealDescription}>{deal.description}</Text>
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
            <Ionicons name="time-outline" size={12} color="#666" />
            <Text style={styles.dateText}>
              {formatTimeRange()}
            </Text>
          </View>
        </View>
      )}
    </View>
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
});