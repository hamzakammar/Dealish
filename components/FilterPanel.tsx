import { FilterState } from "@/types/filters";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import Slider from "@react-native-community/slider";
import React, { useEffect, useMemo } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type FilterPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  restaurants: Restaurant[];
  activeFilterCount: number;
  planTime?: Date | null;
  onChangePlanTime?: (t: Date | null) => void;
};

const PLAN_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}
function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onClearFilters,
  restaurants,
  activeFilterCount,
  planTime = null,
  onChangePlanTime,
}: FilterPanelProps) {
  const colors = useThemeColors();
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = screenWidth * 0.85;
  const slideAnim = React.useRef(new Animated.Value(-panelWidth)).current;

  const dynamicStyles = useMemo(() => StyleSheet.create({
    panel: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: colors.isDark ? colors.card : "#F5E6D3",
      zIndex: 7,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.isDark ? colors.cardSecondary : "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxLabel: {
      fontSize: 16,
      color: colors.text,
    },
    toggleLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
      marginBottom: 4,
    },
    toggleDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    sliderValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    sliderContainer: {
      paddingHorizontal: 4,
    },
    sliderLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    sliderLabel: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    typeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.isDark ? colors.cardSecondary : "#fff",
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
      marginBottom: 8,
    },
    typeChipActive: {
      backgroundColor: "#FE902A",
      borderColor: "#FE902A",
    },
    typeChipText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    typeChipTextActive: {
      color: "#fff",
      fontWeight: "600",
    },
  }), [colors]);

  // Get unique restaurant types from database
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    restaurants.forEach((r) => {
      if (r.type) {
        types.add(r.type);
      }
    });
    return Array.from(types).sort();
  }, [restaurants]);


  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -panelWidth,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen, panelWidth, slideAnim]);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    updateFilter("types", newTypes);
  };

  const formatRating = (rating: number | null) => {
    if (rating === null || rating === 0) return "Any";
    return `${rating.toFixed(1)}+ stars`;
  };

  const formatDistance = (distance: number | null) => {
    if (distance === null || distance === 0) return "Any";
    return `${distance} km`;
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={0}
        />
      )}

      {/* Slide Panel */}
      <Animated.View
        style={[
          dynamicStyles.panel,
          {
            width: panelWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={dynamicStyles.header}>
          <View style={styles.headerContent}>
            <Text style={dynamicStyles.title}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <AntDesign name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Planning for (time-travel deal availability) */}
          {onChangePlanTime && (
            <View style={styles.section}>
              <Text style={dynamicStyles.sectionTitle}>Planning for</Text>
              <Text style={dynamicStyles.toggleDescription}>
                {planTime
                  ? `Showing deals available ${dayLabel(planTime, new Date())} at ${hourLabel(planTime.getHours())}`
                  : "Showing deals available now"}
              </Text>

              {/* Day chips (next 7 days) */}
              <View style={[styles.chipContainer, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={[dynamicStyles.typeChip, !planTime && dynamicStyles.typeChipActive]}
                  onPress={() => onChangePlanTime(null)}
                >
                  <Text style={[dynamicStyles.typeChipText, !planTime && dynamicStyles.typeChipTextActive]}>Now</Text>
                </TouchableOpacity>
                {Array.from({ length: 7 }).map((_, i) => {
                  const today = new Date();
                  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
                  const selected = !!planTime &&
                    planTime.getFullYear() === d.getFullYear() &&
                    planTime.getMonth() === d.getMonth() &&
                    planTime.getDate() === d.getDate();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[dynamicStyles.typeChip, selected && dynamicStyles.typeChipActive]}
                      onPress={() => {
                        const hour = planTime ? planTime.getHours() : 18;
                        onChangePlanTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0));
                      }}
                    >
                      <Text style={[dynamicStyles.typeChipText, selected && dynamicStyles.typeChipTextActive]}>
                        {dayLabel(d, today)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Hour chips */}
              <View style={[styles.chipContainer, { marginTop: 4 }]}>
                {PLAN_HOURS.map((h) => {
                  const selected = !!planTime && planTime.getHours() === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[dynamicStyles.typeChip, selected && dynamicStyles.typeChipActive]}
                      onPress={() => {
                        // If no day selected, default to current day
                        const base = planTime ?? new Date();
                        // Create new date preserving the selected day/month/year
                        const newDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0);
                        onChangePlanTime(newDate);
                      }}
                    >
                      <Text style={[dynamicStyles.typeChipText, selected && dynamicStyles.typeChipTextActive]}>
                        {hourLabel(h)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Rating Filter - Slider */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Minimum Rating</Text>
            <Text style={dynamicStyles.sliderValue}>
              {formatRating(filters.minRating)}
            </Text>
            <View style={dynamicStyles.sliderContainer}>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={5}
                step={0.5}
                value={filters.minRating ?? 0}
                onValueChange={(value) => updateFilter("minRating", value === 0 ? null : value)}
                minimumTrackTintColor="#FE902A"
                maximumTrackTintColor={colors.isDark ? "#444" : "#ddd"}
                thumbTintColor="#FE902A"
              />
              <View style={dynamicStyles.sliderLabels}>
                <Text style={dynamicStyles.sliderLabel}>Any</Text>
                <Text style={dynamicStyles.sliderLabel}>2.5</Text>
                <Text style={dynamicStyles.sliderLabel}>5.0</Text>
              </View>
            </View>
          </View>

          {/* Distance Filter - Slider */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Maximum Distance</Text>
            <Text style={dynamicStyles.sliderValue}>
              {formatDistance(filters.maxDistance)}
            </Text>
            <View style={dynamicStyles.sliderContainer}>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={0}
                maximumValue={50}
                step={1}
                value={filters.maxDistance ?? 0}
                onValueChange={(value) => updateFilter("maxDistance", value === 0 ? null : value)}
                minimumTrackTintColor="#FE902A"
                maximumTrackTintColor={colors.isDark ? "#444" : "#ddd"}
                thumbTintColor="#FE902A"
              />
              <View style={dynamicStyles.sliderLabels}>
                <Text style={dynamicStyles.sliderLabel}>Any</Text>
                <Text style={dynamicStyles.sliderLabel}>25 km</Text>
                <Text style={dynamicStyles.sliderLabel}>50 km</Text>
              </View>
            </View>
          </View>

          {/* Type Filter - Chips from DB */}
          {availableTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={dynamicStyles.sectionTitle}>Cuisine Type</Text>
              <View style={styles.chipContainer}>
                {availableTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      dynamicStyles.typeChip,
                      filters.types.includes(type) && dynamicStyles.typeChipActive,
                    ]}
                    onPress={() => toggleType(type)}
                  >
                    <Text
                      style={[
                        dynamicStyles.typeChipText,
                        filters.types.includes(type) && dynamicStyles.typeChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Partner Only Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={dynamicStyles.toggleLabel}>Partner Restaurants Only</Text>
                <Text style={dynamicStyles.toggleDescription}>
                  Show only restaurants partnered with Dealish
                </Text>
              </View>
              <Switch
                value={filters.partnerOnly}
                onValueChange={(val) => updateFilter("partnerOnly", val)}
                trackColor={{ false: "#e0e0e0", true: "#FE902A" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Has Deals Only Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={dynamicStyles.toggleLabel}>Active Deals Only</Text>
                <Text style={dynamicStyles.toggleDescription}>
                  Show only restaurants with active deals
                </Text>
              </View>
              <Switch
                value={filters.hasDealsOnly}
                onValueChange={(val) => updateFilter("hasDealsOnly", val)}
                trackColor={{ false: "#e0e0e0", true: "#FE902A" }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={dynamicStyles.footer}>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearFilters}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 6,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    backgroundColor: "#FE902A",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FE902A",
  },
  clearButtonText: {
    color: "#FE902A",
    fontSize: 16,
    fontWeight: "600",
  },
  applyButton: {
    paddingVertical: 16,
    backgroundColor: "#FE902A",
    borderRadius: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
