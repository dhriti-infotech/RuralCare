import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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

import { ratePatientRequest } from "@/api/patientRequests";

export default function RateServiceScreen() {
  const { requestId, nurseName, serviceType, amount, patientName } =
    useLocalSearchParams<{
      requestId?: string;
      nurseName?: string;
      serviceType?: string;
      amount?: string;
      patientName?: string;
    }>();

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const displayNurse = nurseName || "Your nurse";
  const displayPatient = patientName || "Patient";
  const displayService = serviceType || "Nursing service";

  const numericAmount = Number(amount || 0);

  const displayAmount = Number.isFinite(numericAmount)
    ? numericAmount.toFixed(0)
    : "0";

  /*
   * --------------------------------------------------------------------------
   * RATING
   * --------------------------------------------------------------------------
   * Existing rating API integration is intentionally preserved.
   */
  const submit = async () => {
    if (!requestId || rating < 1) {
      Alert.alert(
        "Rating required",
        "Please select a rating before submitting.",
      );
      return;
    }

    try {
      setSubmitting(true);

      await ratePatientRequest(requestId, {
        rating,
        review: review.trim() || undefined,
      });

      Alert.alert("Thank you", "Your rating has been submitted.", [
        {
          text: "Continue",
          onPress: () => router.replace("/(tabs)/orders"),
        },
      ]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to submit your rating.";

      Alert.alert("Unable to submit rating", message);
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * --------------------------------------------------------------------------
   * NAVIGATION
   * --------------------------------------------------------------------------
   */
  const goToOrders = () => {
    if (submitting || downloadingInvoice) return;

    router.replace("/(tabs)/orders");
  };

  /*
   * --------------------------------------------------------------------------
   * REORDER
   * --------------------------------------------------------------------------
   * Keeps this UI action independent from the existing rating integration.
   */
  const reorderService = () => {
    Alert.alert(
      "Reorder service",
      `You can request ${displayService} again from the home screen.`,
      [
        {
          text: "Go to Home",
          onPress: () => router.replace("/(tabs)"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
    );
  };

  /*
   * --------------------------------------------------------------------------
   * INVOICE
   * --------------------------------------------------------------------------
   * No invoice API was available in the current CareNow frontend context,
   * so we intentionally do not invent an endpoint here.
   *
   * Once the backend invoice endpoint is available, replace the body of
   * this function with the real API call.
   */
  const downloadInvoice = async () => {
    if (!requestId || downloadingInvoice) return;

    try {
      setDownloadingInvoice(true);

      /*
       * TODO:
       *
       * Replace this Alert with the real invoice API integration when the
       * backend endpoint is available.
       *
       * Example:
       *
       * const invoice = await getPatientInvoice(requestId);
       *
       * Then download/open the returned PDF.
       */

      await new Promise((resolve) => setTimeout(resolve, 500));

      Alert.alert(
        "Invoice",
        "Invoice download will be available once the invoice service is connected.",
      );
    } catch (error: any) {
      Alert.alert(
        "Unable to download invoice",
        error?.message || "We couldn't download the invoice. Please try again.",
      );
    } finally {
      setDownloadingInvoice(false);
    }
  };

  /*
   * --------------------------------------------------------------------------
   * HELP & SUPPORT
   * --------------------------------------------------------------------------
   */
  const openSupport = () => {
    Alert.alert(
      "Help & Support",
      "Need help with this completed service? Please contact CareNow support.",
      [
        {
          text: "OK",
          style: "default",
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ---------------------------------------------------------------- */}
        {/* HEADER */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={goToOrders}
            disabled={submitting || downloadingInvoice}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={23} color="#0F172A" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Service completed</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---------------------------------------------------------------- */}
          {/* COMPLETED HEADER */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.completedSection}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={42} color="#FFFFFF" />
            </View>

            <View style={styles.completedBadge}>
              <View style={styles.completedDot} />

              <Text style={styles.completedBadgeText}>SERVICE COMPLETED</Text>
            </View>

            <Text style={styles.title}>Your service is complete</Text>

            <Text style={styles.subtitle}>
              {displayNurse} has completed the requested{" "}
              {displayService.toLowerCase()}.
            </Text>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* ORDER SUMMARY */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="receipt-outline" size={20} color="#2563EB" />
              </View>

              <View>
                <Text style={styles.cardTitle}>Order summary</Text>

                <Text style={styles.cardSubtitle}>
                  Details of your completed service
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Ordered for */}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="person-outline" size={19} color="#64748B" />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ordered for</Text>

                <Text style={styles.infoValue}>{displayPatient}</Text>
              </View>
            </View>

            {/* Service */}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="medical-outline" size={19} color="#64748B" />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Service</Text>

                <Text style={styles.infoValue}>{displayService}</Text>
              </View>
            </View>

            {/* Professional */}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="medkit-outline" size={19} color="#64748B" />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Professional</Text>

                <Text style={styles.infoValue}>{displayNurse}</Text>
              </View>
            </View>

            {/* Service cost */}

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <View style={styles.infoIcon}>
                <Ionicons name="cash-outline" size={19} color="#64748B" />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Service cost</Text>

                <Text style={styles.amountValue}>₹{displayAmount}</Text>
              </View>
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* SERVICE GIVEN */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIconGreen}>
                <Ionicons name="clipboard-outline" size={20} color="#16A34A" />
              </View>

              <View>
                <Text style={styles.cardTitle}>Service given</Text>

                <Text style={styles.cardSubtitle}>Completed care details</Text>
              </View>
            </View>

            <View style={styles.serviceCompletedBox}>
              <View style={styles.serviceCheck}>
                <Ionicons name="checkmark-circle" size={23} color="#16A34A" />
              </View>

              <View style={styles.serviceCompletedContent}>
                <Text style={styles.serviceCompletedTitle}>
                  {displayService}
                </Text>

                <Text style={styles.serviceCompletedText}>
                  The requested healthcare service was completed by{" "}
                  {displayNurse}.
                </Text>
              </View>
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* PAYMENT */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.paymentCard}>
            <View style={styles.paymentIcon}>
              <Ionicons name="card-outline" size={21} color="#2563EB" />
            </View>

            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>Payment</Text>

              <Text style={styles.paymentSubtitle}>Service payment</Text>
            </View>

            <Text style={styles.paymentAmount}>₹{displayAmount}</Text>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* INVOICE */}
          {/* ---------------------------------------------------------------- */}

          <TouchableOpacity
            style={styles.invoiceCard}
            onPress={() => void downloadInvoice()}
            disabled={downloadingInvoice || submitting}
            activeOpacity={0.85}
          >
            <View style={styles.invoiceIcon}>
              <Ionicons
                name="document-text-outline"
                size={22}
                color="#7C3AED"
              />
            </View>

            <View style={styles.invoiceContent}>
              <Text style={styles.invoiceTitle}>Download invoice</Text>

              <Text style={styles.invoiceSubtitle}>
                View or download your service receipt
              </Text>
            </View>

            {downloadingInvoice ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Ionicons name="download-outline" size={21} color="#7C3AED" />
            )}
          </TouchableOpacity>

          {/* ---------------------------------------------------------------- */}
          {/* RATING */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.ratingCard}>
            <View style={styles.ratingHeader}>
              <View style={styles.ratingHeaderContent}>
                <Text style={styles.ratingTitle}>How was your experience?</Text>

                <Text style={styles.ratingSubtitle}>Rate {displayNurse}</Text>
              </View>

              <View style={styles.ratingHeaderIcon}>
                <Ionicons name="star-outline" size={27} color="#F59E0B" />
              </View>
            </View>

            {/* Stars */}

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={styles.starButton}
                  onPress={() => setRating(value)}
                  disabled={submitting}
                  activeOpacity={0.75}
                  accessibilityLabel={`${value} star${value > 1 ? "s" : ""}`}
                >
                  <Ionicons
                    name={value <= rating ? "star" : "star-outline"}
                    size={42}
                    color="#F59E0B"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingSelectedText}>
                {rating === 5
                  ? "Excellent"
                  : rating === 4
                    ? "Very good"
                    : rating === 3
                      ? "Good"
                      : rating === 2
                        ? "Needs improvement"
                        : "Poor"}
              </Text>
            )}

            <TextInput
              style={styles.reviewInput}
              value={review}
              onChangeText={setReview}
              placeholder="Tell us about your experience (optional)"
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={2000}
              textAlignVertical="top"
              editable={!submitting}
            />

            <TouchableOpacity
              style={[
                styles.submitButton,
                (rating < 1 || submitting) && styles.disabledButton,
              ]}
              onPress={() => void submit()}
              disabled={rating < 1 || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="star" size={17} color="#FFFFFF" />

                  <Text style={styles.submitText}>Submit rating</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={goToOrders}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.skipText}>Rate later</Text>
            </TouchableOpacity>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* QUICK ACTIONS */}
          {/* ---------------------------------------------------------------- */}

          <View style={styles.quickActions}>
            {/* Reorder */}

            <TouchableOpacity
              style={styles.actionCard}
              onPress={reorderService}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <View style={styles.actionIconBlue}>
                <Ionicons name="repeat-outline" size={22} color="#2563EB" />
              </View>

              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Reorder service</Text>

                <Text style={styles.actionSubtitle}>
                  Request {displayService} again
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#94A3B8" />
            </TouchableOpacity>

            {/* Help & Support */}

            <TouchableOpacity
              style={styles.actionCard}
              onPress={openSupport}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <View style={styles.actionIconGreen}>
                <Ionicons
                  name="help-circle-outline"
                  size={22}
                  color="#16A34A"
                />
              </View>

              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Help & Support</Text>

                <Text style={styles.actionSubtitle}>
                  Get help with this service
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* VIEW ALL ORDERS */}
          {/* ---------------------------------------------------------------- */}

          <TouchableOpacity
            style={styles.ordersButton}
            onPress={goToOrders}
            disabled={submitting || downloadingInvoice}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={18} color="#2563EB" />

            <Text style={styles.ordersButtonText}>View all orders</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
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

  scrollView: {
    flex: 1,
  },

  header: {
    height: 64,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 42,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#102A43",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 26,
  },

  completedSection: {
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 22,
  },

  successCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },

  completedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16A34A",
    marginRight: 6,
  },

  completedBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#15803D",
    letterSpacing: 0.6,
  },

  title: {
    fontSize: 25,
    fontWeight: "900",
    color: "#102A43",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 17,
    marginBottom: 13,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  cardHeaderIconGreen: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#102A43",
  },

  cardSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748B",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 15,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  infoRowLast: {
    marginBottom: 0,
  },

  infoIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },

  infoValue: {
    marginTop: 2,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "700",
  },

  amountValue: {
    marginTop: 2,
    fontSize: 15,
    color: "#15803D",
    fontWeight: "900",
  },

  serviceCompletedBox: {
    marginTop: 15,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  serviceCheck: {
    marginRight: 10,
  },

  serviceCompletedContent: {
    flex: 1,
  },

  serviceCompletedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#166534",
  },

  serviceCompletedText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: "#4B5563",
  },

  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  paymentContent: {
    flex: 1,
  },

  paymentTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
  },

  paymentSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748B",
  },

  paymentAmount: {
    fontSize: 17,
    fontWeight: "900",
    color: "#102A43",
  },

  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  invoiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  invoiceContent: {
    flex: 1,
  },

  invoiceTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4C1D95",
  },

  invoiceSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#64748B",
  },

  ratingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 19,
    marginBottom: 13,
  },

  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ratingHeaderContent: {
    flex: 1,
  },

  ratingTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102A43",
  },

  ratingSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  ratingHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 17,
  },

  starButton: {
    paddingHorizontal: 3,
  },

  ratingSelectedText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
  },

  reviewInput: {
    width: "100%",
    minHeight: 90,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D7E2EA",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    color: "#334155",
    backgroundColor: "#F8FAFC",
  },

  submitButton: {
    width: "100%",
    height: 50,
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  disabledButton: {
    opacity: 0.5,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  skipButton: {
    alignItems: "center",
    marginTop: 12,
    padding: 7,
  },

  skipText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },

  quickActions: {
    gap: 10,
    marginBottom: 13,
  },

  actionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  actionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  actionIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  actionContent: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E293B",
  },

  actionSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#64748B",
  },

  ordersButton: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  ordersButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },

  bottomSpace: {
    height: 30,
  },
});
