/**
 * Tests for DealCard.tsx
 *
 * TDD Phase 2 — Deals Accuracy Button
 *
 * Tests verify:
 * 1. Thumbs buttons are hidden for partner venues (isPartner=true)
 * 2. Thumbs buttons are shown for non-partner venues (isPartner=false / default)
 * 3. Tapping thumbs-up calls supabase upsert with correct payload
 * 4. Tapping thumbs-down calls supabase upsert with type='thumbs_down'
 * 5. Unauthenticated tap shows Alert instead of inserting
 * 6. Optimistic UI: button shows active state immediately after tap
 * 7. Error rollback: active state reverts if supabase call fails
 */

import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DealCard from '../DealCard';
import { Deal } from '@/types/restaurant';
import { supabase } from '@/app/lib/supabase';

// Use moduleNameMapper mock
jest.mock('@/app/lib/supabase');

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    text: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    card: '#fff',
    border: '#e0e0e0',
    background: '#f5f5f5',
    primary: '#FE902A',
    isDark: false,
  }),
}));

jest.mock('@/utils/activity', () => ({
  calculateSavings: jest.fn(() => 0),
}));

jest.mock('@/components/DealQRCode', () => 'DealQRCode');

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.spyOn(Alert, 'alert');

const mockDeal: Deal = {
  id: 'deal-001',
  restaurant_id: 'rest-001',
  title: '20% Off All Mains',
  discount_type: 'percent',
  discount_value: 20,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// Helper to get a fresh mock chain per test
function getMockSupabase() {
  return supabase as jest.Mocked<typeof supabase>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DealCard accuracy buttons visibility', () => {
  it('does NOT render thumbs buttons when isPartner=true', () => {
    const { queryByTestId } = render(
      <DealCard deal={mockDeal} isPartner={true} />
    );
    expect(queryByTestId('thumbs-up-button')).toBeNull();
    expect(queryByTestId('thumbs-down-button')).toBeNull();
  });

  it('renders thumbs-up and thumbs-down buttons when isPartner=false', () => {
    const { getByTestId } = render(
      <DealCard deal={mockDeal} isPartner={false} />
    );
    expect(getByTestId('thumbs-up-button')).toBeTruthy();
    expect(getByTestId('thumbs-down-button')).toBeTruthy();
  });

  it('renders thumbs buttons by default (isPartner omitted)', () => {
    const { getByTestId } = render(<DealCard deal={mockDeal} />);
    expect(getByTestId('thumbs-up-button')).toBeTruthy();
    expect(getByTestId('thumbs-down-button')).toBeTruthy();
  });
});

describe('DealCard accuracy button interactions', () => {
  it('calls supabase upsert with thumbs_up when authenticated user taps thumbs-up', async () => {
    const mockFrom = getMockSupabase().from as jest.Mock;
    const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    (getMockSupabase().auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { getByTestId } = render(<DealCard deal={mockDeal} isPartner={false} />);
    fireEvent.press(getByTestId('thumbs-up-button'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('deal_flags');
      expect(mockUpsert).toHaveBeenCalledWith(
        { deal_id: 'deal-001', user_id: 'user-123', type: 'thumbs_up' },
        { onConflict: 'deal_id,user_id' }
      );
    });
  });

  it('calls supabase upsert with thumbs_down when authenticated user taps thumbs-down', async () => {
    const mockFrom = getMockSupabase().from as jest.Mock;
    const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    (getMockSupabase().auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { getByTestId } = render(<DealCard deal={mockDeal} isPartner={false} />);
    fireEvent.press(getByTestId('thumbs-down-button'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        { deal_id: 'deal-001', user_id: 'user-123', type: 'thumbs_down' },
        { onConflict: 'deal_id,user_id' }
      );
    });
  });

  it('shows Alert when unauthenticated user taps thumbs-up', async () => {
    (getMockSupabase().auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { getByTestId } = render(<DealCard deal={mockDeal} isPartner={false} />);
    fireEvent.press(getByTestId('thumbs-up-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign in required',
        expect.any(String),
        expect.any(Array)
      );
    });
    // Supabase insert should NOT be called
    expect(getMockSupabase().from).not.toHaveBeenCalledWith('deal_flags');
  });

  it('shows thumbs-up in active state after tapping (optimistic UI)', async () => {
    const mockFrom = getMockSupabase().from as jest.Mock;
    // Delay resolution to test optimistic state
    const mockUpsert = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: null, error: null }), 100))
    );
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    (getMockSupabase().auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { getByTestId } = render(<DealCard deal={mockDeal} isPartner={false} />);
    fireEvent.press(getByTestId('thumbs-up-button'));

    // Immediately after press, optimistic state should be set
    await waitFor(() => {
      expect(getByTestId('thumbs-up-button-active')).toBeTruthy();
    });
  });

  it('rolls back optimistic state when supabase call fails', async () => {
    const mockFrom = getMockSupabase().from as jest.Mock;
    const mockUpsert = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    (getMockSupabase().auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { getByTestId, queryByTestId } = render(
      <DealCard deal={mockDeal} isPartner={false} />
    );
    fireEvent.press(getByTestId('thumbs-up-button'));

    // After error resolves, active state should be rolled back
    await waitFor(() => {
      expect(queryByTestId('thumbs-up-button-active')).toBeNull();
    });
  });
});
