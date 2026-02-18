import { supabase } from '@/app/lib/supabase';
import { Restaurant } from '@/types/restaurant';
import { geocodeAddress } from '@/utils/geocode';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RestaurantSettings() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [rating, setRating] = useState('');
  const [numReviews, setNumReviews] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [displayImage, setDisplayImage] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

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
        setNumReviews(data.num_ratings?.toString() || '');
        setImageUrl(data.hero_image_url || '');
        setLogoUrl(data.hero_image_url || '');
        setDisplayImage(data.display_image || '');
        setLatitude(data.lat?.toString() || '');
        setLongitude(data.lng?.toString() || '');
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

  const handleGeocode = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address first');
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        setLatitude(result.lat.toString());
        setLongitude(result.lng.toString());
      } else {
        Alert.alert('Not Found', 'Could not find coordinates for that address. Try a more specific address or enter coordinates manually.');
      }
    } catch {
      Alert.alert('Error', 'Failed to look up address. Please try again or enter coordinates manually.');
    } finally {
      setIsGeocoding(false);
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

      const updates: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        type: type.trim() || null,
        rating: rating.trim() ? parseFloat(rating) : null,
        num_ratings: numReviews.trim() ? parseInt(numReviews, 10) : null,
        hero_image_url: imageUrl.trim() || null,
        display_image: displayImage.trim() || null,
      };

      if (latitude.trim() && longitude.trim()) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          updates.lat = lat;
          updates.lng = lng;
        }
      }

      const { error } = await supabase
        .from('restaurants')
        .update(updates)
        .eq('id', restaurantId);

      if (error) throw error;

      Alert.alert('Success', 'Restaurant updated successfully');
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
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Settings</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveRestaurant}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Restaurant Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter restaurant name"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Street address, city, state"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={[styles.geocodeButton, isGeocoding && styles.geocodeButtonDisabled]}
                onPress={handleGeocode}
                disabled={isGeocoding}
              >
                {isGeocoding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="location" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              Enter address and tap location icon to auto-fill coordinates
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type</Text>
            <TextInput
              style={styles.input}
              value={type}
              onChangeText={setType}
              placeholder="e.g., Italian, Fast Food, Cafe"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Rating & Reviews</Text>
          
          <View style={styles.ratingRow}>
            <View style={styles.ratingInputContainer}>
              <Text style={styles.label}>Rating</Text>
              <TextInput
                style={styles.input}
                value={rating}
                onChangeText={setRating}
                placeholder="0-5"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.ratingInputContainer}>
              <Text style={styles.label}>Number of Reviews</Text>
              <TextInput
                style={styles.input}
                value={numReviews}
                onChangeText={setNumReviews}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.locationRow}>
            <View style={styles.locationInputContainer}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="Auto-filled from address"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.locationInputContainer}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="Auto-filled from address"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {(latitude || longitude) && (
            <View style={styles.coordsDisplay}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.coordsText}>
                Coordinates: {latitude}, {longitude}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Images</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Logo URL</Text>
            <TextInput
              style={styles.input}
              value={logoUrl}
              onChangeText={setLogoUrl}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
            />
            {logoUrl && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
            />
            {imageUrl && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Image URL</Text>
            <TextInput
              style={styles.input}
              value={displayImage}
              onChangeText={setDisplayImage}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
            />
            {displayImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: displayImage }} style={styles.heroPreview} />
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FE902A',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
  helpText: {
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
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  geocodeButton: {
    backgroundColor: '#FE902A',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geocodeButtonDisabled: {
    opacity: 0.6,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingInputContainer: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationInputContainer: {
    flex: 1,
  },
  coordsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 12,
  },
  coordsText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  logoPreview: {
    width: 80,
    height: 80,
    margin: 12,
    borderRadius: 8,
  },
  imagePreview: {
    width: '100%',
    height: 160,
  },
  heroPreview: {
    width: '100%',
    height: 200,
  },
});
