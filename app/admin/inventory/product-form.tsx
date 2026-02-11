import { useAuthContext } from '@/app/providers/auth';
import { useProducts } from '@/hooks/useProducts';
import { Product, PRODUCT_CATEGORIES } from '@/types/inventory';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProductForm() {
  const router = useRouter();
  const { restaurantId, productId, barcode, mode } = useLocalSearchParams<{
    restaurantId: string;
    productId?: string;
    barcode?: string;
    mode?: 'create' | 'edit';
  }>();
  const { profile } = useAuthContext();
  const { products, createProduct, updateProduct } = useProducts(restaurantId || null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [productBarcode, setProductBarcode] = useState(barcode || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [itemType, setItemType] = useState('');
  const [unit, setUnit] = useState('each');
  const [baseUnit, setBaseUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (productId && products.length > 0) {
      loadProduct();
    }
  }, [productId, products.length]);

  const loadProduct = async () => {
    if (!productId) return;
    
    const product = products.find(p => p.id === productId);
    if (product) {
      setName(product.name);
      setProductBarcode(product.barcode || '');
      setDescription(product.description || '');
      setCategory(product.category || '');
      setSubcategory(product.subcategory || '');
      setItemType(product.item_type || '');
      setUnit(product.unit);
      setBaseUnit(product.base_unit || '');
      setSupplier(product.supplier || '');
      setImageUrl(product.image_url || '');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }

    if (!unit.trim()) {
      Alert.alert('Error', 'Unit is required');
      return;
    }

    try {
      setIsSaving(true);

      const productData: Partial<Product> = {
        name: name.trim(),
        barcode: productBarcode.trim() || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
        subcategory: subcategory.trim() || undefined,
        item_type: itemType.trim() || undefined,
        unit: unit.trim(),
        base_unit: baseUnit.trim() || undefined,
        supplier: supplier.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
      };

      if (productId) {
        const updated = await updateProduct(productId, productData);
        if (updated) {
          Alert.alert('Success', 'Product updated successfully');
          // Small delay to ensure state updates propagate
          setTimeout(() => {
            router.back();
          }, 500);
        }
      } else {
        const created = await createProduct(productData);
        if (created) {
          Alert.alert('Success', 'Product created successfully');
          // Small delay to ensure state updates propagate
          setTimeout(() => {
            router.back();
          }, 500);
        }
      }
    } catch (error: any) {
      console.error('Error saving product:', error);
      Alert.alert('Error', error.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {productId ? 'Edit Product' : 'Create Product'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter product name"
          />
        </View>

        {/* Barcode */}
        <View style={styles.section}>
          <Text style={styles.label}>Barcode (UPC/EAN)</Text>
          <TextInput
            style={styles.input}
            value={productBarcode}
            onChangeText={setProductBarcode}
            placeholder="Scan or enter barcode"
            keyboardType="numeric"
            editable={!barcode} // If barcode came from scan, don't allow editing
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={category ? styles.pickerButtonText : styles.pickerButtonTextPlaceholder}>
              {category 
                ? category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')
                : 'Select category...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Unit */}
        <View style={styles.section}>
          <Text style={styles.label}>Unit *</Text>
          <TextInput
            style={styles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder="e.g., each, lb, oz, gallon"
          />
          <Text style={styles.helperText}>
            Common units: each, lb, oz, gallon, liter, case, box
          </Text>
        </View>

        {/* Base Unit */}
        <View style={styles.section}>
          <Text style={styles.label}>Base Unit (for conversions)</Text>
          <TextInput
            style={styles.input}
            value={baseUnit}
            onChangeText={setBaseUnit}
            placeholder="e.g., oz (for weight), ml (for volume)"
          />
          <Text style={styles.helperText}>
            Used for automatic unit conversions (optional)
          </Text>
        </View>

        {/* Supplier */}
        <View style={styles.section}>
          <Text style={styles.label}>Supplier</Text>
          <TextInput
            style={styles.input}
            value={supplier}
            onChangeText={setSupplier}
            placeholder="Optional"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Image URL */}
        <View style={styles.section}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://..."
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {productId ? 'Update Product' : 'Create Product'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  !category && styles.modalItemSelected
                ]}
                onPress={() => {
                  setCategory('');
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={styles.modalItemText}>None</Text>
                {!category && (
                  <Ionicons name="checkmark" size={20} color="#FE902A" />
                )}
              </TouchableOpacity>
              {PRODUCT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.modalItem,
                    category === cat && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                  </Text>
                  {category === cat && (
                    <Ionicons name="checkmark" size={20} color="#FE902A" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginLeft: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  pickerButtonTextPlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#FE902A',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
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
    borderBottomColor: '#E5E5EA',
  },
  modalItemSelected: {
    backgroundColor: '#FFF5EB',
  },
  modalItemText: {
    fontSize: 16,
    color: '#000000',
  },
});
