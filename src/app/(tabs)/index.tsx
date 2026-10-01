import { getProfilePictureSource } from "@/api/profilePicture";
import { useAuth } from "@/context/auth-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/*
 * ============================================================
 * CARE TYPES
 * ============================================================
 *
 * These are informational shortcuts for the customer.
 * They can later be connected to specific care types
 * inside the booking flow.
 */

const careTypes = [
  {
    title: "Nursing Care",
    subtitle: "Professional nursing support",
    icon: "medkit-outline" as const,
  },
  {
    title: "Post-Hospital Care",
    subtitle: "Support after discharge",
    icon: "fitness-outline" as const,
  },
  {
    title: "Elderly Care",
    subtitle: "Care and daily assistance",
    icon: "heart-outline" as const,
  },
  {
    title: "Doctor-Supervised Care",
    subtitle: "Care under medical guidance",
    icon: "medical-outline" as const,
  },
];

/*
 * ============================================================
 * FUTURE SERVICES
 * ============================================================
 *
 * Keeping these commented instead of deleting them.
 * They can be introduced when the features are ready.
 */

// const futureServices = [
//   {
//     title: "Injection Service",
//     subtitle: "With prescription",
//     icon: "fitness-outline" as const,
//     route: "/services",
//   },
//   {
//     title: "Prescription Medicines",
//     subtitle: "Delivered to you",
//     icon: "medical-outline" as const,
//     route: "/services",
//   },
//   {
//     title: "Medical Equipment",
//     subtitle: "Buy or rent",
//     icon: "bandage-outline" as const,
//     route: "/services",
//   },
// ];

