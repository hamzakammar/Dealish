# Release Commands Reference Guide

## 📱 EAS Build & Submit Commands

### **1. Build Commands**

#### Build for Android (Production)
```bash
eas build --platform android --profile production
```

#### Build for iOS (Production)
```bash
eas build --platform ios --profile production
```

#### Build for Both Platforms (Production)
```bash
eas build --platform all --profile production
```

#### Build for Preview/Testing
```bash
# Android preview
eas build --platform android --profile preview

# iOS preview
eas build --platform ios --profile preview
```

#### Build Development Client
```bash
eas build --platform android --profile development
eas build --platform ios --profile development
```

---

### **2. Submit to App Stores**

#### Submit Android to Google Play Store
```bash
eas submit --platform android --profile production
```
**Note:** Requires Google Play service account key (`dealish-483419-8e5a47ccf671.json`)

#### Submit iOS to App Store
```bash
eas submit --platform ios --profile production
```
**Note:** Requires Apple Developer account credentials

#### Submit Both Platforms
```bash
eas submit --platform all --profile production
```

---

### **3. OTA Updates (Over-The-Air)**

#### Publish Update to All Platforms
```bash
eas update --branch main --message "Your update message"
```

#### Publish Update for Specific Platforms
```bash
# iOS only
eas update --branch main --message "iOS update" --platform ios

# Android only
eas update --branch main --message "Android update" --platform android

# Both (explicit)
eas update --branch main --message "Update" --platform ios --platform android
```

#### Publish Update with Non-Interactive Mode (CI/CD)
```bash
CI=1 eas update --branch main --message "Automated update" --platform ios --platform android
```

---

### **4. Build Status & Management**

#### Check Build Status
```bash
eas build:list
```

#### View Specific Build Details
```bash
eas build:view [BUILD_ID]
```

#### Cancel a Build
```bash
eas build:cancel [BUILD_ID]
```

#### Download Build Artifacts
```bash
eas build:download [BUILD_ID]
```

---

### **5. Configuration Commands**

#### Configure EAS Project
```bash
eas build:configure
```

#### Update App Version
```bash
# Update version in app.json, then:
eas build --platform all --profile production --auto-submit
```

#### View Current Configuration
```bash
eas config
```

---

### **6. Environment Variables**

#### Set Environment Variables for Build
```bash
# Set in EAS dashboard or use:
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
eas secret:create --scope project --name EXPO_PUBLIC_ORS_API_KEY --value "your-key"
eas secret:create --scope project --name EXPO_PUBLIC_AUTH_REDIRECT_URL --value "your-url"
```

#### List Environment Variables
```bash
eas secret:list
```

---

### **7. Complete Release Workflow**

#### **Full Release to Both Stores:**

**Step 1: Update Version (if needed)**
- Edit `app.json`: `"version": "1.0.2"` (increment as needed)

**Step 2: Commit Changes**
```bash
git add .
git commit -m "Release v1.0.2 - Android bug fixes"
git push origin main
```

**Step 3: Build for Both Platforms**
```bash
eas build --platform all --profile production
```

**Step 4: Submit to Stores**
```bash
eas submit --platform all --profile production
```

**Step 5: Publish OTA Update (Optional)**
```bash
eas update --branch main --message "Bug fixes and improvements" --platform ios --platform android
```

---

### **8. Quick Release (Build + Submit)**

#### Android Only
```bash
eas build --platform android --profile production --auto-submit
```

#### iOS Only
```bash
eas build --platform ios --profile production --auto-submit
```

#### Both Platforms
```bash
eas build --platform all --profile production --auto-submit
```

---

### **9. Pre-Release Checklist**

Before running release commands, verify:

- [ ] **Version Updated**: Check `app.json` version number
- [ ] **Environment Variables Set**: 
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_ORS_API_KEY` (if using directions)
  - `EXPO_PUBLIC_AUTH_REDIRECT_URL`
- [ ] **Bundle Identifiers**: Update if needed
  - iOS: `com.anonymous.Dealish` → Your actual bundle ID
  - Android: `com.anonymous.Dealish` → Your actual package name
- [ ] **Google Play Service Account**: `dealish-483419-8e5a47ccf671.json` available (for Android submit)
- [ ] **Apple Developer Account**: Credentials configured (for iOS submit)
- [ ] **Code Committed**: All changes committed and pushed
- [ ] **Testing Complete**: App tested on both platforms

---

### **10. Common Release Scenarios**

#### **Scenario A: Bug Fix Release**
```bash
# 1. Fix bugs
# 2. Update version in app.json
# 3. Commit
git commit -m "Fix: Android marker rendering issues"
git push

# 4. Build and submit
eas build --platform all --profile production --auto-submit

# 5. Publish OTA update (for users with app already installed)
eas update --branch main --message "Bug fixes" --platform ios --platform android
```

#### **Scenario B: Feature Release**
```bash
# 1. Add features
# 2. Update version (minor bump: 1.0.1 → 1.1.0)
# 3. Commit
git commit -m "Feature: New search functionality"
git push

# 4. Build and submit
eas build --platform all --profile production --auto-submit
```

#### **Scenario C: Hotfix (OTA Update Only)**
```bash
# For small fixes that don't require native changes
eas update --branch main --message "Hotfix: Search bar improvements" --platform ios --platform android
```

---

### **11. Build Profiles Reference**

From `eas.json`:

- **`development`**: Development client builds
- **`preview`**: Internal testing builds
- **`production`**: App store builds (with auto-increment)

---

### **12. Important Notes**

1. **Build Time**: 
   - Android builds: ~15-20 minutes
   - iOS builds: ~20-30 minutes
   - Both platforms: ~30-45 minutes total

2. **Auto-Increment**: 
   - Production profile has `autoIncrement: true`
   - Version numbers increment automatically

3. **OTA Updates**:
   - Only work for JavaScript/asset changes
   - Cannot update native code (requires new build)
   - Users must have compatible runtime version

4. **Google Play Submission**:
   - Requires service account JSON file
   - File should be in project root: `dealish-483419-8e5a47ccf671.json`
   - Already in `.gitignore` (safe)

5. **iOS Submission**:
   - Requires Apple Developer account
   - May need to configure App Store Connect
   - First submission requires manual setup in App Store Connect

---

### **13. Troubleshooting Commands**

#### Check EAS CLI Version
```bash
eas --version
```

#### Update EAS CLI
```bash
npm install -g eas-cli@latest
```

#### Login to EAS
```bash
eas login
```

#### View Project Info
```bash
eas project:info
```

#### Clear Build Cache
```bash
eas build --platform android --profile production --clear-cache
```

---

## 🚀 Quick Reference Card

```bash
# BUILD
eas build --platform android --profile production
eas build --platform ios --profile production
eas build --platform all --profile production

# SUBMIT
eas submit --platform android --profile production
eas submit --platform ios --profile production
eas submit --platform all --profile production

# UPDATE (OTA)
eas update --branch main --message "Update message" --platform ios --platform android

# BUILD + SUBMIT (Combined)
eas build --platform all --profile production --auto-submit
```

---

## 📋 Current Configuration

- **Project ID**: `c8d4d9ee-1ec9-4e2c-a60f-fa51168853fe`
- **Current Version**: `1.0.1` (in app.json)
- **Runtime Version Policy**: `appVersion`
- **Updates URL**: `https://u.expo.dev/c8d4d9ee-1ec9-4e2c-a60f-fa51168853fe`

---

**Remember**: Always test builds before submitting to production!
