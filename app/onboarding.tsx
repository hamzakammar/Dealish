import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type OnboardingStep = "welcome" | "name" | "location" | "complete";

export default function OnboardingScreen() {
  const { session, refetchProfile } = useAuthContext();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

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
    // Allow skipping onboarding, but mark that it was skipped
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

      // Refresh profile to get updated role
      await refetchProfile();
      
      // Get updated profile to check role
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      // Show completion step briefly, then navigate based on role
      setCurrentStep("complete");
      setTimeout(() => {
        try {
          if (updatedProfile?.role === 'owner' || updatedProfile?.role === 'admin') {
            router.replace("/admin");
          } else {
            router.replace("/map");
          }
        } catch (error) {
          console.error("Navigation error:", error);
          router.replace("/map");
        }
      }, 1500);
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
            <Text style={styles.title}>Welcome to Dealish!</Text>
            <Text style={styles.description}>
              Let's set up your profile to get the most out of your deals
              experience.
            </Text>
            <Text style={styles.subDescription}>
              This will only take a minute.
            </Text>
          </View>
        );

      case "name":
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepDescription}>
              This will be displayed on your profile
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#999"
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
            <Text style={styles.stepTitle}>Where are you located?</Text>
            <Text style={styles.stepDescription}>
              Help us show you deals near you
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your city or area"
              placeholderTextColor="#999"
              value={location}
              onChangeText={setLocation}
              autoFocus
              autoCapitalize="words"
            />
          </View>
        );

      case "complete":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <AntDesign name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.title}>All set!</Text>
            <Text style={styles.description}>
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
      style={styles.container}
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
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  subDescription: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  stepDescription: {
    fontSize: 14,
    color: "#666",
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
    color: "#333",
    backgroundColor: "#fff",
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
  skipButtonText: {
    color: "#666",
    fontSize: 14,
  },
});
