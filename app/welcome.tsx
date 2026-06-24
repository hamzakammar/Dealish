import { useThemeColors } from '@/hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useRef, useState, useMemo } from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface WelcomeSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: WelcomeSlide[] = [
  {
    id: '1',
    icon: 'restaurant-outline',
    title: 'Discover Local Deals',
    description: 'Find exclusive deals and discounts at your favorite restaurants near you.',
    color: '#FE902A',
  },
  {
    id: '2',
    icon: 'qr-code-outline',
    title: 'Easy QR Redemption',
    description: 'Simply scan a QR code at the restaurant to redeem your deal instantly.',
    color: '#FF6B6B',
  },
  {
    id: '3',
    icon: 'time-outline',
    title: 'Limited Time Offers',
    description: 'Get notified about flash deals and time-sensitive offers in real-time.',
    color: '#4ECDC4',
  },
  {
    id: '4',
    icon: 'heart-outline',
    title: 'Save Your Favorites',
    description: 'Save restaurants and deals you love to access them quickly anytime.',
    color: '#95E1D3',
  },
];

export default function WelcomeScreen() {
  const colors = useThemeColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    skipText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    inactiveDot: {
      width: 8,
      backgroundColor: colors.isDark ? '#444' : '#E5E5EA',
    },
  }), [colors]);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
      router.replace('/map');
    } catch (error) {
      console.error('Error saving welcome status:', error);
      // Still navigate even if storage fails
      router.replace('/map');
    }
  };

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
      router.replace('/map');
    } catch (error) {
      console.error('Error saving welcome status:', error);
      // Still navigate even if storage fails
      router.replace('/map');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ isViewable: boolean; index: number | null }> }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const renderSlide = ({ item }: { item: WelcomeSlide }) => (
    <View style={styles.slide}>
      <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={80} color="#FFFFFF" />
      </View>
      <Text style={dynamicStyles.title}>{item.title}</Text>
      <Text style={dynamicStyles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={dynamicStyles.container}>
      {/* Skip Button */}
      {currentIndex < slides.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={dynamicStyles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
      />

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex ? styles.activeDot : dynamicStyles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <TouchableOpacity testID="welcome-next-button" accessibilityLabel={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'} style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  bottomContainer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#FE902A',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#FE902A',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});
