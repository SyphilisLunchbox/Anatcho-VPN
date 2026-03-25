import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, Redirect, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
// Note: Error logging is auto-initialized via index.ts import

// Prevent the splash screen from auto-hiding before asset loading is complete.
import { isOnboardingComplete } from "@/utils/onboardingStorage";
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)", // Ensure any route can link back to `/`
};


function SubscriptionRedirect() {
  const { isSubscribed, loading } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || authLoading) return;
    const onAuthScreen = pathname === "/auth";
    if (onAuthScreen) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    const onOnboarding = pathname.startsWith("/onboarding");
    if (onOnboarding) return;

    let cancelled = false;
    isOnboardingComplete().then((done) => {
      if (cancelled) return;
      if (!done) {
        router.replace("/onboarding");
        return;
      }
      const onPaywall = pathname === "/paywall";
      if (onPaywall) return;
      if (!isSubscribed) {
        router.replace("/paywall");
      }
    }).catch(() => {
      if (cancelled) return;
      const onPaywall = pathname === "/paywall";
      if (onPaywall) return;
      if (!isSubscribed) {
        router.replace("/paywall");
      }
    });
    return () => { cancelled = true; };
  }, [isSubscribed, loading, authLoading, pathname, user]);

  return null;
}

export default function RootLayout() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    isOnboardingComplete().then((complete) => {
      setOnboardingComplete(complete);
    });
  }, [pathname]);

  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  React.useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "🔌 You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  if (!loaded || onboardingComplete === null) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(0, 122, 255)", // System Blue
      background: "rgb(242, 242, 247)", // Light mode background
      card: "rgb(255, 255, 255)", // White cards/surfaces
      text: "rgb(0, 0, 0)", // Black text for light mode
      border: "rgb(216, 216, 220)", // Light gray for separators/borders
      notification: "rgb(255, 59, 48)", // System Red
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(10, 132, 255)", // System Blue (Dark Mode)
      background: "rgb(1, 1, 1)", // True black background for OLED displays
      card: "rgb(28, 28, 30)", // Dark card/surface color
      text: "rgb(255, 255, 255)", // White text for dark mode
      border: "rgb(44, 44, 46)", // Dark gray for separators/borders
      notification: "rgb(255, 69, 58)", // System Red (Dark Mode)
    },
  };
  return (
    <SubscriptionProvider>
          <SubscriptionRedirect />
  <>
      <StatusBar style="auto" animated />
        <ThemeProvider
          value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
        >
          <SafeAreaProvider>
            <WidgetProvider>
              <GestureHandlerRootView>
              {onboardingComplete === false && pathname !== "/auth" && pathname !== "/paywall" && pathname !== "/auth-popup" && pathname !== "/auth-callback" && <Redirect href="/onboarding" />}

              <Stack>
                {/* Main app with tabs */}
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="tor"
                  options={{
                    title: "Tor Network",
                    headerBackButtonDisplayMode: "minimal",
                    headerStyle: { backgroundColor: "#0D0D14" },
                    headerTintColor: "#fff",
                    headerTitleStyle: { color: "#fff", fontWeight: "700" },
                  }}
                />
              </Stack>
              <SystemBars style={"auto"} />
              </GestureHandlerRootView>
            </WidgetProvider>
          </SafeAreaProvider>
        </ThemeProvider>
    </>
    </SubscriptionProvider>
  );
}
