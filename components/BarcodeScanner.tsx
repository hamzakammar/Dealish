import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type BarcodeScannerProps = {
  onScan: (data: string, type: string) => void;
  onClose?: () => void;
  mode?: 'qr' | 'barcode' | 'both';
  title?: string;
};

function BarcodeScannerWeb({ onScan, onClose, mode = 'both', title }: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setLoading(true);
    try {
      await onScan(code, 'manual');
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert('Error', 'Failed to process barcode. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const displayTitle = title || (mode === 'qr' ? 'Enter QR Code' : 'Enter Barcode');
  const placeholder = mode === 'qr' ? 'Paste or type QR code value' : 'Enter barcode number';

  return (
    <View style={webStyles.container}>
      <Ionicons name={mode === 'qr' ? 'qr-code-outline' : 'barcode-outline'} size={64} color="#FE902A" />
      <Text style={webStyles.title}>{displayTitle}</Text>
      <Text style={webStyles.subtitle}>
        Camera scanning is not available in the browser. Enter the code manually.
      </Text>
      <TextInput
        style={webStyles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={manualCode}
        onChangeText={setManualCode}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={mode === 'barcode' ? 'numeric' : 'default'}
      />
      <TouchableOpacity
        style={[webStyles.button, loading && webStyles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={webStyles.buttonText}>Submit</Text>
        )}
      </TouchableOpacity>
      {onClose && (
        <TouchableOpacity style={webStyles.secondaryButton} onPress={onClose}>
          <Text style={webStyles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function BarcodeScanner({
  onScan,
  onClose,
  mode = 'both',
  title
}: BarcodeScannerProps) {
  if (Platform.OS === 'web') {
    return <BarcodeScannerWeb onScan={onScan} onClose={onClose} mode={mode} title={title} />;
  }

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Determine which barcode types to scan based on mode
  const getBarcodeTypes = () => {
    if (mode === 'qr') {
      return ['qr'];
    } else if (mode === 'barcode') {
      return ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'];
    } else {
      // both
      return ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'];
    }
  };

  const handleBarCodeScanned = async ({ data, type }: { data: string; type: string }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

    try {
      // Call the onScan callback with the scanned data and type
      await onScan(data, type);
    } catch (error) {
      console.error("Error processing scan:", error);
      Alert.alert("Error", "Failed to process barcode. Please try again.");
    } finally {
      setLoading(false);
      // Reset scanned state after a delay to allow re-scanning
      setTimeout(() => {
        setScanned(false);
      }, 2000);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FE902A" />
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="#999" />
        <Text style={styles.message}>Camera permission is required</Text>
        <Text style={styles.subMessage}>
          Please enable camera access to scan {mode === 'qr' ? 'QR codes' : mode === 'barcode' ? 'barcodes' : 'codes'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const displayTitle = title || (mode === 'qr' ? 'Scan QR Code' : mode === 'barcode' ? 'Scan Barcode' : 'Scan Code');
  const instructionText = mode === 'qr' 
    ? 'Position the QR code within the frame'
    : mode === 'barcode'
    ? 'Position the barcode within the frame'
    : 'Position the QR code or barcode within the frame';

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: getBarcodeTypes() as any,
        }}
      />

      {/* Overlay with scanning frame */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleOverlay}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanFrame}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FE902A" />
              </View>
            )}
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* Title */}
      {displayTitle && (
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>{displayTitle}</Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsText}>
          {instructionText}
        </Text>
      </View>

      {/* Close button */}
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 360,
  },
  input: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FE902A',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FE902A',
    fontSize: 16,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  message: {
    fontSize: 18,
    color: "#333",
    marginTop: 16,
    textAlign: "center",
  },
  subMessage: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  middleOverlay: {
    flexDirection: "row",
    height: 300,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#FE902A",
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 25,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  titleText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionsContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instructionsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FE902A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FE902A",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#FE902A",
    fontSize: 16,
    fontWeight: "600",
  },
});
