const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withEntitlementsModification(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    
    // Find all build configurations
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    Object.keys(configurations).forEach((configId) => {
      const buildSettings = configurations[configId].buildSettings;
      if (buildSettings) {
        // Set CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION to YES
        buildSettings.CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION = 'YES';
      }
    });
    
    return config;
  });
};
