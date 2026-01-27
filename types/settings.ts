export type NotificationSettings = {
  deals: boolean;
  visits: boolean;
  favorites: boolean;
};

export type PrivacySettings = {
  shareLocation: boolean;
  showVisits: boolean;
};

export type AppearanceSettings = {
  theme: 'light' | 'dark' | 'auto';
  defaultMapType: 'standard' | 'satellite' | 'hybrid' | 'terrain';
};

export type UserSettings = {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  appearance: AppearanceSettings;
};

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    deals: true,
    visits: true,
    favorites: true,
  },
  privacy: {
    shareLocation: true,
    showVisits: false,
  },
  appearance: {
    theme: 'auto',
    defaultMapType: 'standard',
  },
};
