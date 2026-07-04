import * as Haptics from 'expo-haptics';

export const lightTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const mediumTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
