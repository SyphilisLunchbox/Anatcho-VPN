import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Shield, Lock, Globe, RefreshCw, Zap, ChevronRight } from "lucide-react-native";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { apiGet, apiPost, apiPatch } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TorServer {
  id: string;
  name: string;
  country: string;
  country_code: string;
  is_tor: boolean;
  protocol?: string;
}

interface Connection {
  id: string;
  server_id: string;
  protocol: string;
  status: string;
}

interface SubscriptionInfo {
  plan: string;
}

// ─── Country flag helper ──────────────────────────────────────────────────────

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const base = 0x1f1e6;
  const chars = code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(base + c.charCodeAt(0) - 65));
  return chars.join("");
}

// ─── AnimatedPressable ────────────────────────────────────────────────────────

function AnimatedPressable({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
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
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Node Card ────────────────────────────────────────────────────────────────

function NodeCard({
  label,
  server,
  isLast,
  animValue,
}: {
  label: string;
  server: TorServer | null;
  isLast: boolean;
  animValue: Animated.Value;
}) {
  const flag = server ? countryFlag(server.country_code) : "🌐";
  const serverName = server ? server.name : "—";
  const country = server ? server.country : "Unknown";

  return (
    <Animated.View
      style={[
        styles.nodeCardWrapper,
        {
          opacity: animValue,
          transform: [
            {
              translateY: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.nodeCard}>
        <View style={styles.nodeLeft}>
          <View style={styles.nodeDot} />
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeLabel}>{label}</Text>
            <View style={styles.nodeNameRow}>
              <Text style={styles.nodeFlag}>{flag}</Text>
              <Text style={styles.nodeName}>{serverName}</Text>
            </View>
            <Text style={styles.nodeCountry}>{country}</Text>
          </View>
        </View>
        <View style={styles.nodeIconRight}>
          <Globe size={16} color="#7C3AED" />
        </View>
      </View>
      {!isLast && <View style={styles.nodeConnector} />}
    </Animated.View>
  );
}

// ─── Premium Gate Overlay ─────────────────────────────────────────────────────

function PremiumGate() {
  const router = useRouter();

  const handleUnlock = () => {
    console.log("[TorScreen] User pressed Unlock with Premium button");
    router.push("/paywall");
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <View style={styles.gateLockCircle}>
            <Lock size={32} color="#7C3AED" />
          </View>
          <Text style={styles.gatePremiumLabel}>PREMIUM FEATURE</Text>
          <Text style={styles.gateTitle}>Tor-over-VPN</Text>
          <Text style={styles.gateDescription}>
            Route your traffic through the Tor network for maximum anonymity. Upgrade to unlock this and all premium features.
          </Text>
          <View style={styles.gateFeatureRow}>
            <Text style={styles.gateFeatureIcon}>🧅</Text>
            <Text style={styles.gateFeatureText}>Tor Network Routing</Text>
          </View>
          <View style={styles.gateFeatureRow}>
            <Text style={styles.gateFeatureIcon}>🔒</Text>
            <Text style={styles.gateFeatureText}>No-Log Guarantee</Text>
          </View>
          <View style={styles.gateFeatureRow}>
            <Text style={styles.gateFeatureIcon}>🛡️</Text>
            <Text style={styles.gateFeatureText}>Kill Switch Protection</Text>
          </View>
          <AnimatedPressable onPress={handleUnlock} style={styles.gateButton}>
            <Text style={styles.gateButtonText}>Unlock with Premium</Text>
            <ChevronRight size={18} color="#fff" />
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TorScreen() {
  const router = useRouter();
  const { isSubscribed, loading: subLoading } = useSubscription();

  const [servers, setServers] = useState<TorServer[]>([]);
  const [circuit, setCircuit] = useState<[TorServer | null, TorServer | null, TorServer | null]>([null, null, null]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<string | null>(null);
  const [subCheckDone, setSubCheckDone] = useState(false);

  // Animations
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const nodeAnim0 = useRef(new Animated.Value(0)).current;
  const nodeAnim1 = useRef(new Animated.Value(0)).current;
  const nodeAnim2 = useRef(new Animated.Value(0)).current;

  // Pulsing glow when connected
  useEffect(() => {
    if (!isConnected) {
      glowScale.setValue(1);
      glowOpacity.setValue(0.4);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isConnected]);

  // Staggered entrance for node cards
  const animateNodes = useCallback(() => {
    nodeAnim0.setValue(0);
    nodeAnim1.setValue(0);
    nodeAnim2.setValue(0);
    Animated.stagger(120, [
      Animated.timing(nodeAnim0, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(nodeAnim1, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(nodeAnim2, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Fetch subscription plan from backend
  useEffect(() => {
    const fetchSubPlan = async () => {
      try {
        console.log("[TorScreen] Fetching subscription plan from /api/subscriptions/me");
        const data = await apiGet<SubscriptionInfo>("/api/subscriptions/me");
        setSubPlan(data.plan);
        console.log("[TorScreen] Subscription plan:", data.plan);
      } catch (e: any) {
        console.warn("[TorScreen] Could not fetch subscription plan:", e?.message);
        setSubPlan("free");
      } finally {
        setSubCheckDone(true);
      }
    };
    fetchSubPlan();
  }, []);

  // Fetch Tor servers
  useEffect(() => {
    const fetchServers = async () => {
      try {
        console.log("[TorScreen] Fetching Tor servers from /api/servers?is_tor=true");
        const data = await apiGet<TorServer[]>("/api/servers?is_tor=true");
        const torServers = Array.isArray(data) ? data : [];
        setServers(torServers);
        console.log("[TorScreen] Fetched", torServers.length, "Tor servers");
        pickRandomCircuit(torServers);
      } catch (e: any) {
        console.error("[TorScreen] Failed to fetch Tor servers:", e?.message);
        setError("Failed to load Tor servers. Please try again.");
      } finally {
        setLoadingServers(false);
      }
    };
    fetchServers();
  }, []);

  const pickRandomCircuit = (pool: TorServer[]) => {
    if (pool.length === 0) {
      setCircuit([null, null, null]);
      animateNodes();
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const entry = shuffled[0] ?? null;
    const middle = shuffled[1] ?? shuffled[0] ?? null;
    const exit = shuffled[2] ?? shuffled[1] ?? shuffled[0] ?? null;
    setCircuit([entry, middle, exit]);
    animateNodes();
  };

  const handleRandomize = () => {
    console.log("[TorScreen] User pressed Randomize Circuit");
    pickRandomCircuit(servers);
  };

  const handleConnect = async () => {
    if (isConnected) {
      // Disconnect
      if (!connection) return;
      console.log("[TorScreen] User pressed Disconnect — connection id:", connection.id);
      setLoadingConnect(true);
      setError(null);
      try {
        await apiPatch(`/api/connections/${connection.id}/disconnect`, {});
        console.log("[TorScreen] Disconnected successfully");
        setConnection(null);
        setIsConnected(false);
      } catch (e: any) {
        console.error("[TorScreen] Disconnect failed:", e?.message);
        setError("Failed to disconnect. Please try again.");
      } finally {
        setLoadingConnect(false);
      }
    } else {
      // Connect
      const exitServer = circuit[2] ?? circuit[1] ?? circuit[0];
      if (!exitServer) {
        setError("No Tor server available. Please try again.");
        return;
      }
      console.log("[TorScreen] User pressed Connect via Tor — server id:", exitServer.id);
      setLoadingConnect(true);
      setError(null);
      try {
        const conn = await apiPost<Connection>("/api/connections", {
          server_id: exitServer.id,
          protocol: "Tor",
        });
        console.log("[TorScreen] Connected successfully — connection id:", conn.id);
        setConnection(conn);
        setIsConnected(true);
      } catch (e: any) {
        console.error("[TorScreen] Connect failed:", e?.message);
        setError("Failed to connect. Please try again.");
      } finally {
        setLoadingConnect(false);
      }
    }
  };

  // Determine premium access
  const isPremium = isSubscribed || subPlan === "plus" || subPlan === "visionary";
  const showGate = subCheckDone && !subLoading && !isPremium;

  const statusText = isConnected ? "Connected to Tor" : "Disconnected";
  const statusColor = isConnected ? "#22C55E" : "#EF4444";
  const connectButtonLabel = isConnected ? "Disconnect" : "Connect via Tor";
  const connectButtonStyle = isConnected ? styles.disconnectButton : styles.connectButton;
  const connectButtonTextStyle = isConnected ? styles.disconnectButtonText : styles.connectButtonText;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Tor Network",
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: "#0D0D14" },
          headerTintColor: "#fff",
          headerTitleStyle: { color: "#fff", fontWeight: "700" },
        }}
      />
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.glowWrapper}>
              <Animated.View
                style={[
                  styles.glowRing,
                  {
                    transform: [{ scale: glowScale }],
                    opacity: glowOpacity,
                    borderColor: isConnected ? "#22C55E" : "#7C3AED",
                  },
                ]}
              />
              <View style={[styles.onionCircle, isConnected && styles.onionCircleConnected]}>
                <Text style={styles.onionEmoji}>🧅</Text>
              </View>
            </View>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            <Text style={styles.heroSubtitle}>
              {isConnected ? "Your traffic is routed through Tor" : "3-hop anonymity network"}
            </Text>
          </View>

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Zap size={14} color="#F59E0B" />
            <Text style={styles.warningText}>
              Tor routing reduces speed. For anonymity, not streaming.
            </Text>
          </View>

          {/* Node Chain */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Circuit Nodes</Text>
              <AnimatedPressable onPress={handleRandomize} style={styles.randomizeBtn}>
                <RefreshCw size={14} color="#7C3AED" />
                <Text style={styles.randomizeBtnText}>Randomize</Text>
              </AnimatedPressable>
            </View>

            {loadingServers ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#7C3AED" />
                <Text style={styles.loadingText}>Loading Tor servers...</Text>
              </View>
            ) : (
              <View style={styles.nodeChain}>
                <NodeCard label="Entry Node" server={circuit[0]} isLast={false} animValue={nodeAnim0} />
                <NodeCard label="Middle Relay" server={circuit[1]} isLast={false} animValue={nodeAnim1} />
                <NodeCard label="Exit Node" server={circuit[2]} isLast={true} animValue={nodeAnim2} />
              </View>
            )}
          </View>

          {/* Error */}
          {error !== null && (
            <View style={styles.errorBanner}>
              <Shield size={14} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Connect Button */}
          <AnimatedPressable
            onPress={handleConnect}
            style={[connectButtonStyle, loadingConnect && styles.buttonDisabled]}
            disabled={loadingConnect || loadingServers}
          >
            {loadingConnect ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Lock size={18} color="#fff" />
                <Text style={connectButtonTextStyle}>{connectButtonLabel}</Text>
              </>
            )}
          </AnimatedPressable>

          {/* Info Cards */}
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardIcon}>🔒</Text>
              <Text style={styles.infoCardTitle}>No Logs</Text>
              <Text style={styles.infoCardDesc}>Zero activity recorded</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardIcon}>🛡️</Text>
              <Text style={styles.infoCardTitle}>Kill Switch</Text>
              <Text style={styles.infoCardDesc}>Auto-cuts on drop</Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Premium Gate Overlay */}
        {showGate && <PremiumGate />}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D0D14",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  glowWrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  glowRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#7C3AED",
  },
  onionCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#2D2D4E",
  },
  onionCircleConnected: {
    borderColor: "#22C55E",
    backgroundColor: "#0F2A1A",
  },
  onionEmoji: {
    fontSize: 40,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    letterSpacing: 0.2,
  },

  // Warning
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1C1A0E",
    borderWidth: 1,
    borderColor: "#3D3010",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#F59E0B",
    lineHeight: 17,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E5E7EB",
    letterSpacing: 0.2,
  },
  randomizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2D2D4E",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  randomizeBtnText: {
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "600",
  },

  // Node chain
  nodeChain: {
    backgroundColor: "#111120",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E1E35",
    overflow: "hidden",
  },
  nodeCardWrapper: {
    alignItems: "center",
  },
  nodeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },
  nodeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  nodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#7C3AED",
    borderWidth: 2,
    borderColor: "#4C1D95",
  },
  nodeInfo: {
    flex: 1,
  },
  nodeLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  nodeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nodeFlag: {
    fontSize: 16,
  },
  nodeName: {
    fontSize: 14,
    color: "#E5E7EB",
    fontWeight: "600",
  },
  nodeCountry: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  nodeIconRight: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeConnector: {
    width: 1.5,
    height: 16,
    backgroundColor: "#2D2D4E",
    marginLeft: 21,
    alignSelf: "flex-start",
  },

  // Loading
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111120",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E1E35",
    padding: 20,
    justifyContent: "center",
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1C0E0E",
    borderWidth: 1,
    borderColor: "#3D1010",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#EF4444",
    lineHeight: 17,
  },

  // Connect button
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  disconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1C0E0E",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Info grid
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "#111120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E35",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  infoCardIcon: {
    fontSize: 24,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  infoCardDesc: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },

  bottomSpacer: {
    height: 20,
  },

  // Premium Gate
  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  gateCard: {
    backgroundColor: "#111120",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2D2D4E",
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  gateLockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1A1A2E",
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  gatePremiumLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7C3AED",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F9FAFB",
    marginBottom: 10,
    textAlign: "center",
  },
  gateDescription: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  gateFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginBottom: 8,
  },
  gateFeatureIcon: {
    fontSize: 18,
    width: 28,
    textAlign: "center",
  },
  gateFeatureText: {
    fontSize: 13,
    color: "#D1D5DB",
    fontWeight: "500",
  },
  gateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
    alignSelf: "stretch",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  gateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
