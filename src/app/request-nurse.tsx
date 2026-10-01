import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createNurseRequest, type PaymentMethod } from "@/api/patientRequests";
import { useAuth } from "@/context/auth-context";

type Step = 1 | 2 | 3 | 4;

type CareOption = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ServiceLocation = {
  id: string;
  name: string;
  relationship?: string;
  address: string;
};

const COLORS = {
  primary: "#0F766E",
  primaryDark: "#115E59",
  primaryLight: "#F0FDFA",
  primarySoft: "#CCFBF1",

  success: "#15803D",
  successDark: "#166534",
  successLight: "#F0FDF4",
  successSoft: "#DCFCE7",

  warning: "#B45309",
  warningLight: "#FFFBEB",

  info: "#0369A1",
  infoLight: "#F0F9FF",

  background: "#F8FAFC",
  surface: "#FFFFFF",

  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
};

const careOptions: CareOption[] = [
  {
    id: "general",
    title: "General Nursing Care",
    description: "Basic nursing attention and support at home",
    icon: "medkit-outline",
  },
  {
    id: "elderly",
    title: "Elderly Care",
    description: "Assistance and attention for elderly patients",
    icon: "people-outline",
  },
  {
    id: "post-hospital",
    title: "Post-Hospital Care",
    description: "Support and monitoring after hospital discharge",
    icon: "fitness-outline",
  },
  {
    id: "wound",
    title: "Wound Care",
    description: "Basic wound dressing and nursing attention",
    icon: "bandage-outline",
  },
  {
    id: "other",
    title: "Other Care",
    description: "Tell us what kind of care you need",
    icon: "add-circle-outline",
  },
];

