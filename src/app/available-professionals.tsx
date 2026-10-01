import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  type AvailableProfessional,
} from "@/api/patientRequests";

/* ==========================================================================
   HARD CODED DEMO DATA
========================================================================== */

const HARDCODED_PROFESSIONALS: AvailableProfessional[] = [
  {
    professionalId: "demo-professional-001",
    name: "Anita Sharma",
    profession: "REGISTERED_NURSE",
    age: 32,
    experienceYears: 8,
    rating: 4.9,
    ratingCount: 128,
    distanceKm: 2.4,
    price: 199,
  },
  {
    professionalId: "demo-professional-002",
    name: "Priya Reddy",
    profession: "STAFF_NURSE",
    age: 29,
    experienceYears: 6,
    rating: 4.8,
    ratingCount: 96,
    distanceKm: 4.1,
    price: 199,
  },
  {
    professionalId: "demo-professional-003",
    name: "Neha Kumari",
    profession: "REGISTERED_NURSE",
    age: 35,
    experienceYears: 10,
    rating: 4.9,
    ratingCount: 174,
    distanceKm: 5.8,
    price: 199,
  },
  {
    professionalId: "demo-professional-004",
    name: "Sowmya Rao",
    profession: "STAFF_NURSE",
    age: 31,
    experienceYears: 7,
    rating: 4.7,
    ratingCount: 83,
    distanceKm: 7.6,
    price: 249,
  },
  {
    professionalId: "demo-professional-005",
    name: "Kavitha Devi",
    profession: "REGISTERED_NURSE",
    age: 38,
    experienceYears: 12,
    rating: 4.8,
    ratingCount: 211,
    distanceKm: 11.4,
    price: 299,
  },
];

type MatchMode = "any" | "distance";

type DistanceOption = 5 | 10 | 15;

type ScreenMode = "availability" | "matching" | "accepted";

/* ==========================================================================
   DEMO ASSIGNED NURSE
========================================================================== */

const DEMO_ASSIGNED_NURSE = HARDCODED_PROFESSIONALS[0];

/* ==========================================================================
   MAIN SCREEN
========================================================================== */

