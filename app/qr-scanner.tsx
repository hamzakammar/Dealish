import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import QRScanner from "@/components/QRScanner";
import { calculateSavings, trackRedemption, trackVisit } from "@/utils/activity";
import { parseQRCodeData, recordQRCodeScan, validateQRCode } from "@/utils/qrCode";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";

export default function QRScannerScreen() {
  const { session, profile } = useAuthContext();
  const [processing, setProcessing] = useState(false);

  const handleScan = async (data: string) => {
    if (processing || !session?.user) return;

    setProcessing(true);

    try {
      // Parse QR code data
      const qrData = parseQRCodeData(data);

      if (!qrData) {
        Alert.alert("Invalid QR Code", "This QR code is not valid for Dealish.");
        setProcessing(false);
        return;
      }

      // Validate QR code
      const isValid = await validateQRCode(qrData.deal_id, qrData.token);

      if (!isValid) {
        Alert.alert(
          "Invalid QR Code",
          "This QR code is invalid or the deal is no longer active."
        );
        setProcessing(false);
        return;
      }

      // Get deal and restaurant information (including discount fields for savings)
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("restaurant_id, title, discount_type, discount_value, original_price")
        .eq("id", qrData.deal_id)
        .single();

      if (dealError || !deal) {
        Alert.alert("Error", "Failed to fetch deal information.");
        setProcessing(false);
        return;
      }

      // Record QR code scan (for analytics)
      await recordQRCodeScan(
        qrData.deal_id,
        deal.restaurant_id,
        session.user.id
      );

      // Track visit
      await trackVisit(deal.restaurant_id, qrData.deal_id);

      // Calculate savings from deal discount info
      const savings = calculateSavings({
        discount_type: deal.discount_type,
        discount_value: deal.discount_value,
        original_price: deal.original_price,
      });

      // Build confirmation message
      const savingsText = savings > 0
        ? `\n\nYou saved $${savings.toFixed(2)}!`
        : '';

      // Show success and ask if they used the deal
      Alert.alert(
        "Visit Tracked!",
        `Your visit to this restaurant has been recorded. Did you use the "${deal.title}" deal?`,
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => {
              setProcessing(false);
              try {
                router.back();
              } catch (error) {
                console.error('Navigation error:', error);
                router.replace('/map');
              }
            },
          },
          {
            text: "Yes, I used it!",
            onPress: async () => {
              try {
                // Track the redemption with savings amount
                await trackRedemption(
                  deal.restaurant_id,
                  deal.title,
                  savings > 0 ? savings : undefined,
                  qrData.deal_id
                );

                // Show savings confirmation if we could calculate it
                if (savings > 0) {
                  Alert.alert(
                    "Deal Redeemed! 🎉",
                    `You saved $${savings.toFixed(2)} with "${deal.title}"!${savingsText}`,
                    [{ text: "Awesome!", onPress: () => {
                      try {
                        router.back();
                      } catch (error) {
                        console.error('Navigation error:', error);
                        router.replace('/map');
                      }
                    }}]
                  );
                } else {
                  Alert.alert(
                    "Deal Redeemed!",
                    `"${deal.title}" has been tracked in your activity.`,
                    [{ text: "OK", onPress: () => {
                      try {
                        router.back();
                      } catch (error) {
                        console.error('Navigation error:', error);
                        router.replace('/map');
                      }
                    }}]
                  );
                }
              } catch (redemptionError) {
                console.error('Error tracking redemption:', redemptionError);
                // Still navigate back even if tracking fails
                try {
                  router.back();
                } catch (error) {
                  router.replace('/map');
                }
              }
              setProcessing(false);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error processing QR scan:", error);
      Alert.alert("Error", error.message || "Failed to process QR code.");
      setProcessing(false);
    }
  };

  const handleClose = () => {
    try {
      // Return to admin dashboard for owners/admins, otherwise go back
      if (profile?.role === 'owner' || profile?.role === 'admin') {
        router.replace('/admin');
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      try {
        router.replace('/map');
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
      }
    }
  };

  return (
    <View style={styles.container}>
      <QRScanner onScan={handleScan} onClose={handleClose} />
      {/* Back button for admin users */}
      {(profile?.role === 'owner' || profile?.role === 'admin') && (
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleClose}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
