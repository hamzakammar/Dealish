import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";

type DirectionsButtonProps = {
  onPress: () => void;
  onClose: () => void;
};

export default function DirectionsButton({
  onPress,
  onClose,
}: DirectionsButtonProps) {
  return (
    <View style={styles.directionsContainer}>
      <TouchableOpacity style={styles.directionsButton} onPress={onPress}>
        <AntDesign
          name="arrow-right"
          size={18}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.directionsButtonText}>Get Directions</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <AntDesign name="close" size={18} color="#333" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  directionsContainer: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  closeButton: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

