import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Deal } from '@/types/restaurant';
import { notifyNewDeal } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DealForm() {
  const { profile } = useAuthContext();
  const router = useRouter();
  const { restaurantId, dealId, recommendationId, suggestedTitle, suggestedDescription, suggestedDiscount } = useLocalSearchParams<{ 
    restaurantId: string; 
    dealId?: string;
    recommendationId?: string;
    suggestedTitle?: string;
    suggestedDescription?: string;
    suggestedDiscount?: string;
  }>();
  
  const [isLoading, setIsLoading] = useState(!!dealId);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState(suggestedTitle || '');
  const [description, setDescription] = useState(suggestedDescription || '');
  const [tags, setTags] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);

  // Discount fields for savings tracking
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | 'bogo'>(
    suggestedDiscount ? 'percent' : 'percent'
  );
  const [discountValue, setDiscountValue] = useState(suggestedDiscount || '');
  const [originalPrice, setOriginalPrice] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (dealId) {
      fetchDeal();
    } else if (suggestedTitle) {
      setTitle(suggestedTitle);
      if (suggestedDescription) {
        setDescription(suggestedDescription);
      }
      const today = new Date();
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(weekFromNow.toISOString().split('T')[0]);
    }
  }, [dealId, suggestedTitle, suggestedDescription]);

  const fetchDeal = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (error) throw error;

      if (data) {
        setTitle(data.title);
        setDescription(data.description || '');
        setTags(data.tags?.join(', ') || '');
        setIsActive(data.is_active);
        setIsRecurring(data.is_recurring || false);

        // Load discount fields
        if (data.discount_type) setDiscountType(data.discount_type);
        if (data.discount_value) setDiscountValue(String(data.discount_value));
        if (data.original_price) setOriginalPrice(String(data.original_price));

        if (data.is_recurring) {
          setRecurrenceDays(data.recurrence_days || []);
          setStartTime(data.recurrence_start_time || '');
          setEndTime(data.recurrence_end_time || '');
        } else {
          setStartDate(data.start_at ? new Date(data.start_at).toISOString().split('T')[0] : '');
          setEndDate(data.end_at ? new Date(data.end_at).toISOString().split('T')[0] : '');
        }
      }
    } catch (error) {
      console.error('Error fetching deal:', error);
      Alert.alert('Error', 'Failed to load deal');
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

  const toggleRecurrenceDay = (day: number) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a deal title');
      return false;
    }

    if (isRecurring) {
      if (recurrenceDays.length === 0) {
        Alert.alert('Error', 'Please select at least one day for recurring deal');
        return false;
      }
      if (!startTime || !endTime) {
        Alert.alert('Error', 'Please set start and end times for recurring deal');
        return false;
      }
    } else {
      if (!startDate || !endDate) {
        Alert.alert('Error', 'Please set start and end dates for the deal');
        return false;
      }
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
        Alert.alert('Error', 'Please enter valid dates in YYYY-MM-DD format');
        return false;
      }
      if (parsedStart > parsedEnd) {
        Alert.alert('Error', 'End date must be after start date');
        return false;
      }
    }

    // Validate discount fields
    if (discountType === 'percent' && discountValue) {
      const pct = parseFloat(discountValue);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        Alert.alert('Error', 'Discount percentage must be between 1 and 100');
        return false;
      }
    }
    if (discountType === 'fixed' && discountValue) {
      const amt = parseFloat(discountValue);
      if (isNaN(amt) || amt <= 0) {
        Alert.alert('Error', 'Discount amount must be greater than 0');
        return false;
      }
    }
    if (originalPrice) {
      const price = parseFloat(originalPrice);
      if (isNaN(price) || price <= 0) {
        Alert.alert('Error', 'Original price must be greater than 0');
        return false;
      }
    }

    return true;
  };

  const saveDeal = async () => {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const dealData: Partial<Deal> = {
        restaurant_id: restaurantId,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        is_active: isActive,
        is_recurring: isRecurring,
        discount_type: discountType,
        discount_value: discountValue ? parseFloat(discountValue) : undefined,
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,
      };

      if (isRecurring) {
        dealData.recurrence_days = recurrenceDays;
        dealData.recurrence_start_time = startTime;
        dealData.recurrence_end_time = endTime;
        dealData.start_at = undefined;
        dealData.end_at = undefined;
      } else {
        dealData.start_at = new Date(startDate).toISOString();
        dealData.end_at = new Date(endDate).toISOString();
        dealData.recurrence_days = undefined;
        dealData.recurrence_start_time = undefined;
        dealData.recurrence_end_time = undefined;
      }

      if (dealId) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', dealId);

        if (error) throw error;
        Alert.alert('Success', 'Deal updated successfully');
      } else {
        const { data, error } = await supabase
          .from('deals')
          .insert([dealData])
          .select()
          .single();

        if (error) throw error;

        if (isActive && data) {
          try {
            await notifyNewDeal(data.id, restaurantId, title, description);
          } catch (notifError) {
            console.error('Error sending notifications:', notifError);
          }
        }

        Alert.alert('Success', 'Deal created successfully');

        if (recommendationId && data) {
          try {
            await supabase
              .from('deal_recommendations')
              .update({ 
                status: 'created',
                deal_id: data.id 
              })
              .eq('id', recommendationId);
          } catch (error) {
            console.error('Error updating recommendation:', error);
          }
        }
      }

      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error saving deal:', error);
      Alert.alert('Error', 'Failed to save deal');
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
        <Text style={styles.headerTitle}>{dealId ? 'Edit Deal' : 'Create Deal'}</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveDeal}
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
            <Text style={styles.label}>Deal Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., 20% off all pizzas"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add details about your deal..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tags</Text>
            <Text style={styles.helpText}>Separate tags with commas</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="e.g., pizza, lunch, dinner"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Discount & Savings</Text>
          <Text style={[styles.helpText, { marginTop: -12, marginBottom: 16 }]}>
            Used to track customer savings when they redeem this deal
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Discount Type</Text>
            <View style={styles.discountTypeRow}>
              {(['percent', 'fixed', 'bogo'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.discountTypeButton,
                    discountType === type && styles.discountTypeButtonSelected,
                  ]}
                  onPress={() => setDiscountType(type)}
                >
                  <Text
                    style={[
                      styles.discountTypeText,
                      discountType === type && styles.discountTypeTextSelected,
                    ]}
                  >
                    {type === 'percent' ? '% Off' : type === 'fixed' ? '$ Off' : 'BOGO'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {discountType !== 'bogo' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {discountType === 'percent' ? 'Discount Percentage' : 'Discount Amount ($)'}
              </Text>
              <TextInput
                style={styles.input}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === 'percent' ? 'e.g., 20' : 'e.g., 5.00'}
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {discountType === 'bogo' ? 'Item Price ($)' : 'Original Price ($)'}
            </Text>
            <Text style={styles.helpText}>
              {discountType === 'bogo'
                ? 'Price of one item (savings = getting one free)'
                : 'Helps calculate exact savings for customers'}
            </Text>
            <TextInput
              style={styles.input}
              value={originalPrice}
              onChangeText={setOriginalPrice}
              placeholder="e.g., 15.99"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Active</Text>
              <Text style={styles.settingDescription}>Deal will be visible to customers</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#E2E8F0', true: '#FE902A' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Recurring Deal</Text>
              <Text style={styles.settingDescription}>Repeats on specific days/times</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: '#E2E8F0', true: '#FE902A' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {isRecurring ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Recurring Schedule</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days of Week *</Text>
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      recurrenceDays.includes(index) && styles.dayButtonSelected
                    ]}
                    onPress={() => toggleRecurrenceDay(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      recurrenceDays.includes(index) && styles.dayButtonTextSelected
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Time *</Text>
              <Text style={styles.helpText}>Format: HH:MM:SS (e.g., 11:00:00)</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="11:00:00"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Time *</Text>
              <Text style={styles.helpText}>Format: HH:MM:SS (e.g., 14:00:00)</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="14:00:00"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date *</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date *</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
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
    marginBottom: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dayButtonSelected: {
    backgroundColor: '#FE902A',
    borderColor: '#FE902A',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  discountTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  discountTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  discountTypeButtonSelected: {
    backgroundColor: '#FE902A',
    borderColor: '#FE902A',
  },
  discountTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  discountTypeTextSelected: {
    color: '#FFFFFF',
  },
});