export default function HomeScreen() {
  const { user } = useAuth();

  const [profilePicture, setProfilePicture] =
    useState<Awaited<ReturnType<typeof getProfilePictureSource>>>(null);

  const [profilePictureLoading, setProfilePictureLoading] = useState(true);

  const [locationText, setLocationText] = useState("Select your location");

  const [locationLoading, setLocationLoading] = useState(false);

  /*
   * ============================================================
   * PROFILE PICTURE
   * ============================================================
   */

  const loadProfilePicture = useCallback(async () => {
    try {
      setProfilePictureLoading(true);

      const source = await getProfilePictureSource("USER", Date.now());

      setProfilePicture(source);
    } catch {
      setProfilePicture(null);
    } finally {
      setProfilePictureLoading(false);
    }
  }, []);

  /*
   * ============================================================
   * LOCATION
   * ============================================================
   */

  const detectCurrentLocation = useCallback(async () => {
    try {
      setLocationLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Please allow CareNow to use your location so we can show your current location.",
        );

        return;
      }

      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // Continue with available location provider.
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = currentLocation.coords;

      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses.length > 0) {
        const place = addresses[0];

        const primary =
          place.district || place.city || place.subregion || place.region;

        const secondary =
          place.city && place.city !== primary
            ? place.city
            : place.region && place.region !== primary
              ? place.region
              : undefined;

        const formatted = [primary, secondary].filter(Boolean).join(", ");

        setLocationText(formatted || place.name || "Current location");
      } else {
        setLocationText("Current location");
      }
    } catch (error) {
      console.error("Home location detection failed:", error);

      Alert.alert(
        "Location unavailable",
        "We couldn't detect your current location. Please check that Location Services are enabled and try again.",
      );
    } finally {
      setLocationLoading(false);
    }
  }, []);

  /*
   * ============================================================
   * SCREEN FOCUS
   * ============================================================
   */

  useFocusEffect(
    useCallback(() => {
      void loadProfilePicture();

      return undefined;
    }, [loadProfilePicture]),
  );

  useEffect(() => {
    void detectCurrentLocation();
  }, [detectCurrentLocation]);

  /*
   * ============================================================
   * GREETING
   * ============================================================
   */

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 17) {
      return "Good afternoon";
    }

    if (hour < 21) {
      return "Good evening";
    }

    return "Good night";
  };

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* =====================================================
              LOCATION + PROFILE
          ====================================================== */}

          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.locationContainer}
              onPress={() => void detectCurrentLocation()}
              activeOpacity={0.75}
              disabled={locationLoading}
            >
              <View style={styles.locationIcon}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#0A9FB5" />
                ) : (
                  <Ionicons name="location" size={18} color="#0A9FB5" />
                )}
              </View>

              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Your location</Text>

                <View style={styles.locationRow}>
                  <Text
                    style={styles.locationText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {locationLoading ? "Detecting location..." : locationText}
                  </Text>

                  <Ionicons name="chevron-down" size={15} color="#526973" />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.8}
            >
              {profilePictureLoading ? (
                <ActivityIndicator size="small" color="#0A9FB5" />
              ) : profilePicture ? (
                <Image
                  source={profilePicture}
                  style={styles.profileImage}
                  contentFit="cover"
                  onError={() => setProfilePicture(null)}
                />
              ) : (
                <Ionicons name="person-outline" size={20} color="#182A33" />
              )}
            </TouchableOpacity>
          </View>

          {/* =====================================================
              WELCOME
          ====================================================== */}

          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>
              {getGreeting()}, {user?.name || "there"} 👋
            </Text>

            <Text style={styles.welcomeSubtitle}>
              How can we help you today?
            </Text>

            <Text style={styles.welcomeSupportingText}>
              Care for you or someone you care about.
            </Text>
          </View>

          {/* =====================================================
              SEARCH
          ====================================================== */}

          <TouchableOpacity
            style={styles.searchBox}
            activeOpacity={0.8}
            onPress={() => router.push("/request-nurse")}
          >
            <View style={styles.searchIconContainer}>
              <Ionicons name="search-outline" size={19} color="#687F89" />
            </View>

            <Text style={styles.searchText}>
              What kind of care are you looking for?
            </Text>

            <Ionicons name="chevron-forward" size={17} color="#9AAEB5" />
          </TouchableOpacity>

          {/* =====================================================
              MAIN CARE ACTION
          ====================================================== */}

          <TouchableOpacity
            style={styles.mainCareCard}
            activeOpacity={0.9}
            onPress={() => router.push("/request-nurse")}
          >
            <View style={styles.mainCareTop}>
              <View style={styles.mainCareIcon}>
                <Ionicons name="medical" size={27} color="#FFFFFF" />
              </View>

              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />

                <Text style={styles.availableText}>HOME CARE</Text>
              </View>
            </View>

            <Text style={styles.mainCareTitle}>Need care at home?</Text>

            <Text style={styles.mainCareDescription}>
              Tell us what you need and we'll help you find a suitable
              healthcare professional.
            </Text>

            <View style={styles.mainCareBottom}>
              <Text style={styles.mainCareAction}>Get care at home</Text>

              <View style={styles.mainCareArrow}>
                <Ionicons name="arrow-forward" size={18} color="#0A9FB5" />
              </View>
            </View>
          </TouchableOpacity>

          {/* =====================================================
              ACTIVE CARE
          ====================================================== */}

          {/*
            This section is intentionally ready for the real
            booking API.

            When an active order exists, this should replace
            the empty state with:

            - Professional name
            - Service
            - ETA
            - Current status
            - Track button
          */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your care</Text>
          </View>

          <TouchableOpacity
            style={styles.careStatusCard}
            activeOpacity={0.82}
            onPress={() => router.push("/(tabs)/orders")}
          >
            <View style={styles.careStatusIcon}>
              <Ionicons name="heart-outline" size={21} color="#0A9FB5" />
            </View>

            <View style={styles.careStatusContent}>
              <Text style={styles.careStatusTitle}>
                Nothing active right now
              </Text>

              <Text style={styles.careStatusSubtitle}>
                Your current and previous care requests will appear here.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color="#9AAEB5" />
          </TouchableOpacity>

          {/* =====================================================
              QUICK ACCESS
          ====================================================== */}

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.82}
              onPress={() => router.push("/(tabs)/orders")}
            >
              <View style={[styles.quickActionIcon, styles.blueBackground]}>
                <Ionicons name="receipt-outline" size={20} color="#0A9FB5" />
              </View>

              <Text style={styles.quickActionTitle}>My care</Text>

              <Text style={styles.quickActionSubtitle}>Requests & bills</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              activeOpacity={0.82}
              onPress={() => router.push("/request-nurse")}
            >
              <View style={[styles.quickActionIcon, styles.greenBackground]}>
                <Ionicons name="calendar-outline" size={20} color="#16A34A" />
              </View>

              <Text style={styles.quickActionTitle}>Schedule care</Text>

              <Text style={styles.quickActionSubtitle}>Plan a visit</Text>
            </TouchableOpacity>
          </View>

          {/* =====================================================
              CARE PROFILE
          ====================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Care Profile</Text>

              <Text style={styles.sectionSubtitle}>
                Keep these details ready when you need care.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileStatusCard}
            activeOpacity={0.82}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <View style={styles.profileStatusTop}>
              <View style={styles.profileStatusIcon}>
                <Ionicons
                  name="person-circle-outline"
                  size={25}
                  color="#0A9FB5"
                />
              </View>

              <View style={styles.profileStatusContent}>
                <Text style={styles.profileStatusTitle}>
                  You're almost ready
                </Text>

                <Text style={styles.profileStatusSubtitle}>
                  Complete your care details to make future requests easier.
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={styles.progressValue} />
            </View>

            <View style={styles.profileStatusBottom}>
              <Text style={styles.progressText}>Profile information</Text>

              <Text style={styles.progressAction}>View profile</Text>
            </View>
          </TouchableOpacity>

          {/* =====================================================
              WHO CAN YOU CARE FOR
          ====================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Care for someone you love</Text>

              <Text style={styles.sectionSubtitle}>
                You can request care for yourself, family or someone else.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.familyCard}
            activeOpacity={0.82}
            onPress={() => router.push("/request-nurse")}
          >
            <View style={styles.familyAvatars}>
              <View style={[styles.familyAvatar, styles.familyAvatarOne]}>
                <Ionicons name="person" size={17} color="#0A9FB5" />
              </View>

              <View style={[styles.familyAvatar, styles.familyAvatarTwo]}>
                <Ionicons name="people" size={17} color="#16A34A" />
              </View>
            </View>

            <View style={styles.familyContent}>
              <Text style={styles.familyTitle}>Who needs care?</Text>

              <Text style={styles.familySubtitle}>
                We'll guide you through the right care for them.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color="#9AAEB5" />
          </TouchableOpacity>

          {/* =====================================================
              HOW CARENOW WORKS
          ====================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>How CareNow works</Text>

              <Text style={styles.sectionSubtitle}>
                Simple support when you need it.
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Tell us what you need</Text>

                <Text style={styles.stepDescription}>
                  Choose the type of care and who needs the support.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Choose when you need it</Text>

                <Text style={styles.stepDescription}>
                  Request care now or schedule it for a later time.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>We find a professional</Text>

                <Text style={styles.stepDescription}>
                  An available healthcare professional can accept your request.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Care at your doorstep</Text>

                <Text style={styles.stepDescription}>
                  Track the professional and receive the requested care.
                </Text>
              </View>
            </View>
          </View>

          {/* =====================================================
              CARE TYPES
          ====================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Care you can request</Text>

              <Text style={styles.sectionSubtitle}>
                Support for different healthcare needs.
              </Text>
            </View>
          </View>

          <View style={styles.careTypesContainer}>
            {careTypes.map((care) => (
              <TouchableOpacity
                key={care.title}
                style={styles.careTypeCard}
                activeOpacity={0.82}
                onPress={() => router.push("/request-nurse")}
              >
                <View style={styles.careTypeIcon}>
                  <Ionicons name={care.icon} size={21} color="#0A9FB5" />
                </View>

                <View style={styles.careTypeContent}>
                  <Text style={styles.careTypeTitle}>{care.title}</Text>

                  <Text style={styles.careTypeSubtitle}>{care.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#A0B0B6" />
              </TouchableOpacity>
            ))}
          </View>

          {/* =====================================================
              TRUST
          ====================================================== */}

          <View style={styles.trustCard}>
            <View style={styles.trustIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#16A34A"
              />
            </View>

            <View style={styles.trustContent}>
              <Text style={styles.trustTitle}>
                Your care, handled with care
              </Text>

              <Text style={styles.trustSubtitle}>
                Your booking, payment and service information stay securely
                within CareNow.
              </Text>
            </View>
          </View>

          {/* =====================================================
              FOOTER
          ====================================================== */}

          <View style={styles.footer}>
            <Ionicons name="heart-outline" size={13} color="#0A9FB5" />

            <Text style={styles.footerText}>
              CareNow · Here when you need care
            </Text>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FBFC",
  },

  container: {
    flex: 1,
    backgroundColor: "#F7FBFC",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  /*
   * ------------------------------------------------------------
   * TOP BAR
   * ------------------------------------------------------------
   */

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 7,
    paddingBottom: 7,
  },

  locationContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
  },

  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF9FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  locationTextContainer: {
    flex: 1,
  },

  locationLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: "#71858D",
    marginBottom: 1,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },

  locationText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: "#182A33",
    marginRight: 4,
  },

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7E8EB",
    overflow: "hidden",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  /*
   * ------------------------------------------------------------
   * WELCOME
   * ------------------------------------------------------------
   */

  welcomeSection: {
    marginTop: 17,
    marginBottom: 17,
  },

  welcomeTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    color: "#10242C",
    letterSpacing: -0.4,
  },

  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: "#405861",
    marginTop: 5,
  },

  welcomeSupportingText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#788C94",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * SEARCH
   * ------------------------------------------------------------
   */

  searchBox: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E8EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 15,
  },

  searchIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F8F9",
    alignItems: "center",
    justifyContent: "center",
  },

  searchText: {
    flex: 1,
    fontSize: 12,
    color: "#7D929A",
    marginLeft: 9,
    marginRight: 8,
  },

  /*
   * ------------------------------------------------------------
   * MAIN CARE CARD
   * ------------------------------------------------------------
   */

  mainCareCard: {
    backgroundColor: "#0A9FB5",
    borderRadius: 20,
    padding: 17,
    marginBottom: 23,
    overflow: "hidden",
  },

  mainCareTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  mainCareIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
  },

  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 5,
  },

  availableText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },

  mainCareTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  mainCareDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#D9F4F7",
    marginTop: 5,
    maxWidth: "95%",
  },

  mainCareBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 17,
  },

  mainCareAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  mainCareArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * ------------------------------------------------------------
   * SECTION
   * ------------------------------------------------------------
   */

  sectionHeader: {
    marginBottom: 11,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#10242C",
    letterSpacing: -0.2,
  },

  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: "#71858D",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * CARE STATUS
   * ------------------------------------------------------------
   */

  careStatusCard: {
    minHeight: 75,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
  },

  careStatusIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#EAF9FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  careStatusContent: {
    flex: 1,
    marginRight: 8,
  },

  careStatusTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  careStatusSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71858D",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * QUICK ACTIONS
   * ------------------------------------------------------------
   */

  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 23,
  },

  quickActionCard: {
    width: "48.4%",
    minHeight: 101,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 12,
  },

  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  blueBackground: {
    backgroundColor: "#EAF9FC",
  },

  greenBackground: {
    backgroundColor: "#ECFDF3",
  },

  quickActionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  quickActionSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    color: "#71858D",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * CARE PROFILE
   * ------------------------------------------------------------
   */

  profileStatusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 14,
    marginBottom: 23,
  },

  profileStatusTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EAF9FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  profileStatusContent: {
    flex: 1,
  },

  profileStatusTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  profileStatusSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71858D",
    marginTop: 2,
  },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8F0F2",
    marginTop: 13,
    overflow: "hidden",
  },

  progressValue: {
    width: "75%",
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#0A9FB5",
  },

  profileStatusBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },

  progressText: {
    fontSize: 10,
    color: "#71858D",
  },

  progressAction: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0A9FB5",
  },

  /*
   * ------------------------------------------------------------
   * FAMILY
   * ------------------------------------------------------------
   */

  familyCard: {
    minHeight: 78,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 23,
  },

  familyAvatars: {
    width: 58,
    height: 46,
    position: "relative",
    marginRight: 11,
  },

  familyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    position: "absolute",
  },

  familyAvatarOne: {
    left: 0,
    top: 0,
    backgroundColor: "#EAF9FC",
  },

  familyAvatarTwo: {
    left: 20,
    top: 6,
    backgroundColor: "#ECFDF3",
  },

  familyContent: {
    flex: 1,
    marginRight: 8,
  },

  familyTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  familySubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71858D",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * HOW IT WORKS
   * ------------------------------------------------------------
   */

  howItWorksCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 15,
    marginBottom: 23,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EAF9FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  stepNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0A9FB5",
  },

  stepContent: {
    flex: 1,
    paddingTop: 1,
  },

  stepTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  stepDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71858D",
    marginTop: 2,
  },

  stepConnector: {
    width: 1,
    height: 17,
    backgroundColor: "#D7E8EB",
    marginLeft: 15.5,
    marginVertical: 3,
  },

  /*
   * ------------------------------------------------------------
   * CARE TYPES
   * ------------------------------------------------------------
   */

  careTypesContainer: {
    marginBottom: 23,
  },

  careTypeCard: {
    minHeight: 65,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  careTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EAF9FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  careTypeContent: {
    flex: 1,
  },

  careTypeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#182A33",
  },

  careTypeSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71858D",
    marginTop: 1,
  },

  /*
   * ------------------------------------------------------------
   * TRUST
   * ------------------------------------------------------------
   */

  trustCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8F3E0",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 19,
  },

  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  trustContent: {
    flex: 1,
    marginLeft: 10,
  },

  trustTitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#166534",
  },

  trustSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: "#66836E",
    marginTop: 2,
  },

  /*
   * ------------------------------------------------------------
   * FOOTER
   * ------------------------------------------------------------
   */

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  footerText: {
    fontSize: 10,
    color: "#8BA0A8",
    marginLeft: 5,
  },

  bottomSpacing: {
    height: 20,
  },
});
