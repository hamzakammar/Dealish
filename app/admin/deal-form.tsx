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
  const { restaurantId, dealId } = useLocalSearchParams<{ restaurantId: string; dealId?: string }>();
  
  const [isLoading, setIsLoading] = useState(!!dealId);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  
  // One-time deal dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Recurring deal settings
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (dealId) {
      fetchDeal();
    }
  }, [dealId]);

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
      if (new Date(startDate) > new Date(endDate)) {
        Alert.alert('Error', 'End date must be after start date');
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
        // Update existing deal
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', dealId);

        if (error) throw error;
        Alert.alert('Success', 'Deal updated successfully');
      } else {
        // Create new deal
        const { data, error } = await supabase
          .from('deals')
          .insert([dealData])
          .select()
          .single();

        if (error) throw error;

        // Send notifications for new deal if active
        if (isActive && data) {
          try {
            await notifyNewDeal(data.id, restaurantId, title, description);
          } catch (notifError) {
            console.error('Error sending notifications:', notifError);
            // Don't fail the deal creation if notifications fail
          }
        }

        Alert.alert('Success', 'Deal created successfully');
      }

      // Small delay to ensure success message is seen
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
        <Text style={styles.headerTitle}>{dealId ? 'Edit Deal' : 'Create Deal'}</Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveDeal}
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
          <Text style={styles.label}>Deal Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., 20% off all pizzas"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add details about your deal..."
            placeholderTextColor="#C7C7CC"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tags (comma separated)</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="e.g., pizza, lunch, dinner"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        {/* Active Status */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Active</Text>
              <Text style={styles.helpText}>Deal will be visible to customers</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#E5E5EA', true: '#FE902A' }}
            />
          </View>
        </View>

        {/* Recurring Toggle */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Recurring Deal</Text>
              <Text style={styles.helpText}>Repeats on specific days/times</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: '#E5E5EA', true: '#FE902A' }}
            />
          </View>
        </View>

        {/* Recurring Settings */}
        {isRecurring ? (
          <>
            <View style={styles.section}>
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

            <View style={styles.section}>
              <Text style={styles.label}>Start Time (HH:MM:SS) *</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="e.g., 11:00:00"
                placeholderTextColor="#C7C7CC"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>End Time (HH:MM:SS) *</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="e.g., 14:00:00"
                placeholderTextColor="#C7C7CC"
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Start Date *</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#C7C7CC"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>End Date *</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#C7C7CC"
              />
            </View>
          </>
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
    marginTop: 2,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dayButtonSelected: {
    backgroundColor: '#FE902A',
    borderColor: '#FE902A',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
});
