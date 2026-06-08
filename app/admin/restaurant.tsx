import { supabase } from '@/app/lib/supabase';
import { Restaurant } from '@/types/restaurant';
import { geocodeAddress } from '@/utils/geocode';
import { placesGeocode } from '@/utils/places';
import { pickAndUploadHeroImage } from '@/utils/uploadImage';
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
  // Rating / review count are NOT editable by restaurants — they are sourced from
  // Google (see scripts/refresh-restaurant-photos-places.js). Kept read-only for display.
  const [rating, setRating] = useState<number | null>(null);
  const [numReviews, setNumReviews] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [displayImage, setDisplayImage] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingDisplay, setIsUploadingDisplay] = useState(false);

  const handleUploadHero = async () => {
    setIsUploadingHero(true);
    try {
      const url = await pickAndUploadHeroImage();
      if (url) {
        setImageUrl(url);
      }
    } finally {
      setIsUploadingHero(false);
    }
  };

  const handleUploadDisplay = async () => {
    setIsUploadingDisplay(true);
    try {
      const url = await pickAndUploadHeroImage();
      if (url) {
        setDisplayImage(url);
      }
    } finally {
      setIsUploadingDisplay(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Membership-first check: verify owner-level access via restaurant_members.
      // If the user has access, the restaurants query will succeed via RLS.
      const { data: membership, error: memberErr } = await supabase
        .from('restaurant_members')
        .select('role')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (memberErr) throw memberErr;
      
      // If no explicit membership, fallback to checking legacy owner_id via RLS on restaurants
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        Alert.alert('Error', 'You do not have permission to edit this restaurant');
        router.replace('/admin');
        return;
      }

      setRestaurant(data);
      setName(data.name);
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setType(data.type || '');
      setRating(typeof data.rating === 'number' ? data.rating : null);
      setNumReviews(typeof data.num_ratings === 'number' ? data.num_ratings : null);
      setImageUrl(data.hero_image_url || '');
      setDisplayImage(data.display_image || '');
      setLatitude(data.lat?.toString() || '');
      setLongitude(data.lng?.toString() || '');
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
      // Google Places first (also refreshes rating/review count), Nominatim fallback.
      const placesResult = await placesGeocode(address);
      if (placesResult?.lat != null && placesResult?.lng != null) {
        setLatitude(placesResult.lat.toString());
        setLongitude(placesResult.lng.toString());
        if (placesResult.rating != null) setRating(placesResult.rating);
        if (placesResult.userRatingCount != null) setNumReviews(placesResult.userRatingCount);
        return;
      }
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

    try {
      setIsSaving(true);

      // rating / num_ratings are intentionally NOT written here — they come from
      // Google reviews, not restaurant self-reporting (prevents fabricated ratings).
      const updates: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        type: type.trim() || null,
        hero_image_url: imageUrl.trim() || null,
        display_image: displayImage.trim() || null,
        // rating/num_ratings are Google-sourced (refreshed via the location lookup),
        // never typed by the restaurant.
        ...(rating != null ? { rating } : {}),
        ...(numReviews != null ? { num_ratings: numReviews } : {}),
      };

      if (latitude.trim() && longitude.trim()) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          updates.lat = lat;
          updates.lng = lng;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
              <Text style={styles.readOnlyValue}>
                {rating != null ? `${rating.toFixed(1)} ★` : 'Not set'}
              </Text>
            </View>
            <View style={styles.ratingInputContainer}>
              <Text style={styles.label}>Number of Reviews</Text>
              <Text style={styles.readOnlyValue}>
                {numReviews != null ? `${numReviews}` : 'Not set'}
              </Text>
            </View>
          </View>
          <Text style={styles.helpText}>
            Ratings and reviews are pulled from Google and can’t be edited here.
          </Text>
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
            <Text style={styles.label}>Hero Image (Wide)</Text>
            <View style={styles.imageInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://... or upload"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={[styles.uploadButton, isUploadingHero && styles.uploadButtonDisabled]}
                onPress={handleUploadHero}
                disabled={isUploadingHero}
              >
                {isUploadingHero ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cloud-upload" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            {imageUrl ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              </View>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Image (Wide)</Text>
            <View style={styles.imageInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={displayImage}
                onChangeText={setDisplayImage}
                placeholder="https://... or upload"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={[styles.uploadButton, isUploadingDisplay && styles.uploadButtonDisabled]}
                onPress={handleUploadDisplay}
                disabled={isUploadingDisplay}
              >
                {isUploadingDisplay ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cloud-upload" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            {displayImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: displayImage }} style={styles.heroPreview} />
              </View>
            ) : null}
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
  readOnlyValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
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
  imageInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: '#FE902A',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
});
