import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { geocodeAddress } from '@/utils/geocode';
import { pickAndUploadHeroImage } from '@/utils/uploadImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type PlaceSuggestion = {
  place_id: string;
  description: string;
};

export default function CreateRestaurant() {
  const { profile } = useAuthContext();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, []);

  const fetchSuggestions = (text: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!text || text.length < 3 || !GOOGLE_MAPS_API_KEY) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=address&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.predictions?.length > 0) {
          setSuggestions(data.predictions.map((p: { place_id: string; description: string }) => ({
            place_id: p.place_id,
            description: p.description,
          })));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    setAddress(suggestion.description);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();

    // Auto-geocode the selected address
    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(suggestion.description);
      if (result) {
        setLatitude(result.lat.toString());
        setLongitude(result.lng.toString());
      }
    } catch {
      // Silently fail — user can still tap the location button manually
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUploadImage = async () => {
    setIsUploadingImage(true);
    try {
      const url = await pickAndUploadHeroImage();
      if (url) setImageUrl(url);
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
    return true;
  };

  const createRestaurant = async () => {
    if (!validateForm() || !profile?.id) return;

    try {
      setIsSaving(true);

      const payload = {
        owner_id: profile.id,
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        type: type.trim() || null,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        hero_image_url: imageUrl.trim() || null,
      };

      const { data, error } = await supabase
        .from('restaurants')
        .insert([payload])
        .select('id')
        .single();

      // PGRST116 = "no rows returned" when the SELECT-after-INSERT is blocked
      // by RLS even though the insert itself succeeded.
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error creating restaurant:', JSON.stringify(error));
        Alert.alert('Error', `Failed to create restaurant: ${error.message || error.code || 'Unknown error'}`);
        return;
      }

      if (!data && !error) {
        Alert.alert('Error', 'Restaurant insert returned no row. Check RLS policies on the restaurants table.');
        return;
      }

      Alert.alert('Success', 'Restaurant created successfully');
      setTimeout(() => router.back(), 500);
    } catch (error: unknown) {
      console.error('Error creating restaurant:', error);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to create restaurant: ${message}`);
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
            try { router.back(); } catch { router.replace('/admin'); }
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

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
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

        {/* Address with autocomplete */}
        <View style={styles.section}>
          <Text style={styles.label}>Address *</Text>
          <View style={styles.addressRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  fetchSuggestions(text);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Street address, city, province"
                placeholderTextColor="#C7C7CC"
                autoCorrect={false}
              />
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.place_id}
                    keyboardShouldPersistTaps="always"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectSuggestion(item)}
                      >
                        <Ionicons name="location-outline" size={14} color="#8E8E93" style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={styles.suggestionText} numberOfLines={2}>{item.description}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>
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
            Type to search or enter manually, then tap 📍 to auto-fill coordinates
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
              No coordinates yet — enter an address above and tap 📍
            </Text>
          )}
          <View style={styles.locationRow}>
            <View style={styles.locationInputContainer}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="e.g., 43.6532"
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
                placeholder="e.g., -79.3832"
                placeholderTextColor="#C7C7CC"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Images</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#000000' },
  saveButton: { paddingHorizontal: 16, paddingVertical: 8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#FE902A', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 8 },
  helpText: { fontSize: 13, color: '#8E8E93', marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  addressRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  suggestionText: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 18 },
  geocodeButton: {
    backgroundColor: '#FE902A',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  locationRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  locationInputContainer: { flex: 1 },
  coordsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FFF4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
    marginBottom: 8,
  },
  coordsText: { fontSize: 14, color: '#333', fontWeight: '500' },
  coordsMissing: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic', marginBottom: 8 },
  imageInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
  logoPreview: { width: 80, height: 80, margin: 12, borderRadius: 8 },
  heroPreview: { width: '100%', height: 160 },
});
