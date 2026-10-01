// import { router, Stack } from 'expo-router';
// import 'react-native-reanimated';
// import { useEffect } from 'react';

// import { AuthProvider } from '@/context/auth-context';
// import {
//   addProfessionalNotificationResponseListener,
//   getInitialProfessionalNotificationRequestId,
// } from '@/services/professional-notifications';

// export const unstable_settings = {
//   anchor: 'index',
// };

// /**
//  * Keep the navigator in a child component of AuthProvider.
//  *
//  * Expo Router renders route components through the navigator. Keeping the
//  * navigator itself below the provider guarantees that every route (including
//  * the initial index route) receives the same AuthContext during the initial
//  * render and prevents `useAuth must be used within an AuthProvider` errors.
//  */
// function RootNavigator() {
//   useEffect(() => {
//     const subscription = addProfessionalNotificationResponseListener((requestId) => {
//       router.push({ pathname: '/professional-requests', params: { requestId } });
//     });

//     void getInitialProfessionalNotificationRequestId().then((requestId) => {
//       if (requestId) {
//         router.push({ pathname: '/professional-requests', params: { requestId } });
//       }
//     });

//     return () => subscription.remove();
//   }, []);

//   return (
//     <Stack initialRouteName="index">
//       <Stack.Screen name="index" options={{ headerShown: false }} />
//       <Stack.Screen name="login" options={{ headerShown: false }} />
//       <Stack.Screen name="register-user" options={{ headerShown: false }} />
//       <Stack.Screen name="register-professional" options={{ headerShown: false }} />
//       <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
//       <Stack.Screen name="professional-profile" options={{ headerShown: false }} />
//       <Stack.Screen name="professional-home" options={{ headerShown: false }} />
//       <Stack.Screen name="professional-requests" options={{ headerShown: false }} />
//       <Stack.Screen name="professional-wallet" options={{ headerShown: false }} />
//       <Stack.Screen name="nurse-service-map" options={{ headerShown: false }} />
//       <Stack.Screen name="professional-verification" options={{ headerShown: false }} />
//       <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
//       <Stack.Screen name="request-nurse" options={{ headerShown: false }} />
//       <Stack.Screen name="available-professionals" options={{ headerShown: false }} />
//       <Stack.Screen name="nurse-request-submitted" options={{ headerShown: false }} />
//       <Stack.Screen name="rate-service" options={{ headerShown: false }} />
//     </Stack>
//   );
// }

// export default function RootLayout() {
//   return (
//     <AuthProvider>
//       <RootNavigator />
//     </AuthProvider>
//   );
// }

import { router, Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";
import "react-native-reanimated";

import { AuthProvider } from "@/context/auth-context";
import {
  addProfessionalNotificationResponseListener,
  getInitialProfessionalNotificationRequestId,
} from "@/services/professional-notifications";

/**
 * Keep the navigator in a child component of AuthProvider.
 *
 * Expo Router renders route components through the navigator. Keeping the
 * navigator itself below the provider guarantees that every route (including
 * the initial index route) receives the same AuthContext during the initial
 * render and prevents `useAuth must be used within an AuthProvider` errors.
 */
function RootNavigator() {
  const pathname = usePathname();

  useEffect(() => {
    const subscription = addProfessionalNotificationResponseListener(
      (requestId) => {
        router.push({
          pathname: "/professional-requests",
          params: { requestId },
        });
      },
    );

    void getInitialProfessionalNotificationRequestId().then((requestId) => {
      if (requestId) {
        router.push({
          pathname: "/professional-requests",
          params: { requestId },
        });
      }
    });

    return () => subscription.remove();
  }, []);

  /*
   * ---------------------------------------------------------
   * PROFESSIONAL ANDROID BACK NAVIGATION
   * ---------------------------------------------------------
   *
   * Professional screens behave like a tab-based application:
   *
   * Home
   * Requests
   * Earnings / Wallet
   * Profile
   *
   * Pressing Android Back from one of these top-level screens
   * should return to Professional Home rather than exposing
   * the previous authentication/navigation screen.
   */
  useEffect(() => {
    const professionalRoutes = [
      "/professional-home",
      "/professional-requests",
      "/professional-wallet",
      "/professional-profile",
    ];

    const isProfessionalRoute = professionalRoutes.includes(pathname);

    if (!isProfessionalRoute) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        /*
         * Professional Home is the root of the professional
         * dashboard. Let Android handle Back here so the app
         * can minimize/exit normally.
         */
        if (pathname === "/professional-home") {
          return false;
        }

        /*
         * All other professional top-level destinations
         * return to the dashboard.
         *
         * replace() is intentional:
         * it prevents the user from creating a growing
         * navigation stack by switching between tabs.
         */
        router.replace("/professional-home");

        return true;
      },
    );

    return () => subscription.remove();
  }, [pathname]);

  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Screen name="login" options={{ headerShown: false }} />

      <Stack.Screen name="register-user" options={{ headerShown: false }} />

      <Stack.Screen
        name="register-professional"
        options={{ headerShown: false }}
      />

      <Stack.Screen name="verify-otp" options={{ headerShown: false }} />

      <Stack.Screen
        name="professional-profile"
        options={{ headerShown: false }}
      />

      <Stack.Screen name="professional-home" options={{ headerShown: false }} />

      <Stack.Screen
        name="professional-requests"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="professional-wallet"
        options={{ headerShown: false }}
      />

      <Stack.Screen name="nurse-service-map" options={{ headerShown: false }} />

      <Stack.Screen
        name="professional-verification"
        options={{ headerShown: false }}
      />

      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen name="request-nurse" options={{ headerShown: false }} />

      <Stack.Screen
        name="available-professionals"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="nurse-request-submitted"
        options={{ headerShown: false }}
      />

      {/* <Stack.Screen
        name="rate-service"
        options={{ headerShown: false }}
      /> */}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
