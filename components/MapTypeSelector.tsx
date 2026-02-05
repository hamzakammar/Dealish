import { MapType } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type MapTypeSelectorProps = {
  mapType: MapType;
  onMapTypeChange: (type: MapType) => void;
};

const mapTypes: { label: string; value: MapType }[] = [
  { label: "Standard", value: "standard" },
  { label: "Satellite", value: "satellite" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Terrain", value: "terrain" },
];

export default function MapTypeSelector({
  mapType,
  onMapTypeChange,
}: MapTypeSelectorProps) {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <View style={styles.mapTypeContainer}>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setShowMenu(!showMenu)}
      >
        <AntDesign name="menu" size={18} color="black" />
      </TouchableOpacity>

      {showMenu && (
        <View style={styles.menu}>
          {mapTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.menuItem,
                mapType === type.value && styles.menuItemActive,
              ]}
              onPress={() => {
                onMapTypeChange(type.value);
                setShowMenu(false);
              }}
            >
              <Text
                style={[
                  styles.menuItemText,
                  mapType === type.value && styles.menuItemTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapTypeContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 1,
  },
  menuButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: 50,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    minWidth: 120,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemActive: {
    backgroundColor: "#FE902A",
  },
  menuItemText: {
    fontSize: 14,
    color: "#333",
  },
  menuItemTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});

