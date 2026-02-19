import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';

export default function PartnerScreen() {
  const handleEmailPress = () => {
    Linking.openURL('mailto:partners@dealish.com?subject=Partner Inquiry');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partner With Us</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.title}>Grow Your Restaurant Business</Text>
          <Text style={styles.description}>
            Join Dealish and connect with thousands of food lovers in your area. 
            Partner with us to increase foot traffic, boost sales, and build lasting customer relationships.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Benefits of Partnering</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="people" size={24} color="#FE902A" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Reach More Customers</Text>
              <Text style={styles.benefitDescription}>
                Get discovered by thousands of users actively looking for great deals
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="trending-up" size={24} color="#FE902A" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Increase Sales</Text>
              <Text style={styles.benefitDescription}>
                Attract new customers and encourage repeat visits with exclusive offers
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="analytics" size={24} color="#FE902A" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Track Performance</Text>
              <Text style={styles.benefitDescription}>
                Access analytics and insights about your deals and customer engagement
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="qr-code" size={24} color="#FE902A" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Easy Redemption</Text>
              <Text style={styles.benefitDescription}>
                Simple QR code system makes it easy for customers to redeem deals
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Started</Text>
          <Text style={styles.description}>
            Ready to partner with us? Contact our team to learn more about our partnership program and how we can help grow your business.
          </Text>
          
          <TouchableOpacity style={styles.contactButton} onPress={handleEmailPress}>
            <Text style={styles.contactButtonText}>Contact Us</Text>
            <Ionicons name="mail" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  benefitText: {
    flex: 1,
    marginLeft: 16,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#FE902A',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});
