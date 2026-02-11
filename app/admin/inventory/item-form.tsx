import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { useInventory } from '@/hooks/useInventory';
import { useProducts } from '@/hooks/useProducts';
import { InventoryItem, Product, STORAGE_LOCATIONS } from '@/types/inventory';
import { getDefaultLocation, getSuggestedExpirationDate } from '@/utils/productDefaults';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function InventoryItemForm() {
  const router = useRouter();
  const { restaurantId, itemId, productId, barcode } = useLocalSearchParams<{
    restaurantId: string;
    itemId?: string;
    productId?: string;
    barcode?: string;
  }>();
  const { profile } = useAuthContext();
  const { products, loading: productsLoading, getProductByBarcode } = useProducts(restaurantId || null);
  const { addInventoryItem, updateInventoryItem } = useInventory(restaurantId || null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(productId || '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [location, setLocation] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    if (itemId) {
      loadItem();
      return;
    }

    if (!purchaseDate) {
      const today = new Date().toISOString().split('T')[0];
      setPurchaseDate(today);
    }
  }, [itemId]);

  useEffect(() => {
    if (itemId) return;

    if (productId && products.length > 0) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setUnit(product.unit);
        if (!expirationDate && product.category) {
          const suggestedDate = getSuggestedExpirationDate(product.category);
          setExpirationDate(suggestedDate);
          const suggestedLocation = getDefaultLocation(product.category);
          if (!location) {
            setLocation(suggestedLocation);
          }
        }
      }
    } else if (barcode && !productId) {
      loadProductByBarcode();
    }
  }, [productId, barcode, products.length]);

  const loadProductByBarcode = async () => {
    if (!barcode) return;
    const product = await getProductByBarcode(barcode);
    if (product) {
      setSelectedProductId(product.id);
      setUnit(product.unit);
      if (product.category) {
        const suggestedDate = getSuggestedExpirationDate(product.category);
        setExpirationDate(suggestedDate);
        const suggestedLocation = getDefaultLocation(product.category);
        setLocation(suggestedLocation);
      }
    }
  };

  const loadItem = async () => {
    if (!itemId || !restaurantId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;

      const item = data as InventoryItem & { product: Product };
      setSelectedProductId(item.product_id);
      setQuantity(item.quantity.toString());
      setUnit(item.unit);
      setUnitCost(item.unit_cost?.toString() || '');
      setPurchaseDate(item.purchase_date || '');
      setExpirationDate(item.expiration_date || '');
      setLocation(item.location || '');
      setBatchNumber(item.batch_number || '');
      setSupplier(item.supplier || '');
      setNotes(item.notes || '');
    } catch (error: any) {
      console.error('Error loading item:', error);
      Alert.alert('Error', 'Failed to load inventory item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      Alert.alert('Error', 'Please select a product');
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!unit) {
      Alert.alert('Error', 'Please enter a unit');
      return;
    }

    try {
      setIsSaving(true);

      const itemData: Partial<InventoryItem> = {
        product_id: selectedProductId,
        quantity: parseFloat(quantity),
        unit: unit.trim(),
        unit_cost: unitCost ? parseFloat(unitCost) : undefined,
        purchase_date: purchaseDate?.trim() || undefined,
        expiration_date: expirationDate?.trim() || undefined,
        location: location?.trim() || undefined,
        batch_number: batchNumber?.trim() || undefined,
        supplier: supplier?.trim() || undefined,
        notes: notes?.trim() || undefined,
        status: 'active',
      };

      let success = false;
      if (itemId) {
        const updated = await updateInventoryItem(itemId, itemData);
        if (updated) {
          Alert.alert('Success', 'Inventory item updated successfully');
          success = true;
        }
      } else {
        const added = await addInventoryItem(itemData);
        if (added) {
          Alert.alert('Success', 'Inventory item added successfully');
          success = true;
        }
      }

      if (success) {
        setTimeout(() => {
          router.back();
        }, 500);
      }
    } catch (error: any) {
      console.error('Error saving inventory item:', error);
      Alert.alert('Error', error.message || 'Failed to save inventory item');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {itemId ? 'Edit Item' : 'Add Item'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Product Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowProductPicker(true)}
            >
              <Text style={selectedProductId ? styles.pickerButtonText : styles.pickerButtonTextPlaceholder}>
                {selectedProductId 
                  ? products.find(p => p.id === selectedProductId)?.name || 'Select a product...'
                  : 'Select a product...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748B" />
            </TouchableOpacity>
            {selectedProduct && (
              <Text style={styles.helperText}>
                Category: {selectedProduct.category || 'Uncategorized'} • Unit: {selectedProduct.unit}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Quantity *</Text>
            <View style={styles.quantityRow}>
              <TextInput
                style={[styles.input, styles.quantityInput]}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.unitInput]}
                value={unit}
                onChangeText={setUnit}
                placeholder="unit"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Dates & Location</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Expiration Date</Text>
              <Text style={styles.optionalLabel}>Auto-suggested</Text>
            </View>
            <TextInput
              style={styles.input}
              value={expirationDate}
              onChangeText={setExpirationDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.quickDateButtons}>
              <Text style={styles.quickDateLabel}>Quick select:</Text>
              <View style={styles.quickDateRow}>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: '+3 Days', days: 3 },
                  { label: '+7 Days', days: 7 },
                ].map(({ label, days }) => {
                  const date = new Date();
                  date.setDate(date.getDate() + days);
                  const dateStr = date.toISOString().split('T')[0];
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.quickDateButton,
                        expirationDate === dateStr && styles.quickDateButtonSelected
                      ]}
                      onPress={() => setExpirationDate(dateStr)}
                    >
                      <Text style={[
                        styles.quickDateButtonText,
                        expirationDate === dateStr && styles.quickDateButtonTextSelected
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Storage Location</Text>
              <Text style={styles.optionalLabel}>Auto-suggested</Text>
            </View>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowLocationPicker(true)}
            >
              <Text style={location ? styles.pickerButtonText : styles.pickerButtonTextPlaceholder}>
                {location 
                  ? location.charAt(0).toUpperCase() + location.slice(1).replace('_', ' ')
                  : 'Select location...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit Cost ($)</Text>
            <TextInput
              style={styles.input}
              value={unitCost}
              onChangeText={setUnitCost}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Batch Number</Text>
            <TextInput
              style={styles.input}
              value={batchNumber}
              onChangeText={setBatchNumber}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Supplier</Text>
            <TextInput
              style={styles.input}
              value={supplier}
              onChangeText={setSupplier}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {itemId ? 'Update Item' : 'Add Item'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Product Picker Modal */}
      <Modal
        visible={showProductPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {productsLoading ? (
                <View style={styles.modalEmptyState}>
                  <ActivityIndicator size="large" color="#FE902A" />
                  <Text style={styles.modalEmptyText}>Loading products...</Text>
                </View>
              ) : products.length === 0 ? (
                <View style={styles.modalEmptyState}>
                  <View style={styles.modalEmptyIcon}>
                    <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
                  </View>
                  <Text style={styles.modalEmptyText}>No products found</Text>
                  <Text style={styles.modalEmptySubtext}>
                    Create a product first to add inventory items
                  </Text>
                  <TouchableOpacity
                    style={styles.createProductButton}
                    onPress={() => {
                      setShowProductPicker(false);
                      router.push({
                        pathname: '/admin/inventory/product-form' as any,
                        params: { restaurantId }
                      });
                    }}
                  >
                    <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.createProductButtonText}>Create Product</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                products.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.modalItem,
                      selectedProductId === product.id && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedProductId(product.id);
                      setUnit(product.unit);
                      if (product.category) {
                        const suggestedDate = getSuggestedExpirationDate(product.category);
                        setExpirationDate(suggestedDate);
                        const suggestedLocation = getDefaultLocation(product.category);
                        setLocation(suggestedLocation);
                      }
                      setShowProductPicker(false);
                    }}
                  >
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemText}>{product.name}</Text>
                      {product.category && (
                        <Text style={styles.modalItemSubtext}>
                          {product.category} • {product.unit}
                        </Text>
                      )}
                    </View>
                    {selectedProductId === product.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#FE902A" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  !location && styles.modalItemSelected
                ]}
                onPress={() => {
                  setLocation('');
                  setShowLocationPicker(false);
                }}
              >
                <Text style={styles.modalItemText}>None</Text>
                {!location && (
                  <Ionicons name="checkmark-circle" size={24} color="#FE902A" />
                )}
              </TouchableOpacity>
              {STORAGE_LOCATIONS.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.modalItem,
                    location === loc && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setLocation(loc);
                    setShowLocationPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {loc.charAt(0).toUpperCase() + loc.slice(1).replace('_', ' ')}
                  </Text>
                  {location === loc && (
                    <Ionicons name="checkmark-circle" size={24} color="#FE902A" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityInput: {
    flex: 2,
  },
  unitInput: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  pickerButtonTextPlaceholder: {
    fontSize: 15,
    color: '#94A3B8',
  },
  quickDateButtons: {
    marginTop: 12,
  },
  quickDateLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  quickDateButtonSelected: {
    backgroundColor: '#FE902A',
    borderColor: '#FE902A',
  },
  quickDateButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  quickDateButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#FE902A',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalItemSelected: {
    backgroundColor: '#FEF3E2',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  modalEmptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE902A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createProductButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
