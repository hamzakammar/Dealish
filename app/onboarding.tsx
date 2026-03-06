import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import { useThemeColors } from "@/hooks/useThemeColors";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type OnboardingStep = "welcome" | "name" | "location" | "complete";

// Common cities list for autocomplete
const COMMON_CITIES = [
  "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Winnipeg", "Quebec City",
  "Hamilton", "Kitchener", "London", "Victoria", "Halifax", "Oshawa", "Windsor", "Saskatoon",
  "Regina", "Sherbrooke", "St. John's", "Barrie", "Kelowna", "Abbotsford", "Sudbury", "Kingston",
  "Saguenay", "Trois-Rivières", "Guelph", "Cambridge", "Thunder Bay", "Saint John", "Moncton",
  "Brantford", "Saint-Jean-sur-Richelieu", "Peterborough", "Red Deer", "Lethbridge", "Nanaimo",
  "Kamloops", "Belleville", "Chilliwack", "Fredericton", "Charlottetown", "Grande Prairie",
  "Medicine Hat", "Airdrie", "Spruce Grove", "Vernon", "Penticton", "Newmarket", "Sarnia",
  "Fort McMurray", "Prince George", "Sault Ste. Marie", "Chatham", "Orillia", "Cornwall",
  "Lloydminster", "Brandon", "Whitehorse", "Yellowknife", "Iqaluit"
];

export default function OnboardingScreen() {
  const { session, refetchProfile } = useAuthContext();
  const colors = useThemeColors();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
      textAlign: "center",
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 8,
      paddingHorizontal: 20,
      lineHeight: 24,
    },
    subDescription: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: "center",
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    stepDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 32,
    },
    input: {
      width: "100%",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "#FE902A",
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    suggestionsContainer: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
      maxHeight: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 1000,
    },
    suggestionItem: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      fontSize: 16,
      color: colors.text,
    },
    skipButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  }), [colors]);

  // Move useMemo OUTSIDE of renderStep to avoid conditional hook call
  // This hook MUST be called unconditionally on every render
  const citySuggestions = useMemo(() => {
    if (!location.trim()) return [];
    const query = location.toLowerCase().trim();
    return COMMON_CITIES
      .filter(city => city.toLowerCase().startsWith(query))
      .slice(0, 5);
  }, [location]);

  const handleNext = () => {
    if (currentStep === "welcome") {
      setCurrentStep("name");
    } else if (currentStep === "name") {
      if (!name.trim()) {
        Alert.alert("Required", "Please enter your name");
        return;
      }
      setCurrentStep("location");
    } else if (currentStep === "location") {
      if (!location.trim()) {
        Alert.alert("Required", "Please enter your location");
        return;
      }
      handleComplete();
    }
  };

  const handleSkip = async () => {
    // Mark onboarding as complete so it never shows again on this device
    await AsyncStorage.setItem("hasCompletedOnboarding", "true");
    
    // Check role before redirecting
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      
      try {
        if (profile?.role === 'owner' || profile?.role === 'admin') {
          router.replace("/admin");
        } else {
          router.replace("/map");
        }
      } catch (error) {
        console.error("Navigation error:", error);
        router.replace("/map");
      }
    } else {
      router.replace("/map");
    }
  };

  const handleComplete = async () => {
    if (!session?.user?.id) {
      Alert.alert("Error", "You must be logged in to complete setup");
      return;
    }

    setSaving(true);

    try {
      const updateData: { display_name: string; location: string } = {
        display_name: name.trim(),
        location: location.trim(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", session.user.id);

      if (error) {
        console.error("Error updating profile:", error);
        Alert.alert("Error", "Failed to save profile. Please try again.");
        setSaving(false);
        return;
      }

      // Mark onboarding as complete so it never shows again on this device
      await AsyncStorage.setItem("hasCompletedOnboarding", "true");

      // Refresh profile to get updated role
      await refetchProfile();
      
      // Show completion step briefly, then navigate
      setCurrentStep("complete");
      setTimeout(() => {
        try {
          // Let index.tsx handle routing based on profile role
          router.replace("/map");
        } catch (error) {
          console.error("Navigation error:", error);
          router.replace("/map");
        }
      }, 800);
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <AntDesign name="user" size={64} color="#FE902A" />
            </View>
            <Text style={dynamicStyles.title}>Welcome to Dealish!</Text>
            <Text style={dynamicStyles.description}>
              Let's set up your profile to get the most out of your deals
              experience.
            </Text>
            <Text style={dynamicStyles.subDescription}>
              This will only take a minute.
            </Text>
          </View>
        );

      case "name":
        return (
          <View style={styles.stepContainer}>
            <Text style={dynamicStyles.stepTitle}>What's your name?</Text>
            <Text style={dynamicStyles.stepDescription}>
              This will be displayed on your profile
            </Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Enter your name"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
            />
          </View>
        );

      case "location":
        return (
          <View style={styles.stepContainer}>
            <Text style={dynamicStyles.stepTitle}>Where are you located?</Text>
            <Text style={dynamicStyles.stepDescription}>
              Help us show you deals near you
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={dynamicStyles.input}
                placeholder="Enter your city or area"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  setShowCitySuggestions(text.length > 0);
                }}
                onFocus={() => setShowCitySuggestions(location.length > 0)}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                autoFocus
                autoCapitalize="words"
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <View style={dynamicStyles.suggestionsContainer}>
                  <FlatList
                    data={citySuggestions}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={dynamicStyles.suggestionItem}
                        onPress={() => {
                          setLocation(item);
                          setShowCitySuggestions(false);
                        }}
                      >
                        <Text style={dynamicStyles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>
          </View>
        );

      case "complete":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <AntDesign name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={dynamicStyles.title}>All set!</Text>
            <Text style={dynamicStyles.description}>
              Your profile has been set up successfully.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={dynamicStyles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {renderStep()}

      {currentStep !== "complete" && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleNext}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {currentStep === "welcome"
                  ? "Get Started"
                  : currentStep === "name"
                  ? "Continue"
                  : "Complete"}
              </Text>
            )}
          </TouchableOpacity>

          {currentStep === "welcome" && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={saving}
            >
              <Text style={dynamicStyles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  stepContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    width: "100%",
    position: "relative",
  },
  buttonContainer: {
    width: "100%",
    marginTop: 40,
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#FE902A",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
