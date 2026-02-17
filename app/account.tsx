import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import { RecentActivityCard } from "@/components/RecentActivityCard";
import { useProfileSetup } from "@/hooks/useProfileSetup";
import { ActivityWithRestaurant } from "@/types/activity";
import AntDesign from "@expo/vector-icons/AntDesign";
import * as ImagePicker from 'expo-image-picker';
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

// Type assertion for ImagePicker
const imagePicker = ImagePicker as any;

async function getFavouriteCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("favourites")
    .eq("id", userId)
    .single();

  if (error || !data) return 0;
  return Array.isArray(data.favourites) ? data.favourites.length : 0;
}


export default function AccountPage() {
    const { session, profile, refetchProfile } = useAuthContext();
    const { needsSetup } = useProfileSetup();
    const [loading, setLoading] = useState<boolean>(true);
    const [userEmail, setUserEmail] = useState<string>("");
    const [userName, setUserName] = useState<string>("User");
    const [userLocation, setUserLocation] = useState<string>("");
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [numFavourites, setNumFavourites] = useState<number>(0);
    const [numVisits, setNumVisits] = useState<number>(0);
    const [dollarsSaved, setDollarsSaved] = useState<number>(0);
    const [recentActivity, setRecentActivity] = useState<ActivityWithRestaurant[]>([]);

    // Edit mode state
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editingName, setEditingName] = useState<string>("");
    const [editingLocation, setEditingLocation] = useState<string>("");
    const [editingAvatar, setEditingAvatar] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    // Dynamic labels based on count
    const favouritesLabel = numFavourites === 1 ? "Favourite" : "Favourites";

    // Image picker function
    const pickImage = async () => {
        try {
            const { status } = await imagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                const { showSettingsAlert, getPermissionInfo } = require('@/utils/permissions');
                const info = getPermissionInfo('mediaLibrary');
                showSettingsAlert(
                    info.title,
                    info.settingsDescription
                );
                return;
            }

            const result = await imagePicker.launchImageLibraryAsync({
                mediaTypes: imagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                setEditingAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to open image picker');
        }
    };

    // Start editing
    const startEditing = () => {
        setEditingName(userName);
        setEditingLocation(userLocation);
        setEditingAvatar(userAvatar);
        setIsEditing(true);
    };

    // Cancel editing
    const cancelEditing = () => {
        setIsEditing(false);
        setEditingName("");
        setEditingLocation("");
        setEditingAvatar(null);
    };

    // Save profile changes
    const saveProfile = async () => {
        if (!session?.user?.id) return;

        setSaving(true);
        try {
            let avatarUrl = editingAvatar;

            // Upload new image if it was changed and is a local file
            if (editingAvatar && editingAvatar !== userAvatar && editingAvatar.startsWith('file://')) {
                try {
                    const response = await fetch(editingAvatar);
                    const blob = await response.blob();
                    const fileName = `${session.user.id}_${Date.now()}.jpg`;

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(fileName, blob);

                    if (uploadError) {
                        console.error('Error uploading image:', uploadError);
                        Alert.alert('Error', 'Failed to upload image');
                        setSaving(false);
                        return;
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(fileName);

                    avatarUrl = publicUrl;
                } catch (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    Alert.alert('Error', 'Failed to upload image');
                    setSaving(false);
                    return;
                }
            }

            // Update profile
            // avatar_url is stored in profiles table and synced from Google auth on sign-in
            const updateData: { display_name: string; location: string; avatar_url?: string } = {
                display_name: editingName,
                location: editingLocation,
            };
            
            // Only update avatar_url if a new avatar was uploaded
            if (avatarUrl && avatarUrl !== userAvatar) {
                updateData.avatar_url = avatarUrl;
            }
            
            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', session.user.id);

            if (error) {
                console.error('Error updating profile:', error);
                Alert.alert('Error', 'Failed to update profile');
            } else {
                // Refresh profile from database to get updated data
                await refetchProfile();
                Alert.alert('Success', 'Profile updated successfully!');
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        // Redirect to onboarding if profile is incomplete
        if (needsSetup && session) {
            try {
              router.replace('/onboarding');
            } catch (error) {
              console.error('Navigation error:', error);
            }
            return;
        }

        const loadProfile = async () => {
            setLoading(true);
            if (!session?.user) {
                setLoading(false);
                return;
            }

            try {
                setUserEmail(session.user.email || "");

                // Sync avatar from Google auth for existing users if profile doesn't have one
                if (profile && !profile.avatar_url) {
                    const googleAvatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
                    if (googleAvatarUrl && session.user.id) {
                        // Silently sync in background - don't block UI
                        (async () => {
                            try {
                                const { error: syncError } = await supabase
                                    .from('profiles')
                                    .update({ avatar_url: googleAvatarUrl })
                                    .eq('id', session.user.id);
                                if (syncError) {
                                    console.error('Error syncing avatar for existing user:', syncError);
                                }
                            } catch (syncErr) {
                                console.error('Error syncing avatar:', syncErr);
                            }
                        })();
                    }
                }

                // Load from profile object if available, fallback to session metadata
                // Note: profile.avatar_url is prioritized - it contains either:
                // 1. Custom uploaded avatar, or
                // 2. Google auth avatar (synced automatically on sign-in)
                if (profile) {
                    setUserName(profile.display_name || session.user.user_metadata?.name || "User");
                    setUserAvatar(profile.avatar_url || session.user.user_metadata?.avatar_url || null);
                    setUserLocation(profile.location || "");
                } else {
                    const metadata = session.user.user_metadata;
                    if (metadata?.display_name) {
                        setUserName(metadata.display_name);
                    } else if (metadata?.name) {
                        setUserName(metadata.name);
                    }

                    if (metadata?.avatar_url) {
                        setUserAvatar(metadata.avatar_url);
                    }
                    setUserLocation("");
                }
            } catch (error) {
                console.error("Error loading profile:", error);
            } finally {
                setLoading(false);
            }
        };

        const loadFavourites = async () => {
            if (session?.user?.id) {
                const count = await getFavouriteCount(session.user.id);
                setNumFavourites(count);
            } else {
                setNumFavourites(0);
            }
        };

        const loadStats = async () => {
            if (!profile?.recents) {
                setNumVisits(0);
                setDollarsSaved(0);
                return;
            }

            try {
                // Get visit count
                const visitsCount = profile.recents.filter(activity => activity.activity_type === 'visit').length;
                setNumVisits(visitsCount);

                // Get total dollars saved
                const totalSaved = profile.recents
                    .filter(activity => activity.activity_type === 'redemption')
                    .reduce((sum, activity) => sum + (activity.amount_saved || 0), 0);

                setDollarsSaved(totalSaved);
            } catch (error) {
                console.error("Error loading stats:", error);
                setNumVisits(0);
                setDollarsSaved(0);
            }
        };

        const loadRecentActivity = async () => {
            if (!profile?.recents) {
                setRecentActivity([]);
                return;
            }

            try {
                // Sort by created_at descending and take first 5
                const sortedActivities = profile.recents
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 5);

                // Fetch restaurant data for each activity
                const activitiesWithRestaurants = await Promise.all(
                    sortedActivities.map(async (activity) => {
                        try {
                            const { data: restaurant } = await supabase
                                .from('restaurants')
                                .select('name, logo_url, rating, num_ratings')
                                .eq('id', activity.restaurant_id)
                                .single();

                            return {
                                ...activity,
                                restaurants: restaurant ? {
                                    name: restaurant.name,
                                    logo_url: restaurant.logo_url,
                                    rating: restaurant.rating,
                                    rating_count: restaurant.num_ratings
                                } : {
                                    name: 'Unknown Restaurant',
                                    logo_url: null,
                                    rating: undefined,
                                    rating_count: undefined
                                }
                            };
                        } catch (error) {
                            console.error('Error fetching restaurant for activity:', error);
                            return {
                                ...activity,
                                restaurants: {
                                    name: 'Unknown Restaurant',
                                    logo_url: null
                                }
                            };
                        }
                    })
                );

                setRecentActivity(activitiesWithRestaurants);
            } catch (error) {
                console.error("Error loading recent activity:", error);
                setRecentActivity([]);
            }
        };

        loadProfile();
        loadFavourites();
        loadStats();
        loadRecentActivity();
    }, [session, profile, needsSetup]);


    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Orange Header */}
            <View style={styles.headerBg}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => {
                    try {
                      router.back();
                    } catch (error) {
                      console.error('Navigation error:', error);
                      router.replace('/map');
                    }
                  }}
                >
                    <View style={styles.backIconBox}>
                        <AntDesign name="left" size={20} color="#FE902A"/>
                    </View>
                </TouchableOpacity>

                {!isEditing && (
                    <TouchableOpacity style={styles.editButton} onPress={startEditing}>
                        <View style={styles.editIconBox}>
                            <AntDesign name="edit" size={20} color="#FE902A" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* Admin Dashboard Link */}
                {(profile?.role === 'owner' || profile?.role === 'admin') && !isEditing && (
                    <TouchableOpacity 
                        style={styles.adminButton}
                        onPress={() => {
                          try {
                            router.push('/admin');
                          } catch (error) {
                            console.error('Navigation error:', error);
                            Alert.alert('Error', 'Failed to navigate. Please try again.');
                          }
                        }}
                    >
                        <View style={styles.adminIconBox}>
                            <AntDesign name="setting" size={20} color="#FE902A" />
                        </View>
                    </TouchableOpacity>
                )}

                <View style={styles.avatarContainer}>
                    {isEditing ? (
                        <TouchableOpacity onPress={pickImage}>
                            {editingAvatar ? (
                                <Image source={{ uri: editingAvatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <AntDesign name="user" size={64} color="#FE902A" />
                                </View>
                            )}
                            <View style={styles.editOverlay}>
                                <AntDesign name="camera" size={24} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.avatar} resizeMode="cover" />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <AntDesign name="user" size={64} color="#FE902A" />
                                </View>
                            )}
                        </>
                    )}
                </View>
            </View>

            {/* Name and location */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
                {isEditing ? (
                    <View style={{ alignItems: 'center', width: '80%' }}>
                        <TextInput
                            style={[styles.name, styles.editInput, { textAlign: 'center' }]}
                            value={editingName}
                            onChangeText={setEditingName}
                            placeholder="Enter your name"
                            placeholderTextColor="#999"
                        />
                        <TextInput
                            style={[styles.location, styles.editInput, { textAlign: 'center', marginTop: 8 }]}
                            value={editingLocation}
                            onChangeText={setEditingLocation}
                            placeholder="Enter your location"
                            placeholderTextColor="#999"
                        />
                        <View style={styles.editButtons}>
                            <TouchableOpacity
                                style={[styles.editBtn, styles.cancelBtn]}
                                onPress={cancelEditing}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editBtn, styles.saveBtn]}
                                onPress={saveProfile}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <Text style={styles.name}>{userName || 'User'}</Text>
                        <Text style={styles.location}>{userLocation || 'Location not set'}</Text>
                    </>
                )}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{numVisits}</Text>
                    <Text style={styles.statLabel}>Visits</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{numFavourites}</Text>
                    <Text style={styles.statLabel}>{favouritesLabel}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: '#FE902A' }]}>${dollarsSaved}</Text>
                    <Text style={styles.statLabel}>Saved</Text>
                </View>
            </View>

            {/* Recent Activity */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={{ paddingHorizontal: 16 }}>
                {recentActivity.length > 0 ? (
                    recentActivity.map((activity, idx) => {
                        const date = new Date(activity.created_at);
                        const now = new Date();
                        const diffMs = Math.max(now.getTime() - date.getTime(), 0);
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMinutes / 60);
                        const diffDays = Math.floor(diffHours / 24);

                        let dateString;
                        if (diffMinutes < 1) {
                            dateString = "Just now";
                        } else if (diffMinutes < 60) {
                            dateString = `${diffMinutes} min ago`;
                        } else if (diffHours < 24) {
                            dateString = diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
                        } else if (diffDays === 1) {
                            dateString = "Yesterday";
                        } else if (diffDays < 7) {
                            dateString = `${diffDays} days ago`;
                        } else {
                            dateString = date.toLocaleDateString();
                        }

                        const description = activity.activity_type === 'redemption'
                            ? `Redeemed: ${activity.deal_description || 'deal'}`
                            : 'Visited restaurant';

                        return (
                            <RecentActivityCard
                                key={activity.id}
                                logo={activity.restaurants?.logo_url || "https://via.placeholder.com/56x56?text=R"}
                                name={activity.restaurants?.name || 'Unknown Restaurant'}
                                description={description}
                                date={dateString}
                                rating={activity.restaurants?.rating}
                                ratingCount={activity.restaurants?.rating_count}
                            />
                        );
                    })
                ) : (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#888', fontSize: 16 }}>No recent activity</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}


const styles = StyleSheet.create({
    headerBg: {
        backgroundColor: '#FE902A',
        height: 180,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: '30%',
        left: '6%',
        zIndex: 2,
    },
    backIconBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    avatarContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -48,
        alignItems: 'center',
        zIndex: 3,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 4,
        borderColor: '#fff',
        backgroundColor: '#eee',
    },
    avatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    name: {
        fontSize: 32,
        fontWeight: '700',
        marginTop: 56,
        color: '#222',
    },
    location: {
        fontSize: 18,
        color: '#888',
        marginTop: 4,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F7F7F7',
        borderRadius: 20,
        alignItems: 'center',
        paddingVertical: 20,
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FE902A',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 15,
        color: '#888',
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#222',
        marginLeft: 16,
        marginBottom: 12,
    },
    editButton: {
        position: 'absolute',
        top: '30%', // Use percentage values for better zoom scaling
        right: '6%', // Percentage of header width
        zIndex: 2,
    },
    adminButton: {
        position: 'absolute',
        top: '30%',
        right: '20%', // Position to the left of edit button
        zIndex: 2,
    },
    adminIconBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    editIconBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    editOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(254, 144, 42, 0.8)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editInput: {
        borderWidth: 2,
        borderColor: '#FE902A',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 20,
        fontWeight: '700',
        color: '#222',
        backgroundColor: '#fff',
        minWidth: 200,
    },
    editButtons: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12,
    },
    editBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        minWidth: 100,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    saveBtn: {
        backgroundColor: '#FE902A',
    },
    cancelBtnText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});