import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { geocodeAddress } from '@/utils/geocode';
import { pickAndUploadHeroImage, pickAndUploadImage } from '@/utils/uploadImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateRestaurant() {
  const { profile } = useAuthContext();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [rating, setRating] = useState('');
  const [numReviews, setNumReviews] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleUploadLogo = async () => {
    setIsUploadingLogo(true);
    try {
      const url = await pickAndUploadImage();
      if (url) {
        setLogoUrl(url);
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUploadImage = async () => {
    setIsUploadingImage(true);
    try {
      const url = await pickAndUploadHeroImage();
      if (url) {
        setImageUrl(url);
      }
    } finally {
      setIsUploadingImage(false);
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

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return false;
    }

    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Error', 'Location is required. Enter an address and tap "Look up" or enter coordinates manually.');
      return false;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Latitude and longitude must be valid numbers');
      return false;
    }

    if (lat < -90 || lat > 90) {
      Alert.alert('Error', 'Latitude must be between -90 and 90');
      return false;
    }

    if (lng < -180 || lng > 180) {
      Alert.alert('Error', 'Longitude must be between -180 and 180');
      return false;
    }

    if (rating.trim()) {
      const ratingNum = parseFloat(rating);
      if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
        Alert.alert('Error', 'Rating must be a number between 0 and 5');
        return false;
      }
    }

    if (numReviews.trim()) {
      const reviewsNum = parseInt(numReviews, 10);
      if (isNaN(reviewsNum) || reviewsNum < 0) {
        Alert.alert('Error', 'Number of reviews must be a positive integer');
        return false;
      }
    }

    return true;
  };

  const createRestaurant = async () => {
    if (!validateForm() || !profile?.id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('restaurants')
        .insert([
          {
            owner_id: profile.id,
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            type: type.trim() || null,
            rating: rating.trim() ? parseFloat(rating) : null,
            num_ratings: numReviews.trim() ? parseInt(numReviews, 10) : null,
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
            hero_image_url: imageUrl.trim() || null,
          },
        ]);

      if (error) throw error;

      Alert.alert('Success', 'Restaurant created successfully');
      // Small delay to ensure success message is seen
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error creating restaurant:', error);
      Alert.alert('Error', 'Failed to create restaurant');
    } finally {
      setIsSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Create Restaurant</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={createRestaurant}
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
        {/* Basic Info */}
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
          <Text style={styles.label}>Address *</Text>
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
          <View style={styles.locationRow}>
            <View style={styles.locationInputContainer}>
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
            <View style={styles.locationInputContainer}>
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

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location *</Text>
          {latitude && longitude ? (
            <View style={styles.coordsDisplay}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.coordsText}>
                {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </Text>
            </View>
          ) : (
            <Text style={styles.coordsMissing}>
              No coordinates yet - enter an address above and tap the location button
            </Text>
          )}
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

        {/* Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Images</Text>
          
          <Text style={styles.label}>Logo (Square)</Text>
          <View style={styles.imageInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={logoUrl}
              onChangeText={setLogoUrl}
              placeholder="https://... or upload"
              placeholderTextColor="#C7C7CC"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.uploadButton, isUploadingLogo && styles.saveButtonDisabled]}
              onPress={handleUploadLogo}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="cloud-upload" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          {logoUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Hero Image (Wide)</Text>
          <View style={styles.imageInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... or upload"
              placeholderTextColor="#C7C7CC"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.uploadButton, isUploadingImage && styles.saveButtonDisabled]}
              onPress={handleUploadImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="cloud-upload" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.heroPreview} />
            </View>
          ) : null}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
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
  coordsMissing: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginBottom: 4,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  heroPreview: {
    width: '100%',
    height: 160,
  },
});
