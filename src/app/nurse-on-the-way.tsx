import MapTilerLiveMap from "@/components/MapTilerLiveMap";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getPatientRequest,
  type NurseServiceRequestStatus,
  type PatientServiceRequest,
} from "@/api/patientRequests";

import {
  getAssignedNursePictureSource,
  getPatientNurseLiveLocation,
  type PatientNurseLiveLocation,
} from "@/api/nurseTracking";

/* =========================================================
 * SAFE TYPES
 * ========================================================= */

type AnyRecord = Record<string, unknown>;

type SafeCoordinates = {
  latitude: number;
  longitude: number;
};

/* =========================================================
 * SAFE HELPERS
 * ========================================================= */

const asRecord = (value: unknown): AnyRecord => {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord;
  }

  return {};
};

const firstValue = <T,>(...values: Array<T | null | undefined>): T | null => {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
};

const safeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const safeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
};

const normalizeStatus = (value: unknown): NurseServiceRequestStatus => {
  const status = safeString(value, "ACCEPTED").toUpperCase();

  switch (status) {
    case "SEARCHING":
    case "OFFERED":
    case "ACCEPTED":
    case "EN_ROUTE":
    case "ARRIVED":
    case "IN_SERVICE":
    case "COMPLETED":
    case "CANCELLED":
    case "REJECTED":
      return status as NurseServiceRequestStatus;

    default:
      return "ACCEPTED";
  }
};

const isTrackingStatus = (status: NurseServiceRequestStatus) => {
  return (
    status === "ACCEPTED" ||
    status === "EN_ROUTE" ||
    status === "ARRIVED" ||
    status === "IN_SERVICE"
  );
};

const isValidLatitude = (value: number | null) => {
  return value !== null && value >= -90 && value <= 90;
};

const isValidLongitude = (value: number | null) => {
  return value !== null && value >= -180 && value <= 180;
};

const buildCoordinates = (
  latitude: unknown,
  longitude: unknown,
): SafeCoordinates | null => {
  const lat = safeNumber(latitude);
  const lng = safeNumber(longitude);

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return null;
  }

  return {
    latitude: lat!,
    longitude: lng!,
  };
};

/* =========================================================
 * SAFE REQUEST FIELD ACCESS
 *
 * We intentionally keep fallback field names here.
 * This means the UI can tolerate backend naming differences
 * without spreading `as any` everywhere.
 * ========================================================= */

const getRequestRecord = (request: PatientServiceRequest | null) =>
  asRecord(request);

const getRequestId = (
  request: PatientServiceRequest | null,
  fallbackId: string,
) => {
  const data = getRequestRecord(request);

  return safeString(
    firstValue(data.requestId, data.id, data.requestID),
    fallbackId,
  );
};

const getRequestStatus = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  return normalizeStatus(
    firstValue(data.status, data.requestStatus, data.serviceStatus),
  );
};

const getPatientCoordinates = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  return buildCoordinates(
    firstValue(
      data.latitude,
      data.patientLatitude,
      data.patientLat,
      asRecord(data.patientLocation).latitude,
      asRecord(data.patientLocation).lat,
    ),
    firstValue(
      data.longitude,
      data.patientLongitude,
      data.patientLng,
      data.patientLong,
      asRecord(data.patientLocation).longitude,
      asRecord(data.patientLocation).lng,
    ),
  );
};

const getNurseName = (
  request: PatientServiceRequest | null,
  liveLocation: PatientNurseLiveLocation | null,
) => {
  const requestData = getRequestRecord(request);

  const liveData = asRecord(liveLocation);

  const nestedNurse = asRecord(
    firstValue(
      requestData.nurse,
      requestData.professional,
      requestData.assignedNurse,
    ),
  );

  return safeString(
    firstValue(
      liveData.professionalName,
      liveData.nurseName,
      liveData.name,

      requestData.professionalName,
      requestData.nurseName,
      requestData.assignedNurseName,

      nestedNurse.name,
      nestedNurse.fullName,
      nestedNurse.professionalName,
    ),
    "Your nurse",
  );
};

