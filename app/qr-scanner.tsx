import { useAuthContext } from "@/app/providers/auth";
import QRScanner from "@/components/QRScanner";
import { parseQRCodeData, validateQRCode, recordQRCodeScan } from "@/utils/qrCode";
import { trackVisit } from "@/utils/activity";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { supabase } from "@/app/lib/supabase";

export default function QRScannerScreen() {
  const { session } = useAuthContext();
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

      // Get deal and restaurant information
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("restaurant_id, title")
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
              router.back();
            },
          },
          {
            text: "Yes",
            onPress: () => {
              // Could navigate to redemption tracking in the future
              setProcessing(false);
              router.back();
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
    router.back();
  };

  return (
    <View style={styles.container}>
      <QRScanner onScan={handleScan} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
