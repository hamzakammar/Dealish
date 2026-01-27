import { FilterState, DISTANCE_OPTIONS, RATING_OPTIONS } from "@/types/filters";
import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
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
};

export default function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onClearFilters,
  restaurants,
  activeFilterCount,
}: FilterPanelProps) {
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = screenWidth * 0.85;
  const slideAnim = React.useRef(new Animated.Value(-panelWidth)).current;

  // Get unique restaurant types
  const availableTypes = React.useMemo(() => {
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
          styles.panel,
          {
            width: panelWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <AntDesign name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Distance Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distance</Text>
            <View style={styles.optionsContainer}>
              {DISTANCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value ?? "all"}
                  style={[
                    styles.optionButton,
                    filters.maxDistance === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => updateFilter("maxDistance", option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      filters.maxDistance === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rating Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minimum Rating</Text>
            <View style={styles.optionsContainer}>
              {RATING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value ?? "any"}
                  style={[
                    styles.optionButton,
                    filters.minRating === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => updateFilter("minRating", option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      filters.minRating === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Type Filter */}
          {availableTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuisine Type</Text>
              <View style={styles.checkboxContainer}>
                {availableTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.checkboxRow}
                    onPress={() => toggleType(type)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        filters.types.includes(type) && styles.checkboxChecked,
                      ]}
                    >
                      {filters.types.includes(type) && (
                        <AntDesign name="check" size={16} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Partner Only Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Partner Restaurants Only</Text>
                <Text style={styles.toggleDescription}>
                  Show only restaurants partnered with Dealish
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  filters.partnerOnly && styles.toggleActive,
                ]}
                onPress={() => updateFilter("partnerOnly", !filters.partnerOnly)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    filters.partnerOnly && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Has Deals Only Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Active Deals Only</Text>
                <Text style={styles.toggleDescription}>
                  Show only restaurants with active deals
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  filters.hasDealsOnly && styles.toggleActive,
                ]}
                onPress={() => updateFilter("hasDealsOnly", !filters.hasDealsOnly)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    filters.hasDealsOnly && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
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
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#F5E6D3",
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
    borderBottomColor: "#e0e0e0",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  optionButtonActive: {
    backgroundColor: "#FE902A",
    borderColor: "#FE902A",
  },
  optionText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#FE902A",
    borderColor: "#FE902A",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
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
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: "#666",
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ccc",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: "#FE902A",
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
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
