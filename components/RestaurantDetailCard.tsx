import { supabase } from "@/app/lib/supabase";
import DealCard from "@/components/DealCard";
import RatingDisplay from "@/components/RatingDisplay";
import { useRestaurantDeals } from "@/hooks/useRestaurantDeals";
import { Restaurant, UserLocation } from "@/types/restaurant";
import { trackVisit } from "@/utils/activity";
import { calculateDistance, formatDistance } from "@/utils/distance";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Animation configuration constants
 */
// Spring animation configuration for card slide-in
const SPRING_ANIMATION_TENSION = 65;
const SPRING_ANIMATION_FRICTION = 11;

// Duration for card slide-out animation when closing
const CLOSE_ANIMATION_DURATION_MS = 600;

// Duration for state transitions (peek/half/full) - matches entrance animation timing
const STATE_TRANSITION_DURATION_MS = 800;

// Vertical offset for card entrance/exit animation (pixels off-screen)
const CARD_ANIMATION_OFFSET = 600;

/**
 * Bottom Sheet State Heights
 * These define the three states of the restaurant detail card:
 * - PEEK: Minimal preview with just name, logo, and basic info
 * - HALF: Current default view with deals and description
 * - FULL: Expanded view with all details, photos, menu, etc.
 */
const SHEET_HEIGHT = {
  PEEK_RATIO: 0.22, // ~22% of screen height
  HALF_RATIO: 0.55, // ~55% of screen height
  FULL_RATIO: 0.95, // target ~95% of screen height
  MIN_PEEK: 180,
  MAX_PEEK_RATIO: 0.32, // cap peek on very tall screens
  MIN_HALF: 420,
  MAX_HALF_RATIO: 0.75, // cap half to avoid covering too much on small screens
  FULL_TOP_GAP: 56, // leave breathing room at top when fully expanded
};

/**
 * Gesture thresholds for state transitions
 */
const DRAG_THRESHOLD = 80;  // Pixels to drag before triggering state change
const VELOCITY_THRESHOLD = 0.5;  // Velocity for quick swipe gestures

/**
 * Sheet state type definition
 * Represents the three possible states of the bottom sheet
 */
export type SheetState = 'peek' | 'half' | 'full';

type RestaurantDetailCardProps = {
  restaurant: Restaurant;
  onClose: () => void;
  onGetDirections: () => void;
  isDirectionsAvailable?: boolean;
  userLocation?: UserLocation | null;
  /** Initial state of the sheet. Defaults to 'half' for backward compatibility */
  initialState?: SheetState;
};

export type RestaurantDetailCardRef = {
  closeWithAnimation: () => void;
};

async function fetchIsFavourite(restaurantId: string): Promise<boolean> {
  const user = await supabase.auth.getUser();
  const userId = user.data?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("favourites")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("profiles fetch error:", error.message);
    return false;
  }

  const favoriteIds = data?.favourites || [];
  return favoriteIds.includes(restaurantId);
}



