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
  
  // Form state
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
        setNumReviews(data.rating_count?.toString() || '');
        setImageUrl(data.image_url || '');
        setLogoUrl(data.logo_url || '');
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
        rating_count: numReviews.trim() ? parseInt(numReviews, 10) : null,
        image_url: imageUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
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
          <View style={styles.addressRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street address, city, state"
              placeholderTextColor="#C7C7CC"
            />
            <TouchableOpacity
              style={[styles.geocodeButton, isGeocoding && styles.saveButtonDisabled]}
              onPress={handleGeocode}
              disabled={isGeocoding}
            >
              {isGeocoding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="location" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>
            Enter the full address and tap the location button to auto-fill coordinates
          </Text>
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
          <Text style={styles.sectionTitle}>Images</Text>

          <Text style={styles.label}>Logo URL</Text>
          <TextInput
            style={styles.input}
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://example.com/logo.jpg"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />
          {logoUrl.trim() !== '' && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: logoUrl }}
                style={styles.logoPreview}
                resizeMode="contain"
              />
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>Image URL</Text>
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />
          {imageUrl.trim() !== '' && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>Hero / Display Image URL</Text>
          <TextInput
            style={styles.input}
            value={displayImage}
            onChangeText={setDisplayImage}
            placeholder="https://example.com/hero.jpg"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />
          {displayImage.trim() !== '' && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: displayImage }}
                style={styles.heroPreview}
                resizeMode="cover"
              />
            </View>
          )}
          <Text style={styles.helpText}>
            Paste any image URL to use as logo, listing image, or hero banner
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {latitude && longitude ? (
            <View style={styles.coordsDisplay}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.coordsText}>
                {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </Text>
            </View>
          ) : null}
          <View style={styles.locationRow}>
            <View style={styles.locationInputContainer}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="e.g., 40.7128"
                placeholderTextColor="#C7C7CC"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.locationInputContainer}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="e.g., -74.0060"
                placeholderTextColor="#C7C7CC"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Text style={styles.helpText}>
            Auto-filled from address, or enter manually
          </Text>
        </View>

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
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  geocodeButton: {
    backgroundColor: '#FE902A',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  locationInputContainer: {
    flex: 1,
  },
  coordsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FFF4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  coordsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F5',
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
