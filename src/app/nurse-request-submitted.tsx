import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getPatientRequest,
  getPatientRequestOffers,
  type NurseServiceRequestStatus,
  type PatientNurseOffer,
} from "@/api/patientRequests";

const careNames: Record<string, string> = {
  general: "General Nursing Care",
  elderly: "Elderly Care",
  "post-hospital": "Post-Hospital Care",
  wound: "Wound Care",
};

const isTrackingStatus = (status: NurseServiceRequestStatus) =>
  status === "ACCEPTED" ||
  status === "EN_ROUTE" ||
  status === "ARRIVED" ||
  status === "IN_SERVICE";

export default function NurseRequestSubmittedScreen() {
  const { patientName, careType, serviceType, urgency, requestId } =
    useLocalSearchParams<{
      patientName?: string;
      careType?: string;
      serviceType?: string;
      urgency?: string;
      requestId?: string;
    }>();

  const [requestStatus, setRequestStatus] =
    useState<NurseServiceRequestStatus>("SEARCHING");

  const [assignedProfessionalName, setAssignedProfessionalName] = useState<
    string | null
  >(null);

  const [offers, setOffers] = useState<PatientNurseOffer[]>([]);

  const acceptedNotifiedRef = useRef(false);
  const trackingOpenedRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const careName = serviceType || careNames[careType ?? ""] || "Nursing Care";

  const isAsap = urgency === "asap";

  useEffect(() => {
    if (!requestId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previousStatus: NurseServiceRequestStatus | null = null;

    const refresh = async () => {
      try {
        const request = await getPatientRequest(requestId);

        if (!active) return;

        const statusChangedToAccepted =
          previousStatus !== null &&
          previousStatus !== "ACCEPTED" &&
          request.status === "ACCEPTED";

        previousStatus = request.status;

        setRequestStatus(request.status);
        setAssignedProfessionalName(request.professionalName ?? null);

        if (
          isTrackingStatus(request.status) &&
          request.professionalId &&
          !trackingOpenedRef.current
        ) {
          trackingOpenedRef.current = true;

          router.replace({
            pathname: "/nurse-on-the-way",
            params: { requestId },
          });

          return;
        }

        if (statusChangedToAccepted && !acceptedNotifiedRef.current) {
          acceptedNotifiedRef.current = true;

          Alert.alert(
            "Nurse assigned",
            request.professionalName
              ? `${request.professionalName} has accepted your request.`
              : "A nurse has accepted your request.",
          );
        }

        if (request.status === "SEARCHING" || request.status === "OFFERED") {
          const currentOffers = await getPatientRequestOffers(requestId);

          if (active) setOffers(currentOffers);
        }

        if (request.status === "SEARCHING" || request.status === "OFFERED") {
          timer = setTimeout(refresh, 5000);
        }
      } catch (error) {
        console.warn("Unable to refresh nurse request status", error);
      }
    };

    void refresh();

    return () => {
      active = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [requestId]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulseAnim]);

  const statusLabel = (() => {
    switch (requestStatus) {
      case "OFFERED": {
        const activeOfferCount = offers.filter(
          (offer) => offer.status === "OFFERED",
        ).length;

        return `${activeOfferCount || offers.length} nurse${
          (activeOfferCount || offers.length) === 1 ? "" : "s"
        } notified`;
      }

      case "SEARCHING": {
        const hasActiveOffer = offers.some(
          (offer) => offer.status === "OFFERED",
        );

        const hasDeclinedOffer = offers.some(
          (offer) => offer.status === "DECLINED",
        );

        if (!hasActiveOffer && hasDeclinedOffer) {
          return "Nurse declined — finding another nurse";
        }

        return "Finding a nurse";
      }

      case "ACCEPTED":
        return assignedProfessionalName
          ? `${assignedProfessionalName} is getting ready`
          : "Nurse is getting ready";

      case "EN_ROUTE":
        return "Nurse is on the way";

      case "ARRIVED":
        return "Nurse has arrived";

      case "IN_SERVICE":
        return "Service in progress";

      case "COMPLETED":
        return "Service completed";

      case "CANCELLED":
        return "Request cancelled";

      case "EXPIRED":
        return "Request expired";

      default:
        return "Finding a nurse";
    }
  })();

  const isSearching =
    requestStatus === "SEARCHING" || requestStatus === "OFFERED";

  const isTerminal =
    requestStatus === "CANCELLED" || requestStatus === "EXPIRED";

  const statusConfig = (() => {
    switch (requestStatus) {
      case "ACCEPTED":
        return {
          icon: "checkmark-circle" as const,
          color: "#059669",
          background: "#ECFDF5",
          badgeBackground: "#D1FAE5",
          badgeText: "#047857",
          message: "Your nurse has accepted the request.",
        };

      case "EN_ROUTE":
        return {
          icon: "navigate" as const,
          color: "#2563EB",
          background: "#EFF6FF",
          badgeBackground: "#DBEAFE",
          badgeText: "#1D4ED8",
          message: "Your nurse is travelling to you.",
        };

      case "ARRIVED":
        return {
          icon: "location" as const,
          color: "#7C3AED",
          background: "#F5F3FF",
          badgeBackground: "#EDE9FE",
          badgeText: "#6D28D9",
          message: "Your nurse has arrived at the location.",
        };

      case "IN_SERVICE":
        return {
          icon: "medical" as const,
          color: "#0EA5B7",
          background: "#ECFEFF",
          badgeBackground: "#CFFAFE",
          badgeText: "#0E7490",
          message: "Your nursing service is currently in progress.",
        };

      case "CANCELLED":
        return {
          icon: "close-circle" as const,
          color: "#DC2626",
          background: "#FEF2F2",
          badgeBackground: "#FEE2E2",
          badgeText: "#B91C1C",
          message: "This request has been cancelled.",
        };

      case "EXPIRED":
        return {
          icon: "time" as const,
          color: "#D97706",
          background: "#FFFBEB",
          badgeBackground: "#FEF3C7",
          badgeText: "#B45309",
          message: "This request is no longer active.",
        };

      default:
        return {
          icon: "search" as const,
          color: "#0EA5B7",
          background: "#ECFEFF",
          badgeBackground: "#CFFAFE",
          badgeText: "#0E7490",
          message:
            requestStatus === "OFFERED"
              ? "Nearby nurses have been notified and are responding."
              : "We're checking nearby professionals who can help you.",
        };
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackButton}
            activeOpacity={0.8}
            onPress={() => router.replace("/")}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerEyebrow}>CARE REQUEST</Text>

            <Text style={styles.headerTitle}>
              {isSearching ? "Finding your nurse" : statusLabel}
            </Text>
          </View>

          {isSearching && (
            <View style={styles.liveBadge}>
              <Animated.View
                style={[
                  styles.liveDot,
                  {
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.35],
                    }),
                  },
                ]}
              />

              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Main search visual */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <View style={styles.iconContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.45],
                        }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 0],
                    }),
                  },
                ]}
              />

              <View
                style={[
                  styles.mainIcon,
                  {
                    backgroundColor: statusConfig.color,
                  },
                ]}
              >
                <Ionicons name={statusConfig.icon} size={34} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.heroTitle}>{statusLabel}</Text>

            <Text style={styles.heroSubtitle}>{statusConfig.message}</Text>

            {isSearching && (
              <View style={styles.searchIndicator}>
                <View style={styles.searchLine}>
                  <Animated.View
                    style={[
                      styles.searchProgress,
                      {
                        transform: [
                          {
                            translateX: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-35, 35],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>

                <Text style={styles.searchIndicatorText}>
                  {requestStatus === "OFFERED"
                    ? `${offers.length || 0} response${
                        offers.length === 1 ? "" : "s"
                      } received`
                    : "Searching nearby professionals"}
                </Text>
              </View>
            )}
          </View>

          {/* Request details */}
          <View style={styles.detailsCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>REQUEST DETAILS</Text>

                <Text style={styles.cardTitle}>Your care request</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusConfig.badgeBackground,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: statusConfig.color,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: statusConfig.badgeText,
                    },
                  ]}
                >
                  {requestStatus}
                </Text>
              </View>
            </View>

            <View style={styles.detailRows}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="medical-outline" size={18} color="#2563EB" />
                </View>

                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>CARE REQUIRED</Text>

                  <Text style={styles.detailValue}>{careName}</Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons
                    name={isAsap ? "flash-outline" : "calendar-outline"}
                    size={18}
                    color="#2563EB"
                  />
                </View>

                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>REQUEST TYPE</Text>

                  <Text style={styles.detailValue}>
                    {isAsap ? "As soon as possible" : "Scheduled"}
                  </Text>
                </View>

                {isAsap && (
                  <View style={styles.asapBadge}>
                    <Ionicons name="flash" size={12} color="#B45309" />

                    <Text style={styles.asapText}>ASAP</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Information */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: statusConfig.background,
              },
            ]}
          >
            <View
              style={[
                styles.infoIcon,
                {
                  backgroundColor: "#FFFFFF",
                },
              ]}
            >
              <Ionicons
                name={
                  isSearching
                    ? "shield-checkmark-outline"
                    : "information-circle-outline"
                }
                size={20}
                color={statusConfig.color}
              />
            </View>

            <View style={styles.infoContent}>
              <Text
                style={[
                  styles.infoTitle,
                  {
                    color: statusConfig.badgeText,
                  },
                ]}
              >
                {isSearching ? "We're on it" : "Request status"}
              </Text>

              <Text style={styles.infoText}>
                {isSearching
                  ? "We're continuously checking for an available and appropriately qualified healthcare worker near the requested location."
                  : statusConfig.message}
              </Text>
            </View>
          </View>

          {/* Offers */}
          {offers.length > 0 && isSearching && (
            <View style={styles.offerCard}>
              <View style={styles.offerPeople}>
                <Ionicons name="people" size={19} color="#2563EB" />
              </View>

              <View style={styles.offerContent}>
                <Text style={styles.offerTitle}>
                  {offers.length} professional
                  {offers.length === 1 ? "" : "s"} responding
                </Text>

                <Text style={styles.offerSubtitle}>
                  We're coordinating responses for you.
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={17} color="#94A3B8" />
            </View>
          )}
        </View>

        {/* Bottom action */}
        <View style={styles.bottom}>
          <TouchableOpacity
            style={[styles.homeButton, isTerminal && styles.homeButtonTerminal]}
            onPress={() => router.replace("/")}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={19} color="#FFFFFF" />

            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>

          {isSearching && (
            <Text style={styles.bottomHint}>
              You can return home. Your request will continue to be monitored.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  container: {
    flex: 1,
  },

  header: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  headerContent: {
    flex: 1,
    marginLeft: 12,
  },

  headerEyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#94A3B8",
  },

  headerTitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 5,
  },

  liveText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#047857",
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  heroCard: {
    minHeight: 245,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
    backgroundColor: "#ECFEFF",
    borderWidth: 1,
    borderColor: "#CFFAFE",
  },

  heroGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#CFFAFE",
    opacity: 0.55,
    top: -120,
  },

  iconContainer: {
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
  },

  pulseRing: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#0EA5B7",
  },

  mainIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },

  heroTitle: {
    marginTop: 13,
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },

  heroSubtitle: {
    marginTop: 6,
    maxWidth: 310,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    textAlign: "center",
  },

  searchIndicator: {
    width: "100%",
    marginTop: 17,
    alignItems: "center",
  },

  searchLine: {
    width: 76,
    height: 4,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#CCFBF1",
  },

  searchProgress: {
    width: 30,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#0EA5B7",
  },

  searchIndicatorText: {
    marginTop: 7,
    fontSize: 10,
    fontWeight: "700",
    color: "#0F766E",
  },

  detailsCard: {
    marginTop: 13,
    padding: 15,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardEyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#94A3B8",
  },

  cardTitle: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  statusBadgeText: {
    fontSize: 9,
    fontWeight: "900",
  },

  detailRows: {
    marginTop: 12,
  },

  detailRow: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },

  detailTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  detailLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "#94A3B8",
  },

  detailValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  detailDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 2,
  },

  asapBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFFBEB",
  },

  asapText: {
    marginLeft: 3,
    fontSize: 8,
    fontWeight: "900",
    color: "#B45309",
  },

  infoCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 10,
  },

  infoTitle: {
    fontSize: 11,
    fontWeight: "900",
  },

  infoText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: "#64748B",
  },

  offerCard: {
    marginTop: 10,
    padding: 11,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },

  offerPeople: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },

  offerContent: {
    flex: 1,
    marginLeft: 10,
  },

  offerTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E3A8A",
  },

  offerSubtitle: {
    marginTop: 2,
    fontSize: 9,
    color: "#64748B",
  },

  bottom: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#F8FAFC",
  },

  homeButton: {
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  homeButtonTerminal: {
    backgroundColor: "#0F766E",
  },

  homeButtonText: {
    marginLeft: 7,
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  bottomHint: {
    marginTop: 7,
    fontSize: 9,
    lineHeight: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
});
