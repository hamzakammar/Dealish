import { supabase } from '@/app/lib/supabase';
import { Restaurant } from '@/types/restaurant';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RestaurantSettings() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [rating, setRating] = useState('');
  const [numReviews, setNumReviews] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error) throw error;

      if (data) {
        setRestaurant(data);
        setName(data.name);
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setType(data.type || '');
        setRating(data.rating?.toString() || '');
        setNumReviews(data.rating_count?.toString() || '');
        setImageUrl(data.image_url || '');
        setLogoUrl(data.logo_url || '');
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      Alert.alert('Error', 'Failed to load restaurant details');
      try {
        router.back();
      } catch (navError) {
        console.error('Navigation error:', navError);
        router.replace('/admin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveRestaurant = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    if (rating.trim()) {
      const ratingNum = parseFloat(rating);
      if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
        Alert.alert('Error', 'Rating must be a number between 0 and 5');
        return;
      }
    }

    if (numReviews.trim()) {
      const reviewsNum = parseInt(numReviews, 10);
      if (isNaN(reviewsNum) || reviewsNum < 0) {
        Alert.alert('Error', 'Number of reviews must be a positive integer');
        return;
      }
    }

    try {
      setIsSaving(true);

      const updates = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        type: type.trim() || null,
        rating: rating.trim() ? parseFloat(rating) : null,
        rating_count: numReviews.trim() ? parseInt(numReviews, 10) : null,
        image_url: imageUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
      };

      const { error } = await supabase
        .from('restaurants')
        .update(updates)
        .eq('id', restaurantId);

      if (error) throw error;

      Alert.alert('Success', 'Restaurant updated successfully');
      // Small delay to ensure success message is seen
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      Alert.alert('Error', 'Failed to update restaurant');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('Navigation error:', error);
              router.replace('/admin');
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FE902A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Settings</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveRestaurant}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Restaurant Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter restaurant name"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Street address"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#C7C7CC"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Type</Text>
          <TextInput
            style={styles.input}
            value={type}
            onChangeText={setType}
            placeholder="e.g., Italian, Fast Food, Cafe"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        {/* Rating & Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating & Reviews</Text>
          <View style={styles.ratingRow}>
            <View style={styles.ratingInputContainer}>
              <Text style={styles.label}>Rating</Text>
              <TextInput
                style={styles.input}
                value={rating}
                onChangeText={setRating}
                placeholder="e.g., 4.5"
                placeholderTextColor="#C7C7CC"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.ratingInputContainer}>
              <Text style={styles.label}>Number of Reviews</Text>
              <TextInput
                style={styles.input}
                value={numReviews}
                onChangeText={setNumReviews}
                placeholder="e.g., 150"
                placeholderTextColor="#C7C7CC"
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Text style={styles.helpText}>
            Rating should be between 0 and 5
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Logo URL</Text>
          <TextInput
            style={styles.input}
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://example.com/logo.jpg"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />
        </View>

        {restaurant && (
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Latitude: {restaurant.lat}</Text>
              <Text style={styles.infoText}>Longitude: {restaurant.lng}</Text>
              <Text style={styles.helpText}>
                Contact support to update location
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FE902A',
    fontSize: 16,
    fontWeight: '600',
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
  helpText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingInputContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  infoText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
});
