import BarcodeScanner from '@/components/BarcodeScanner';
import { useProducts } from '@/hooks/useProducts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function InventoryScannerScreen() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { getProductByBarcode, createProduct } = useProducts(restaurantId || null);
  const [processing, setProcessing] = useState(false);

  const handleScan = async (data: string, type: string) => {
    if (processing || !restaurantId) return;

    setProcessing(true);

    try {
      // Look up product by barcode
      let product = await getProductByBarcode(data);

      if (!product) {
        // Product doesn't exist, ask user if they want to create it
        Alert.alert(
          'Product Not Found',
          `No product found with barcode: ${data}\n\nWould you like to create a new product?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setProcessing(false);
              }
            },
            {
              text: 'Create Product',
              onPress: () => {
                setProcessing(false);
                // Navigate to product creation form
                router.push({
                  pathname: '/admin/inventory/product-form' as any,
                  params: { 
                    restaurantId,
                    barcode: data,
                    mode: 'create'
                  }
                });
              }
            }
          ]
        );
        return;
      }

      // Product exists, navigate to add inventory item form
      setProcessing(false);
      router.push({
        pathname: '/admin/inventory/item-form' as any,
        params: { 
          restaurantId,
          productId: product.id,
          barcode: data
        }
      });
    } catch (error: any) {
      console.error('Error processing barcode scan:', error);
      Alert.alert('Error', error.message || 'Failed to process barcode.');
      setProcessing(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleManualEntry = () => {
    router.push({
      pathname: '/admin/inventory/item-form' as any,
      params: { restaurantId }
    });
  };

  return (
    <View style={styles.container}>
      <BarcodeScanner
        onScan={handleScan}
        onClose={handleClose}
        mode="barcode"
        title="Scan Product Barcode"
      />
      <TouchableOpacity
        style={styles.manualButton}
        onPress={handleManualEntry}
      >
        <Text style={styles.manualButtonText}>Enter Manually</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  manualButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FE902A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