const getNurseId = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  const nestedNurse = asRecord(
    firstValue(data.nurse, data.professional, data.assignedNurse),
  );

  return safeString(
    firstValue(
      data.professionalId,
      data.nurseId,
      data.assignedNurseId,
      nestedNurse.id,
      nestedNurse.nurseId,
      nestedNurse.professionalId,
    ),
    "",
  );
};

const getServiceType = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  return safeString(
    firstValue(data.serviceType, data.serviceName, data.service, data.category),
    "Nursing Care",
  );
};

const getAddress = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  const location = asRecord(
    firstValue(
      data.location,
      data.serviceLocation,
      data.patientLocation,
      data.address,
    ),
  );

  return safeString(
    firstValue(
      data.locationAddress,
      data.address,
      data.serviceAddress,
      data.patientAddress,

      location.address,
      location.fullAddress,
      location.formattedAddress,
    ),
    "Your saved service location",
  );
};

const getCompletionPasscode = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  return safeString(
    firstValue(
      data.completionPasscode,
      data.serviceCompletionCode,
      data.completionCode,
      data.otp,
      data.serviceCode,
    ),
    "",
  );
};

const getOfferedPrice = (request: PatientServiceRequest | null) => {
  const data = getRequestRecord(request);

  return safeString(
    firstValue(data.offeredPrice, data.amount, data.price, data.totalAmount),
    "",
  );
};

/* =========================================================
 * LIVE LOCATION HELPERS
 * ========================================================= */

const getLiveCoordinates = (liveLocation: PatientNurseLiveLocation | null) => {
  const data = asRecord(liveLocation);

  const nestedLocation = asRecord(
    firstValue(data.location, data.coordinates, data.nurseLocation),
  );

  return buildCoordinates(
    firstValue(
      data.latitude,
      data.nurseLatitude,
      data.lat,
      nestedLocation.latitude,
      nestedLocation.lat,
    ),
    firstValue(
      data.longitude,
      data.nurseLongitude,
      data.lng,
      data.long,
      nestedLocation.longitude,
      nestedLocation.lng,
    ),
  );
};

/* =========================================================
 * STATUS UI
 * ========================================================= */

const getStatusTitle = (status: NurseServiceRequestStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "Your nurse is getting ready";

    case "EN_ROUTE":
      return "Your nurse is on the way";

    case "ARRIVED":
      return "Your nurse has arrived";

    case "IN_SERVICE":
      return "Your care is in progress";

    case "COMPLETED":
      return "Service completed";

    case "CANCELLED":
      return "Service cancelled";

    default:
      return "Your nurse is assigned";
  }
};

const getStatusSubtitle = (status: NurseServiceRequestStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "Your nurse has accepted the request.";

    case "EN_ROUTE":
      return "We're tracking their journey to you.";

    case "ARRIVED":
      return "Your nurse has reached the service location.";

    case "IN_SERVICE":
      return "Your healthcare service is currently in progress.";

    case "COMPLETED":
      return "Your healthcare service has been completed.";

    case "CANCELLED":
      return "This service request is no longer active.";

    default:
      return "We're keeping you updated.";
  }
};

const getStatusText = (status: NurseServiceRequestStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "Getting ready";

    case "EN_ROUTE":
      return "On the way";

    case "ARRIVED":
      return "Arrived";

    case "IN_SERVICE":
      return "Service in progress";

    case "COMPLETED":
      return "Service completed";

    case "CANCELLED":
      return "Cancelled";

    default:
      return "Nurse assigned";
  }
};

const getStatusIcon = (status: NurseServiceRequestStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "checkmark-circle-outline";

    case "EN_ROUTE":
      return "navigate-outline";

    case "ARRIVED":
      return "location-outline";

    case "IN_SERVICE":
      return "medkit-outline";

    case "COMPLETED":
      return "checkmark-done-circle-outline";

    case "CANCELLED":
      return "close-circle-outline";

    default:
      return "person-outline";
  }
};

/* =========================================================
 * SCREEN
 * ========================================================= */

