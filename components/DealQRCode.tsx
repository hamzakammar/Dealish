import { useDealQRCode } from "@/hooks/useDealQRCode";
import { Deal } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type DealQRCodeProps = {
  deal: Deal;
  visible: boolean;
  onClose: () => void;
};

export default function DealQRCode({ deal, visible, onClose }: DealQRCodeProps) {
  const { qrCodeData, loading, error } = useDealQRCode(deal.id);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan to Track Visit</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.dealTitle}>{deal.title}</Text>
            {deal.description && (
              <Text style={styles.dealDescription}>{deal.description}</Text>
            )}

            <View style={styles.qrContainer}>
              {loading ? (
                <ActivityIndicator size="large" color="#FE902A" />
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={48} color="#ff4444" />
                  <Text style={styles.errorText}>Failed to generate QR code</Text>
                  <Text style={styles.errorSubtext}>{error.message}</Text>
                </View>
              ) : qrCodeData ? (
                <QRCode
                  value={qrCodeData}
                  size={250}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              ) : null}
            </View>

            <Text style={styles.instructionText}>
              Show this QR code at the restaurant to track your visit
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxWidth: 400,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    alignItems: "center",
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  dealDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  qrContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 290,
  },
  errorContainer: {
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ff4444",
    fontWeight: "600",
    marginTop: 12,
  },
  errorSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
