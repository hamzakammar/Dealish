import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import QRScanner from "@/components/QRScanner";
import { calculateSavings, trackRedemption } from "@/utils/activity";
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

      // Use user_id from QR code so tracking is attributed to the customer,
      // not the restaurant admin who is holding the scanner.
      const targetUserId = qrData.user_id || session.user.id;

      // Record QR code scan (for analytics)
      await recordQRCodeScan(
        qrData.deal_id,
        deal.restaurant_id,
        targetUserId
      );

      // Track visit attributed to the customer
      const savings = calculateSavings({
        discount_type: deal.discount_type,
        discount_value: deal.discount_value,
        original_price: deal.original_price,
      });

      // Track redemption — push notification goes to the customer's device
      // via recordQRCodeScan. No Alert prompts here since this is the restaurant's device.
      await trackRedemption(
        deal.restaurant_id,
        deal.title,
        savings > 0 ? savings : undefined,
        qrData.deal_id
      );

      // Brief success confirmation on the scanner (restaurant's device)
      Alert.alert(
        "Verified!",
        `Deal "${deal.title}" has been redeemed.`,
        [{
          text: "OK",
          onPress: () => {
            setProcessing(false);
            try { router.back(); } catch { router.replace('/map'); }
          },
        }]
      );
    } catch (error: unknown) {
      console.error("Error processing QR scan:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert("Error", message || "Failed to process QR code.");
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