export default function NurseOnTheWayScreen() {
  const params = useLocalSearchParams<{
    requestId?: string | string[];
  }>();

  /*
   * Expo Router can theoretically give a string[].
   * Always normalize it.
   */
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;

  const normalizedRequestId = safeString(requestId, "");

  const mapRef = useRef<MapView | null>(null);

  const [request, setRequest] = useState<PatientServiceRequest | null>(null);

  const [liveLocation, setLiveLocation] =
    useState<PatientNurseLiveLocation | null>(null);

  const [pictureSource, setPictureSource] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [requestError, setRequestError] = useState(false);

  const [locationLoading, setLocationLoading] = useState(false);

  const [locationUnavailable, setLocationUnavailable] = useState(false);

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [sheetExpanded, setSheetExpanded] = useState(false);

  /*
   * Dynamic sheet:
   *
   * collapsed = 285
   * expanded  = 530
   */
  const sheetHeight = useRef(new Animated.Value(285)).current;

  const sheetStartHeight = useRef(285);

  /* =======================================================
   * LOAD REQUEST
   * ======================================================= */

  const load = useCallback(async () => {
    if (!normalizedRequestId) {
      setLoading(false);
      setRequestError(true);
      return;
    }

    try {
      const currentRequest = await getPatientRequest(normalizedRequestId);

      /*
       * Defensive guard.
       */
      if (!currentRequest || typeof currentRequest !== "object") {
        setRequestError(true);
        return;
      }

      setRequest(currentRequest);
      setRequestError(false);

      const status = getRequestStatus(currentRequest);

      /*
       * COMPLETED is authoritative.
       */
      if (status === "COMPLETED") {
        const finalRequestId = getRequestId(
          currentRequest,
          normalizedRequestId,
        );

        const nurseName = getNurseName(currentRequest, null);

        const serviceType = getServiceType(currentRequest);

        const amount = getOfferedPrice(currentRequest);

        router.replace({
          pathname: "/rate-service",
          params: {
            requestId: finalRequestId,
            nurseName,
            serviceType,
            amount,
          },
        });

        return;
      }

      /*
       * Only request live location for active
       * tracking states.
       */
      if (isTrackingStatus(status)) {
        setLocationLoading(true);

        try {
          const location =
            await getPatientNurseLiveLocation(normalizedRequestId);

          /*
           * A backend may return null/empty while
           * the nurse has not started sharing GPS.
           */
          if (location && typeof location === "object") {
            setLiveLocation(location);

            const coordinates = getLiveCoordinates(location);

            setLocationUnavailable(coordinates === null);

            setLastRefresh(new Date());
          } else {
            setLiveLocation(null);
            setLocationUnavailable(true);
          }
        } catch (error) {
          /*
           * Location failure should NEVER kill
           * the request screen.
           */
          console.warn("[Nurse Tracking] Live location unavailable:", error);

          setLocationUnavailable(true);
        } finally {
          setLocationLoading(false);
        }
      } else {
        /*
         * No tracking needed.
         */
        setLocationLoading(false);
      }
    } catch (error) {
      /*
       * Preserve whatever data we already have.
       * Polling can recover automatically.
       */
      console.warn("[Nurse Tracking] Request refresh failed:", error);

      setRequestError(true);
    } finally {
      setLoading(false);
    }
  }, [normalizedRequestId]);

  /* =======================================================
   * LOAD ON FOCUS
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /* =======================================================
   * 5 SECOND POLLING
   * ======================================================= */

  useEffect(() => {
    if (!normalizedRequestId) {
      return;
    }

    const interval = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [normalizedRequestId, load]);

  /* =======================================================
   * NURSE PHOTO
   *
   * Photo is optional.
   * Never block the screen because it fails.
   * ======================================================= */

  useEffect(() => {
    if (!normalizedRequestId) {
      return;
    }

    const status = getRequestStatus(request);

    const nurseId = getNurseId(request);

    if (!nurseId || !isTrackingStatus(status)) {
      setPictureSource(null);
      return;
    }

    let cancelled = false;

    const loadPicture = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const source = await getAssignedNursePictureSource(
            normalizedRequestId,
            Date.now(),
          );

          if (source && !cancelled) {
            setPictureSource(source);

            return;
          }
        } catch (error) {
          console.warn("[Nurse Tracking] Nurse photo unavailable:", error);
        }

        if (attempt < 2 && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }

      /*
       * No image is completely okay.
       * The UI will show the person icon.
       */
    };

    setPictureSource(null);

    void loadPicture();

    return () => {
      cancelled = true;
    };
  }, [normalizedRequestId, request]);

  /* =======================================================
   * SAFE DERIVED DATA
   * ======================================================= */

  const patientCoordinates = useMemo(
    () => getPatientCoordinates(request),
    [request],
  );

  const nurseCoordinates = useMemo(
    () => getLiveCoordinates(liveLocation),
    [liveLocation],
  );

  const status = getRequestStatus(request);

  const displayName = getNurseName(request, liveLocation);

  const serviceType = getServiceType(request);

  const serviceAddress = getAddress(request);

  const completionPasscode = getCompletionPasscode(request);

  const hasPatientLocation = patientCoordinates !== null;

  const hasNurseLocation = nurseCoordinates !== null;

  /* =======================================================
   * MAP REGION
   *
   * IMPORTANT:
   * We use a valid fallback only for INITIAL MAP
   * rendering. We do NOT claim it is the patient's
   * actual location.
   *
   * The fallback is Hyderabad only as a visual
   * neutral map center when no coordinates exist.
   * ======================================================= */

  const initialRegion = useMemo<Region>(() => {
    if (patientCoordinates) {
      return {
        latitude: patientCoordinates.latitude,
        longitude: patientCoordinates.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      };
    }

    return {
      latitude: 17.385,
      longitude: 78.4867,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [patientCoordinates]);

  /* =======================================================
   * FIT MAP
   * ======================================================= */

  useEffect(() => {
    if (!mapRef.current || !patientCoordinates) {
      return;
    }

    const coordinates: SafeCoordinates[] = [patientCoordinates];

    if (nurseCoordinates) {
      coordinates.push(nurseCoordinates);
    }

    try {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: {
          top: 75,
          right: 40,
          bottom: sheetExpanded ? 70 : 45,
          left: 40,
        },
        animated: true,
      });
    } catch (error) {
      console.warn("[Nurse Tracking] Unable to fit map:", error);
    }
  }, [patientCoordinates, nurseCoordinates, sheetExpanded]);

  /* =======================================================
   * SHEET ANIMATION
   * ======================================================= */

  const animateSheet = useCallback(
    (expanded: boolean) => {
      setSheetExpanded(expanded);

      Animated.spring(sheetHeight, {
        toValue: expanded ? 530 : 285,
        useNativeDriver: false,
        tension: 55,
        friction: 9,
      }).start();
    },
    [sheetHeight],
  );

  /* =======================================================
   * SWIPE
   * ======================================================= */

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 4 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),

        onPanResponderTerminationRequest: () => false,

        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: () => {
          sheetStartHeight.current = sheetExpanded ? 530 : 285;
        },

        onPanResponderMove: (_, gestureState) => {
          const nextHeight = Math.max(
            270,
            Math.min(600, sheetStartHeight.current - gestureState.dy),
          );

          sheetHeight.setValue(nextHeight);
        },

        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dy) < 18) {
            animateSheet(!sheetExpanded);

            return;
          }

          if (gestureState.dy < -45) {
            animateSheet(true);

            return;
          }

          if (gestureState.dy > 45) {
            animateSheet(false);

            return;
          }

          animateSheet(sheetStartHeight.current > 400);
        },

        onPanResponderTerminate: () => {
          animateSheet(sheetStartHeight.current > 400);
        },
      }),
    [animateSheet, sheetExpanded, sheetHeight],
  );

  /* =======================================================
   * MISSING REQUEST ID
   * ======================================================= */

  if (!normalizedRequestId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
          </View>

          <Text style={styles.errorTitle}>Request unavailable</Text>

          <Text style={styles.errorText}>
            We couldn't identify this service request.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.primaryButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * INITIAL LOADING
   * ======================================================= */

  if (loading && !request) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="navigate-outline" size={28} color="#0EA5B7" />
          </View>

          <ActivityIndicator size="small" color="#0EA5B7" />

          <Text style={styles.loadingText}>Connecting to your nurse...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * SCREEN
   * ======================================================= */

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* =================================================
            HEADER
        ================================================= */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {getStatusTitle(status)}
            </Text>

            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {getStatusSubtitle(status)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.85}
            onPress={() => router.replace("/(tabs)")}
          >
            <Ionicons name="home-outline" size={21} color="#0EA5B7" />
          </TouchableOpacity>
        </View>

        {/* =================================================
            BODY
        ================================================= */}

        <View style={styles.content}>
          {/* ===============================================
              MAP
          =============================================== */}

          <View style={styles.mapArea}>
            <View style={styles.mapCard}>
              {hasPatientLocation ? (
                Platform.OS === "android" ? (
                  <View style={styles.mapContainer}>
                    <MapTilerLiveMap
                      patient={{
                        latitude: patientCoordinates!.latitude,
                        longitude: patientCoordinates!.longitude,
                      }}
                      nurse={
                        hasNurseLocation
                          ? {
                              latitude: nurseCoordinates!.latitude,
                              longitude: nurseCoordinates!.longitude,
                            }
                          : null
                      }
                    />
                  </View>
                ) : (
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={initialRegion}
                    showsCompass
                    showsScale
                    showsBuildings
                    showsPointsOfInterest
                  >
                    {/* PATIENT */}

                    <Marker
                      coordinate={patientCoordinates!}
                      title="Your location"
                    >
                      <View style={styles.destinationMarker}>
                        <Ionicons name="home" size={18} color="#FFFFFF" />
                      </View>
                    </Marker>

                    {/* NURSE */}

                    {hasNurseLocation && (
                      <Marker
                        coordinate={nurseCoordinates!}
                        title={displayName}
                        anchor={{
                          x: 0.5,
                          y: 0.5,
                        }}
                      >
                        <View style={styles.nurseMarkerOuter}>
                          {pictureSource ? (
                            <Image
                              source={pictureSource}
                              style={styles.nurseMarkerImage}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.nurseMarkerFallback}>
                              <Ionicons
                                name="person"
                                size={23}
                                color="#0EA5B7"
                              />
                            </View>
                          )}

                          <View style={styles.liveDot} />
                        </View>
                      </Marker>
                    )}

                    {/* ROUTE */}

                    {hasNurseLocation && (
                      <Polyline
                        coordinates={[nurseCoordinates!, patientCoordinates!]}
                        strokeColor="#0EA5B7"
                        strokeWidth={3}
                        lineDashPattern={[8, 6]}
                      />
                    )}
                  </MapView>
                )
              ) : (
                <View style={styles.mapFallback}>
                  <View style={styles.mapFallbackIcon}>
                    <Ionicons name="map-outline" size={32} color="#94A3B8" />
                  </View>

                  <Text style={styles.mapFallbackTitle}>
                    Location unavailable
                  </Text>

                  <Text style={styles.mapFallbackText}>
                    We're waiting for the service location from the request.
                  </Text>

                  {serviceAddress &&
                    serviceAddress !== "Your saved service location" && (
                      <Text style={styles.fallbackAddress} numberOfLines={2}>
                        {serviceAddress}
                      </Text>
                    )}
                </View>
              )}

              {/* LIVE CHIP */}

              <View style={styles.mapLiveChip}>
                <View
                  style={
                    hasNurseLocation ? styles.mapLiveDot : styles.mapWaitingDot
                  }
                />

                <Text
                  style={
                    hasNurseLocation
                      ? styles.mapLiveText
                      : styles.mapWaitingText
                  }
                >
                  {hasNurseLocation
                    ? "LIVE LOCATION"
                    : locationLoading
                      ? "UPDATING LOCATION"
                      : "WAITING FOR LOCATION"}
                </Text>
              </View>

              {/* LEGEND */}

              {hasPatientLocation && hasNurseLocation && (
                <View style={styles.mapLegend}>
                  <View style={styles.legendRow}>
                    <View style={styles.legendNurse} />

                    <Text style={styles.legendText} numberOfLines={1}>
                      {displayName}
                    </Text>
                  </View>

                  <View style={styles.legendDivider} />

                  <View style={styles.legendRow}>
                    <View style={styles.legendHome}>
                      <Ionicons name="home" size={9} color="#FFFFFF" />
                    </View>

                    <Text style={styles.legendText}>Your location</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* ===============================================
              DETAILS SHEET
          =============================================== */}

          <Animated.View
            style={[
              styles.bottomSheet,
              {
                height: sheetHeight,
              },
            ]}
          >
            {/* HANDLE */}

            <View
              style={styles.handleHitArea}
              {...sheetPanResponder.panHandlers}
            >
              <View style={styles.handle} />
            </View>

            {/* STATUS */}

            <View style={styles.statusHero}>
              <View style={styles.statusIconContainer}>
                <Ionicons
                  name={getStatusIcon(status) as any}
                  size={21}
                  color="#0EA5B7"
                />
              </View>

              <View style={styles.statusHeroText}>
                <Text style={styles.statusHeroTitle} numberOfLines={1}>
                  {getStatusTitle(status)}
                </Text>

                <Text style={styles.statusHeroSubtitle} numberOfLines={1}>
                  {hasNurseLocation
                    ? "Location is updating automatically"
                    : "Waiting for the latest location"}
                </Text>
              </View>

              <View style={styles.liveBadge}>
                <View style={styles.liveBadgeDot} />

                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            {/* NURSE */}

            <View style={styles.nurseCard}>
              <View style={styles.avatarWrap}>
                {pictureSource ? (
                  <Image
                    source={pictureSource}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={27} color="#0EA5B7" />
                  </View>
                )}

                {hasNurseLocation && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.nurseInfo}>
                <Text style={styles.nurseName} numberOfLines={1}>
                  {displayName}
                </Text>

                <View style={styles.roleRow}>
                  <Ionicons name="medical-outline" size={14} color="#64748B" />

                  <Text style={styles.nurseRole}>Nursing professional</Text>
                </View>

                <View style={styles.statusRow}>
                  <View
                    style={
                      hasNurseLocation
                        ? styles.statusDot
                        : styles.statusDotWaiting
                    }
                  />

                  <Text
                    style={
                      hasNurseLocation
                        ? styles.statusLabel
                        : styles.statusLabelWaiting
                    }
                  >
                    {getStatusText(status)}
                  </Text>
                </View>
              </View>
            </View>

            {/* QUICK DETAILS */}

            <View style={styles.quickDetails}>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Ionicons name="medkit-outline" size={17} color="#0EA5B7" />
                </View>

                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>SERVICE</Text>

                  <Text style={styles.detailValue} numberOfLines={1}>
                    {serviceType}
                  </Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location-outline" size={17} color="#0EA5B7" />
                </View>

                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>TRACKING</Text>

                  <Text style={styles.detailValue} numberOfLines={1}>
                    {hasNurseLocation ? "Live" : "Waiting"}
                  </Text>
                </View>
              </View>
            </View>

            {/* REQUEST ERROR BANNER */}

            {requestError && (
              <View style={styles.refreshBanner}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={15}
                  color="#B45309"
                />

                <Text style={styles.refreshBannerText}>
                  Temporary connection issue. We'll keep trying automatically.
                </Text>
              </View>
            )}

            {/* SWIPE HINT */}

            {!sheetExpanded && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.swipeHint}
                onPress={() => animateSheet(true)}
              >
                <Text style={styles.swipeHintText}>
                  Swipe up for more details
                </Text>

                <Ionicons name="chevron-up" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {/* ============================================
                EXPANDED DETAILS
            ============================================ */}

            {sheetExpanded && (
              <View style={styles.expandedInfo}>
                {/* LOCATION */}

                <View style={styles.expandedRow}>
                  <View style={styles.expandedIcon}>
                    <Ionicons
                      name="navigate-outline"
                      size={18}
                      color="#0EA5B7"
                    />
                  </View>

                  <View style={styles.expandedTextWrap}>
                    <Text style={styles.expandedLabel}>SERVICE LOCATION</Text>

                    <Text style={styles.expandedValue} numberOfLines={2}>
                      {serviceAddress}
                    </Text>
                  </View>
                </View>

                {/* CURRENT STATUS */}

                <View style={styles.expandedRow}>
                  <View style={styles.expandedIcon}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#0EA5B7"
                    />
                  </View>

                  <View style={styles.expandedTextWrap}>
                    <Text style={styles.expandedLabel}>CURRENT STATUS</Text>

                    <Text style={styles.expandedValue}>
                      {getStatusText(status)}
                    </Text>
                  </View>
                </View>

                {/* LOCATION */}

                <View style={styles.expandedRow}>
                  <View style={styles.expandedIcon}>
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color="#0EA5B7"
                    />
                  </View>

                  <View style={styles.expandedTextWrap}>
                    <Text style={styles.expandedLabel}>LOCATION UPDATES</Text>

                    <Text style={styles.expandedValue}>
                      {hasNurseLocation
                        ? "Live location is updating automatically."
                        : "Nurse location will appear when GPS data becomes available."}
                    </Text>
                  </View>
                </View>

                {/* COMPLETION CODE */}

                {status === "IN_SERVICE" && completionPasscode ? (
                  <View style={styles.passcodeCard}>
                    <View style={styles.passcodeIcon}>
                      <Ionicons
                        name="keypad-outline"
                        size={21}
                        color="#2563EB"
                      />
                    </View>

                    <View style={styles.passcodeContent}>
                      <Text style={styles.passcodeLabel}>
                        SERVICE COMPLETION CODE
                      </Text>

                      <Text style={styles.passcodeValue}>
                        {completionPasscode}
                      </Text>

                      <Text style={styles.passcodeHint}>
                        Share this code with the professional when the service
                        is complete.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* NO COMPLETION CODE */}

                {status === "IN_SERVICE" && !completionPasscode && (
                  <View style={styles.infoMessage}>
                    <Ionicons
                      name="information-circle-outline"
                      size={17}
                      color="#2563EB"
                    />

                    <Text style={styles.infoMessageText}>
                      The service completion code will appear here when it is
                      available.
                    </Text>
                  </View>
                )}

                {/* TRACKING MESSAGE */}

                <View style={styles.infoMessage}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color="#15803D"
                  />

                  <Text style={styles.infoMessageText}>
                    Your service tracking stays active while your request is in
                    progress.
                  </Text>
                </View>

                {/* COLLAPSE */}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.collapseButton}
                  onPress={() => animateSheet(false)}
                >
                  <Text style={styles.collapseText}>Show less</Text>

                  <Ionicons name="chevron-down" size={15} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  container: {
    flex: 1,
  },

  /* =======================================================
   * HEADER
   * ======================================================= */

  header: {
    height: 64,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102A43",
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
  },

  /* =======================================================
   * CONTENT
   * ======================================================= */

  content: {
    flex: 1,
    minHeight: 0,
  },

  /* =======================================================
   * MAP
   * ======================================================= */

  mapArea: {
    flex: 1,
    minHeight: 190,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },

  mapCard: {
    flex: 1,
    minHeight: 180,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  mapContainer: {
    flex: 1,
    width: "100%",
  },

  map: {
    flex: 1,
    width: "100%",
  },

  /* =======================================================
   * MAP CHIP
   * ======================================================= */

  mapLiveChip: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  mapLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 6,
  },

  mapWaitingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginRight: 6,
  },

  mapLiveText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#166534",
    letterSpacing: 0.3,
  },

  mapWaitingText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#92400E",
    letterSpacing: 0.3,
  },

  /* =======================================================
   * LEGEND
   * ======================================================= */

  mapLegend: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendNurse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#0EA5B7",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  legendHome: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0EA5B7",
    alignItems: "center",
    justifyContent: "center",
  },

  legendText: {
    marginLeft: 6,
    fontSize: 9,
    fontWeight: "700",
    color: "#334155",
    maxWidth: 110,
  },

  legendDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 7,
  },

  /* =======================================================
   * MAP MARKERS
   * ======================================================= */

  destinationMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0EA5B7",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  nurseMarkerOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#0EA5B7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 5,
  },

  nurseMarkerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  nurseMarkerFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  liveDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#16A34A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  /* =======================================================
   * MAP FALLBACK
   * ======================================================= */

  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 35,
  },

  mapFallbackIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  mapFallbackTitle: {
    marginTop: 13,
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
  },

  mapFallbackText: {
    marginTop: 5,
    color: "#64748B",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
  },

  fallbackAddress: {
    marginTop: 8,
    color: "#475569",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
  },

  /* =======================================================
   * BOTTOM SHEET
   * ======================================================= */

  bottomSheet: {
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: -5,
    },
    elevation: 16,
    zIndex: 20,
  },

  /* =======================================================
   * HANDLE
   * ======================================================= */

  handleHitArea: {
    alignSelf: "stretch",
    alignItems: "center",
    height: 28,
    justifyContent: "flex-start",
  },

  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginTop: 2,
  },

  /* =======================================================
   * STATUS
   * ======================================================= */

  statusHero: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  statusIconContainer: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  statusHeroText: {
    flex: 1,
    marginLeft: 10,
  },

  statusHeroTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#102A43",
  },

  statusHeroSubtitle: {
    marginTop: 3,
    fontSize: 9,
    color: "#64748B",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 15,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 5,
  },

  liveBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#15803D",
  },

  /* =======================================================
   * NURSE CARD
   * ======================================================= */

  nurseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 17,
    padding: 10,
  },

  avatarWrap: {
    position: "relative",
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C9EEF2",
  },

  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#16A34A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  nurseInfo: {
    flex: 1,
    marginLeft: 12,
  },

  nurseName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102A43",
  },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  nurseRole: {
    marginLeft: 5,
    fontSize: 11,
    color: "#64748B",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 6,
  },

  statusDotWaiting: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginRight: 6,
  },

  statusLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },

  statusLabelWaiting: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },

  /* =======================================================
   * QUICK DETAILS
   * ======================================================= */

  quickDetails: {
    flexDirection: "row",
    marginTop: 11,
    gap: 10,
  },

  detailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 13,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  detailIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  detailTextWrap: {
    flex: 1,
    marginLeft: 7,
  },

  detailLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.4,
  },

  detailValue: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
  },

  /* =======================================================
   * CONNECTION BANNER
   * ======================================================= */

  refreshBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    backgroundColor: "#FFFBEB",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  refreshBannerText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 9,
    lineHeight: 13,
    color: "#92400E",
    fontWeight: "600",
  },

  /* =======================================================
   * SWIPE HINT
   * ======================================================= */

  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    paddingVertical: 3,
  },

  swipeHintText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    marginRight: 3,
  },

  /* =======================================================
   * EXPANDED
   * ======================================================= */

  expandedInfo: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },

  expandedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  expandedIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  expandedTextWrap: {
    flex: 1,
    marginLeft: 10,
  },

  expandedLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  expandedValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    lineHeight: 17,
  },

  /* =======================================================
   * PASSCODE
   * ======================================================= */

  passcodeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 15,
    padding: 12,
  },

  passcodeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  passcodeContent: {
    flex: 1,
    marginLeft: 10,
  },

  passcodeLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
  },

  passcodeValue: {
    marginTop: 3,
    fontSize: 25,
    letterSpacing: 5,
    fontWeight: "900",
    color: "#1D4ED8",
  },

  passcodeHint: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 14,
    color: "#475569",
  },

  /* =======================================================
   * INFO
   * ======================================================= */

  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  infoMessageText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 9,
    lineHeight: 14,
    color: "#166534",
    fontWeight: "600",
  },

  /* =======================================================
   * COLLAPSE
   * ======================================================= */

  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 1,
  },

  collapseText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 3,
  },

  /* =======================================================
   * LOADING
   * ======================================================= */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  loadingText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  /* =======================================================
   * ERROR
   * ======================================================= */

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#102A43",
  },

  errorText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: "#64748B",
  },

  primaryButton: {
    marginTop: 22,
    backgroundColor: "#0EA5B7",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