const RestaurantDetailCard = forwardRef<RestaurantDetailCardRef, RestaurantDetailCardProps>(({
  restaurant,
  onClose,
  onGetDirections,
  isDirectionsAvailable = true,
  userLocation,
  initialState = 'half', // Default to 'half' for backward compatibility
}, ref) => {
  const { deals, loading: dealsLoading } = useRestaurantDeals(restaurant.id);
  const [isFavouriteState, setIsFavouriteState] = useState<boolean>(false);
  
  /**
   * Sheet state management
   * Controls which view state the bottom sheet is currently in
   */
  const [sheetState, setSheetState] = useState<SheetState>(initialState);
  
  /**
   * Get screen dimensions for calculating full state height
   */
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    let mounted = true;

    // Track visit when restaurant detail is opened
    trackVisit(restaurant.id);

    fetchIsFavourite(restaurant.id)
      .then((fav) => {
        if (mounted) setIsFavouriteState(fav);
      })
      .catch((e) => console.warn(e));
    return () => {
      mounted = false;
    };
  }, [restaurant.id]);

  async function toggleFavourite(restaurantId: string): Promise<void> {
    const user = await supabase.auth.getUser();
    const profileId = user.data?.user?.id;
    if (!profileId) {
      console.warn("Not authenticated");
      return;
    }

    const prev = isFavouriteState;
    setIsFavouriteState(!prev); // optimistic update

    try {
      if (!prev) {
        const { error } = await supabase.rpc("append_favourite", {
          p_profile_id: profileId,
          p_restaurant_id: restaurantId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("remove_favourite", {
          p_profile_id: profileId,
          p_restaurant_id: restaurantId,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      console.warn("toggleFavourite error:", e.message ?? e);
      setIsFavouriteState(prev); // rollback
    }
  }

  // Calculate distance if user location is available
  const distance = useMemo(() => {
    if (!userLocation) return null;
    const dist = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      restaurant.lat,
      restaurant.lng
    );
    return formatDistance(dist);
  }, [userLocation, restaurant.lat, restaurant.lng]);
  
  /**
   * Clamp helper for height bounds
   */
  const clampHeight = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  };

  /**
   * Calculate adaptive heights for each state based on device size
   */
  const getSheetHeight = (state: SheetState = sheetState): number => {
    const peekBase = screenHeight * SHEET_HEIGHT.PEEK_RATIO;
    const peek = clampHeight(
      peekBase,
      SHEET_HEIGHT.MIN_PEEK,
      screenHeight * SHEET_HEIGHT.MAX_PEEK_RATIO,
    );

    const halfBase = screenHeight * SHEET_HEIGHT.HALF_RATIO;
    const half = clampHeight(
      halfBase,
      Math.max(SHEET_HEIGHT.MIN_HALF, peek + 40), // keep some gap above peek
      screenHeight * SHEET_HEIGHT.MAX_HALF_RATIO,
    );

    const fullBase = screenHeight * SHEET_HEIGHT.FULL_RATIO;
    const full = clampHeight(
      fullBase,
      screenHeight * 0.9, // ensure we stay near-full on short screens
      screenHeight - SHEET_HEIGHT.FULL_TOP_GAP, // leave breathing room for status/safe area
    );

    switch (state) {
      case 'peek':
        return peek;
      case 'half':
        return half;
      case 'full':
        return full;
      default:
        return half;
    }
  };

  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  /**
   * Animated height for smooth state transitions while keeping footer anchored.
   */
  const sheetHeightAnim = useRef(new Animated.Value(getSheetHeight(initialState))).current;
  const closingRestaurantIdRef = useRef<string | null>(null);
  const lastDragY = useRef(0);
  const isDragging = useRef(false);
  /**
   * Prevents multiple state transitions from happening simultaneously
   * Set to true during animation, false when complete
   */
  const isAnimating = useRef(false);

  useEffect(() => {
    // Reset animation and sheet state when restaurant changes
    slideAnim.setValue(0);
    dragY.setValue(0);
    sheetHeightAnim.setValue(getSheetHeight(initialState));
    lastDragY.current = 0;
    isDragging.current = false;
    closingRestaurantIdRef.current = null;
    setSheetState(initialState); // Reset to initial state
  
    // Animate card entrance
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [restaurant.id, initialState]);

  /**
   * Animate vertical offset when sheet state changes
   */
  useEffect(() => {
    Animated.timing(sheetHeightAnim, {
      toValue: getSheetHeight(sheetState),
      duration: STATE_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [sheetState, screenHeight]);

  /**
   * Pan responder for drag gestures on the handle/header area
   * Handles both upward expansion and downward collapse/dismissal
   * Recreated when sheet state changes to ensure correct state is captured
   */
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Always allow starting the pan responder on the draggable area
        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Respond to both upward and downward swipes
        const isVerticalSwipe = Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dx) < 50;
        return isVerticalSwipe;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        dragY.setOffset(lastDragY.current);
        dragY.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Allow both upward (negative) and downward (positive) dragging
        dragY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        isDragging.current = false;
        dragY.flattenOffset();

        /**
         * Prevent state transitions if an animation is already in progress
         * This prevents multiple state changes from a single gesture
         */
        if (isAnimating.current) {
          // Snap back to original position if animating
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: false,
            tension: SPRING_ANIMATION_TENSION,
            friction: SPRING_ANIMATION_FRICTION,
          }).start(() => {
            lastDragY.current = 0;
          });
          return;
        }

        /**
         * Handle state transitions based on drag direction and distance
         * Upward swipe (negative dy): Expand to next state
         * Downward swipe (positive dy): Collapse to previous state or close
         */
        
        // Downward swipe - collapse or close
        if (gestureState.dy > DRAG_THRESHOLD || gestureState.vy > VELOCITY_THRESHOLD) {
          // Determine action based on current state
          if (sheetState === 'peek') {
            // From peek, swipe down closes the card
            closingRestaurantIdRef.current = restaurant.id;
            Animated.timing(dragY, {
              toValue: CARD_ANIMATION_OFFSET,
              duration: CLOSE_ANIMATION_DURATION_MS,
              useNativeDriver: false,
            }).start(() => {
              dragY.setValue(0);
              lastDragY.current = 0;
              if (closingRestaurantIdRef.current === restaurant.id) {
                handleClose();
              }
            });
          } else if (sheetState === 'half') {
            // From half, swipe down goes to peek
            isAnimating.current = true;
            setSheetState('peek');
            Animated.timing(dragY, {
              toValue: 0,
              duration: STATE_TRANSITION_DURATION_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              lastDragY.current = 0;
              isAnimating.current = false;
            });
          } else if (sheetState === 'full') {
            // From full, swipe down goes to half
            isAnimating.current = true;
            setSheetState('half');
            Animated.timing(dragY, {
              toValue: 0,
              duration: STATE_TRANSITION_DURATION_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              lastDragY.current = 0;
              isAnimating.current = false;
            });
          }
        } 
        // Upward swipe - expand to next state
        else if (gestureState.dy < -DRAG_THRESHOLD || gestureState.vy < -VELOCITY_THRESHOLD) {
          if (sheetState === 'peek') {
            // From peek, swipe up goes to half
            isAnimating.current = true;
            setSheetState('half');
            Animated.timing(dragY, {
              toValue: 0,
              duration: STATE_TRANSITION_DURATION_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              lastDragY.current = 0;
              isAnimating.current = false;
            });
          } else if (sheetState === 'half') {
            // From half, swipe up goes to full
            isAnimating.current = true;
            setSheetState('full');
            Animated.timing(dragY, {
              toValue: 0,
              duration: STATE_TRANSITION_DURATION_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              lastDragY.current = 0;
              isAnimating.current = false;
            });
          }
          // From full, swipe up does nothing (already at max)
        } else {
          // Snap back to original position (drag was too small)
          Animated.timing(dragY, {
            toValue: 0,
            duration: STATE_TRANSITION_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }).start(() => {
            lastDragY.current = 0;
          });
        }
      },
    });
  }, [sheetState]);  // Recreate when sheet state changes to capture current state

  const handleClose = () => {
    // Prevent double-triggering close while animation is running
    if (closingRestaurantIdRef.current) return;

    // Store the restaurant ID when close animation starts
    closingRestaurantIdRef.current = restaurant.id;
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: CLOSE_ANIMATION_DURATION_MS,
      useNativeDriver: false,
    }).start(() => {
      closingRestaurantIdRef.current = null;
      // Only notify parent after the close animation finishes, otherwise the
      // parent will unmount this component and the animation will be cut off.
      onClose();
    });
  };

  // Expose handleClose method to parent via ref
  useImperativeHandle(ref, () => ({
    closeWithAnimation: handleClose,
  }));

  const baseTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_ANIMATION_OFFSET, 0],
  });

  // Combine base animation with drag gesture and state offset
  const translateY = Animated.add(baseTranslateY, dragY);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: sheetHeightAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Hero image section - full state only, positioned absolutely to fill from top */}
      {sheetState === 'full' && (restaurant.display_image || restaurant.image_url) && (
        <View style={styles.heroFullContainer}>
          <Image
            source={{ uri: restaurant.display_image || restaurant.image_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{restaurant.name}</Text>
            <View style={styles.heroRatingContainer}>
              <RatingDisplay
                rating={restaurant.rating}
                ratingCount={restaurant.rating_count}
                size={18}
                showCount={true}
                textColor="#fff"
              />
            </View>
            {restaurant.address && (
              <View style={styles.heroAddressRow}>
                <AntDesign name="environment" size={14} color="#fff" />
                <Text style={styles.heroAddressText}>{restaurant.address}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Draggable area: handle + header */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.draggableArea,
          sheetState === 'full' && styles.draggableAreaOverlayFull,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.dragHandle} />

        <View style={[styles.header, sheetState === 'full' && styles.headerOverlayFull]} pointerEvents="auto">
          <View style={styles.headerMain}>
            {sheetState !== 'full' && (
              <View style={styles.logoContainer}>
                {(restaurant.logo_url || restaurant.image_url) ? (
                  <Image
                    source={{ uri: restaurant.logo_url || restaurant.image_url }}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.logo, styles.logoPlaceholder]}>
                    <AntDesign name="picture" size={24} color="#ccc" />
                  </View>
                )}
              </View>
            )}
            <View style={styles.headerContent}>
              <Text style={[styles.restaurantName, sheetState === 'full' && styles.restaurantNameOverlayFull]}>
                {restaurant.name}
              </Text>
              {sheetState === 'half' && (
                <RatingDisplay
                  rating={restaurant.rating}
                  ratingCount={restaurant.rating_count}
                  size={14}
                  showCount={true}
                />
              )}
              {/* Show address and distance in half and full states */}
              {sheetState !== 'peek' && sheetState !== 'full' && restaurant.address && (
                <View style={styles.addressRow}>
                  <AntDesign name="environment" size={14} color="#666" />
                  <Text style={styles.addressText}>{restaurant.address}</Text>
                </View>
              )}
              {sheetState !== 'peek' && sheetState !== 'full' && distance && (
                <View style={styles.distanceRow}>
                  <AntDesign name="environment" size={14} color="#FE902A" />
                  <Text style={styles.distanceText}>{distance} away</Text>
                </View>
              )}
              {/* Show distance only in peek state */}
              {sheetState === 'peek' && distance && (
                <Text style={styles.peekDistanceText}>{distance} away</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.closeButton, sheetState === 'full' && styles.closeButtonOverlayFull]}
            onPress={handleClose}
          >
            <AntDesign name="close" size={20} color={sheetState === 'full' ? '#fff' : '#333'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Content area - only show in half and full states */}
      {sheetState !== 'peek' && (
        <ScrollView
          style={[styles.content, sheetState === 'full' && styles.contentFullState]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sheetState === 'full' ? styles.fullScrollContent : styles.scrollContent}
          pointerEvents="auto"
          scrollEnabled={sheetState === 'full'} // Only allow scrolling in full state
        >
          {/* Description - show in half state only */}
          {sheetState === 'half' && restaurant.description && (
            <View style={styles.section}>
              <Text style={styles.description}>{restaurant.description}</Text>
            </View>
          )}

          {/* Deals section */}
          <View style={sheetState === 'full' ? styles.fullDealsSection : styles.dealsSection}>
            <Text style={styles.sectionTitle}>Available Deals</Text>
            {dealsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FE902A" />
              </View>
            ) : deals.length > 0 ? (
              deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
            ) : (
              <View style={styles.emptyState}>
                <AntDesign name="inbox" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No deals available</Text>
              </View>
            )}
          </View>
          
          {/* Additional content for full state only */}
          {sheetState === 'full' && (
            <View style={styles.fullStateContent}>
              {/* Placeholder for future full state content */}
            </View>
          )}
        </ScrollView>
      )}

      {/* Footer - always visible */}
      <View style={styles.footer} pointerEvents="auto">
        {isDirectionsAvailable && (
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => {
              setSheetState('peek');
              onGetDirections();
            }}
          >
            <AntDesign
              name="arrow-right"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.favoriteButton,
            { backgroundColor: isFavouriteState ? "#fff" : "#FE902A" }
          ]}
          onPress={() => {
            toggleFavourite(restaurant.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isFavouriteState ? "Remove from favourites" : "Add to favourites"
          }
        >
          <AntDesign
            name="heart"
            size={20}
            color={isFavouriteState ? "#FF0000" : "#fff"}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/**
 * Component Styles
 * 
 * Key styling notes:
 * - Container uses dynamic height based on sheet state
 * - Fixed height removed in favor of calculated height
 * - Drag handle provides visual affordance for gestures
 * - Header remains visible in all states
 * - Content area conditionally renders based on state
 * - Footer with actions always visible
 */
const styles = StyleSheet.create({
  /**
   * Main container - positioned at bottom with dynamic height
   * Height changes based on sheet state (peek/half/full)
   */
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Height is set dynamically via inline style based on sheetState
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 2, // Above the overlay
  },
  /**
   * Draggable area - wraps drag handle and header for gesture recognition
   */
  draggableArea: {
    // Wraps drag handle and header for drag gesture
  },
  draggableAreaOverlayFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  /**
   * Visual drag handle - indicates draggable area
   */
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerOverlayFull: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  headerMain: {
    flexDirection: "row",
    flex: 1,
    marginRight: 12,
  },
  logoContainer: {
    marginRight: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
  },
  headerContent: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  restaurantNameOverlayFull: {
    color: 'transparent',
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  addressText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    color: "#FE902A",
    fontWeight: "600",
  },
  /**
   * Peek state styles - simplified distance display
   */
  peekDistanceText: {
    fontSize: 13,
    color: "#FE902A",
    fontWeight: "500",
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonOverlayFull: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentFullState: {
    marginTop: 280, // account for hero image height
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  fullScrollContent: {
    paddingBottom: 10,
  },
  /**
   * Hero section for full state - positioned absolutely
   */
  heroFullContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    zIndex: 0,
  },
  /**
   * Hero section for full state
   */
  heroSection: {
    position: 'relative',
    height: 280,
    marginBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  heroRatingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroAddressText: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  dealsSection: {
    marginTop: 8,
  },
  fullDealsSection: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  /**
   * Full state content styles
   */
  fullStateContent: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    flexDirection: "row",
    gap: 12,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: "#FE902A",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FE902A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default RestaurantDetailCard;