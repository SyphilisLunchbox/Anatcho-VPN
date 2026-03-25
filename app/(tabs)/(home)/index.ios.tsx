import React, { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Shield, Lock, Zap } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DevToast from "@/components/DevToast";

const DEV_PREMIUM_KEY = "dev_premium_unlocked";
const TAP_TARGET = 7;
const TAP_WINDOW_MS = 2000;

function AnimatedPressable({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [toastVisible, setToastVisible] = useState(false);

  const tapCount = useRef(0);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = async () => {
    if (Platform.OS === "ios") {
      try {
        const Haptics = await import("expo-haptics");
        tapCount.current += 1;
        console.log(`[DevUnlock] Logo tap ${tapCount.current}/${TAP_TARGET}`);

        if (tapCount.current < TAP_TARGET) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        tapCount.current += 1;
        console.log(`[DevUnlock] Logo tap ${tapCount.current}/${TAP_TARGET}`);
      }
    } else {
      tapCount.current += 1;
      console.log(`[DevUnlock] Logo tap ${tapCount.current}/${TAP_TARGET}`);
    }

    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    tapResetTimer.current = setTimeout(() => {
      if (tapCount.current < TAP_TARGET) {
        console.log("[DevUnlock] Tap sequence reset (timeout)");
      }
      tapCount.current = 0;
    }, TAP_WINDOW_MS);

    if (tapCount.current >= TAP_TARGET) {
      tapCount.current = 0;
      if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
      console.log("[DevUnlock] Developer mode activated — storing flag");
      await AsyncStorage.setItem(DEV_PREMIUM_KEY, "true");
      setToastVisible(true);
    }
  };

  const handleTorPress = () => {
    console.log("[HomeScreen] User pressed Tor-over-VPN button");
    router.push("/tor");
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Anarcho VPN",
          headerStyle: { backgroundColor: "#0D0D14" },
          headerTintColor: "#fff",
          headerTitleStyle: { color: "#fff", fontWeight: "700" },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <DevToast visible={toastVisible} onHide={() => setToastVisible(false)} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header — tap logo 7x to unlock dev mode */}
          <View style={styles.header}>
            <Pressable onPress={handleLogoTap} hitSlop={8}>
              <View style={styles.headerIconRow}>
                <Shield size={22} color="#7C3AED" />
              </View>
            </Pressable>
            <Text style={styles.appName}>Anarcho VPN</Text>
            <Text style={styles.appTagline}>Privacy without compromise</Text>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusDot} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>VPN Status</Text>
              <Text style={styles.statusValue}>Not Connected</Text>
            </View>
            <Lock size={18} color="#6B7280" />
          </View>

          {/* Feature Cards */}
          <Text style={styles.sectionTitle}>Features</Text>

          {/* Tor-over-VPN Card */}
          <AnimatedPressable onPress={handleTorPress} style={styles.torCard}>
            <View style={styles.torCardLeft}>
              <View style={styles.torIconCircle}>
                <Text style={styles.torEmoji}>🧅</Text>
              </View>
              <View style={styles.torInfo}>
                <View style={styles.torTitleRow}>
                  <Text style={styles.torTitle}>Tor-over-VPN</Text>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                </View>
                <Text style={styles.torDesc}>
                  Route traffic through the Tor network for maximum anonymity
                </Text>
              </View>
            </View>
            <View style={styles.torChevron}>
              <Text style={styles.torChevronText}>›</Text>
            </View>
          </AnimatedPressable>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Zap size={18} color="#7C3AED" />
              <Text style={styles.statValue}>50+</Text>
              <Text style={styles.statLabel}>Servers</Text>
            </View>
            <View style={styles.statCard}>
              <Shield size={18} color="#22C55E" />
              <Text style={styles.statValue}>30+</Text>
              <Text style={styles.statLabel}>Countries</Text>
            </View>
            <View style={styles.statCard}>
              <Lock size={18} color="#F59E0B" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Logs</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0D0D14",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: "center",
    paddingVertical: 28,
  },
  headerIconRow: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2D2D4E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F9FAFB",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 13,
    color: "#6B7280",
    letterSpacing: 0.2,
  },

  // Status card
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E35",
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 15,
    color: "#E5E7EB",
    fontWeight: "600",
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Tor card
  torCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111120",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D2D4E",
    padding: 16,
    marginBottom: 24,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  torCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  torIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#3D2D6E",
    alignItems: "center",
    justifyContent: "center",
  },
  torEmoji: {
    fontSize: 26,
  },
  torInfo: {
    flex: 1,
  },
  torTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  torTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  premiumBadge: {
    backgroundColor: "#2D1A5E",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#4C2D9E",
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#A78BFA",
    letterSpacing: 0.8,
  },
  torDesc: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
  },
  torChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  torChevronText: {
    fontSize: 20,
    color: "#7C3AED",
    lineHeight: 24,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E35",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F9FAFB",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
});
