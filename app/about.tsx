import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  const colors = useThemeColors();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerTitle: { fontSize: 18, fontWeight: '600', fontFamily: 'Manrope', color: '#fff' },
    sectionTitle: { fontSize: 15, fontWeight: '700', fontFamily: 'Manrope', color: colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    body: { fontSize: 15, fontFamily: 'Manrope', color: colors.textSecondary, lineHeight: 23 },
    cardBox: { backgroundColor: colors.cardSecondary, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    versionText: { fontSize: 15, fontFamily: 'Manrope', color: colors.text },
    versionSub: { fontSize: 13, fontFamily: 'Manrope', color: colors.textSecondary, marginTop: 2 },
  }), [colors]);

  const features = [
    { icon: 'map-outline' as const, text: 'Browse restaurants and deals on the map' },
    { icon: 'pricetag-outline' as const, text: 'Find exclusive discounts and special offers' },
    { icon: 'qr-code-outline' as const, text: 'Scan QR codes at partner restaurants to redeem deals' },
    { icon: 'heart-outline' as const, text: 'Save your favourite restaurants for quick access' },
  ];

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={styles.backIconBox}>
            <Ionicons name="arrow-back" size={20} color="#FE902A" />
          </View>
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>About Dealish</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Mission */}
        <Text style={[dynamicStyles.sectionTitle, { marginBottom: 8 }]}>Our Mission</Text>
        <View style={dynamicStyles.cardBox}>
          <Text style={dynamicStyles.body}>
            To help you discover great food at great prices while supporting local restaurants in your community.
          </Text>
        </View>

        {/* How It Works */}
        <Text style={[dynamicStyles.sectionTitle, { marginTop: 8 }]}>How It Works</Text>
        {features.map((f, i) => (
          <View key={i} style={[dynamicStyles.cardBox, styles.featureRow]}>
            <View style={styles.iconCircle}>
              <Ionicons name={f.icon} size={20} color="#FE902A" />
            </View>
            <Text style={[dynamicStyles.body, { flex: 1 }]}>{f.text}</Text>
          </View>
        ))}

        {/* Version */}
        <Text style={[dynamicStyles.sectionTitle, { marginTop: 8 }]}>App Info</Text>
        <View style={dynamicStyles.cardBox}>
          <View style={styles.versionRow}>
            <Text style={dynamicStyles.versionText}>Version</Text>
            <Text style={dynamicStyles.versionText}>1.0.1</Text>
          </View>
          <View style={[styles.versionRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 }]}>
            <Text style={dynamicStyles.versionText}>Contact</Text>
            <Text style={dynamicStyles.versionSub}>hello@dealish.io</Text>
          </View>
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
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(254,144,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
