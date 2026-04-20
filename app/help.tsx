import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_ITEMS = [
  {
    q: 'How do I redeem a deal?',
    a: 'When you visit a partner restaurant, open the deal in the app and scan the QR code displayed at the restaurant to redeem your discount.',
  },
  {
    q: 'Can I use multiple deals at once?',
    a: 'Typically, only one deal can be used per visit. Check the specific terms of each deal for details.',
  },
  {
    q: 'How do I find restaurants near me?',
    a: 'Use the map view to see all restaurants in your area. You can also use filters to find specific cuisines or types of deals.',
  },
  {
    q: 'How do I save favourite restaurants?',
    a: 'Tap on a restaurant marker or card, then tap the heart icon to add it to your favourites. Access your favourites from the account menu.',
  },
  {
    q: 'Why can\'t I find a specific restaurant?',
    a: 'We\'re constantly adding new partner restaurants. If your favourite spot isn\'t listed yet, ask them to sign up at dealish.io/partner.',
  },
];

function FaqItem({ item, colors }: { item: typeof FAQ_ITEMS[0]; colors: ReturnType<typeof useThemeColors> }) {
  const [open, setOpen] = useState(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    question: { fontSize: 15, fontFamily: 'Manrope', fontWeight: '600', color: colors.text, flex: 1, paddingRight: 8 },
    answer: { fontSize: 14, fontFamily: 'Manrope', color: colors.textSecondary, lineHeight: 22, marginTop: 10 },
    card: { backgroundColor: colors.cardSecondary, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  }), [colors]);

  return (
    <TouchableOpacity
      style={dynamicStyles.card}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen(v => !v);
      }}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={dynamicStyles.question}>{item.q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#FE902A" />
      </View>
      {open && <Text style={dynamicStyles.answer}>{item.a}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const colors = useThemeColors();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerTitle: { fontSize: 18, fontWeight: '600', fontFamily: 'Manrope', color: '#fff' },
    sectionTitle: { fontSize: 15, fontWeight: '700', fontFamily: 'Manrope', color: colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    contactCard: { backgroundColor: colors.cardSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    contactText: { fontSize: 15, fontFamily: 'Manrope', color: colors.textSecondary, lineHeight: 22 },
    contactEmail: { fontSize: 15, fontFamily: 'Manrope', fontWeight: '600', color: '#FE902A', marginTop: 6 },
  }), [colors]);

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={styles.backIconBox}>
            <Ionicons name="arrow-back" size={20} color="#FE902A" />
          </View>
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={dynamicStyles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQ_ITEMS.map((item, i) => (
          <FaqItem key={i} item={item} colors={colors} />
        ))}

        <Text style={[dynamicStyles.sectionTitle, { marginTop: 16 }]}>Need More Help?</Text>
        <View style={dynamicStyles.contactCard}>
          <Text style={dynamicStyles.contactText}>
            If you have additional questions or need support, reach out to us:
          </Text>
          <Text style={dynamicStyles.contactEmail}>hello@dealish.io</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FE902A',
  },
  backButton: { padding: 4 },
  backIconBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { width: 44 },
  content: { padding: 16, paddingBottom: 40 },
});
