import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  PatientNurseOffer,
  PatientServiceRequest,
} from "@/api/patientRequests";

const STATUS = {
  SEARCHING: "SEARCHING",
  OFFERED: "OFFERED",
  ACCEPTED: "ACCEPTED",
  EN_ROUTE: "EN_ROUTE",
  ARRIVED: "ARRIVED",
  IN_SERVICE: "IN_SERVICE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

const STATUS_LABELS: Record<string, string> = {
  SEARCHING: "Finding a nurse",
  OFFERED: "Nurse notified",
  ACCEPTED: "Nurse assigned",
  EN_ROUTE: "Nurse is on the way",
  ARRIVED: "Nurse has arrived",
  IN_SERVICE: "Care in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  SEARCHING: "#1D4ED8",
  OFFERED: "#1D4ED8",
  ACCEPTED: "#15803D",
  EN_ROUTE: "#15803D",
  ARRIVED: "#15803D",
  IN_SERVICE: "#15803D",
  COMPLETED: "#15803D",
  CANCELLED: "#B91C1C",
  EXPIRED: "#B45309",
};

type ExtendedRequest = PatientServiceRequest & {
  nurseName?: string;
  professionalName?: string;
  amount?: number | string;
  price?: number | string;
  totalAmount?: number | string;
  paymentMethod?: string;
  address?: string;
  location?: string;
  careType?: string;
  requesterName?: string;
  orderedBy?: string;
  serviceType?: string;
  patientName?: string;
  scheduledAt?: string;
  requestedAt?: string;
  createdAt?: string;
  createdDate?: string;
  requestDate?: string;
};

function getRequestDate(request: PatientServiceRequest) {
  const item = request as ExtendedRequest;

  return (
    item.scheduledAt ||
    item.requestedAt ||
    item.createdAt ||
    item.createdDate ||
    item.requestDate ||
    null
  );
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) {
    return "Date not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateValue?: string | null) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return String(value);
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

function getServiceLabel(request: PatientServiceRequest) {
  const item = request as ExtendedRequest;

  const value = item.careType || item.serviceType;

  if (!value) {
    return "Home Care";
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getServiceIcon(request: PatientServiceRequest) {
  const service = getServiceLabel(request).toLowerCase();

  if (service.includes("elder")) {
    return "heart-outline";
  }

  if (service.includes("post")) {
    return "medkit-outline";
  }

  if (service.includes("doctor")) {
    return "medical-outline";
  }

  return "person-outline";
}

function getStatusColor(status?: string) {
  return STATUS_COLORS[status || ""] || "#64748B";
}

function getStatusLabel(status?: string) {
  return STATUS_LABELS[status || ""] || "Order placed";
}

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

  const loadOffersForRequests = useCallback(
    async (requestList: PatientServiceRequest[]) => {
      const eligibleRequests = requestList.filter(
        (request) =>
          request.status === STATUS.SEARCHING ||
          request.status === STATUS.OFFERED,
      );

      if (eligibleRequests.length === 0) {
        setOffersByRequestId({});
        return;
      }

      const entries = await Promise.all(
        eligibleRequests.map(async (request) => {
          try {
            const offers = await getPatientRequestOffers(request.id);

            return [request.id, offers] as const;
          } catch {
            return [request.id, []] as const;
          }
        }),
      );

      setOffersByRequestId(Object.fromEntries(entries));
    },
    [],
  );

  const loadRequests = useCallback(async () => {
    try {
      setError(null);

      const response = await getPatientRequests();

      const sorted = [...response].sort((a, b) => {
        const dateA = getRequestDate(a);
        const dateB = getRequestDate(b);

        if (!dateA && !dateB) {
          return 0;
        }

        if (!dateA) {
          return 1;
        }

        if (!dateB) {
          return -1;
        }

        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setRequests(sorted);

      await loadOffersForRequests(sorted);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load your orders.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadOffersForRequests]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      loadRequests();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadRequests]);

  const openRequest = useCallback((request: PatientServiceRequest) => {
    router.push({
      pathname: "/order-details",
      params: {
        order: JSON.stringify(request),
      },
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  const handleCancelRequest = useCallback(async () => {
    if (!cancelRequest) {
      return;
    }

    try {
      setCanceling(true);

      await cancelPatientRequest(cancelRequest.id);

      setRequests((current) =>
        current.map((request) =>
          request.id === cancelRequest.id
            ? {
                ...request,
                status: STATUS.CANCELLED,
              }
            : request,
        ),
      );

      setCancelRequest(null);

      Alert.alert("Care cancelled", "Your care request has been cancelled.");
    } catch (err: any) {
      Alert.alert(
        "Unable to cancel",
        err?.response?.data?.message ||
          err?.message ||
          "We couldn't cancel this request.",
      );
    } finally {
      setCanceling(false);
    }
  }, [cancelRequest]);

  const canCancelRequest = useCallback(
    (request: PatientServiceRequest) =>
      request.status === STATUS.SEARCHING || request.status === STATUS.OFFERED,
    [],
  );

  const orderCountText = useMemo(() => {
    if (requests.length === 0) {
      return "Your care requests will appear here.";
    }

    return `${requests.length} ${requests.length === 1 ? "order" : "orders"}`;
  }, [requests.length]);

  const renderOrderCard = (request: PatientServiceRequest) => {
    const extendedRequest = request as ExtendedRequest;

    const requestDate = getRequestDate(request);
    const status = request.status || "";
    const statusColor = getStatusColor(status);

    const offers = offersByRequestId[request.id] || [];

    const professionalName =
      extendedRequest.nurseName ||
      extendedRequest.professionalName ||
      (offers.length > 0 ? offers[0]?.nurseName : undefined);

    const amount =
      extendedRequest.totalAmount ??
      extendedRequest.amount ??
      extendedRequest.price;

    return (
      <View key={request.id} style={styles.orderWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.orderCard}
          onPress={() => openRequest(request)}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.serviceIcon}>
              <Ionicons
                name={getServiceIcon(request) as any}
                size={21}
                color="#0A9FB5"
              />
            </View>

            <View style={styles.serviceInfo}>
              <Text style={styles.serviceTitle}>
                {getServiceLabel(request)}
              </Text>

              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />

                <Text style={styles.dateText}>
                  {formatDate(requestDate)}
                  {formatTime(requestDate)
                    ? ` • ${formatTime(requestDate)}`
                    : ""}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    request.status === STATUS.COMPLETED
                      ? "#DCFCE7"
                      : `${statusColor}12`,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusColor,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {getStatusLabel(status)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Care for</Text>

            <Text style={styles.detailValue} numberOfLines={1}>
              {extendedRequest.patientName || "You"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Care professional</Text>

            <Text style={styles.detailValue} numberOfLines={1}>
              {professionalName ||
                (status === STATUS.CANCELLED ? "—" : "Being assigned")}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Care amount</Text>

            <Text style={styles.amountText}>{formatAmount(amount)}</Text>
          </View>

          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>View order details</Text>

            <Ionicons name="chevron-forward" size={18} color="#0A9FB5" />
          </View>
        </TouchableOpacity>

        {canCancelRequest(request) && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setCancelRequest(request)}
          >
            <Text style={styles.cancelButtonText}>Cancel request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A9FB5" />

          <Text style={styles.loadingText}>Loading your care...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0A9FB5"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Care</Text>

          <Text style={styles.subtitle}>{orderCountText}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color="#B91C1C" />

            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>
                We couldn't load your orders
              </Text>

              <Text style={styles.errorText}>{error}</Text>

              <TouchableOpacity
                onPress={loadRequests}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={30} color="#0A9FB5" />
            </View>

            <Text style={styles.emptyTitle}>No care orders yet</Text>

            <Text style={styles.emptyText}>
              When you request care, your order and its progress will appear
              here.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/request-nurse")}
            >
              <Text style={styles.primaryButtonText}>Get care at home</Text>

              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersList}>{requests.map(renderOrderCard)}</View>
        )}
      </ScrollView>

      {cancelRequest && (
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModal}>
            <View style={styles.modalIcon}>
              <Ionicons name="close-circle-outline" size={30} color="#B91C1C" />
            </View>

            <Text style={styles.modalTitle}>Cancel this request?</Text>

            <Text style={styles.modalText}>
              Are you sure you want to cancel this care request?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.keepButton}
                disabled={canceling}
                onPress={() => setCancelRequest(null)}
              >
                <Text style={styles.keepButtonText}>Keep request</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCancelButton}
                disabled={canceling}
                onPress={handleCancelRequest}
              >
                {canceling ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelText}>Cancel request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FBFC",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#10242C",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#64748B",
  },

  ordersList: {
    gap: 14,
  },

  orderWrapper: {
    marginBottom: 2,
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 15,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  serviceInfo: {
    flex: 1,
    paddingTop: 1,
    paddingRight: 8,
  },

  serviceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#182A33",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 5,
  },

  dateText: {
    fontSize: 12,
    color: "#64748B",
  },

  statusBadge: {
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF3F4",
    marginVertical: 13,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  detailLabel: {
    fontSize: 13,
    color: "#64748B",
  },

  detailValue: {
    maxWidth: "58%",
    fontSize: 13,
    fontWeight: "600",
    color: "#243640",
    textAlign: "right",
  },

  amountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#182A33",
  },

  viewDetailsRow: {
    marginTop: 7,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A9FB5",
  },

  cancelButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B91C1C",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E8EB",
    padding: 24,
    alignItems: "center",
    marginTop: 10,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#182A33",
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
    marginTop: 7,
    maxWidth: 310,
  },

  primaryButton: {
    marginTop: 20,
    backgroundColor: "#0A9FB5",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  errorCard: {
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#F1CCCC",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },

  errorContent: {
    flex: 1,
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7F1D1D",
  },

  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#991B1B",
    marginTop: 4,
  },

  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },

  retryText: {
    color: "#0A7281",
    fontSize: 13,
    fontWeight: "700",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },

  modalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end",
  },

  cancelModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
  },

  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#182A33",
  },

  modalText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    marginTop: 7,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  keepButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E8EB",
    alignItems: "center",
    justifyContent: "center",
  },

  keepButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },

  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
