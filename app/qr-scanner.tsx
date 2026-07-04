import { useAuthContext } from "@/app/providers/auth";
import QRScanner from "@/components/QRScanner";
import { sendPushNotification } from "@/utils/notifications";
import { success as hapticSuccess } from "@/utils/haptics";
import { parseQRCodeData, redeemRedemptionToken } from "@/utils/qrCode";
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

      // Redeem server-side by opaque single-use token. The credited customer is
      // derived from the bound redemption row on the server — never from the QR —
      // which validates token + expiry + active state + merchant ownership. The
      // cross-user credit can't be done from the merchant device under RLS, so this
      // goes through a definer RPC.
      const result = await redeemRedemptionToken(qrData.token);

      if (!result.ok) {
        Alert.alert("Cannot Redeem", result.message || "This deal could not be redeemed.");
        setProcessing(false);
        return;
      }

      // Notify the customer's device (best-effort; never blocks the flow). The
      // customer id is returned by the server from the bound redemption row.
      if (result.out_user_id) {
        try {
          await sendPushNotification(result.out_user_id, {
            type: "deal_redeemed",
            title: "Deal Redeemed!",
            body: result.restaurant_name
              ? `You redeemed: ${result.deal_title} at ${result.restaurant_name}`
              : `You redeemed: ${result.deal_title ?? "your deal"}`,
            data: {
              restaurant_id: result.out_restaurant_id,
              screen: "/account",
            },
          });
        } catch (notifError) {
          console.error("Error sending redemption notification:", notifError);
        }
      }

      // Brief success confirmation on the scanner (restaurant's device)
      hapticSuccess();
      Alert.alert(
        "Verified!",
        `Deal "${result.deal_title ?? ""}" has been redeemed.`,
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
