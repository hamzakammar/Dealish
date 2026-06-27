import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

/**
 * Web-only placeholder for the map screen.
 * This prevents the Metro/Vercel bundler from attempting to load
 * react-native-maps (which contains native-only code) for web builds.
 *
 * Mobile users will get the full map experience from app/map.tsx.
 */
export default function MapScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Map Not Available
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          The interactive map is only available in the mobile app.
          Please download the iOS or Android app for the full experience.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
});
