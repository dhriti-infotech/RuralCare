import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cancelPatientRequest,
  getPatientRequestOffers,
  getPatientRequests,
  type NurseServiceRequestStatus,
  type PatientNurseOffer,
  type PatientServiceRequest,
} from "@/api/patientRequests";

const statusLabels: Record<NurseServiceRequestStatus, string> = {
  SEARCHING: "Finding a nurse",
  OFFERED: "Nurse notified",
  ACCEPTED: "Nurse assigned",
  EN_ROUTE: "Nurse is on the way",
  ARRIVED: "Nurse has arrived",
  IN_SERVICE: "Service in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const statusColors: Record<NurseServiceRequestStatus, string> = {
  SEARCHING: "#1D4ED8",
  OFFERED: "#1D4ED8",
  ACCEPTED: "#15803D",
  EN_ROUTE: "#15803D",
  ARRIVED: "#15803D",
  IN_SERVICE: "#15803D",
  COMPLETED: "#11a906",
  CANCELLED: "#B91C1C",
  EXPIRED: "#B45309",
};

export default function OrdersScreen() {
  const [requests, setRequests] = useState<PatientServiceRequest[]>([]);
  const [offersByRequestId, setOffersByRequestId] = useState<
    Record<string, PatientNurseOffer[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelRequest, setCancelRequest] =
    useState<PatientServiceRequest | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadOffersForRequests = useCallback(
    async (data: PatientServiceRequest[]) => {
      const pendingRequests = data.filter(
        (request) =>
          request.status === "SEARCHING" || request.status === "OFFERED",
      );

      const offerEntries = await Promise.all(
        pendingRequests.map(async (request) => {
          try {
            const offers = await getPatientRequestOffers(request.requestId);
            return [request.requestId, offers] as const;
          } catch (offerError) {
            console.warn(
              `Unable to load offers for request ${request.requestId}`,
              offerError,
            );
            return [request.requestId, []] as const;
          }
        }),
      );

      setOffersByRequestId(Object.fromEntries(offerEntries));
    },
    [],
  );

  const loadRequests = useCallback(
    async (isRefresh = false) => {
      try {
        setError(null);
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const data = await getPatientRequests();
        setRequests(data);
        await loadOffersForRequests(data);
      } catch (err: any) {
        console.warn("Unable to load patient requests", err);
        setError(err?.message ?? "Unable to load your requests.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadOffersForRequests],
  );

  const refreshRequestsSilently = useCallback(async () => {
    try {
      const data = await getPatientRequests();
      setRequests(data);
      await loadOffersForRequests(data);
    } catch (err) {
      console.warn("Unable to refresh patient requests", err);
    }
  }, [loadOffersForRequests]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshRequestsSilently();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshRequestsSilently]);

  const getStatusPresentation = (request: PatientServiceRequest) => {
    const offers = offersByRequestId[request.requestId] ?? [];

    if (request.status === "SEARCHING") {
      const hasActiveOffer = offers.some((offer) => offer.status === "OFFERED");
      const hasDeclinedOffer = offers.some(
        (offer) => offer.status === "DECLINED",
      );

      if (!hasActiveOffer && hasDeclinedOffer) {
        return {
          label: "Nurse declined — finding another nurse",
          color: "#B45309",
        };
      }
    }

    if (request.status === "OFFERED") {
      const activeOfferCount = offers.filter(
        (offer) => offer.status === "OFFERED",
      ).length;
      return {
        label: `${activeOfferCount || offers.length} nurse${(activeOfferCount || offers.length) === 1 ? "" : "s"} notified`,
        color: statusColors[request.status],
      };
    }

    return {
      label: statusLabels[request.status],
      color: statusColors[request.status],
    };
  };

  const canCancelRequest = (request: PatientServiceRequest) =>
    request.status === "SEARCHING" || request.status === "OFFERED";

  const handleCancelRequest = async () => {
    if (!cancelRequest || canceling) return;

    try {
      setCanceling(true);
      setCancelError(null);
      const updatedRequest = await cancelPatientRequest(
        cancelRequest.requestId,
      );

      setRequests((current) =>
        current.map((request) =>
          request.requestId === updatedRequest.requestId
            ? updatedRequest
            : request,
        ),
      );
      setOffersByRequestId((current) => ({
        ...current,
        [updatedRequest.requestId]: [],
      }));
      setCancelRequest(null);
    } catch (err: any) {
      setCancelError(
        err?.message ?? "Unable to cancel this request. Please try again.",
      );
    } finally {
      setCanceling(false);
    }
  };

  const formatOrderDateTime = (dateValue?: string) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const openRequest = (request: PatientServiceRequest) => {
    const trackingStatuses: NurseServiceRequestStatus[] = [
      "ACCEPTED",
      "EN_ROUTE",
      "ARRIVED",
      "IN_SERVICE",
    ];

    if (trackingStatuses.includes(request.status)) {
      router.push({
        pathname: "/nurse-on-the-way",
        params: { requestId: request.requestId },
      });
      return;
    }

    if (request.status === "COMPLETED") {
      router.push({
        pathname: "/rate-service",
        params: {
          requestId: request.requestId,
          nurseName: request.professionalName || "Your nurse",
          serviceType: request.serviceType,
          amount: String(request.offeredPrice ?? ""),
        },
      });
      return;
    }

    router.push({
      pathname: "/nurse-request-submitted",
      params: {
        requestId: request.requestId,
        patientName: request.patientName,
        serviceType: request.serviceType,
        careType: request.serviceType,
        urgency: request.priority === "URGENT" ? "asap" : "scheduled",
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (requests.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="clipboard-outline" size={36} color="#2563EB" />
          </View>

          <Text style={styles.title}>Your Requests & Orders</Text>

          <Text style={styles.subtitle}>
            Your healthcare service requests, medicine orders, and equipment
            orders will appear here.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRequests(true)}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Your Requests & Orders</Text>
        <Text style={styles.pageSubtitle}>
          Track your healthcare service requests and orders.
        </Text>

        {requests.map((request) => (
          <View key={request.requestId} style={styles.requestCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openRequest(request)}
            >
              <View style={styles.requestTopRow}>
                <View style={styles.requestIcon}>
                  <Ionicons name="medical-outline" size={23} color="#2563EB" />
                </View>

                <View style={styles.requestMain}>
                  <Text style={styles.serviceType} numberOfLines={1}>
                    {request.serviceType}
                  </Text>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {request.patientName}
                  </Text>
                  <Text style={styles.orderDateTime}>
                    Requested Time : {formatOrderDateTime(request.requestedAt)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={21} color="#94A3B8" />
              </View>

              <View style={styles.requestDivider} />

              <View style={styles.requestBottomRow}>
                {(() => {
                  const status = getStatusPresentation(request);

                  return (
                    <View style={styles.statusBadge}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: status.color },
                        ]}
                      />
                      <Text
                        style={[styles.statusText, { color: status.color }]}
                      >
                        {status.label}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.priceDateContainer}>
                  <Text style={styles.price}>
                    ₹{request.offeredPrice.toFixed(0)}
                  </Text>
                </View>
              </View>

              <View style={styles.paymentRow}>
                <Ionicons
                  name={
                    request.paymentMethod === "COD"
                      ? "cash-outline"
                      : "phone-portrait-outline"
                  }
                  size={16}
                  color={
                    request.paymentMethod === "COD" ? "#16A34A" : "#2563EB"
                  }
                />
                <Text
                  style={[
                    styles.paymentText,
                    {
                      color:
                        request.paymentMethod === "COD" ? "#166534" : "#1D4ED8",
                    },
                  ]}
                >
                  Payment:{" "}
                  {request.paymentMethod === "COD" ? "Cash on Delivery" : "UPI"}
                </Text>
              </View>

              {request.status === "ACCEPTED" && request.professionalName && (
                <View style={styles.assignedRow}>
                  <Ionicons
                    name="person-circle-outline"
                    size={18}
                    color="#15803D"
                  />
                  <Text style={styles.assignedText}>
                    Assigned to {request.professionalName}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {canCancelRequest(request) && (
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.85}
                onPress={() => {
                  setCancelError(null);
                  setCancelRequest(request);
                }}
                disabled={canceling}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={17}
                  color="#B91C1C"
                />
                <Text style={styles.cancelButtonText}>Cancel Request</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={cancelRequest !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !canceling && setCancelRequest(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cancelModal}>
            <View style={styles.cancelIcon}>
              <Ionicons name="close" size={26} color="#B91C1C" />
            </View>

            <Text style={styles.cancelTitle}>Cancel request?</Text>
            <Text style={styles.cancelMessage}>
              Are you sure you want to cancel this nursing service request?\n\n
              CareNow will stop looking for a professional for this request.
            </Text>

            {cancelError && (
              <Text style={styles.cancelError}>{cancelError}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setCancelRequest(null)}
                disabled={canceling}
                activeOpacity={0.85}
              >
                <Text style={styles.keepButtonText}>Keep Request</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => void handleCancelRequest()}
                disabled={canceling}
                activeOpacity={0.85}
              >
                {canceling ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelText}>Cancel Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
  },

  errorText: {
    marginTop: 18,
    fontSize: 12,
    color: "#B91C1C",
    textAlign: "center",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 30,
  },

  pageTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
  },

  pageSubtitle: {
    marginTop: 7,
    marginBottom: 20,
    fontSize: 13,
    color: "#64748B",
  },

  requestCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },

  requestTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  requestIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  requestMain: {
    flex: 1,
  },

  serviceType: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },

  patientName: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  requestDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 13,
  },

  requestBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  price: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },

  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    gap: 6,
  },
  paymentText: { fontSize: 10, fontWeight: "700" },

  cancelButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B91C1C",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  cancelModal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
  },

  cancelIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  cancelTitle: {
    marginTop: 15,
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },

  cancelMessage: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },

  cancelError: {
    marginTop: 10,
    fontSize: 11,
    color: "#B91C1C",
    textAlign: "center",
  },

  modalActions: {
    marginTop: 20,
    gap: 10,
  },

  keepButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  keepButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },

  confirmCancelButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmCancelText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#DCFCE7",
  },

  assignedText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  priceDateContainer: {
    alignItems: "flex-end",
  },

  orderDateTime: {
    marginTop: 5,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "900",
  },
});
