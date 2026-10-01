import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  PatientServiceRequest,
  ratePatientRequest,
} from "@/api/patientRequests";

/**
 * Keep these as strings instead of importing NurseServiceRequestStatus
 * because the API module does not expose it as a runtime enum/value.
 */
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

type ExtendedRequest = PatientServiceRequest & {
  nurseName?: string;
  professionalName?: string;
  amount?: number;
  price?: number;
  totalAmount?: number;
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

function getRequestDate(request?: ExtendedRequest | null) {
  if (!request) return null;

  return (
    request.scheduledAt ||
    request.requestedAt ||
    request.createdAt ||
    request.createdDate ||
    request.requestDate ||
    null
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value?: number | string | null) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `₹${numericValue.toLocaleString("en-IN")}`;
}

function getServiceLabel(request?: ExtendedRequest | null) {
  if (!request) return "Home Care";

  const value = request.careType || request.serviceType || "Home Care";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusLabel(status?: string) {
  switch (status) {
    case STATUS.SEARCHING:
      return "Finding a nurse";

    case STATUS.OFFERED:
      return "Nurse notified";

    case STATUS.ACCEPTED:
      return "Nurse assigned";

    case STATUS.EN_ROUTE:
      return "Nurse is on the way";

    case STATUS.ARRIVED:
      return "Nurse has arrived";

    case STATUS.IN_SERVICE:
      return "Care in progress";

    case STATUS.COMPLETED:
      return "Completed";

    case STATUS.CANCELLED:
      return "Cancelled";

    case STATUS.EXPIRED:
      return "Expired";

    default:
      return "Care request";
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case STATUS.SEARCHING:
    case STATUS.OFFERED:
      return "#1D4ED8";

    case STATUS.ACCEPTED:
    case STATUS.EN_ROUTE:
    case STATUS.ARRIVED:
    case STATUS.IN_SERVICE:
      return "#15803D";

    case STATUS.COMPLETED:
      return "#15803D";

    case STATUS.CANCELLED:
      return "#B91C1C";

    case STATUS.EXPIRED:
      return "#B45309";

    default:
      return "#475569";
  }
}

function getServiceIcon(serviceType?: string) {
  const value = (serviceType || "").toLowerCase();

  if (value.includes("injection")) {
    return "medical-outline";
  }

  if (value.includes("medicine") || value.includes("prescription")) {
    return "medkit-outline";
  }

  if (value.includes("equipment")) {
    return "fitness-outline";
  }

  return "heart-outline";
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color="#0F766E" />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={icon}
        size={19}
        color={disabled ? "#94A3B8" : "#0F766E"}
      />

      <Text
        style={[
          styles.actionButtonText,
          disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function OrderDetailsScreen() {
  const { order } = useLocalSearchParams<{ order?: string }>();

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const request = useMemo<ExtendedRequest | null>(() => {
    if (!order) {
      return null;
    }

    try {
      return JSON.parse(order) as ExtendedRequest;
    } catch (error) {
      console.error("[Order Details] Failed to parse order:", error);
      return null;
    }
  }, [order]);

  if (!request) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={32} color="#0F766E" />
          </View>

          <Text style={styles.emptyTitle}>Order not available</Text>

          <Text style={styles.emptyText}>
            We couldn't load the details for this care order.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = request.status;
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  const requestDate = getRequestDate(request);

  const professionalName =
    request.nurseName || request.professionalName || "Care professional";

  const amount = request.totalAmount ?? request.amount ?? request.price;

  const paymentMethod = request.paymentMethod || "Payment details unavailable";

  const location =
    request.address || request.location || "Address details unavailable";

  const serviceLabel = getServiceLabel(request);

  const completed = status === STATUS.COMPLETED;

  const cancelled = status === STATUS.CANCELLED || status === STATUS.EXPIRED;

  const active =
    status === STATUS.SEARCHING ||
    status === STATUS.OFFERED ||
    status === STATUS.ACCEPTED ||
    status === STATUS.EN_ROUTE ||
    status === STATUS.ARRIVED ||
    status === STATUS.IN_SERVICE;

  const handleSubmitRating = async () => {
    if (!rating) {
      Alert.alert(
        "Rating required",
        "Please select a rating before submitting.",
      );
      return;
    }

    if (!request.id) {
      Alert.alert("Unable to rate", "The order information is incomplete.");
      return;
    }

    try {
      setIsSubmittingRating(true);

      await ratePatientRequest(request.id, {
        rating,
        review: review.trim() || undefined,
      });

      setRatingSubmitted(true);

      Alert.alert("Thank you", "Your feedback has been submitted.");
    } catch (error) {
      console.error("[Order Details] Rating error:", error);

      Alert.alert(
        "Unable to submit",
        "We couldn't submit your feedback. Please try again.",
      );
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleInvoice = () => {
    Alert.alert(
      "Invoice",
      "Your invoice will be available here once the invoice service is connected.",
    );
  };

  const handleHelp = () => {
    Alert.alert("Need help?", "Support options will be available here.");
  };

  const handleRepeatCare = () => {
    router.push("/request-nurse");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={23} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Order Details</Text>

            <View style={styles.headerSpacer} />
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Status */}
              <View
                style={[
                  styles.statusCard,
                  {
                    borderColor:
                      status === STATUS.COMPLETED
                        ? "#DCFCE7"
                        : `${statusColor}25`,
                    backgroundColor:
                      status === STATUS.COMPLETED
                        ? "#F0FDF4"
                        : `${statusColor}08`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusIcon,
                    {
                      backgroundColor:
                        status === STATUS.COMPLETED
                          ? "#DCFCE7"
                          : `${statusColor}15`,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      completed
                        ? "checkmark-circle-outline"
                        : cancelled
                          ? "close-circle-outline"
                          : "time-outline"
                    }
                    size={27}
                    color={statusColor}
                  />
                </View>

                <View style={styles.statusContent}>
                  <Text style={[styles.statusTitle, { color: statusColor }]}>
                    {statusLabel}
                  </Text>

                  <Text style={styles.statusSubtext}>
                    {completed
                      ? "This care order has been completed."
                      : cancelled
                        ? "This care order is no longer active."
                        : "We'll keep you updated as your care progresses."}
                  </Text>
                </View>
              </View>
              {/* Care details */}
              ```tsx
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Care details</Text>

                <View style={styles.card}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceIcon}>
                      <Ionicons
                        name={getServiceIcon(
                          request.careType || request.serviceType,
                        )}
                        size={25}
                        color="#0F766E"
                      />
                    </View>

                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceTitle}>{serviceLabel}</Text>

                      <Text style={styles.serviceSubtitle}>Home care</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.careSummaryRow}>
                    <View style={styles.careSummaryItem}>
                      <View style={styles.careSummaryIcon}>
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color="#0F766E"
                        />
                      </View>

                      <Text style={styles.careSummaryLabel}>DATE</Text>

                      <Text style={styles.careSummaryValue} numberOfLines={1}>
                        {formatDate(requestDate)}
                      </Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.careSummaryItem}>
                      <View style={styles.careSummaryIcon}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color="#0F766E"
                        />
                      </View>

                      <Text style={styles.careSummaryLabel}>TIME</Text>

                      <Text style={styles.careSummaryValue} numberOfLines={1}>
                        {formatTime(requestDate)}
                      </Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.careSummaryItem}>
                      <View style={styles.careSummaryIcon}>
                        <Ionicons
                          name="person-outline"
                          size={16}
                          color="#0F766E"
                        />
                      </View>

                      <Text style={styles.careSummaryLabel}>CARE FOR</Text>

                      <Text style={styles.careSummaryValue} numberOfLines={1}>
                        {request.patientName ||
                          request.requesterName ||
                          request.orderedBy ||
                          "Patient"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              ```
              {/* Professional */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Care professional</Text>

                <View style={styles.card}>
                  <View style={styles.professionalRow}>
                    <View style={styles.professionalAvatar}>
                      <Ionicons name="person" size={24} color="#0F766E" />
                    </View>

                    <View style={styles.professionalInfo}>
                      <Text style={styles.professionalName}>
                        {professionalName}
                      </Text>

                      <Text style={styles.professionalRole}>
                        Healthcare professional
                      </Text>
                    </View>
                  </View>

                  {active && (
                    <>
                      <View style={styles.divider} />

                      <View style={styles.reassuranceRow}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={19}
                          color="#15803D"
                        />

                        <Text style={styles.reassuranceText}>
                          Your care is being coordinated safely through CareNow.
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
              {/* Location */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>

                <View style={styles.card}>
                  <DetailRow
                    icon="location-outline"
                    label="Care location"
                    value={location}
                  />
                </View>
              </View>
              {/* Payment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment</Text>

                <View style={styles.card}>
                  <DetailRow
                    icon="card-outline"
                    label="Payment method"
                    value={paymentMethod}
                  />

                  <View style={styles.divider} />

                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Care amount</Text>

                    <Text style={styles.amountValue}>
                      {formatAmount(amount)}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Order information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order information</Text>

                <View style={styles.card}>
                  <DetailRow
                    icon="document-text-outline"
                    label="Order ID"
                    value={request.id || "—"}
                  />

                  {requestDate && (
                    <>
                      <View style={styles.divider} />

                      <DetailRow
                        icon="calendar-number-outline"
                        label="Requested on"
                        value={`${formatDate(
                          requestDate,
                        )} at ${formatTime(requestDate)}`}
                      />
                    </>
                  )}
                </View>
              </View>
              {/* Active information */}
              {active && (
                <View style={styles.infoCard}>
                  <View style={styles.infoIcon}>
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color="#0F766E"
                    />
                  </View>

                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>We'll keep you updated</Text>

                    <Text style={styles.infoText}>
                      You can return to this order anytime to see the latest
                      care status.
                    </Text>
                  </View>
                </View>
              )}
              {/* Completed + rating */}
              {completed && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>How was your care?</Text>

                  <View style={styles.ratingCard}>
                    {ratingSubmitted ? (
                      <View style={styles.ratingSuccess}>
                        <View style={styles.ratingSuccessIcon}>
                          <Ionicons
                            name="checkmark"
                            size={25}
                            color="#15803D"
                          />
                        </View>

                        <Text style={styles.ratingSuccessTitle}>
                          Thank you for your feedback
                        </Text>

                        <Text style={styles.ratingSuccessText}>
                          Your feedback helps us improve the CareNow experience.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.ratingTitle}>
                          Rate your care experience
                        </Text>

                        <Text style={styles.ratingSubtitle}>
                          Your feedback helps us improve care.
                        </Text>

                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                              key={star}
                              activeOpacity={0.7}
                              onPress={() => setRating(star)}
                              style={styles.starButton}
                            >
                              <Ionicons
                                name={star <= rating ? "star" : "star-outline"}
                                size={34}
                                color={star <= rating ? "#F59E0B" : "#CBD5E1"}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TextInput
                          value={review}
                          onChangeText={setReview}
                          placeholder="Share anything you'd like us to know (optional)"
                          placeholderTextColor="#94A3B8"
                          multiline
                          textAlignVertical="top"
                          style={styles.reviewInput}
                          maxLength={500}
                        />

                        <TouchableOpacity
                          style={[
                            styles.submitRatingButton,
                            (!rating || isSubmittingRating) &&
                              styles.submitRatingButtonDisabled,
                          ]}
                          activeOpacity={0.8}
                          onPress={handleSubmitRating}
                          disabled={!rating || isSubmittingRating}
                        >
                          {isSubmittingRating ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.submitRatingText}>
                              Submit feedback
                            </Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
              {/* Cancelled */}
              {cancelled && (
                <View style={styles.cancelledCard}>
                  <Ionicons
                    name="information-circle-outline"
                    size={21}
                    color="#B91C1C"
                  />

                  <Text style={styles.cancelledText}>
                    This care order is no longer active. If you still need care,
                    you can create a new request.
                  </Text>
                </View>
              )}
              {/* Actions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order actions</Text>

                <View style={styles.actionsCard}>
                  <ActionButton
                    icon="receipt-outline"
                    label="View invoice"
                    onPress={handleInvoice}
                    disabled={!completed}
                  />

                  <View style={styles.actionDivider} />

                  <ActionButton
                    icon="help-circle-outline"
                    label="Need help?"
                    onPress={handleHelp}
                  />

                  {completed && (
                    <>
                      <View style={styles.actionDivider} />

                      <ActionButton
                        icon="refresh-outline"
                        label="Book similar care"
                        onPress={handleRepeatCare}
                      />
                    </>
                  )}
                </View>
              </View>
              {/* Security footer */}
              <View style={styles.securityFooter}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#64748B"
                />

                <Text style={styles.securityText}>
                  Your care information is handled securely by CareNow.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </>
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

  flex: {
    flex: 1,
  },

  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },

  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  statusSubtext: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#F0FDFA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  serviceInfo: {
    flex: 1,
  },

  serviceTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3,
  },

  serviceSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 15,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FDFA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },

  detailValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#0F172A",
  },

  professionalRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  professionalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  professionalInfo: {
    flex: 1,
  },

  professionalName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3,
  },

  professionalRole: {
    fontSize: 13,
    color: "#64748B",
  },

  reassuranceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  reassuranceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    marginLeft: 8,
  },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  amountLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },

  amountValue: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  infoCard: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    marginBottom: 22,
  },

  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#134E4A",
    marginBottom: 3,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },

  ratingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  ratingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },

  ratingSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 18,
  },

  starButton: {
    paddingHorizontal: 4,
  },

  reviewInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },

  submitRatingButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },

  submitRatingButtonDisabled: {
    backgroundColor: "#94A3B8",
  },

  submitRatingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  ratingSuccess: {
    alignItems: "center",
    paddingVertical: 10,
  },

  ratingSuccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  ratingSuccessTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#15803D",
    textAlign: "center",
  },

  ratingSuccessText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    textAlign: "center",
    marginTop: 5,
  },

  cancelledCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 22,
  },

  cancelledText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#7F1D1D",
    marginLeft: 9,
  },

  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
  },

  actionButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
  },

  actionButtonDisabled: {
    opacity: 0.6,
  },

  actionButtonText: {
    marginLeft: 11,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F766E",
  },

  actionButtonTextDisabled: {
    color: "#94A3B8",
  },

  actionDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },

  securityFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
  },

  securityText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    textAlign: "center",
    marginLeft: 7,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F0FDFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 7,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 22,
  },

  primaryButton: {
    minWidth: 140,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  careSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
  },

  careSummaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  careSummaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#F0FDFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },

  careSummaryLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#94A3B8",
    marginBottom: 2,
  },

  careSummaryValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
    maxWidth: "100%",
  },

  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: "#E2E8F0",
  },
});
