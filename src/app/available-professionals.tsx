import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  continuePatientMatching,
  getAvailableProfessionals,
  getPatientRequest,
  type AvailableProfessional,
} from "@/api/patientRequests";

type MatchMode = "any" | "distance";

type DistanceOption = 5 | 10 | 15;

type ScreenMode = "availability" | "matching" | "accepted";

/* ==========================================================================
   MAIN SCREEN
========================================================================== */

export default function AvailableProfessionalsScreen() {
  const {
    requestId,
    latitude: latitudeParam,
    longitude: longitudeParam,
  } = useLocalSearchParams<{
    requestId?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const [professionals, setProfessionals] = useState<AvailableProfessional[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);

  const [matchMode, setMatchMode] = useState<MatchMode>("any");

  const [selectedDistance, setSelectedDistance] = useState<DistanceOption>(10);

  const [screenMode, setScreenMode] = useState<ScreenMode>("availability");

  const [matchingStep, setMatchingStep] = useState(0);

  const [acceptanceAnimation] = useState(() => new Animated.Value(0));
  const matchingPollActiveRef = useRef(false);

  /*
   * ------------------------------------------------------------------------
   * ANIMATION VALUES
   * ------------------------------------------------------------------------
   */

  const [pinAnimations, setPinAnimations] = useState<Animated.Value[]>([]);

  const mapFocusAnimation = useRef(new Animated.Value(0)).current;

  const successScale = useRef(new Animated.Value(0.7)).current;

  const successOpacity = useRef(new Animated.Value(0)).current;

  /*
   * Keep one animation value per real professional returned by the backend.
   * No fixed/demo professional count is used here.
   */
  useEffect(() => {
    setPinAnimations((previous) =>
      professionals.map((_, index) => previous[index] ?? new Animated.Value(0)),
    );
  }, [professionals]);

  /*
   * ------------------------------------------------------------------------
   * REAL AVAILABILITY
   * ------------------------------------------------------------------------
   *
   * The request was already created by the previous screen. We now ask the
   * backend for the actual professionals available for this request.
   */

  const load = useCallback(async () => {
    if (!requestId) {
      setProfessionals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await getAvailableProfessionals(requestId);

      setProfessionals(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Load available professionals error:", error);

      setProfessionals([]);

      Alert.alert(
        "Unable to load availability",
        error?.message ??
          "We couldn't check nurse availability. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      matchingPollActiveRef.current = false;
    };
  }, []);

  /*
   * ------------------------------------------------------------------------
   * PIN ANIMATION
   * ------------------------------------------------------------------------
   *
   * Each real professional gets a slightly different, slow vertical drift.
   * This is visual only and does not affect the booking/matching flow.
   */

  useEffect(() => {
    if (screenMode === "tracking" || professionals.length === 0) {
      return;
    }

    const animations = pinAnimations.map((animation, index) => {
      const amplitude = 4 + (index % 3);
      const duration = 1500 + ((index * 137) % 500);

      return Animated.loop(
        Animated.sequence([
          Animated.delay((index * 260) % 1100),
          Animated.timing(animation, {
            toValue: -amplitude,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: amplitude * 0.55,
            duration: duration + 250,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: duration + 150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(500 + ((index * 97) % 700)),
        ]),
      );
    });

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [screenMode, professionals, pinAnimations]);

  /*
   * ------------------------------------------------------------------------
   * AVAILABILITY COUNTS
   * ------------------------------------------------------------------------
   */

  const availability = useMemo(() => {
    const within6 = professionals.filter(
      (professional) => professional.distanceKm < 6,
    );

    const within10 = professionals.filter(
      (professional) =>
        professional.distanceKm >= 6 && professional.distanceKm <= 10,
    );

    const within15 = professionals.filter(
      (professional) =>
        professional.distanceKm > 10 && professional.distanceKm < 15,
    );

    return {
      within6,
      within10,
      within15,
      total: professionals.length,
    };
  }, [professionals]);

  const selectedAvailabilityCount = useMemo(() => {
    return professionals.filter(
      (professional) => professional.distanceKm <= selectedDistance,
    ).length;
  }, [professionals, selectedDistance]);

  const selectedPrice = useMemo(() => {
    if (selectedDistance <= 5) return 199;
    if (selectedDistance <= 10) return 249;

    return 299;
  }, [selectedDistance]);

  /*
   * ------------------------------------------------------------------------
   * START MATCHING
   * ------------------------------------------------------------------------
   *
   * Matching starts through the real backend. We then watch the real request
   * status until the professional accepts it. There is intentionally no fake
   * acceptance timer.
   */

  const handleFindNurse = async () => {
    if (!requestId || continuing) return;

    if (professionals.length === 0) {
      Alert.alert(
        "No professionals available",
        "There are currently no available care professionals for this request.",
      );
      return;
    }

    try {
      setContinuing(true);
      setScreenMode("matching");
      setMatchingStep(0);
      mapFocusAnimation.setValue(0);
      acceptanceAnimation.setValue(0);
      matchingPollActiveRef.current = true;

      await continuePatientMatching(requestId);

      setMatchingStep(1);

      const checkRequestStatus = async () => {
        if (!matchingPollActiveRef.current) return;

        try {
          const request = await getPatientRequest(requestId);

          if (!matchingPollActiveRef.current) return;

          if (request.status === "ACCEPTED") {
            matchingPollActiveRef.current = false;
            setMatchingStep(2);
            setContinuing(false);
            setScreenMode("accepted");

            Animated.parallel([
              Animated.timing(acceptanceAnimation, {
                toValue: 1,
                duration: 650,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.spring(successScale, {
                toValue: 1,
                friction: 7,
                tension: 80,
                useNativeDriver: true,
              }),
            ]).start(({ finished }) => {
              if (!finished || !requestId) return;

              setTimeout(() => {
                router.replace({
                  pathname: "/nurse-on-the-way",
                  params: { requestId },
                });
              }, 900);
            });

            return;
          }

          if (request.status === "CANCELLED" || request.status === "EXPIRED") {
            matchingPollActiveRef.current = false;
            setScreenMode("availability");
            setContinuing(false);

            Alert.alert(
              request.status === "CANCELLED"
                ? "Request cancelled"
                : "Request expired",
              request.status === "CANCELLED"
                ? "This care request has been cancelled."
                : "This care request has expired. Please start a new request.",
            );

            return;
          }
        } catch (error) {
          console.warn("Unable to refresh matching request status", error);
        }

        if (matchingPollActiveRef.current) {
          setTimeout(checkRequestStatus, 2000);
        }
      };

      void checkRequestStatus();
    } catch (error: any) {
      matchingPollActiveRef.current = false;
      setScreenMode("availability");
      setContinuing(false);

      Alert.alert(
        "Matching unavailable",
        error?.message ?? "We couldn't start nurse matching. Please try again.",
      );
    }
  };

  /*
   * ------------------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------------------
   */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons
              name="location-outline"
              size={28}
              color={COLORS.primary}
            />
          </View>

          <ActivityIndicator
            size="small"
            color={COLORS.primary}
            style={styles.loadingSpinner}
          />

          <Text style={styles.loadingTitle}>Checking nurse availability</Text>

          <Text style={styles.loadingSubtitle}>
            Finding available care professionals near you...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ------------------------------------------------------------------------
   * ACCEPTANCE TRANSITION
   * ------------------------------------------------------------------------
   */

  if (screenMode === "accepted") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.acceptanceScreen}>
          <Animated.View
            style={[
              styles.acceptanceGlow,
              {
                opacity: acceptanceAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.18],
                }),
                transform: [
                  {
                    scale: acceptanceAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.15],
                    }),
                  },
                ],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.acceptanceIcon,
              {
                opacity: acceptanceAnimation,
                transform: [
                  {
                    scale: acceptanceAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.55, 1],
                    }),
                  },
                  {
                    translateY: acceptanceAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="checkmark" size={42} color={COLORS.white} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: acceptanceAnimation,
              transform: [
                {
                  translateY: acceptanceAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            <Text style={styles.acceptanceTitle}>
              Your order has been accepted
            </Text>

            <Text style={styles.acceptanceSubtitle}>
              Your care professional has accepted the request.
            </Text>

            <View style={styles.acceptanceNextCard}>
              <View style={styles.acceptanceNextIcon}>
                <Ionicons
                  name="person-outline"
                  size={21}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.acceptanceNextContent}>
                <Text style={styles.acceptanceNextEyebrow}>NEXT</Text>

                <Text style={styles.acceptanceNextTitle}>
                  Your professional is getting ready
                </Text>

                <Text style={styles.acceptanceNextText}>
                  We&apos;ll take you to the live care journey now.
                </Text>
              </View>

              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ------------------------------------------------------------------------
   * MATCHING SCREEN
   * ------------------------------------------------------------------------
   */

  if (screenMode === "matching") {
    return (
      <MatchingScreen
        matchingStep={matchingStep}
        pinAnimations={pinAnimations}
        mapFocusAnimation={mapFocusAnimation}
        professionals={professionals}
      />
    );
  }

  /*
   * ------------------------------------------------------------------------
   * AVAILABILITY SCREEN
   * ------------------------------------------------------------------------
   */

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={21} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Nurse availability</Text>

            <Text style={styles.headerSubtitle}>
              Care professionals available near you
            </Text>
          </View>
        </View>

        {/* SUMMARY */}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryEyebrow}>AVAILABLE NEAR YOU</Text>

              <Text style={styles.summaryTitle}>
                {availability.total} care professionals available
              </Text>

              <Text style={styles.summaryDescription}>
                CareNow will find a suitable care professional based on your
                care requirements and distance.
              </Text>
            </View>

            <View style={styles.summaryIcon}>
              <Ionicons
                name="people-outline"
                size={24}
                color={COLORS.primary}
              />
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.availabilityStats}>
            <AvailabilityStat
              count={availability.within6.length}
              label="Within 6 km"
            />

            <View style={styles.statDivider} />

            <AvailabilityStat
              count={availability.within10.length}
              label="6–10 km"
            />

            <View style={styles.statDivider} />

            <AvailabilityStat
              count={availability.within15.length}
              label="10–15 km"
            />
          </View>
        </View>

        {/* MAP */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Care availability</Text>

          <Text style={styles.sectionSubtitle}>
            Approximate availability around your location
          </Text>
        </View>

        <AvailabilityMap
          pinAnimations={pinAnimations}
          professionals={professionals}
          showPatientLabel
        />

        {/* MATCHING */}

        <View style={styles.preferenceSection}>
          <Text style={styles.sectionTitle}>
            How would you like us to match?
          </Text>

          <Text style={styles.sectionSubtitle}>
            Choose how widely CareNow should search.
          </Text>

          {/* ANY */}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMatchMode("any")}
            style={[
              styles.optionCard,
              matchMode === "any" && styles.optionCardSelected,
            ]}
          >
            <View
              style={[
                styles.radioOuter,
                matchMode === "any" && styles.radioOuterSelected,
              ]}
            >
              {matchMode === "any" && <View style={styles.radioInner} />}
            </View>

            <View style={styles.optionContent}>
              <View style={styles.optionTitleRow}>
                <Text style={styles.optionTitle}>
                  Any available care professional
                </Text>

                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                </View>
              </View>

              <Text style={styles.optionDescription}>
                CareNow finds a suitable available nurse near your location.
              </Text>

              <View style={styles.optionBottomRow}>
                <View style={styles.optionMeta}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={COLORS.primary}
                  />

                  <Text style={styles.optionMetaText}>
                    {availability.total} available
                  </Text>
                </View>

                <Text style={styles.priceText}>From ₹199</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* DISTANCE */}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMatchMode("distance")}
            style={[
              styles.optionCard,
              matchMode === "distance" && styles.optionCardSelected,
            ]}
          >
            <View
              style={[
                styles.radioOuter,
                matchMode === "distance" && styles.radioOuterSelected,
              ]}
            >
              {matchMode === "distance" && <View style={styles.radioInner} />}
            </View>

            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Choose maximum distance</Text>

              <Text style={styles.optionDescription}>
                Only search for a care professional within your selected
                distance.
              </Text>

              {matchMode === "distance" && (
                <View style={styles.distanceOptions}>
                  {([5, 10, 15] as DistanceOption[]).map((distance) => {
                    const count = professionals.filter(
                      (professional) => professional.distanceKm <= distance,
                    ).length;

                    const selected = selectedDistance === distance;

                    return (
                      <TouchableOpacity
                        key={distance}
                        activeOpacity={0.8}
                        onPress={() => setSelectedDistance(distance)}
                        style={[
                          styles.distanceChip,
                          selected && styles.distanceChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.distanceChipValue,
                            selected && styles.distanceChipValueSelected,
                          ]}
                        >
                          {distance} km
                        </Text>

                        <Text
                          style={[
                            styles.distanceChipCount,
                            selected && styles.distanceChipCountSelected,
                          ]}
                        >
                          {count} available
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* PRICE */}

        <View style={styles.priceInfoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={COLORS.primary}
          />

          <View style={styles.priceInfoContent}>
            <Text style={styles.priceInfoTitle}>
              Distance-based care amount
            </Text>

            <Text style={styles.priceInfoText}>
              Up to 6 km · ₹199{"\n"}
              6–10 km · ₹249{"\n"}
              10–15 km · ₹299
            </Text>
          </View>
        </View>

        {/* PRIVACY */}

        <View style={styles.assignmentNote}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={COLORS.primary}
          />

          <Text style={styles.assignmentNoteText}>
            Professional details are shown only after someone accepts your
            request.
          </Text>
        </View>

        {/* CTA */}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={continuing || professionals.length === 0}
          onPress={handleFindNurse}
          style={[
            styles.primaryButton,
            (continuing || professionals.length === 0) &&
              styles.primaryButtonDisabled,
          ]}
        >
          {continuing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {matchMode === "distance"
                  ? `Find a Nurse within ${selectedDistance} km`
                  : "Book a Care Professional"}
              </Text>

              <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.bottomHint}>
          Availability is based on your current request and the professionals
          currently online.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ==========================================================================
   MATCHING SCREEN
========================================================================== */

function MatchingScreen({
  matchingStep,
  pinAnimations,
  mapFocusAnimation,
  professionals,
}: {
  matchingStep: number;
  pinAnimations: Animated.Value[];
  mapFocusAnimation: Animated.Value;
  professionals: AvailableProfessional[];
}) {
  const messages = [
    {
      title: "Finding a care professional near you",
      subtitle: "We're checking available care professionals nearby.",
      icon: "search-outline" as const,
    },
    {
      title: "Connecting you with available care",
      subtitle: "We're matching your request with the right availability.",
      icon: "git-network-outline" as const,
    },
    {
      title: "Waiting for professional confirmation",
      subtitle: "A nearby care professional is reviewing your request.",
      icon: "person-outline" as const,
    },
  ];

  const currentMessage = messages[matchingStep];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.matchingScrollContent}
      >
        {/* TOP */}

        <View style={styles.matchingHeader}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />

            <Text style={styles.liveText}>LIVE MATCHING</Text>
          </View>

          <Text style={styles.matchingTitle}>Finding a care professional</Text>

          <Text style={styles.matchingSubtitle}>
            Please stay on this screen while we connect you with available care.
          </Text>
        </View>

        {/* MAP */}

        <Animated.View
          style={[
            styles.matchingMapWrapper,
            {
              transform: [
                {
                  scale: mapFocusAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            },
          ]}
        >
          <AvailabilityMap
            pinAnimations={pinAnimations}
            professionals={professionals}
            showPatientLabel={false}
            matching
          />
        </Animated.View>

        {/* STATUS */}

        <View style={styles.matchingStatusCard}>
          <View style={styles.matchingIconContainer}>
            <Animated.View
              style={[
                styles.matchingIconCircle,
                {
                  transform: [
                    {
                      scale: mapFocusAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={currentMessage.icon}
                size={25}
                color={COLORS.primary}
              />
            </Animated.View>
          </View>

          <View style={styles.matchingStatusContent}>
            <Text style={styles.matchingStatusTitle}>
              {currentMessage.title}
            </Text>

            <Text style={styles.matchingStatusSubtitle}>
              {currentMessage.subtitle}
            </Text>
          </View>
        </View>

        {/* PROGRESS */}

        <View style={styles.matchingProgress}>
          <MatchingStep
            active={matchingStep >= 0}
            complete={matchingStep > 0}
            label="Searching"
          />

          <View
            style={[
              styles.progressLine,
              matchingStep > 0 && styles.progressLineActive,
            ]}
          />

          <MatchingStep
            active={matchingStep >= 1}
            complete={matchingStep > 1}
            label="Matching"
          />

          <View
            style={[
              styles.progressLine,
              matchingStep > 1 && styles.progressLineActive,
            ]}
          />

          <MatchingStep
            active={matchingStep >= 2}
            complete={false}
            label="Confirming"
          />
        </View>

        {/* REQUEST CARD */}

        <View style={styles.requestCard}>
          <View style={styles.requestCardIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.requestCardContent}>
            <Text style={styles.requestCardTitle}>
              Your care request is active
            </Text>

            <Text style={styles.requestCardText}>
              We're looking for a suitable care professional. You don't need to
              select a professional manually.
            </Text>
          </View>
        </View>

        <Text style={styles.matchingFooter}>
          This usually takes less than a minute.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ==========================================================================
   TRACKING SCREEN
========================================================================== */

function TrackingScreen({
  nurse,
  successScale,
  successOpacity,
  mapFocusAnimation,
  patientLatitude,
  patientLongitude,
}: {
  nurse: AvailableProfessional;
  successScale: Animated.Value;
  successOpacity: Animated.Value;
  mapFocusAnimation: Animated.Value;
  patientLatitude?: number;
  patientLongitude?: number;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.trackingScrollContent}
      >
        {/* SUCCESS HEADER */}

        <Animated.View
          style={[
            styles.trackingHeader,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={31} color={COLORS.white} />
          </View>

          <Text style={styles.trackingTitle}>
            Your care professional is on the way
          </Text>

          <Text style={styles.trackingSubtitle}>
            Your request has been accepted. You can follow their journey below.
          </Text>
        </Animated.View>

        {/* MAP */}

        <Animated.View
          style={[
            styles.trackingMapWrapper,
            {
              opacity: successOpacity,
              transform: [{ scale: mapFocusAnimation }],
            },
          ]}
        >
          <TrackingMap
            nurse={nurse}
            patientLatitude={patientLatitude}
            patientLongitude={patientLongitude}
          />
        </Animated.View>

        {/* NURSE CARD */}

        <Animated.View
          style={[
            styles.assignedCard,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <View style={styles.assignedTopRow}>
            <View style={styles.nurseAvatar}>
              <Ionicons name="person" size={26} color={COLORS.primary} />
            </View>

            <View style={styles.assignedInfo}>
              <Text style={styles.assignedLabel}>YOUR CARE PROFESSIONAL</Text>

              <Text style={styles.assignedName}>{nurse.name}</Text>

              <Text style={styles.assignedProfession}>Registered Nurse</Text>
            </View>

            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color={COLORS.warning} />

              <Text style={styles.ratingText}>{nurse.rating}</Text>
            </View>
          </View>

          <View style={styles.assignedDivider} />

          <View style={styles.arrivalRow}>
            <View style={styles.arrivalItem}>
              <Ionicons
                name="location-outline"
                size={18}
                color={COLORS.primary}
              />

              <View>
                <Text style={styles.arrivalLabel}>Distance</Text>

                <Text style={styles.arrivalValue}>
                  {nurse.distanceKm} km away
                </Text>
              </View>
            </View>

            <View style={styles.arrivalItem}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />

              <View>
                <Text style={styles.arrivalLabel}>Estimated arrival</Text>

                <Text style={styles.arrivalValue}>~18 minutes</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* STATUS */}

        <Animated.View
          style={[styles.onTheWayCard, { opacity: successOpacity }]}
        >
          <View style={styles.onTheWayIcon}>
            <Ionicons
              name="navigate-outline"
              size={20}
              color={COLORS.success}
            />
          </View>

          <View style={styles.onTheWayContent}>
            <Text style={styles.onTheWayTitle}>
              Your care professional is on the way
            </Text>

            <Text style={styles.onTheWayText}>
              Follow the journey below. We’ll keep you updated as your
              professional travels to you.
            </Text>
          </View>
        </Animated.View>

        {/* LIVE TRACKING STATUS */}

        <Animated.View
          style={[styles.trackingFooterCard, { opacity: successOpacity }]}
        >
          <View style={styles.trackingFooterIcon}>
            <Ionicons
              name="navigate-circle-outline"
              size={21}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.trackingFooterContent}>
            <Text style={styles.trackingFooterTitle}>
              CareNow is tracking the journey
            </Text>

            <Text style={styles.trackingFooterText}>
              This screen will show the latest location and arrival updates as
              your professional travels to you.
            </Text>
          </View>
        </Animated.View>

        {/* HOME CTA */}

        <Animated.View style={{ opacity: successOpacity }}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.replace("/")}
            style={styles.homeButton}
          >
            <Ionicons name="home-outline" size={19} color={COLORS.white} />
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.homeButtonHint}>
          Your care request remains active after you return home.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ==========================================================================
   AVAILABILITY MAP
========================================================================== */

function AvailabilityMap({
  pinAnimations,
  professionals,
  showPatientLabel = true,
  matching = false,
}: {
  pinAnimations: Animated.Value[];
  professionals: AvailableProfessional[];
  showPatientLabel?: boolean;
  matching?: boolean;
}) {
  const emptyPulse = useRef(new Animated.Value(0)).current;
  const hasProfessionals = professionals.length > 0;
  const maxDistanceKm = hasProfessionals
    ? Math.max(...professionals.map((item) => Number(item.distanceKm) || 0), 1)
    : 1;

  useEffect(() => {
    if (hasProfessionals) {
      emptyPulse.stopAnimation();
      emptyPulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(emptyPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(emptyPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [hasProfessionals, emptyPulse]);

  const pulseScale = emptyPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.16],
  });

  const pulseOpacity = emptyPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.06],
  });

  return (
    <View style={styles.mapCard}>
      {/* MAP GRID */}
      <View style={styles.mapGridVerticalOne} />
      <View style={styles.mapGridVerticalTwo} />
      <View style={styles.mapGridHorizontalOne} />
      <View style={styles.mapGridHorizontalTwo} />

      {/* ROADS */}
      <View style={styles.roadOne} />
      <View style={styles.roadTwo} />
      <View style={styles.roadThree} />

      {/* RANGES */}
      <View style={styles.rangeOuter} />
      <View style={styles.rangeMiddle} />
      <View style={styles.rangeInner} />

      {hasProfessionals ? (
        <>
          {professionals.map((professional, index) => {
            const distanceKm = Math.max(
              0,
              Number(professional.distanceKm) || 0,
            );
            const distanceRatio = Math.min(distanceKm / maxDistanceKm, 1);

            // Illustrative radial placement: distance from the real API controls
            // how far the anonymous pin sits from the patient's location.
            const radiusX = 10 + distanceRatio * 34;
            const radiusY = 9 + distanceRatio * 34;
            const angle =
              -Math.PI / 2 +
              index * 2.399963229728653 +
              (professionals.length % 2) * 0.18;

            const left = 50 + Math.cos(angle) * radiusX;
            const top = 50 + Math.sin(angle) * radiusY;
            const far = distanceKm > 6;

            return (
              <Animated.View
                key={professional.professionalId}
                style={[
                  styles.animatedPin,
                  {
                    left: `${left}%`,
                    top: `${top}%`,
                    marginLeft: -20,
                    marginTop: -20,
                    transform: [{ translateY: pinAnimations[index] ?? 0 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.availabilityPinDot,
                    far && styles.availabilityPinDotFar,
                    matching && styles.matchingPin,
                  ]}
                >
                  <Ionicons
                    name="medical-outline"
                    size={13}
                    color={COLORS.white}
                  />
                </View>

                {/* Anonymous distance only — never show the professional name here. */}
                <View
                  style={[styles.distancePill, far && styles.distancePillFar]}
                >
                  <Text style={styles.distancePillText}>
                    {distanceKm.toFixed(1)} km
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </>
      ) : (
        <View style={styles.noAvailabilityOverlay}>
          <Animated.View
            style={[
              styles.searchPulseOuter,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.searchPulseMiddle,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={styles.noAvailabilityCenter}>
            <Ionicons name="search-outline" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.noAvailabilityTitle}>
            No professionals nearby
          </Text>
          <Text style={styles.noAvailabilitySubtitle}>
            No care professionals are available for this request right now.
          </Text>
        </View>
      )}

      {/* PATIENT */}
      <View style={styles.patientLocation}>
        <View style={styles.patientPulse} />

        <View style={styles.patientMarker}>
          <Ionicons name="location" size={19} color={COLORS.white} />
        </View>

        {showPatientLabel && (
          <View style={styles.locationLabel}>
            <Text style={styles.locationLabelText}>Your location</Text>
          </View>
        )}
      </View>

      {/* LEGEND */}
      {hasProfessionals && (
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={styles.legendDotNearby} />
            <Text style={styles.legendText}>Nearby</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={styles.legendDotFar} />
            <Text style={styles.legendText}>Wider area</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function AvailabilityStat({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statCount}>{count}</Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MatchingStep({
  active,
  complete,
  label,
}: {
  active: boolean;
  complete: boolean;
  label: string;
}) {
  return (
    <View style={styles.matchingStep}>
      <View
        style={[
          styles.matchingStepCircle,
          active && styles.matchingStepCircleActive,
        ]}
      >
        {complete ? (
          <Ionicons name="checkmark" size={12} color={COLORS.white} />
        ) : (
          <View
            style={[
              styles.matchingStepDot,
              active && styles.matchingStepDotActive,
            ]}
          />
        )}
      </View>

      <Text
        style={[
          styles.matchingStepLabel,
          active && styles.matchingStepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ==========================================================================
   COLORS
========================================================================== */

const COLORS = {
  primary: "#0F766E",
  primaryDark: "#115E59",
  primaryTint: "#CCFBF1",
  lightTeal: "#F0FDFA",

  white: "#FFFFFF",

  background: "#F8FAFC",
  surface: "#FFFFFF",

  text: "#0F172A",
  secondary: "#64748B",
  muted: "#475569",

  border: "#E2E8F0",

  success: "#15803D",
  successLight: "#DCFCE7",

  warning: "#B45309",
  warningLight: "#FFFBEB",
};

/* ==========================================================================
   STYLES
========================================================================== */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },

  /* ------------------------------------------------------------------------
     LOADING
  ------------------------------------------------------------------------ */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryTint,
    marginBottom: 18,
  },

  loadingSpinner: {
    marginBottom: 14,
  },

  loadingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },

  loadingSubtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.secondary,
    textAlign: "center",
  },

  /* ------------------------------------------------------------------------
     HEADER
  ------------------------------------------------------------------------ */

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     SUMMARY
  ------------------------------------------------------------------------ */

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  summaryTextContainer: {
    flex: 1,
  },

  summaryEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: COLORS.primary,
  },

  summaryTitle: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.text,
  },

  summaryDescription: {
    marginTop: 7,
    paddingRight: 8,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.secondary,
  },

  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightTeal,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  availabilityStats: {
    flexDirection: "row",
    alignItems: "center",
  },

  stat: {
    flex: 1,
    alignItems: "center",
  },

  statCount: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  statLabel: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.secondary,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },

  /* ------------------------------------------------------------------------
     SECTIONS
  ------------------------------------------------------------------------ */

  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     MAP
  ------------------------------------------------------------------------ */

  mapCard: {
    height: 310,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    position: "relative",
  },

  noAvailabilityOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 46,
    zIndex: 4,
  },

  searchPulseOuter: {
    position: "absolute",
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.12)",
  },

  searchPulseMiddle: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.18)",
  },

  noAvailabilityCenter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 2,
    borderColor: "#D1FAE5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  noAvailabilityTitle: {
    marginTop: 112,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  noAvailabilitySubtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.secondary,
    textAlign: "center",
  },

  mapGridVerticalOne: {
    position: "absolute",
    width: 1,
    top: -30,
    bottom: -30,
    left: "27%",
    backgroundColor: "#DDF4EC",
    transform: [{ rotate: "12deg" }],
  },

  mapGridVerticalTwo: {
    position: "absolute",
    width: 1,
    top: -30,
    bottom: -30,
    right: "28%",
    backgroundColor: "#DDF4EC",
    transform: [{ rotate: "-15deg" }],
  },

  mapGridHorizontalOne: {
    position: "absolute",
    height: 1,
    left: -30,
    right: -30,
    top: "32%",
    backgroundColor: "#DDF4EC",
    transform: [{ rotate: "-8deg" }],
  },

  mapGridHorizontalTwo: {
    position: "absolute",
    height: 1,
    left: -30,
    right: -30,
    bottom: "29%",
    backgroundColor: "#DDF4EC",
    transform: [{ rotate: "7deg" }],
  },

  roadOne: {
    position: "absolute",
    height: 5,
    width: 400,
    top: 122,
    left: -30,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "17deg" }],
  },

  roadTwo: {
    position: "absolute",
    height: 5,
    width: 380,
    top: 196,
    left: -50,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "-22deg" }],
  },

  roadThree: {
    position: "absolute",
    height: 4,
    width: 340,
    top: 77,
    right: -70,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "-42deg" }],
  },

  rangeOuter: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "rgba(204, 251, 241, 0.20)",
    alignSelf: "center",
    top: 20,
  },

  rangeMiddle: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "#99E8D5",
    backgroundColor: "rgba(204, 251, 241, 0.18)",
    alignSelf: "center",
    top: 60,
  },

  rangeInner: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: "#7DD3C7",
    backgroundColor: "rgba(204, 251, 241, 0.18)",
    alignSelf: "center",
    top: 100,
  },

  /* ------------------------------------------------------------------------
     ANIMATED PINS
  ------------------------------------------------------------------------ */

  animatedPin: {
    position: "absolute",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  availabilityPinDot: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  availabilityPinDotFar: {
    backgroundColor: "#5FAFA7",
  },

  matchingPin: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  distancePill: {
    position: "absolute",
    top: 34,
    minWidth: 42,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(15,118,110,0.94)",
    alignItems: "center",
  },

  distancePillFar: {
    backgroundColor: "rgba(95,175,167,0.96)",
  },

  distancePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.white,
  },

  pinOne: {
    left: "22%",
    top: 76,
  },

  pinTwo: {
    left: "67%",
    top: 92,
  },

  pinThree: {
    left: "31%",
    top: 202,
  },

  pinFour: {
    right: "13%",
    top: 170,
  },

  pinFive: {
    left: "12%",
    top: 238,
  },

  searchingLabel: {
    position: "absolute",
    top: 32,
    left: 22,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  searchingLabelText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.primary,
  },

  /* ------------------------------------------------------------------------
     PATIENT LOCATION
  ------------------------------------------------------------------------ */

  patientLocation: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -16,
    marginTop: -20,
    alignItems: "center",
  },

  patientPulse: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(15, 118, 110, 0.13)",
    top: -9,
    left: -9,
  },

  patientMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryDark,
    borderWidth: 3,
    borderColor: COLORS.white,
    elevation: 4,
  },

  locationLabel: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    elevation: 2,
  },

  locationLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text,
  },

  /* ------------------------------------------------------------------------
     LEGEND
  ------------------------------------------------------------------------ */

  mapLegend: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendDotNearby: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },

  legendDotFar: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5FAFA7",
    marginRight: 5,
  },

  legendText: {
    fontSize: 10,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     MATCHING
  ------------------------------------------------------------------------ */

  matchingScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  acceptanceScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: COLORS.background,
  },

  acceptanceGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.success,
  },

  acceptanceIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },

  acceptanceTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  acceptanceSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.secondary,
    textAlign: "center",
  },

  acceptanceNextCard: {
    width: "100%",
    marginTop: 28,
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },

  acceptanceNextIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryTint,
  },

  acceptanceNextContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  acceptanceNextEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: COLORS.primary,
  },

  acceptanceNextTitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  acceptanceNextText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.secondary,
  },

  matchingHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 18,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },

  liveText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: COLORS.primaryDark,
  },

  matchingTitle: {
    marginTop: 12,
    fontSize: 25,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  matchingSubtitle: {
    marginTop: 6,
    maxWidth: 330,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.secondary,
    textAlign: "center",
  },

  matchingMapWrapper: {
    overflow: "hidden",
    borderRadius: 22,
  },

  matchingStatusCard: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  matchingIconContainer: {
    marginRight: 12,
  },

  matchingIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryTint,
  },

  matchingStatusContent: {
    flex: 1,
  },

  matchingStatusTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  matchingStatusSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.secondary,
  },

  matchingProgress: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  matchingStep: {
    alignItems: "center",
  },

  matchingStepCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },

  matchingStepCircleActive: {
    backgroundColor: COLORS.primary,
  },

  matchingStepDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#94A3B8",
  },

  matchingStepDotActive: {
    backgroundColor: COLORS.white,
  },

  matchingStepLabel: {
    marginTop: 5,
    fontSize: 9,
    color: COLORS.secondary,
  },

  matchingStepLabelActive: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },

  progressLine: {
    flex: 1,
    height: 2,
    marginTop: 12,
    marginHorizontal: 4,
    backgroundColor: "#E2E8F0",
  },

  progressLineActive: {
    backgroundColor: COLORS.primary,
  },

  requestCard: {
    marginTop: 22,
    flexDirection: "row",
    padding: 15,
    borderRadius: 16,
    backgroundColor: COLORS.lightTeal,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },

  requestCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  requestCardContent: {
    flex: 1,
    marginLeft: 10,
  },

  requestCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  requestCardText: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.secondary,
  },

  matchingFooter: {
    marginTop: 18,
    fontSize: 11,
    color: COLORS.secondary,
    textAlign: "center",
  },

  /* ------------------------------------------------------------------------
     MATCHING / TRACKING
  ------------------------------------------------------------------------ */

  trackingScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 40,
  },

  trackingHeader: {
    alignItems: "center",
  },

  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
  },

  trackingTitle: {
    marginTop: 15,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  trackingSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.secondary,
    textAlign: "center",
  },

  trackingMapWrapper: {
    marginTop: 22,
  },

  trackingMap: {
    height: 330,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },

  trackingMapView: {
    flex: 1,
  },

  realMapPatientMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryDark,
    borderWidth: 3,
    borderColor: COLORS.white,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  realMapNurseMarkerOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },

  realMapNurseMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  mapTopBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mapLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },

  mapTopBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: COLORS.primaryDark,
  },

  mapEtaBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mapEtaContent: {
    marginLeft: 7,
  },

  mapEtaLabel: {
    fontSize: 9,
    color: COLORS.secondary,
  },

  mapEtaValue: {
    marginTop: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  mapDistanceBadge: {
    position: "absolute",
    bottom: 13,
    right: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mapDistanceText: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  mapLegendCard: {
    position: "absolute",
    bottom: 13,
    left: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mapLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },

  mapLegendNurseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },

  mapLegendHomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryDark,
    marginRight: 6,
  },

  mapLegendText: {
    fontSize: 9,
    color: COLORS.secondary,
  },

  acceptedRoadOne: {
    position: "absolute",
    width: 360,
    height: 6,
    top: 126,
    left: -30,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "-19deg" }],
  },

  acceptedRoadTwo: {
    position: "absolute",
    width: 300,
    height: 5,
    top: 150,
    right: -35,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "25deg" }],
  },

  acceptedPatientMarker: {
    position: "absolute",
    left: "67%",
    top: "66%",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryDark,
    borderWidth: 3,
    borderColor: COLORS.white,
    elevation: 4,
  },

  acceptedPatientLabel: {
    position: "absolute",
    left: "67%",
    top: "82%",
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.text,
  },

  assignedNurseMarker: {
    position: "absolute",
    left: "20%",
    top: "22%",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    elevation: 5,
  },

  assignedNurseInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  assignedNurseLabel: {
    position: "absolute",
    left: "20%",
    top: "42%",
    marginLeft: 3,
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.text,
  },

  routeLine: {
    position: "absolute",
    width: 180,
    height: 3,
    left: "29%",
    top: "48%",
    backgroundColor: COLORS.primary,
    transform: [{ rotate: "23deg" }],
    borderRadius: 3,
  },

  routeLabel: {
    position: "absolute",
    left: "43%",
    top: "51%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },

  routeLabelText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  /* ------------------------------------------------------------------------
     ASSIGNED NURSE CARD
  ------------------------------------------------------------------------ */

  assignedCard: {
    marginTop: 16,
    padding: 17,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  assignedTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  nurseAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryTint,
  },

  assignedInfo: {
    flex: 1,
    marginLeft: 12,
  },

  assignedLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: COLORS.primary,
  },

  assignedName: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },

  assignedProfession: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.secondary,
  },

  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: COLORS.warningLight,
  },

  ratingText: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  assignedDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  arrivalRow: {
    flexDirection: "row",
  },

  arrivalItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  arrivalLabel: {
    marginLeft: 7,
    fontSize: 10,
    color: COLORS.secondary,
  },

  arrivalValue: {
    marginLeft: 7,
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  /* ------------------------------------------------------------------------
     ON THE WAY
  ------------------------------------------------------------------------ */

  onTheWayCard: {
    marginTop: 13,
    flexDirection: "row",
    padding: 14,
    borderRadius: 15,
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  onTheWayIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  onTheWayContent: {
    flex: 1,
    marginLeft: 10,
  },

  onTheWayTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  onTheWayText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     TRACKING FOOTER
  ------------------------------------------------------------------------ */

  trackingFooterCard: {
    marginTop: 14,
    flexDirection: "row",
    padding: 14,
    borderRadius: 15,
    backgroundColor: COLORS.lightTeal,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },

  trackingFooterIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  trackingFooterContent: {
    flex: 1,
    marginLeft: 10,
  },

  trackingFooterTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  trackingFooterText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     OPTIONS
  ------------------------------------------------------------------------ */

  preferenceSection: {
    marginTop: 25,
  },

  optionCard: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  optionCardSelected: {
    borderColor: "#8ED9D0",
    backgroundColor: COLORS.lightTeal,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },

  radioOuterSelected: {
    borderColor: COLORS.primary,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  optionContent: {
    flex: 1,
  },

  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  optionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  recommendedBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: COLORS.successLight,
  },

  recommendedText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: COLORS.success,
  },

  optionDescription: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.secondary,
  },

  optionBottomRow: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  optionMeta: {
    flexDirection: "row",
    alignItems: "center",
  },

  optionMetaText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
  },

  priceText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  distanceOptions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },

  distanceChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  distanceChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },

  distanceChipValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  distanceChipValueSelected: {
    color: COLORS.white,
  },

  distanceChipCount: {
    marginTop: 3,
    fontSize: 9,
    color: COLORS.secondary,
  },

  distanceChipCountSelected: {
    color: "#D1FAE5",
  },

  /* ------------------------------------------------------------------------
     PRICE / NOTES
  ------------------------------------------------------------------------ */

  priceInfoCard: {
    marginTop: 16,
    flexDirection: "row",
    padding: 14,
    borderRadius: 15,
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },

  priceInfoContent: {
    flex: 1,
    marginLeft: 10,
  },

  priceInfoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  priceInfoText: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.muted,
  },

  assignmentNote: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 3,
  },

  assignmentNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.secondary,
  },

  /* ------------------------------------------------------------------------
     BUTTON
  ------------------------------------------------------------------------ */

  homeButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  homeButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },

  homeButtonHint: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 11,
    color: COLORS.secondary,
  },

  primaryButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryButtonDisabled: {
    opacity: 0.55,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },

  bottomHint: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 11,
    color: COLORS.secondary,
  },
});
