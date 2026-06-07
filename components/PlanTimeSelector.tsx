import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

type PlanTimeSelectorProps = {
  planTime: Date | null;
  onChangePlanTime: (t: Date | null) => void;
};

const PLAN_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return \`\${hr}\${ampm}\`;
}

function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function PlanTimeSelector({ planTime, onChangePlanTime }: PlanTimeSelectorProps) {
  const colors = useThemeColors();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.isDark ? colors.cardSecondary : "#fff",
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    chipActive: {
      backgroundColor: "#FE902A",
      borderColor: "#FE902A",
    },
    chipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    chipTextActive: {
      color: "#fff",
      fontWeight: "600",
    }
  }), [colors]);

  const today = new Date();

  return (
    <View style={styles.container}>
      {/* Days Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[dynamicStyles.chip, !planTime && dynamicStyles.chipActive]}
          onPress={() => onChangePlanTime(null)}
        >
          <Text style={[dynamicStyles.chipText, !planTime && dynamicStyles.chipTextActive]}>Now</Text>
        </TouchableOpacity>
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
          const selected = !!planTime &&
            planTime.getFullYear() === d.getFullYear() &&
            planTime.getMonth() === d.getMonth() &&
            planTime.getDate() === d.getDate();
          return (
            <TouchableOpacity
              key={i}
              style={[dynamicStyles.chip, selected && dynamicStyles.chipActive]}
              onPress={() => {
                const hour = planTime ? planTime.getHours() : 18;
                onChangePlanTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0));
              }}
            >
              <Text style={[dynamicStyles.chipText, selected && dynamicStyles.chipTextActive]}>
                {dayLabel(d, today)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Hours Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { marginTop: 8 }]}>
        {PLAN_HOURS.map((h) => {
          const selected = !!planTime && planTime.getHours() === h;
          return (
            <TouchableOpacity
              key={h}
              style={[dynamicStyles.chip, selected && dynamicStyles.chipActive]}
              onPress={() => {
                const base = planTime ?? new Date();
                onChangePlanTime(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0));
              }}
            >
              <Text style={[dynamicStyles.chipText, selected && dynamicStyles.chipTextActive]}>
                {hourLabel(h)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
});
