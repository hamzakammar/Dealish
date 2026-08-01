import { useAuthContext } from '@/app/providers/auth';
import { ingestRestaurantWithDeal } from '@/utils/ingestRestaurant';
import { placeDetails, placesAutocomplete, type PlaceSuggestion } from '@/utils/places';
import { pickAndUploadHeroImage } from '@/utils/uploadImage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Private restaurant ingestion form — operator-only.
 *
 * Gated by profile.is_operator (the same hidden-feature gate used by "Review
 * Auto-Detected Deals" / Square). Access is ALSO enforced server-side: the
 * underlying RPC (create_ingested_restaurant_with_deal) checks
 * is_platform_operator() and rejects non-operators even if called directly.
 *
 * Lets Daniel add a restaurant + its first deal without the CLI or Supabase
 * dashboard. Reuses Google Places autocomplete (utils/places.ts), the existing
 * photo upload (utils/uploadImage.ts -> 'restaurant-images' bucket), and the
 * restaurant/deal schema. Creation is atomic and dedupes obvious duplicates.
 */
export default function IngestRestaurant() {
  const { profile, isLoading } = useAuthContext();
  const router = useRouter();

  // ── Operator gate (UI). Server-side gate lives in the RPC. ────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!profile?.is_operator) {
      try {
        router.replace('/');
      } catch {
        // ignore
      }
    }
  }, [profile, isLoading]);

  const [isSaving, setIsSaving] = useState(false);

  // Restaurant fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTest, setIsTest] = useState(false);

  // Places autocomplete (on the name field — searches name/address)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deal fields
  const [dealTitle, setDealTitle] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [tags, setTags] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | 'bogo'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, []);

  const fetchSuggestions = (text: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!text || text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      // Best-effort: returns [] when the `places` edge function / Google key is
      // not configured — manual entry below still works in that case.
      const results = await placesAutocomplete(text);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
  };

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    setGooglePlaceId(suggestion.placeId);
    setIsResolvingPlace(true);
    try {
      const details = await placeDetails(suggestion.placeId);
      // Populate canonical name, address and coordinates from the resolved place.
      setName(details?.name || suggestion.description);
      if (details?.address) setAddress(details.address);
      else setAddress(suggestion.description);
      if (details?.lat != null && details?.lng != null) {
        setLatitude(String(details.lat));
        setLongitude(String(details.lng));
      }
    } catch {
      // Keep whatever the user typed; they can enter coordinates manually.
      setName(suggestion.description);
    } finally {
      setIsResolvingPlace(false);
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

  const toggleRecurrenceDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setCity('');
    setPhone('');
    setType('');
    setWebsiteUrl('');
    setLatitude('');
    setLongitude('');
    setGooglePlaceId('');
    setImageUrl('');
    setIsTest(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setDealTitle('');
    setDealDescription('');
    setTags('');
    setDiscountType('percent');
    setDiscountValue('');
    setOriginalPrice('');
    setIsRecurring(false);
    setRecurrenceDays([]);
    setStartTime('');
    setEndTime('');
    setStartDate('');
    setEndDate('');
  };

  const validate = (): { lat: number; lng: number } | null => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Restaurant name is required.');
      return null;
    }
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Missing location', 'Select a place or enter latitude & longitude.');
      return null;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid location', 'Latitude must be -90..90 and longitude -180..180.');
      return null;
    }
    if (!dealTitle.trim()) {
      Alert.alert('Missing field', 'Deal title is required.');
      return null;
    }
    if (isRecurring) {
      if (recurrenceDays.length === 0) {
        Alert.alert('Missing field', 'Select at least one day for the recurring deal.');
        return null;
      }
      if (!startTime.trim() || !endTime.trim()) {
        Alert.alert('Missing field', 'Set start and end times (HH:MM:SS) for the recurring deal.');
        return null;
      }
    } else {
      if (!startDate.trim() || !endDate.trim()) {
        Alert.alert('Missing field', 'Set start and end dates (YYYY-MM-DD) for the deal.');
        return null;
      }
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        Alert.alert('Invalid dates', 'Enter valid dates in YYYY-MM-DD format.');
        return null;
      }
      if (s > e) {
        Alert.alert('Invalid dates', 'End date must be after start date.');
        return null;
      }
    }
    if (discountType !== 'bogo' && discountValue) {
      const v = parseFloat(discountValue);
      if (isNaN(v) || v <= 0 || (discountType === 'percent' && v > 100)) {
        Alert.alert('Invalid discount', 'Enter a valid discount value.');
        return null;
      }
    }
    return { lat, lng };
  };

  const handleSubmit = async () => {
    const coords = validate();
    if (!coords) return;

    setIsSaving(true);
    try {
      const result = await ingestRestaurantWithDeal({
        name: name.trim(),
        lat: coords.lat,
        lng: coords.lng,
        dealTitle: dealTitle.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        type: type.trim() || null,
        phone: phone.trim() || null,
        heroImageUrl: imageUrl.trim() || null,
        googlePlaceId: googlePlaceId.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        isTest,
        dealDescription: dealDescription.trim() || null,
        dealTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        isRecurring,
        recurrenceDays: isRecurring ? recurrenceDays : null,
        recurrenceStartTime: isRecurring ? startTime.trim() : null,
        recurrenceEndTime: isRecurring ? endTime.trim() : null,
        startAt: !isRecurring ? new Date(startDate).toISOString() : null,
        endAt: !isRecurring ? new Date(endDate).toISOString() : null,
        discountType: discountType,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      });

      if (result.ok) {
        Alert.alert('Restaurant added', 'The restaurant and its deal were created.', [
          { text: 'Add another', onPress: resetForm },
        ]);
        resetForm();
      } else if (result.code === 'duplicate') {
        Alert.alert('Possible duplicate', result.message);
      } else if (result.code === 'not_operator') {
        Alert.alert('Not authorized', result.message);
      } else {
        Alert.alert('Could not create restaurant', result.message);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  // While unauthorized (redirecting) render nothing.
  if (isLoading || !profile?.is_operator) {
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
            try { router.back(); } catch { router.replace('/admin'); }
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FE902A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Restaurant</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.disabled]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator size="small" color="#FE902A" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Restaurant</Text>

        {/* Name with Google Places autocomplete */}
        <View style={styles.section}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setName(t);
              setGooglePlaceId('');
              fetchSuggestions(t);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search a restaurant (Google Places) or type manually"
            placeholderTextColor="#C7C7CC"
            autoCorrect={false}
          />
          {isResolvingPlace && <Text style={styles.helpText}>Resolving place…</Text>}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.placeId}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                    <Ionicons name="location-outline" size={14} color="#8E8E93" style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{item.description}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
          <Text style={styles.helpText}>
            Selecting a suggestion fills the canonical name, address, place ID and
            coordinates. If Google Places isn&apos;t configured, enter fields manually.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street, city, province" placeholderTextColor="#C7C7CC" />
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g., Toronto" placeholderTextColor="#C7C7CC" />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Type</Text>
            <TextInput style={styles.input} value={type} onChangeText={setType} placeholder="e.g., Italian" placeholderTextColor="#C7C7CC" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor="#C7C7CC" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Website</Text>
          <TextInput style={styles.input} value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://…  (lets the deal agent enrich it)" placeholderTextColor="#C7C7CC" autoCapitalize="none" keyboardType="url" />
        </View>

        {/* Coordinates */}
        <View style={styles.section}>
          <Text style={styles.label}>Location *</Text>
          {latitude && longitude ? (
            <View style={styles.coordsDisplay}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.coordsText}>{parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}</Text>
            </View>
          ) : (
            <Text style={styles.coordsMissing}>Select a place above, or enter coordinates manually.</Text>
          )}
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput style={styles.input} value={latitude} onChangeText={setLatitude} placeholder="43.6532" placeholderTextColor="#C7C7CC" keyboardType="decimal-pad" />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput style={styles.input} value={longitude} onChangeText={setLongitude} placeholder="-79.3832" placeholderTextColor="#C7C7CC" keyboardType="decimal-pad" />
            </View>
          </View>
        </View>

        {/* Photo (manual upload only — no Google photo fetch) */}
        <View style={styles.section}>
          <Text style={styles.label}>Restaurant photo</Text>
          <View style={styles.imageInputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={imageUrl} onChangeText={setImageUrl} placeholder="Upload a photo →" placeholderTextColor="#C7C7CC" autoCapitalize="none" />
            <TouchableOpacity style={[styles.iconButton, isUploadingImage && styles.disabled]} onPress={handleUploadImage} disabled={isUploadingImage}>
              {isUploadingImage ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cloud-upload" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.heroPreview} />
            </View>
          ) : null}
        </View>

        {/* Visibility */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Operators only (test)</Text>
            <Text style={styles.helpText}>Hidden from normal users; visible only to operators.</Text>
          </View>
          <Switch value={isTest} onValueChange={setIsTest} trackColor={{ false: '#E5E5EA', true: '#FE902A' }} thumbColor="#FFFFFF" />
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>First deal</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Deal title *</Text>
          <TextInput style={styles.input} value={dealTitle} onChangeText={setDealTitle} placeholder="e.g., Happy Hour" placeholderTextColor="#C7C7CC" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={dealDescription} onChangeText={setDealDescription} placeholder="Deal details…" placeholderTextColor="#C7C7CC" multiline numberOfLines={4} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
          <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="Comma-separated, e.g. drinks, dinner" placeholderTextColor="#C7C7CC" />
        </View>

        {/* Discount */}
        <View style={styles.section}>
          <Text style={styles.label}>Discount type</Text>
          <View style={styles.chipRow}>
            {(['percent', 'fixed', 'bogo'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, discountType === t && styles.chipSelected]} onPress={() => setDiscountType(t)}>
                <Text style={[styles.chipText, discountType === t && styles.chipTextSelected]}>
                  {t === 'percent' ? '% Off' : t === 'fixed' ? '$ Off' : 'BOGO'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {discountType !== 'bogo' && (
          <View style={styles.section}>
            <Text style={styles.label}>{discountType === 'percent' ? 'Discount %' : 'Discount amount ($)'}</Text>
            <TextInput style={styles.input} value={discountValue} onChangeText={setDiscountValue} placeholder={discountType === 'percent' ? 'e.g., 20' : 'e.g., 5.00'} placeholderTextColor="#C7C7CC" keyboardType="numeric" />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>{discountType === 'bogo' ? 'Item price ($)' : 'Original price ($)'}</Text>
          <TextInput style={styles.input} value={originalPrice} onChangeText={setOriginalPrice} placeholder="e.g., 15.99" placeholderTextColor="#C7C7CC" keyboardType="numeric" />
        </View>

        {/* Schedule */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Recurring deal</Text>
            <Text style={styles.helpText}>Repeats on specific days/times.</Text>
          </View>
          <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: '#E5E5EA', true: '#FE902A' }} thumbColor="#FFFFFF" />
        </View>

        {isRecurring ? (
          <View style={styles.section}>
            <Text style={styles.label}>Valid days *</Text>
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map((day, index) => (
                <TouchableOpacity key={index} style={[styles.dayButton, recurrenceDays.includes(index) && styles.dayButtonSelected]} onPress={() => toggleRecurrenceDay(index)}>
                  <Text style={[styles.dayButtonText, recurrenceDays.includes(index) && styles.dayButtonTextSelected]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Start time *</Text>
                <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="17:00:00" placeholderTextColor="#C7C7CC" />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>End time *</Text>
                <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="21:00:00" placeholderTextColor="#C7C7CC" />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Start date *</Text>
                <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#C7C7CC" />
              </View>
              <View style={styles.rowItem}>
                <Text style={styles.label}>End date *</Text>
                <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#C7C7CC" />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.submitButton, isSaving && styles.disabled]} onPress={handleSubmit} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Create restaurant & deal</Text>}
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
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
  saveButtonText: { color: '#FE902A', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginBottom: 16, marginTop: 4 },
  section: { marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#000000', marginBottom: 8 },
  helpText: { fontSize: 13, color: '#8E8E93', marginTop: 8 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, fontSize: 16, color: '#000000', borderWidth: 1, borderColor: '#E5E5EA' },
  textArea: { height: 96, textAlignVertical: 'top' },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 200,
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  suggestionText: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 18 },
  coordsDisplay: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF4', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#34C759', marginBottom: 8 },
  coordsText: { fontSize: 14, color: '#333', fontWeight: '500' },
  coordsMissing: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic', marginBottom: 8 },
  imageInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconButton: { backgroundColor: '#FE902A', width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  imagePreviewContainer: { marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E5EA', backgroundColor: '#F5F5F5', alignItems: 'center' },
  heroPreview: { width: '100%', height: 160 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 8 },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E5E5EA', alignItems: 'center' },
  chipSelected: { backgroundColor: '#FE902A', borderColor: '#FE902A' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  chipTextSelected: { color: '#FFFFFF' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E5E5EA' },
  dayButtonSelected: { backgroundColor: '#FE902A', borderColor: '#FE902A' },
  dayButtonText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  dayButtonTextSelected: { color: '#FFFFFF' },
  submitButton: { backgroundColor: '#FE902A', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
