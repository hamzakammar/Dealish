import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

type PlanTimeSelectorProps = {
  planTime: Date | null;
  onChangePlanTime: (t: Date | null) => void;
};

type DropdownOption = { label: string; value: string };

function buildDayOptions(): DropdownOption[] {
  const today = new Date();
  const options: DropdownOption[] = [{ label: "Now", value: "now" }];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    options.push({ label, value: d.toISOString().split("T")[0] });
  }
  return options;
}

function buildTimeOptions(): DropdownOption[] {
  const options: DropdownOption[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? "AM" : "PM";
      const hr = h % 12 === 0 ? 12 : h % 12;
      const min = m === 0 ? "00" : "30";
      options.push({
        label: `${hr}:${min} ${ampm}`,
        value: `${h}:${min}`,
      });
    }
  }
  return options;
}

function Dropdown({ label, options, selectedValue, onSelect }: {
  label: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label || label;

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.isDark ? colors.cardSecondary : "#fff", borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    item.value === selectedValue && styles.optionRowActive,
                  ]}
                  onPress={() => { onSelect(item.value); setOpen(false); }}
                >
                  <Text style={[
                    styles.optionText,
                    item.value === selectedValue && styles.optionTextActive,
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === selectedValue && (
                    <Ionicons name="checkmark" size={18} color="#FE902A" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function PlanTimeSelector({ planTime, onChangePlanTime }: PlanTimeSelectorProps) {
  const colors = useThemeColors();
  const dayOptions = useMemo(buildDayOptions, []);
  const timeOptions = useMemo(buildTimeOptions, []);

  const selectedDay = planTime ? planTime.toISOString().split("T")[0] : "now";
  const selectedTime = planTime
    ? `${planTime.getHours()}:${planTime.getMinutes() === 0 ? "00" : "30"}`
    : "18:00";

  const handleDayChange = (value: string) => {
    if (value === "now") {
      onChangePlanTime(null);
      return;
    }
    const [y, m, d] = value.split("-").map(Number);
    const [h, min] = selectedTime.split(":").map(Number);
    onChangePlanTime(new Date(y, m - 1, d, h, min, 0));
  };

  const handleTimeChange = (value: string) => {
    const [h, min] = value.split(":").map(Number);
    const base = planTime ?? new Date();
    onChangePlanTime(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min, 0));
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.dropdownWrapper}>
          <Dropdown
            label="Day"
            options={dayOptions}
            selectedValue={selectedDay}
            onSelect={handleDayChange}
          />
        </View>
        {planTime && (
          <View style={styles.dropdownWrapper}>
            <Dropdown
              label="Time"
              options={timeOptions}
              selectedValue={selectedTime}
              onSelect={handleTimeChange}
            />
          </View>
        )}
        {planTime && (
          <TouchableOpacity
            testID="clear-plan-time"
            accessibilityLabel="Clear time filter"
            style={styles.clearButton}
            onPress={() => onChangePlanTime(null)}
          >
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownWrapper: {
    flex: 1,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    maxHeight: 360,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  optionRowActive: {
    backgroundColor: "#FEF7ED",
  },
  optionText: {
    fontSize: 15,
    color: "#334155",
  },
  optionTextActive: {
    color: "#FE902A",
    fontWeight: "600",
  },
});
