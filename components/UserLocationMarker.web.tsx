import { UserLocation } from "@/types/restaurant";

/**
 * Web-only placeholder for UserLocationMarker.
 * This prevents the Metro/Vercel bundler from attempting to load
 * react-native-maps Marker component (which is native-only).
 *
 * Mobile users will get the full marker functionality from
 * components/UserLocationMarker.tsx.
 */

type UserLocationMarkerProps = {
  location: UserLocation;
};

export default function UserLocationMarker(props: UserLocationMarkerProps) {
  // No-op component for web builds
  return null;
}
