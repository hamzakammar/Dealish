/**
 * Tests for listView.tsx (RestaurantCard + RestaurantList)
 *
 * TDD Phase 1 — Image Load Speed Optimization
 *
 * Tests verify:
 * 1. expo-image Image renders when restaurant has an image URL (testID present)
 * 2. Placeholder renders when no image URL (testID present)
 * 3. FlatList testID is present (confirms perf props were added alongside)
 */

import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render } from '@testing-library/react-native';
import RestaurantList from '../listView';
import { Restaurant } from '@/types/restaurant';

// Map @/app/lib/supabase to our mock via moduleNameMapper in package.json
jest.mock('@/app/lib/supabase');

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/components/RatingDisplay', () => 'RatingDisplay');

jest.mock('@/utils/distance', () => ({
  calculateDistance: jest.fn(() => 1.5),
  formatDistance: jest.fn(() => '1.5 km'),
}));

const mockRestaurant: Restaurant = {
  id: 'rest-001',
  name: 'Test Bistro',
  lat: 43.6532,
  lng: -79.3832,
  partner: false,
  type: 'Italian',
  rating: 4.5,
  rating_count: 120,
  image_url: 'https://example.com/image.jpg',
};

const mockRestaurantNoImage: Restaurant = {
  id: 'rest-002',
  name: 'No Image Cafe',
  lat: 43.65,
  lng: -79.38,
  type: 'Cafe',
};

const userLocation = { lat: 43.65, lng: -79.38 };

describe('RestaurantCard image rendering', () => {
  it('renders expo-image element when restaurant has an image URL', () => {
    const { getByTestId } = render(
      <RestaurantList
        restaurants={[mockRestaurant]}
        onRestaurantPress={jest.fn()}
        selectedRestaurant={null}
        userLocation={userLocation}
      />
    );
    expect(getByTestId('restaurant-image-rest-001')).toBeTruthy();
  });

  it('renders placeholder when restaurant has no image URL', () => {
    const { getByTestId } = render(
      <RestaurantList
        restaurants={[mockRestaurantNoImage]}
        onRestaurantPress={jest.fn()}
        selectedRestaurant={null}
        userLocation={userLocation}
      />
    );
    expect(getByTestId('image-placeholder-rest-002')).toBeTruthy();
  });
});

describe('RestaurantList FlatList', () => {
  it('renders the FlatList with testID', () => {
    const { getByTestId } = render(
      <RestaurantList
        restaurants={[mockRestaurant, mockRestaurantNoImage]}
        onRestaurantPress={jest.fn()}
        selectedRestaurant={null}
        userLocation={userLocation}
      />
    );
    expect(getByTestId('restaurant-flatlist')).toBeTruthy();
  });
});
