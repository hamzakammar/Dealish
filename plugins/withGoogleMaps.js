const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withGoogleMaps(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Get the API key from environment variable
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Only add the API key if it's provided
    if (apiKey && apiKey.trim() !== '') {
      // Find or create the meta-data element for Google Maps API key
      if (!mainApplication['meta-data']) {
        mainApplication['meta-data'] = [];
      }

      // Check if API key meta-data already exists
      const existingApiKey = mainApplication['meta-data'].find(
        (item) => item.$['android:name'] === 'com.google.android.geo.API_KEY'
      );

      if (existingApiKey) {
        // Update existing API key
        existingApiKey.$['android:value'] = apiKey;
      } else {
        // Add new API key meta-data
        mainApplication['meta-data'].push({
          $: {
            'android:name': 'com.google.android.geo.API_KEY',
            'android:value': apiKey,
          },
        });
      }
    }

    return config;
  });
};
