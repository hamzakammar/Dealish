import { useTheme } from "@react-navigation/native";
import { DarkTheme } from "@react-navigation/native";

export function useThemeColors() {
  const theme = useTheme();
  const isDark = theme.colors.background === DarkTheme.colors.background;

  return {
    isDark,
    background: theme.colors.background,
    text: theme.colors.text,
    border: isDark ? "#333" : "#e0e0e0",
    card: isDark ? "#1a1a1a" : "#fff",
    cardSecondary: isDark ? "#2a2a2a" : "#f5f5f5",
    textSecondary: isDark ? "#999" : "#666",
    textTertiary: isDark ? "#666" : "#999",
    inputBackground: isDark ? "#2a2a2a" : "#fff",
    inputBorder: isDark ? "#444" : "#e0e0e0",
    overlay: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)",
    shadow: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)",
    primary: "#FE902A",
    primaryLight: "#FFF5EB",
    error: "#ff4444",
    success: "#4CAF50",
  };
}