export default function AvailableProfessionalsScreen() {
  const { requestId } = useLocalSearchParams<{
    requestId?: string;
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

  /*
   * ------------------------------------------------------------------------
   * ANIMATION VALUES
   * ------------------------------------------------------------------------
   */

  const pinAnimations = useRef(
    HARDCODED_PROFESSIONALS.map(() => new Animated.Value(0)),
  ).current;

  const mapFocusAnimation = useRef(new Animated.Value(0)).current;

  const successScale = useRef(new Animated.Value(0.7)).current;

  const successOpacity = useRef(new Animated.Value(0)).current;

  /*
   * ------------------------------------------------------------------------
   * ORIGINAL API IMPLEMENTATION
   * ------------------------------------------------------------------------
   *
   * Keep this commented while using hardcoded data.
   *
   * Uncomment later when backend availability is ready.
   */

  /*
  const load = useCallback(async () => {
    if (!requestId) return;

    try {
      setLoading(true);

      const data = await getAvailableProfessionals(requestId);

      setProfessionals(data);
    } catch (error: any) {
      Alert.alert(
        "Unable to load availability",
        error?.message ?? "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);
  */

  /*
   * ------------------------------------------------------------------------
   * TEMPORARY HARDCODED AVAILABILITY
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    setLoading(true);

    const timer = setTimeout(() => {
      setProfessionals(HARDCODED_PROFESSIONALS);
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  /*
   * ------------------------------------------------------------------------
   * PIN ANIMATION
   * ------------------------------------------------------------------------
   *
   * Gentle jumping/pulsing movement.
   * Not too flashy because this is healthcare.
   */

  useEffect(() => {
    if (screenMode === "accepted") {
      return;
    }

    const animations = pinAnimations.map((animation, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(animation, {
            toValue: -7,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(700),
        ]),
      );
    });

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [screenMode, pinAnimations]);

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
   */

  const handleFindNurse = async () => {
    if (!requestId || continuing) return;

    try {
      setContinuing(true);

      /*
       * Keep the real backend call.
       *
       * Backend currently only needs requestId.
       */
      await continuePatientMatching(requestId);

      /*
       * For the demo we stay on this screen and simulate
       * the real matching experience.
       */

      setScreenMode("matching");
      setMatchingStep(0);

      mapFocusAnimation.setValue(0);

      /*
       * Step 1
       */
      const stepOne = setTimeout(() => {
        setMatchingStep(1);
      }, 1700);

      /*
       * Step 2
       */
      const stepTwo = setTimeout(() => {
        setMatchingStep(2);
      }, 3400);

      /*
       * Nurse accepts
       */
      const accepted = setTimeout(() => {
        setScreenMode("accepted");

        successScale.setValue(0.7);
        successOpacity.setValue(0);

        Animated.parallel([
          Animated.spring(successScale, {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),

          Animated.timing(successOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),

          Animated.timing(mapFocusAnimation, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();

        setContinuing(false);
      }, 5200);

      return () => {
        clearTimeout(stepOne);
        clearTimeout(stepTwo);
        clearTimeout(accepted);
      };
    } catch (error: any) {
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
   * ACCEPTED SCREEN
   * ------------------------------------------------------------------------
   */

  if (screenMode === "accepted") {
    return (
      <AcceptedScreen
        nurse={DEMO_ASSIGNED_NURSE}
        successScale={successScale}
        successOpacity={successOpacity}
        mapFocusAnimation={mapFocusAnimation}
        onContinue={() => {
          router.replace({
            pathname: "/nurse-request-submitted",
            params: {
              requestId,
            },
          });
        }}
      />
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
                {availability.total} nurses available
              </Text>

              <Text style={styles.summaryDescription}>
                CareNow will find a suitable nurse based on your care
                requirements and distance.
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

        <AvailabilityMap pinAnimations={pinAnimations} showPatientLabel />

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
                <Text style={styles.optionTitle}>Any available nurse</Text>

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
                Only search for a nurse within your selected distance.
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
            Nurse details are shown only after a professional accepts your
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
                  : "Find a Nurse"}
              </Text>

              <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.bottomHint}>
          You can cancel your request while CareNow is finding a nurse.
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
}: {
  matchingStep: number;
  pinAnimations: Animated.Value[];
  mapFocusAnimation: Animated.Value;
}) {
  const messages = [
    {
      title: "Finding a nurse near you",
      subtitle: "We're checking available care professionals nearby.",
      icon: "search-outline" as const,
    },
    {
      title: "Connecting you with available care",
      subtitle: "We're matching your request with the right availability.",
      icon: "git-network-outline" as const,
    },
    {
      title: "Waiting for nurse confirmation",
      subtitle: "A nearby nurse is reviewing your care request.",
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

          <Text style={styles.matchingTitle}>Finding your nurse</Text>

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
              We're looking for a suitable nurse. You don't need to select a
              professional manually.
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
   ACCEPTED SCREEN
========================================================================== */

function AcceptedScreen({
  nurse,
  successScale,
  successOpacity,
  mapFocusAnimation,
  onContinue,
}: {
  nurse: AvailableProfessional;
  successScale: Animated.Value;
  successOpacity: Animated.Value;
  mapFocusAnimation: Animated.Value;
  onContinue: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.acceptedScrollContent}
      >
        {/* SUCCESS HEADER */}

        <Animated.View
          style={[
            styles.acceptedHeader,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={31} color={COLORS.white} />
          </View>

          <Text style={styles.acceptedTitle}>
            Your request has been accepted
          </Text>

          <Text style={styles.acceptedSubtitle}>
            A nurse is on the way to provide your care.
          </Text>
        </Animated.View>

        {/* MAP */}

        <Animated.View
          style={[
            styles.acceptedMapWrapper,
            {
              opacity: successOpacity,
              transform: [{ scale: mapFocusAnimation }],
            },
          ]}
        >
          <AcceptedMap />
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
              <Text style={styles.assignedLabel}>YOUR NURSE</Text>

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
            <Text style={styles.onTheWayTitle}>Your nurse is on the way</Text>

            <Text style={styles.onTheWayText}>
              You can track the nurse once they start travelling towards your
              location.
            </Text>
          </View>
        </Animated.View>

        {/* CTA */}

        <Animated.View style={{ opacity: successOpacity }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onContinue}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Continue to Request</Text>

            <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ==========================================================================
   AVAILABILITY MAP
========================================================================== */

function AvailabilityMap({
  pinAnimations,
  showPatientLabel = true,
  matching = false,
}: {
  pinAnimations: Animated.Value[];
  showPatientLabel?: boolean;
  matching?: boolean;
}) {
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

      {/* NURSE PINS */}

      {HARDCODED_PROFESSIONALS.map((professional, index) => {
        const positions = [
          styles.pinOne,
          styles.pinTwo,
          styles.pinThree,
          styles.pinFour,
          styles.pinFive,
        ];

        const far = professional.distanceKm > 6;

        return (
          <Animated.View
            key={professional.professionalId}
            style={[
              styles.animatedPin,
              positions[index],
              {
                transform: [
                  {
                    translateY: pinAnimations[index],
                  },
                ],
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
              <Ionicons name="medical-outline" size={13} color={COLORS.white} />
            </View>

            {matching && index === 0 && (
              <View style={styles.searchingLabel}>
                <Text style={styles.searchingLabelText}>Reviewing</Text>
              </View>
            )}
          </Animated.View>
        );
      })}

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
    </View>
  );
}

/* ==========================================================================
   ACCEPTED MAP
========================================================================== */

function AcceptedMap() {
  return (
    <View style={styles.acceptedMap}>
      <View style={styles.mapGridVerticalOne} />
      <View style={styles.mapGridVerticalTwo} />
      <View style={styles.mapGridHorizontalOne} />
      <View style={styles.mapGridHorizontalTwo} />

      <View style={styles.acceptedRoadOne} />
      <View style={styles.acceptedRoadTwo} />

      {/* patient */}

      <View style={styles.acceptedPatientMarker}>
        <Ionicons name="home" size={17} color={COLORS.white} />
      </View>

      <Text style={styles.acceptedPatientLabel}>You</Text>

      {/* nurse */}

      <View style={styles.assignedNurseMarker}>
        <View style={styles.assignedNurseInner}>
          <Ionicons name="medical" size={17} color={COLORS.white} />
        </View>
      </View>

      <Text style={styles.assignedNurseLabel}>Anita</Text>

      {/* route */}

      <View style={styles.routeLine} />

      <View style={styles.routeLabel}>
        <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />

        <Text style={styles.routeLabelText}>2.4 km</Text>
      </View>
    </View>
  );
}

/* ==========================================================================
   SMALL COMPONENTS
========================================================================== */

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
     MATCHING / ACCEPTED
  ------------------------------------------------------------------------ */

  acceptedScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 25,
    paddingBottom: 40,
  },

  acceptedHeader: {
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

  acceptedTitle: {
    marginTop: 15,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  acceptedSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.secondary,
    textAlign: "center",
  },

  acceptedMapWrapper: {
    marginTop: 22,
  },

  acceptedMap: {
    height: 260,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    position: "relative",
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
