import { useTheme } from "@react-navigation/native";
import { DarkTheme } from "@react-navigation/native";
import { useMemo } from "react";

export function useThemeColors() {
  const theme = useTheme();
  
  // Memoize isDark calculation
  const isDark = useMemo(
    () => theme.colors.background === DarkTheme.colors.background,
    [theme.colors.background]
  );

  // CRITICAL: Memoize the entire colors object to prevent cascading re-renders
  // Returning a new object every render causes all consuming components to re-render
  return useMemo(
    () => ({
      isDark,
      background: isDark ? "#1C1C1E" : theme.colors.background,
      text: isDark ? "#F2F2F7" : theme.colors.text,
      border: isDark ? "#3a3a3a" : "#e0e0e0",
      card: isDark ? "#2C2C2E" : "#fff",
      cardSecondary: isDark ? "#3A3A3C" : "#f5f5f5",
      textSecondary: isDark ? "#AEAEB2" : "#666",
      textTertiary: isDark ? "#6C6C70" : "#999",
      inputBackground: isDark ? "#2C2C2E" : "#fff",
      inputBorder: isDark ? "#48484A" : "#e0e0e0",
      overlay: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)",
      shadow: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)",
      primary: "#FE902A",
      primaryLight: "#FFF5EB",
      error: "#ff4444",
      success: "#4CAF50",
    }),
    [isDark, theme.colors.background, theme.colors.text]
  );
}
