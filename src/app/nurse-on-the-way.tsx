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
  getAssignedNursePictureSource,
  getPatientNurseLiveLocation,
  type PatientNurseLiveLocation,
} from "@/api/nurseTracking";
import {
  getPatientRequest,
  type NurseServiceRequestStatus,
  type PatientServiceRequest,
} from "@/api/patientRequests";

const toNumber = (value: number | string | null | undefined) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const isTrackingStatus = (status: NurseServiceRequestStatus) =>
  status === "ACCEPTED" ||
  status === "EN_ROUTE" ||
  status === "ARRIVED" ||
  status === "IN_SERVICE";

const statusText = (status: NurseServiceRequestStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "Getting ready";
    case "EN_ROUTE":
      return "Nurse is on the way";
    case "ARRIVED":
      return "Nurse has arrived";
    case "IN_SERVICE":
      return "Service in progress";
    case "COMPLETED":
      return "Service completed";
    default:
      return "Nurse assigned";
  }
};

export default function NurseOnTheWayScreen() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const mapRef = useRef<MapView | null>(null);
  const [request, setRequest] = useState<PatientServiceRequest | null>(null);
  const [liveLocation, setLiveLocation] =
    useState<PatientNurseLiveLocation | null>(null);
  const [pictureSource, setPictureSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(255)).current;
  const sheetStartHeight = useRef(255);

  const load = useCallback(async () => {
    if (!requestId) return;
    try {
      const currentRequest = await getPatientRequest(requestId);
      setRequest(currentRequest);

      if (currentRequest.status === "COMPLETED") {
        router.replace({
          pathname: "/order-details",
          params: {
            requestId: currentRequest.requestId,
            nurseName: currentRequest.professionalName || "Your nurse",
            serviceType: currentRequest.serviceType,
            amount: String(currentRequest.offeredPrice ?? ""),
          },
        });
        return;
      }

      if (isTrackingStatus(currentRequest.status)) {
        try {
          const location = await getPatientNurseLiveLocation(requestId);
          setLiveLocation(location);
          setLocationUnavailable(
            toNumber(location.latitude) == null ||
              toNumber(location.longitude) == null,
          );
          setLastRefresh(new Date());
        } catch (error) {
          console.warn("Unable to load nurse live location", error);
        }
      }
    } catch (error) {
      console.warn("Unable to load nurse tracking request", error);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (
      !requestId ||
      !request?.professionalId ||
      !isTrackingStatus(request.status)
    ) {
      return;
    }
    let active = true;
    let cancelled = false;

    const loadPictureWithRetry = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        const source = await getAssignedNursePictureSource(
          requestId,
          Date.now(),
        );
        if (source) {
          if (active) setPictureSource(source);
          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
    };

    setPictureSource(null);
    void loadPictureWithRetry();

    return () => {
      active = false;
      cancelled = true;
    };
  }, [requestId, request?.professionalId, request?.status]);

  useEffect(() => {
    if (!requestId) return;
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [requestId, load]);

  const patientLatitude = toNumber(request?.latitude);
  const patientLongitude = toNumber(request?.longitude);

  useEffect(() => {
    console.log("[CareNow Map Debug] screen state", {
      platform: Platform.OS,
      requestId,
      status: request?.status,
      patientLatitude,
      patientLongitude,
      nurseLatitude: toNumber(liveLocation?.latitude),
      nurseLongitude: toNumber(liveLocation?.longitude),
      mapReady,
      mapLoaded,
    });
  }, [
    requestId,
    request?.status,
    patientLatitude,
    patientLongitude,
    liveLocation?.latitude,
    liveLocation?.longitude,
    mapReady,
    mapLoaded,
  ]);
  const nurseLatitude = toNumber(liveLocation?.latitude);
  const nurseLongitude = toNumber(liveLocation?.longitude);

  const initialRegion = useMemo<Region>(
    () => ({
      latitude: patientLatitude ?? 17.385,
      longitude: patientLongitude ?? 78.4867,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
    }),
    [patientLatitude, patientLongitude],
  );

  useEffect(() => {
    if (
      !mapRef.current ||
      patientLatitude == null ||
      patientLongitude == null
    ) {
      console.log("[CareNow Map Debug] fitToCoordinates skipped", {
        hasMapRef: Boolean(mapRef.current),
        patientLatitude,
        patientLongitude,
      });
      return;
    }
    const coordinates = [
      { latitude: patientLatitude, longitude: patientLongitude },
    ];
    if (nurseLatitude != null && nurseLongitude != null) {
      coordinates.push({ latitude: nurseLatitude, longitude: nurseLongitude });
    }
    console.log("[CareNow Map Debug] fitToCoordinates", coordinates);
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 90, right: 55, bottom: 280, left: 55 },
      animated: true,
    });
  }, [patientLatitude, patientLongitude, nurseLatitude, nurseLongitude]);

  const animateSheet = useCallback(
    (expanded: boolean) => {
      setSheetExpanded(expanded);
      Animated.spring(sheetHeight, {
        toValue: expanded ? 500 : 255,
        useNativeDriver: false,
        tension: 55,
        friction: 9,
      }).start();
    },
    [sheetHeight],
  );

  // Android can give the initial touch to the TouchableOpacity/child views when
  // the responder is attached to the whole sheet. Keep the gesture responder
  // on the dedicated handle area and explicitly claim the touch on both
  // platforms. This makes vertical drag behavior consistent on Android/iOS.
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
          sheetStartHeight.current = sheetExpanded ? 500 : 255;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextHeight = Math.max(
            235,
            Math.min(620, sheetStartHeight.current - gestureState.dy),
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
          } else if (gestureState.dy > 45) {
            animateSheet(false);
          } else {
            animateSheet(sheetStartHeight.current > 350);
          }
        },
        onPanResponderTerminate: () =>
          animateSheet(sheetStartHeight.current > 350),
      }),
    [animateSheet, sheetExpanded, sheetHeight],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0EA5B7" />
          <Text style={styles.loadingText}>Loading nurse location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName =
    liveLocation?.professionalName || request?.professionalName || "Your nurse";
  const status = liveLocation?.status || request?.status || "ACCEPTED";
  const destinationAvailable =
    patientLatitude != null && patientLongitude != null;
  const nurseAvailable = nurseLatitude != null && nurseLongitude != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nurse on the way</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Ionicons name="home-outline" size={23} color="#0EA5B7" />
          </TouchableOpacity>
        </View>

        {destinationAvailable ? (
          Platform.OS === "android" ? (
            <MapTilerLiveMap
              patient={{
                latitude: patientLatitude!,
                longitude: patientLongitude!,
              }}
              nurse={
                nurseAvailable
                  ? { latitude: nurseLatitude!, longitude: nurseLongitude! }
                  : null
              }
            />
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                console.log("[CareNow Map Debug] MapView layout", {
                  width,
                  height,
                });
              }}
              onMapReady={() => {
                setMapReady(true);
                console.log("[CareNow Map Debug] onMapReady", {
                  platform: Platform.OS,
                  provider: "google",
                  patientLatitude,
                  patientLongitude,
                });
              }}
              onMapLoaded={() => {
                setMapLoaded(true);
                console.log(
                  "[CareNow Map Debug] onMapLoaded - map reported loaded",
                );
              }}
              onRegionChangeComplete={(region) => {
                console.log("[CareNow Map Debug] region", {
                  latitude: region.latitude,
                  longitude: region.longitude,
                  latitudeDelta: region.latitudeDelta,
                  longitudeDelta: region.longitudeDelta,
                });
              }}
              initialRegion={initialRegion}
              showsCompass
              showsScale
            >
              <Marker
                coordinate={{
                  latitude: patientLatitude!,
                  longitude: patientLongitude!,
                }}
                title="Your location"
              >
                <View style={styles.destinationMarker}>
                  <Ionicons name="home" size={20} color="#FFFFFF" />
                </View>
              </Marker>

              {nurseAvailable && (
                <Marker
                  coordinate={{
                    latitude: nurseLatitude!,
                    longitude: nurseLongitude!,
                  }}
                  title={displayName}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.nurseMarkerOuter}>
                    {pictureSource ? (
                      <Image
                        source={pictureSource}
                        style={styles.nurseMarkerImage}
                      />
                    ) : (
                      <View style={styles.nurseMarkerFallback}>
                        <Ionicons name="person" size={24} color="#0EA5B7" />
                      </View>
                    )}
                    <View style={styles.liveDot} />
                  </View>
                </Marker>
              )}

              {nurseAvailable && (
                <Polyline
                  coordinates={[
                    { latitude: nurseLatitude!, longitude: nurseLongitude! },
                    {
                      latitude: patientLatitude!,
                      longitude: patientLongitude!,
                    },
                  ]}
                  strokeColor="#0EA5B7"
                  strokeWidth={3}
                  lineDashPattern={[8, 6]}
                />
              )}
            </MapView>
          )
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={42} color="#94A3B8" />
            <Text style={styles.mapFallbackText}>
              Your request location is unavailable.
            </Text>
          </View>
        )}

        <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
          <View style={styles.handleHitArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.nurseRow}>
            <View style={styles.avatarWrap}>
              {pictureSource ? (
                <Image source={pictureSource} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={30} color="#0EA5B7" />
                </View>
              )}
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.nurseInfo}>
              <Text style={styles.nurseName}>{displayName}</Text>
              <Text style={styles.nurseRole}>Nurse</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusLabel}>{statusText(status)}</Text>
              </View>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="medkit-outline" size={20} color="#0EA5B7" />
              <View>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {request?.serviceType || "Nursing Care"}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={20} color="#0EA5B7" />
              <View>
                <Text style={styles.detailLabel}>Location update</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {locationUnavailable
                    ? "Waiting for GPS"
                    : lastRefresh
                      ? "Just now"
                      : "Updating..."}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.locationHint}>
            {nurseAvailable
              ? "The nurse's location refreshes automatically while they are active."
              : "Waiting for the nurse's latest GPS location."}
          </Text>

          {sheetExpanded && (
            <View style={styles.expandedInfo}>
              <View style={styles.expandedRow}>
                <Ionicons name="navigate-outline" size={20} color="#0EA5B7" />
                <View style={styles.expandedTextWrap}>
                  <Text style={styles.expandedLabel}>Destination</Text>
                  <Text style={styles.expandedValue} numberOfLines={2}>
                    {request?.locationAddress || "Your saved service location"}
                  </Text>
                </View>
              </View>
              <View style={styles.expandedRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#0EA5B7"
                />
                <View style={styles.expandedTextWrap}>
                  <Text style={styles.expandedLabel}>Current status</Text>
                  <Text style={styles.expandedValue}>{statusText(status)}</Text>
                </View>
              </View>
              {status === "IN_SERVICE" && request?.completionPasscode ? (
                <View style={styles.passcodeCard}>
                  <Ionicons name="keypad-outline" size={22} color="#2563EB" />
                  <View style={styles.expandedTextWrap}>
                    <Text style={styles.expandedLabel}>
                      Service completion passcode
                    </Text>
                    <Text style={styles.passcodeValue}>
                      {request.completionPasscode}
                    </Text>
                    <Text style={styles.passcodeHint}>
                      Share this code with the professional when the service is
                      complete.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },
  header: {
    height: 64,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 5,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 19, fontWeight: "800", color: "#102A43" },
  map: { flex: 1, width: "100%" },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8FA",
    paddingHorizontal: 30,
  },
  mapFallbackText: {
    marginTop: 10,
    color: "#64748B",
    textAlign: "center",
    fontSize: 13,
  },
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
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  nurseMarkerImage: { width: 50, height: 50, borderRadius: 25 },
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
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 9,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 14,
  },
  nurseRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { position: "relative" },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarFallback: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C9EEF2",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#16A34A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  nurseInfo: { flex: 1, marginLeft: 14 },
  nurseName: { fontSize: 20, fontWeight: "800", color: "#102A43" },
  nurseRole: { marginTop: 2, fontSize: 13, color: "#64748B" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 6,
  },
  statusLabel: { fontSize: 12, fontWeight: "700", color: "#15803D" },
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
  liveBadgeText: { fontSize: 10, fontWeight: "800", color: "#15803D" },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 14 },
  detailsRow: { flexDirection: "row", gap: 14 },
  detailItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  detailLabel: { marginLeft: 8, fontSize: 10, color: "#94A3B8" },
  detailValue: {
    marginLeft: 8,
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    maxWidth: 125,
  },
  locationHint: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
    textAlign: "center",
  },
  handleHitArea: {
    alignSelf: "stretch",
    alignItems: "center",
    height: 30,
    justifyContent: "flex-start",
  },
  expandedInfo: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 14,
  },
  expandedRow: { flexDirection: "row", alignItems: "flex-start" },
  expandedTextWrap: { flex: 1, marginLeft: 10 },
  expandedLabel: { fontSize: 10, color: "#94A3B8" },
  expandedValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    lineHeight: 17,
  },
  passcodeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 13,
    padding: 12,
  },
  passcodeValue: {
    marginTop: 4,
    fontSize: 24,
    letterSpacing: 5,
    fontWeight: "900",
    color: "#1D4ED8",
  },
  passcodeHint: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    color: "#475569",
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#64748B", fontSize: 13 },
});
