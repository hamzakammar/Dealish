import { supabase } from '@/app/lib/supabase';
import { Product } from '@/types/inventory';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useProducts(restaurantId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setProducts([]);
      return;
    }

    fetchProducts();
  }, [restaurantId]);

  const fetchProducts = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setProducts(data || []);
    } catch (e: any) {
      console.error('Error fetching products:', e);
      setError(e);
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
    if (!restaurantId) return null;

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('barcode', barcode)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        // No product found
        return null;
      }

      return data as Product;
    } catch (e: any) {
      console.error('Error fetching product by barcode:', e);
      return null;
    }
  };

  const createProduct = async (product: Partial<Product>) => {
    if (!restaurantId) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert([{
          ...product,
          restaurant_id: restaurantId,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh products list
      await fetchProducts();

      return data as Product;
    } catch (e: any) {
      console.error('Error creating product:', e);
      Alert.alert('Error', e.message || 'Failed to create product.');
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('products')
        .update({
          ...updates,
          updated_at: new Date().toISOString(), // Ensure updated_at is refreshed
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state immediately for instant UI update
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, ...data } : p));

      // Refresh products list to ensure consistency
      await fetchProducts();

      // If category/subcategory/item_type changed, regenerate alerts for related inventory items
      const oldProduct = products.find(p => p.id === id);
      const categoryChanged = oldProduct && (
        oldProduct.category !== updates.category ||
        oldProduct.subcategory !== updates.subcategory ||
        oldProduct.item_type !== updates.item_type
      );

      if (categoryChanged && restaurantId) {
        // Regenerate alerts for all inventory items using this product
        try {
          const { data: inventoryItems } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('product_id', id)
            .eq('status', 'active');

          if (inventoryItems) {
            const { generateAlertForItem } = await import('@/utils/generateInventoryAlerts');
            for (const item of inventoryItems) {
              try {
                await generateAlertForItem(restaurantId, item.id);
              } catch (err) {
                console.error(`Error regenerating alert for item ${item.id}:`, err);
              }
            }
          }
        } catch (err) {
          console.error('Error regenerating alerts after product update:', err);
          // Don't fail the update if alert regeneration fails
        }
      }

      return data as Product;
    } catch (e: any) {
      console.error('Error updating product:', e);
      Alert.alert('Error', e.message || 'Failed to update product.');
      return null;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Refresh products list
      await fetchProducts();

      return true;
    } catch (e: any) {
      console.error('Error deleting product:', e);
      Alert.alert('Error', e.message || 'Failed to delete product.');
      return false;
    }
  };

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