export default function RequestNurseScreen() {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [selectedCare, setSelectedCare] = useState("general");
  const [otherCare, setOtherCare] = useState("");

  const [selectedLocationId, setSelectedLocationId] = useState("self");
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [patientName, setPatientName] = useState(user?.name ?? "");

  const [serviceLocations] = useState<ServiceLocation[]>([
    {
      id: "self",
      name: user?.name ?? "Myself",
      relationship: "Myself",
      address: "Use my current location",
    },
  ]);

  const [urgency, setUrgency] = useState<"asap" | "scheduled">("asap");

  const [scheduledDate, setScheduledDate] = useState<Date>(
    new Date(Date.now() + 60 * 60 * 1000),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");

  const [notes, setNotes] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [detectedAddress, setDetectedAddress] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCareOption = useMemo(
    () =>
      careOptions.find((item) => item.id === selectedCare) ?? careOptions[0],
    [selectedCare],
  );

  const selectedLocation = useMemo(
    () =>
      serviceLocations.find((item) => item.id === selectedLocationId) ??
      serviceLocations[0],
    [serviceLocations, selectedLocationId],
  );

  const displayedServiceName =
    selectedCare === "other" && otherCare.trim()
      ? otherCare.trim()
      : selectedCareOption.title;

  const isScheduledTimeValid =
    urgency === "asap" || scheduledDate.getTime() > Date.now();

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }

    setStep((current) => (current - 1) as Step);
  };

  const continueFromStep1 = () => {
    if (selectedCare === "other" && !otherCare.trim()) {
      Alert.alert(
        "Care details needed",
        "Please tell us what kind of care you need.",
      );
      return;
    }

    setStep(2);
  };

  const continueFromStep2 = () => {
    if (!patientName.trim()) {
      Alert.alert("Patient name required", "Please enter the patient's name.");
      return;
    }

    if (!detectedAddress.trim()) {
      Alert.alert(
        "Location required",
        "Please use your current location or select a saved address.",
      );
      return;
    }

    setStep(3);
  };

  const continueFromStep3 = () => {
    if (urgency === "scheduled" && !isScheduledTimeValid) {
      Alert.alert(
        "Choose a future time",
        "Please select a date and time in the future.",
      );
      return;
    }

    setStep(4);
  };

  const detectLocation = async () => {
    try {
      setDetectingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission",
          "Please allow location access to detect your current address.",
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: lat, longitude: lng } = currentLocation.coords;

      setLatitude(lat);
      setLongitude(lng);

      const addresses = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addresses.length > 0) {
        const address = addresses[0];

        const formatted = [
          address.name,
          address.street,
          address.district,
          address.city,
          address.region,
          address.postalCode,
        ]
          .filter(Boolean)
          .filter((value, index, array) => array.indexOf(value) === index)
          .join(", ");

        setDetectedAddress(formatted);
      }

      setSelectedLocationId("self");
    } catch (error) {
      console.error("Location error:", error);

      Alert.alert(
        "Unable to detect location",
        "Please try again or select a saved address.",
      );
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleAddAddress = () => {
    setShowLocationModal(false);
    router.push("/add");
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);

    if (!selectedDate) {
      return;
    }

    const next = new Date(scheduledDate);

    next.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );

    setScheduledDate(next);

    if (Platform.OS === "android") {
      setTimeout(() => {
        setShowTimePicker(true);
      }, 250);
    }
  };

  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);

    if (!selectedTime) {
      return;
    }

    const next = new Date(scheduledDate);

    next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

    setScheduledDate(next);
  };

  const submitRequest = async () => {
    if (urgency === "scheduled" && !isScheduledTimeValid) {
      Alert.alert(
        "Choose a future time",
        "Please select a date and time in the future.",
      );
      return;
    }

    if (!patientName.trim()) {
      Alert.alert("Patient name required", "Please enter the patient's name.");
      return;
    }

    if (!detectedAddress.trim()) {
      Alert.alert(
        "Location required",
        "Please provide the patient's service location.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const request = await createNurseRequest({
        serviceType: displayedServiceName,
        patientName: patientName.trim(),
        patientAge: null,
        locationAddress: detectedAddress.trim(),
        latitude,
        longitude,
        offeredPrice: 0,
        paymentMethod,
        priority: urgency === "asap" ? "URGENT" : "NORMAL",
        notes: notes.trim() || undefined,
        scheduledFor:
          urgency === "scheduled" ? scheduledDate.toISOString() : undefined,
      });

      router.replace({
        pathname: "/available-professionals",
        params: {
          requestId: request.requestId,
          patientName: request.patientName,
          careType: selectedCare,
          urgency,
        },
      });
    } catch (error: any) {
      console.error("Create nurse request error:", error);

      Alert.alert(
        "Request failed",
        error?.message ||
          "We couldn't create your care request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgress = () => {
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressStep}>Step {step} of 4</Text>

          <Text style={styles.progressHint}>
            {step === 1
              ? "Care needed"
              : step === 2
                ? "Patient & location"
                : step === 3
                  ? "Schedule & payment"
                  : "Review request"}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          {[1, 2, 3, 4].map((item) => (
            <View
              key={item}
              style={[
                styles.progressSegment,
                item <= step && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderStep1 = () => (
    <>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="medical-outline" size={32} color={COLORS.primary} />
        </View>

        <Text style={styles.heroTitle}>What care do you need?</Text>

        <Text style={styles.heroSubtitle}>
          Choose the type of nursing support you need at home.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Care type</Text>

      <View style={styles.careList}>
        {careOptions.map((option) => {
          const selected = selectedCare === option.id;

          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.85}
              onPress={() => setSelectedCare(option.id)}
              style={[styles.careCard, selected && styles.careCardSelected]}
            >
              <View
                style={[styles.careIcon, selected && styles.careIconSelected]}
              >
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={selected ? COLORS.primary : COLORS.textSecondary}
                />
              </View>

              <View style={styles.careContent}>
                <Text
                  style={[
                    styles.careTitle,
                    selected && styles.careTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>

                <Text style={styles.careDescription}>{option.description}</Text>
              </View>

              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedCare === "other" && (
        <View style={styles.otherCareContainer}>
          <Text style={styles.inputLabel}>What kind of care do you need?</Text>

          <TextInput
            value={otherCare}
            onChangeText={setOtherCare}
            placeholder="e.g. Injection, catheter care..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.textInput}
            multiline
            maxLength={120}
          />
        </View>
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.heroCompact}>
        <View style={styles.heroIconSmall}>
          <Ionicons name="person-outline" size={26} color={COLORS.primary} />
        </View>

        <View style={styles.heroCompactContent}>
          <Text style={styles.heroTitleSmall}>Who needs the nurse?</Text>

          <Text style={styles.heroSubtitleSmall}>
            Tell us who we're caring for and where.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Patient</Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowLocationModal(true)}
        style={styles.selectedPersonCard}
      >
        <View style={styles.personAvatar}>
          <Ionicons name="person" size={22} color={COLORS.primary} />
        </View>

        <View style={styles.personInfo}>
          <Text style={styles.personName}>
            {selectedLocation?.name || "Myself"}
          </Text>

          <Text style={styles.personRelation}>
            {selectedLocation?.relationship || "Patient"}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={21} color={COLORS.textMuted} />
      </TouchableOpacity>

      <View style={styles.patientNameContainer}>
        <Text style={styles.inputLabel}>Patient name</Text>

        <TextInput
          value={patientName}
          onChangeText={setPatientName}
          placeholder="Enter patient's name"
          placeholderTextColor={COLORS.textMuted}
          style={styles.textInput}
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowLocationModal(true)}
        style={styles.addAddressButton}
      >
        <View style={styles.addAddressIcon}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </View>

        <View style={styles.addSpace}>
          <Text style={styles.addAddressTitle}>
            Add or select another address
          </Text>

          <Text style={styles.addAddressSubtitle}>
            For family members or saved locations
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Care location</Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={detectLocation}
        disabled={detectingLocation}
        style={[
          styles.locationCard,
          detectedAddress && styles.locationCardDetected,
        ]}
      >
        <View style={styles.locationIcon}>
          <Ionicons name="navigate-outline" size={23} color={COLORS.primary} />
        </View>

        <View style={styles.addSpace}>
          <Text style={styles.locationTitle}>
            {detectingLocation
              ? "Detecting location..."
              : detectedAddress
                ? "Current location"
                : "Use my current location"}
          </Text>

          <Text style={styles.locationSubtitle}>
            {detectedAddress || "We'll use GPS to find the service address"}
          </Text>
        </View>

        <Ionicons
          name={
            detectingLocation
              ? "sync-outline"
              : detectedAddress
                ? "checkmark-circle-outline"
                : "chevron-forward"
          }
          size={20}
          color={detectedAddress ? COLORS.success : COLORS.textMuted}
        />
      </TouchableOpacity>

      {detectedAddress && (
        <View style={styles.detectedAddress}>
          <View style={styles.detectedIcon}>
            <Ionicons name="checkmark" size={15} color={COLORS.success} />
          </View>

          <View style={styles.detectedContent}>
            <Text style={styles.detectedTitle}>Service location</Text>

            <Text style={styles.detectedText}>{detectedAddress}</Text>
          </View>

          <TouchableOpacity onPress={detectLocation} hitSlop={10}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.heroCompact}>
        <View style={styles.heroIconSmall}>
          <Ionicons name="calendar-outline" size={26} color={COLORS.primary} />
        </View>

        <View style={styles.heroCompactContent}>
          <Text style={styles.heroTitleSmall}>When do you need the nurse?</Text>

          <Text style={styles.heroSubtitleSmall}>
            Choose immediate care or plan it for later.
          </Text>
        </View>
      </View>

      <View style={styles.timingContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setUrgency("asap")}
          style={[
            styles.timingCard,
            urgency === "asap" && styles.timingCardSelected,
          ]}
        >
          <View style={styles.timingIcon}>
            <Ionicons name="flash-outline" size={23} color={COLORS.primary} />
          </View>

          <View style={styles.timingContent}>
            <Text style={styles.timingTitle}>As soon as possible</Text>

            <Text style={styles.timingSubtitle}>
              Find an available nurse now
            </Text>
          </View>

          <View
            style={[styles.radio, urgency === "asap" && styles.radioSelected]}
          >
            {urgency === "asap" && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setUrgency("scheduled")}
          style={[
            styles.timingCard,
            urgency === "scheduled" && styles.timingCardSelected,
          ]}
        >
          <View style={styles.timingIcon}>
            <Ionicons
              name="calendar-outline"
              size={23}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.timingContent}>
            <Text style={styles.timingTitle}>Schedule for later</Text>

            <Text style={styles.timingSubtitle}>Choose a date and time</Text>
          </View>

          <View
            style={[
              styles.radio,
              urgency === "scheduled" && styles.radioSelected,
            ]}
          >
            {urgency === "scheduled" && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>
      </View>

      {urgency === "scheduled" && (
        <View style={styles.scheduleBox}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleHeaderIcon}>
              <Ionicons
                name="calendar-outline"
                size={17}
                color={COLORS.primary}
              />
            </View>

            <View>
              <Text style={styles.scheduleTitle}>
                Choose your preferred time
              </Text>

              <Text style={styles.scheduleSubtitle}>
                Select when you'd like care at home
              </Text>
            </View>
          </View>

          <View style={styles.scheduleRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowDatePicker(true)}
              style={styles.dateTimeButton}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.primary}
              />

              <View style={styles.dateTimeText}>
                <Text style={styles.dateTimeLabel}>DATE</Text>

                <Text style={styles.dateTimeValue}>
                  {scheduledDate.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowTimePicker(true)}
              style={styles.dateTimeButton}
            >
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />

              <View style={styles.dateTimeText}>
                <Text style={styles.dateTimeLabel}>TIME</Text>

                <Text style={styles.dateTimeValue}>
                  {scheduledDate.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {!isScheduledTimeValid && (
            <View style={styles.warningBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.warning}
              />

              <Text style={styles.warningText}>
                Please choose a future date and time.
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Estimated care amount</Text>

      <View style={styles.priceCard}>
        <View style={styles.priceIcon}>
          <Ionicons name="wallet-outline" size={24} color={COLORS.success} />
        </View>

        <View style={styles.priceContent}>
          <Text style={styles.priceLabel}>Nursing visit</Text>

          <Text style={styles.priceDescription}>
            Final amount depends on distance and care needs.
          </Text>
        </View>

        <View style={styles.priceValueContainer}>
          <Text style={styles.priceValue}>₹199</Text>
          <Text style={styles.priceTo}>to ₹299</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Payment method</Text>

      <View style={styles.paymentRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setPaymentMethod("UPI")}
          style={[
            styles.paymentCard,
            paymentMethod === "UPI" && styles.paymentCardSelected,
          ]}
        >
          <View style={styles.paymentTopRow}>
            <View style={styles.paymentIcon}>
              <Ionicons
                name="phone-portrait-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>

            <View
              style={[
                styles.radio,
                paymentMethod === "UPI" && styles.radioSelected,
              ]}
            >
              {paymentMethod === "UPI" && <View style={styles.radioDot} />}
            </View>
          </View>

          <Text style={styles.paymentTitle}>UPI</Text>

          <Text style={styles.paymentSubtitle}>Pay digitally</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setPaymentMethod("COD")}
          style={[
            styles.paymentCard,
            paymentMethod === "COD" && styles.paymentCardSelected,
          ]}
        >
          <View style={styles.paymentTopRow}>
            <View style={styles.paymentIcon}>
              <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
            </View>

            <View
              style={[
                styles.radio,
                paymentMethod === "COD" && styles.radioSelected,
              ]}
            >
              {paymentMethod === "COD" && <View style={styles.radioDot} />}
            </View>
          </View>

          <Text style={styles.paymentTitle}>Cash</Text>

          <Text style={styles.paymentSubtitle}>Pay after service</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Additional information
        <Text style={styles.optionalText}>{"  "}Optional</Text>
      </Text>

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything the nurse should know?"
        placeholderTextColor={COLORS.textMuted}
        style={styles.notesInput}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={500}
      />
    </>
  );

  const renderStep4 = () => (
    <>
      <View style={styles.reviewHero}>
        <View style={styles.reviewSuccessIcon}>
          <Ionicons
            name="checkmark-circle-outline"
            size={38}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.reviewHeroTitle}>Review your request</Text>

        <Text style={styles.reviewHeroSubtitle}>
          Please check the details before we find an available nurse near you.
        </Text>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.reviewTitle}>Care details</Text>

            <Text style={styles.reviewSectionHint}>Service requested</Text>
          </View>

          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ReviewRow
          icon="medkit-outline"
          label="Care"
          value={displayedServiceName}
        />
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.reviewTitle}>Patient & location</Text>

            <Text style={styles.reviewSectionHint}>Who and where</Text>
          </View>

          <TouchableOpacity onPress={() => setStep(2)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ReviewRow icon="person-outline" label="Patient" value={patientName} />

        <ReviewRow
          icon="location-outline"
          label="Location"
          value={detectedAddress}
        />
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.reviewTitle}>Schedule & payment</Text>

            <Text style={styles.reviewSectionHint}>
              When and how you'll pay
            </Text>
          </View>

          <TouchableOpacity onPress={() => setStep(3)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ReviewRow
          icon="calendar-outline"
          label="When"
          value={
            urgency === "asap"
              ? "As soon as possible"
              : `${scheduledDate.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}, ${scheduledDate.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
          }
        />

        <ReviewRow
          icon="card-outline"
          label="Payment"
          value={paymentMethod === "UPI" ? "UPI" : "Cash"}
        />

        <ReviewRow icon="wallet-outline" label="Amount" value="₹199 – ₹299" />
      </View>

      {notes.trim() && (
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View>
              <Text style={styles.reviewTitle}>Additional information</Text>

              <Text style={styles.reviewSectionHint}>Note for the nurse</Text>
            </View>

            <TouchableOpacity onPress={() => setStep(3)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.reviewNotes}>{notes.trim()}</Text>
        </View>
      )}

      <View style={styles.finalPriceCard}>
        <View style={styles.finalPriceIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={24}
            color={COLORS.success}
          />
        </View>

        <View style={styles.finalPriceContent}>
          <Text style={styles.finalPriceTitle}>Estimated care amount</Text>

          <Text style={styles.finalPriceSubtitle}>
            Final amount may vary based on distance and care requirements.
          </Text>
        </View>

        <Text style={styles.finalPrice}>₹199–₹299</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={COLORS.info}
          />
        </View>

        <Text style={styles.infoText}>
          After you confirm, we'll show available nursing professionals near
          your service location.
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Care at Home</Text>

          <View style={styles.headerSpacer} />
        </View>

        {renderProgress()}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          <View style={{ height: 105 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          {step === 1 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryButton}
              onPress={continueFromStep1}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>

              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {step === 2 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryButton}
              onPress={continueFromStep2}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>

              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {step === 3 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryButton}
              onPress={continueFromStep3}
            >
              <Text style={styles.primaryButtonText}>Review Request</Text>

              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {step === 4 && (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={submitting}
              style={[
                styles.primaryButton,
                submitting && styles.primaryButtonDisabled,
              ]}
              onPress={submitRequest}
            >
              {submitting ? (
                <>
                  <Ionicons name="sync-outline" size={19} color="#FFFFFF" />

                  <Text style={styles.primaryButtonText}>
                    Finding a Nurse...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={19} color="#FFFFFF" />

                  <Text style={styles.primaryButtonText}>Find a Nurse</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Modal
          visible={showLocationModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLocationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setShowLocationModal(false)}
            />

            <View style={styles.locationModal}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <Text style={styles.modalTitle}>Who needs the nurse?</Text>

                  <Text style={styles.modalSubtitle}>
                    Choose a saved person or address
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowLocationModal(false)}
                  style={styles.modalClose}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: 30,
                }}
              >
                {serviceLocations.map((location) => {
                  const selected = selectedLocationId === location.id;

                  return (
                    <TouchableOpacity
                      key={location.id}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedLocationId(location.id);
                        setPatientName(location.name);

                        if (location.address !== "Use my current location") {
                          setDetectedAddress(location.address);
                        }

                        setShowLocationModal(false);
                      }}
                      style={[
                        styles.modalLocationItem,
                        selected && styles.modalLocationItemSelected,
                      ]}
                    >
                      <View style={styles.modalPersonIcon}>
                        <Ionicons
                          name="person-outline"
                          size={21}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.modalPersonContent}>
                        <Text style={styles.modalPersonName}>
                          {location.name}
                        </Text>

                        <Text style={styles.modalPersonRelation}>
                          {location.relationship || "Patient"}
                        </Text>

                        {location.address !== "Use my current location" && (
                          <Text
                            style={styles.modalPersonAddress}
                            numberOfLines={2}
                          >
                            {location.address}
                          </Text>
                        )}
                      </View>

                      <View
                        style={[styles.radio, selected && styles.radioSelected]}
                      >
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleAddAddress}
                  style={styles.modalAddAddress}
                >
                  <View style={styles.modalAddIcon}>
                    <Ionicons name="add" size={22} color={COLORS.primary} />
                  </View>

                  <View style={styles.modalAddContent}>
                    <Text style={styles.modalAddTitle}>Add new address</Text>

                    <Text style={styles.modalAddSubtitle}>
                      Add a person or service location
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate}
            mode="date"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={scheduledDate}
            mode="time"
            onChange={handleTimeChange}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function ReviewRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIcon}>
        <Ionicons name={icon} size={17} color={COLORS.textSecondary} />
      </View>

      <Text style={styles.reviewLabel}>{label}</Text>

      <Text style={styles.reviewValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    height: 58,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
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
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },

  headerSpacer: {
    width: 40,
  },

  progressContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  progressStep: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  progressHint: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },

  progressTrack: {
    flexDirection: "row",
    gap: 5,
  },

  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },

  progressSegmentActive: {
    backgroundColor: COLORS.primary,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },

  hero: {
    alignItems: "center",
    paddingTop: 5,
    marginBottom: 22,
  },

  heroCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 24,
  },

  heroCompactContent: {
    flex: 1,
  },

  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  heroIconSmall: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  heroSubtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },

  heroTitleSmall: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.text,
  },

  heroSubtitleSmall: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 20,
  },

  careList: {
    gap: 10,
  },

  careCard: {
    minHeight: 86,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  careCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  careIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  careIconSelected: {
    backgroundColor: COLORS.primarySoft,
  },

  careContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  careTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
  },

  careTitleSelected: {
    color: COLORS.text,
  },

  careDescription: {
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: COLORS.primary,
  },

  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },

  otherCareContainer: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
  },

  textInput: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 13,
    fontSize: 14,
    color: COLORS.text,
  },

  patientNameContainer: {
    marginTop: 13,
  },

  selectedPersonCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  personAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  personInfo: {
    flex: 1,
    marginLeft: 12,
  },

  personName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },

  personRelation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  addAddressButton: {
    marginTop: 11,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  addAddressIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  addSpace: {
    flex: 1,
    marginLeft: 14,
  },

  addAddressTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  addAddressSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  locationCard: {
    minHeight: 76,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  locationCardDetected: {
    borderColor: "#BBF7D0",
    backgroundColor: COLORS.successLight,
  },

  locationIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  locationTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  locationSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
    marginTop: 3,
    marginRight: 8,
  },

  detectedAddress: {
    marginTop: 10,
    backgroundColor: COLORS.successLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  detectedIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: COLORS.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  detectedContent: {
    flex: 1,
  },

  detectedTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.successDark,
  },

  detectedText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.successDark,
    marginTop: 2,
  },

  changeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
    marginLeft: 8,
  },

  timingContainer: {
    gap: 10,
  },

  timingCard: {
    minHeight: 78,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  timingCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  timingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  timingContent: {
    flex: 1,
    marginLeft: 11,
  },

  timingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  timingSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  scheduleBox: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },

  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  scheduleHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  scheduleTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },

  scheduleSubtitle: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  scheduleRow: {
    flexDirection: "row",
    gap: 10,
  },

  dateTimeButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  dateTimeText: {
    flex: 1,
  },

  dateTimeLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
  },

  dateTimeValue: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 2,
  },

  warningBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.warningLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  warningText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
  },

  priceCard: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  priceIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  priceContent: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  priceLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.successDark,
  },

  priceDescription: {
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.success,
    marginTop: 3,
  },

  priceValueContainer: {
    alignItems: "flex-end",
  },

  priceValue: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.successDark,
  },

  priceTo: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.success,
    marginTop: 1,
  },

  paymentRow: {
    flexDirection: "row",
    gap: 10,
  },

  paymentCard: {
    flex: 1,
    minHeight: 126,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
  },

  paymentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  paymentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 9,
  },

  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  paymentTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  paymentSubtitle: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  optionalText: {
    fontSize: 10,
    fontWeight: "500",
    color: COLORS.textMuted,
  },

  notesInput: {
    minHeight: 100,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 13,
    color: COLORS.text,
  },

  reviewHero: {
    alignItems: "center",
    paddingTop: 4,
    marginBottom: 20,
  },

  reviewSuccessIcon: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  reviewHeroTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.text,
  },

  reviewHeroSubtitle: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },

  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },

  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  reviewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },

  reviewSectionHint: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  editText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
  },

  reviewIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewLabel: {
    width: 62,
    marginLeft: 8,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  reviewValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textAlign: "right",
  },

  reviewNotes: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
    marginTop: 11,
  },

  finalPriceCard: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  finalPriceIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  finalPriceContent: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  finalPriceTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.successDark,
  },

  finalPriceSubtitle: {
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.success,
    marginTop: 3,
  },

  finalPrice: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.successDark,
  },

  infoCard: {
    padding: 13,
    backgroundColor: COLORS.infoLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIcon: {
    marginRight: 9,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: "#075985",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 12,
  },

  primaryButton: {
    height: 53,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonDisabled: {
    opacity: 0.65,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },

  locationModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.borderStrong,
    marginBottom: 15,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 15,
  },

  modalHeaderContent: {
    flex: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },

  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  modalLocationItem: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  modalLocationItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  modalPersonIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  modalPersonContent: {
    flex: 1,
  },

  modalPersonName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  modalPersonRelation: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  modalPersonAddress: {
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  modalAddAddress: {
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#99F6E4",
    borderStyle: "dashed",
    backgroundColor: COLORS.primaryLight,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  modalAddIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  modalAddContent: {
    flex: 1,
    marginLeft: 14,
  },

  modalAddTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
  },

  modalAddSubtitle: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
});
