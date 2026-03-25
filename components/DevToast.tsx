import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LockOpen } from "lucide-react-native";

interface DevToastProps {
  visible: boolean;
  onHide: () => void;
}

export default function DevToast({ visible, onHide }: DevToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);

      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      hideTimeout.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -80,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onHide());
      }, 2000);
    }

    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [visible]);

  if (!visible) return null;

  const topOffset = insets.top + 8;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.inner}>
        <LockOpen size={16} color="#22C55E" />
        <Text style={styles.text}>Developer mode activated 🔓</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1A1A2E",
    borderLeftWidth: 4,
    borderLeftColor: "#22C55E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
    letterSpacing: 0.2,
  },
});
