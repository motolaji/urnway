import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import DatePickerSheet from "@/components/date-picker-sheet";
import LocationPickerSheet from "@/components/location-picker-sheet";
import { Badge, Button, Card, Chip, IconButton, Input, Text } from "@/components/ui";
import { borderRadius, colors, spacing, typography } from "@/constants/design-tokens";
import {
  ApiError,
  createTripExpense,
  createTripItineraryItem,
  fetchTrip,
  generateTripItineraryDraft,
  type LocationSuggestion,
  type GeneratedTripItineraryDraft,
  type Trip,
  type TripExpense,
  type TripItineraryItem,
  type TripItineraryDraft,
  updateTrip,
  updateTripExpense,
  updateTripItineraryItem,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

const itineraryItemTypes = [
  "flight",
  "hotel",
  "activity",
  "note",
  "transport",
] as const;

const expenseCategories = [
  "flight",
  "hotel",
  "food",
  "transport",
  "activity",
  "misc",
] as const;

type ItineraryItemType = (typeof itineraryItemTypes)[number];
type ExpenseCategory = (typeof expenseCategories)[number];

function formatTokenAmount(value: string, maximumFractionDigits = 2) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(parsed);
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function formatItineraryDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateFieldValue(date: string) {
  if (!date.trim()) {
    return "";
  }

  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortItineraryItems(items: TripItineraryItem[]) {
  return [...items].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function sortExpenses(items: TripExpense[]) {
  return [...items].sort((left, right) => {
    const dateCompare = right.occurredAt.localeCompare(left.occurredAt);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const tripId = typeof params.id === "string" ? params.id : null;
  const { tokens } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [note, setNote] = useState("");
  const [itineraryType, setItineraryType] = useState<ItineraryItemType>("activity");
  const [itineraryTitle, setItineraryTitle] = useState("");
  const [itineraryDate, setItineraryDate] = useState("");
  const [itineraryLocation, setItineraryLocation] = useState("");
  const [itineraryNote, setItineraryNote] = useState("");
  const [editingItineraryItemId, setEditingItineraryItemId] = useState<string | null>(
    null
  );
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("food");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [aiPreferences, setAiPreferences] = useState("");
  const [generatedDraft, setGeneratedDraft] =
    useState<GeneratedTripItineraryDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftActionId, setDraftActionId] = useState<string | "all" | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<
    "startDate" | "endDate" | "itineraryDate" | "expenseDate" | null
  >(null);
  const [showLocationPicker, setShowLocationPicker] = useState<
    "destination" | "itineraryLocation" | null
  >(null);

  function resetItineraryForm(defaultDate = trip?.startDate ?? "") {
    setEditingItineraryItemId(null);
    setItineraryType("activity");
    setItineraryTitle("");
    setItineraryDate(defaultDate);
    setItineraryLocation("");
    setItineraryNote("");
  }

  function resetExpenseForm(defaultDate = trip?.startDate ?? "") {
    setEditingExpenseId(null);
    setExpenseCategory("food");
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseDate(defaultDate);
    setExpenseNote("");
  }

  function applyLocationSelection(
    field: "destination" | "itineraryLocation",
    suggestion: LocationSuggestion
  ) {
    if (field === "destination") {
      setDestination(suggestion.label);
      return;
    }

    setItineraryLocation(suggestion.label);
  }

  function applyTypedLocation(
    field: "destination" | "itineraryLocation",
    value: string
  ) {
    if (field === "destination") {
      setDestination(value);
      return;
    }

    setItineraryLocation(value);
  }

  function applyItineraryItemToTrip(savedItem: TripItineraryItem) {
    setTrip((current) => {
      if (!current) {
        return current;
      }

      const nextItems = sortItineraryItems(
        [...(current.itinerary ?? []).filter((item) => item.id !== savedItem.id), savedItem]
      );

      return {
        ...current,
        itinerary: nextItems,
        itineraryItemCount: nextItems.length,
      };
    });
  }

  function applyExpenseToTrip(savedExpense: TripExpense) {
    setTrip((current) => {
      if (!current) {
        return current;
      }

      const nextExpenses = sortExpenses(
        [...(current.expenses ?? []).filter((item) => item.id !== savedExpense.id), savedExpense]
      );
      const spentAmount = nextExpenses.reduce(
        (sum, expense) => sum + Number.parseFloat(expense.amount || "0"),
        0
      );
      const budgetAmount = Number.parseFloat(current.budgetAmount || "0");
      const remainingAmount = Math.max(budgetAmount - spentAmount, 0);
      const overBudgetAmount = spentAmount > budgetAmount ? spentAmount - budgetAmount : 0;
      const progressPercent =
        budgetAmount > 0 ? Math.min((spentAmount / budgetAmount) * 100, 100) : 0;
      const byCategory = Object.entries(
        nextExpenses.reduce<Record<string, number>>((totals, expense) => {
          totals[expense.category] =
            (totals[expense.category] ?? 0) +
            Number.parseFloat(expense.amount || "0");
          return totals;
        }, {})
      )
        .map(([category, amount]) => ({
          category,
          amount: amount.toFixed(2).replace(/\.00$/, ""),
        }))
        .sort((left, right) => Number.parseFloat(right.amount) - Number.parseFloat(left.amount));

      return {
        ...current,
        expenses: nextExpenses,
        expenseCount: nextExpenses.length,
        spendSummary: {
          budgetAmount: current.budgetAmount,
          spentAmount: spentAmount.toFixed(2).replace(/\.00$/, ""),
          remainingAmount: remainingAmount.toFixed(2).replace(/\.00$/, ""),
          overBudgetAmount: overBudgetAmount.toFixed(2).replace(/\.00$/, ""),
          progressPercent: Number(progressPercent.toFixed(1)),
          currency: current.currency,
          byCategory,
        },
      };
    });
  }

  useEffect(() => {
    if (!tokens?.accessToken || !tripId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const loadedTrip = await fetchTrip(tripId, tokens.accessToken);

        if (!isActive) {
          return;
        }

        setTrip(loadedTrip);
        setTitle(loadedTrip.title);
        setDestination(loadedTrip.destination);
        setStartDate(loadedTrip.startDate);
        setEndDate(loadedTrip.endDate);
        setBudgetAmount(loadedTrip.budgetAmount);
        setNote(loadedTrip.note ?? "");
        setEditingItineraryItemId(null);
        setItineraryType("activity");
        setItineraryTitle("");
        setItineraryDate(loadedTrip.startDate);
        setItineraryLocation("");
        setItineraryNote("");
        setEditingExpenseId(null);
        setExpenseCategory("food");
        setExpenseTitle("");
        setExpenseAmount("");
        setExpenseDate(loadedTrip.startDate);
        setExpenseNote("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load this trip."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [tripId, tokens?.accessToken]);

  async function handleSave() {
    if (!tokens?.accessToken || !tripId || !trip || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const updatedTrip = await updateTrip(
        tripId,
        {
          title: title.trim(),
          destination: destination.trim(),
          startDate: startDate.trim(),
          endDate: endDate.trim(),
          budgetAmount: budgetAmount.trim(),
          note: note,
        },
        tokens.accessToken
      );

      setTrip(updatedTrip);
      setTitle(updatedTrip.title);
      setDestination(updatedTrip.destination);
      setStartDate(updatedTrip.startDate);
      setEndDate(updatedTrip.endDate);
      setBudgetAmount(updatedTrip.budgetAmount);
      setNote(updatedTrip.note ?? "");
      setStatusMessage("Trip updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not update this trip."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveItineraryItem() {
    if (!tokens?.accessToken || !tripId || !trip || isSavingItinerary) {
      return;
    }

    if (!itineraryTitle.trim() || !itineraryDate.trim()) {
      setErrorMessage("Enter an itinerary title and date before saving.");
      return;
    }

    setIsSavingItinerary(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const savedItem = editingItineraryItemId
        ? await updateTripItineraryItem(
            tripId,
            editingItineraryItemId,
            {
              type: itineraryType,
              title: itineraryTitle.trim(),
              date: itineraryDate.trim(),
              location: itineraryLocation.trim() || undefined,
              note: itineraryNote.trim() || undefined,
            },
            tokens.accessToken
          )
        : await createTripItineraryItem(
            tripId,
            {
              type: itineraryType,
              title: itineraryTitle.trim(),
              date: itineraryDate.trim(),
              location: itineraryLocation.trim() || undefined,
              note: itineraryNote.trim() || undefined,
            },
            tokens.accessToken
          );

      applyItineraryItemToTrip(savedItem);

      resetItineraryForm(trip.startDate);
      setStatusMessage(
        editingItineraryItemId ? "Itinerary item updated." : "Itinerary item added."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not save this itinerary item."
      );
    } finally {
      setIsSavingItinerary(false);
    }
  }

  async function handleGenerateDraft() {
    if (!tokens?.accessToken || !tripId || isGeneratingDraft) {
      return;
    }

    setIsGeneratingDraft(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const draft = await generateTripItineraryDraft(
        tripId,
        {
          preferences: aiPreferences.trim() || undefined,
        },
        tokens.accessToken
      );

      setGeneratedDraft(draft);
      setStatusMessage("AI itinerary draft ready for review.");
    } catch (error) {
      setGeneratedDraft(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not generate an AI itinerary draft."
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function handleAcceptDraftItem(draftItem: TripItineraryDraft) {
    if (!tokens?.accessToken || !tripId || draftActionId) {
      return;
    }

    setDraftActionId(draftItem.draftId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const savedItem = await createTripItineraryItem(
        tripId,
        {
          type: draftItem.type,
          title: draftItem.title,
          date: draftItem.date,
          location: draftItem.location ?? undefined,
          note: draftItem.note ?? undefined,
        },
        tokens.accessToken
      );

      applyItineraryItemToTrip(savedItem);
      setGeneratedDraft((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.draftId !== draftItem.draftId),
            }
          : current
      );
      setStatusMessage("Draft item added to your itinerary.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not add that draft item."
      );
    } finally {
      setDraftActionId(null);
    }
  }

  async function handleAcceptAllDraftItems() {
    if (!tokens?.accessToken || !tripId || !generatedDraft || draftActionId) {
      return;
    }

    setDraftActionId("all");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      for (const draftItem of generatedDraft.items) {
        const savedItem = await createTripItineraryItem(
          tripId,
          {
            type: draftItem.type,
            title: draftItem.title,
            date: draftItem.date,
            location: draftItem.location ?? undefined,
            note: draftItem.note ?? undefined,
          },
          tokens.accessToken
        );

        applyItineraryItemToTrip(savedItem);
      }

      setGeneratedDraft((current) => (current ? { ...current, items: [] } : current));
      setStatusMessage("All draft items were added to your itinerary.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not apply the AI itinerary draft."
      );
    } finally {
      setDraftActionId(null);
    }
  }

  function handleLoadDraftIntoForm(draftItem: TripItineraryDraft) {
    setEditingItineraryItemId(null);
    setItineraryType(draftItem.type);
    setItineraryTitle(draftItem.title);
    setItineraryDate(draftItem.date);
    setItineraryLocation(draftItem.location ?? "");
    setItineraryNote(draftItem.note ?? "");
    setErrorMessage(null);
    setStatusMessage("Draft copied into the manual itinerary form.");
  }

  function handleDiscardDraftItem(draftItemId: string) {
    setGeneratedDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.draftId !== draftItemId),
          }
        : current
    );
  }

  async function handleSaveExpense() {
    if (!tokens?.accessToken || !tripId || !trip || isSavingExpense) {
      return;
    }

    if (!expenseTitle.trim() || !expenseAmount.trim() || !expenseDate.trim()) {
      setErrorMessage("Enter an expense title, amount, and date before saving.");
      return;
    }

    setIsSavingExpense(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const savedExpense = editingExpenseId
        ? await updateTripExpense(
            tripId,
            editingExpenseId,
            {
              category: expenseCategory,
              title: expenseTitle.trim(),
              amount: expenseAmount.trim(),
              occurredAt: expenseDate.trim(),
              note: expenseNote.trim() || undefined,
            },
            tokens.accessToken
          )
        : await createTripExpense(
            tripId,
            {
              category: expenseCategory,
              title: expenseTitle.trim(),
              amount: expenseAmount.trim(),
              occurredAt: expenseDate.trim(),
              note: expenseNote.trim() || undefined,
            },
            tokens.accessToken
          );

      applyExpenseToTrip(savedExpense);
      resetExpenseForm(trip.startDate);
      setStatusMessage(editingExpenseId ? "Expense updated." : "Expense added.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not save this expense."
      );
    } finally {
      setIsSavingExpense(false);
    }
  }

  function handleEditItineraryItem(item: TripItineraryItem) {
    setEditingItineraryItemId(item.id);
    setItineraryType(item.type);
    setItineraryTitle(item.title);
    setItineraryDate(item.date);
    setItineraryLocation(item.location ?? "");
    setItineraryNote(item.note ?? "");
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function handleEditExpense(expense: TripExpense) {
    setEditingExpenseId(expense.id);
    setExpenseCategory(expense.category);
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount);
    setExpenseDate(expense.occurredAt);
    setExpenseNote(expense.note ?? "");
    setErrorMessage(null);
    setStatusMessage(null);
  }

  const itineraryGroups = sortItineraryItems(trip?.itinerary ?? []).reduce<
    { date: string; items: TripItineraryItem[] }[]
  >((groups, item) => {
    const currentGroup = groups[groups.length - 1];

    if (currentGroup && currentGroup.date === item.date) {
      currentGroup.items.push(item);
      return groups;
    }

    groups.push({
      date: item.date,
      items: [item],
    });
    return groups;
  }, []);

  return (
    <BlurScrollScreen title="Trip" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text variant="eyebrow">Trip</Text>
          <Text variant="h3">{trip?.title ?? "Trip detail"}</Text>
          <Text variant="bodySmall" color="secondary">
            Edit the core plan here. Itinerary blocks, bookings, and spend tracking come next.
          </Text>
        </View>
        <IconButton
          variant="outlined"
          size="md"
          icon={<Ionicons name="chevron-back" size={20} color={colors.text.secondary} />}
          onPress={() => router.back()}
        />
      </View>

      {isLoading ? (
        <Card variant="default" style={styles.loadingCard}>
          <ActivityIndicator color={colors.brand.default} />
          <Text variant="bodySmall" color="secondary">
            Loading this trip...
          </Text>
        </Card>
      ) : errorMessage && !trip ? (
        <Card variant="outlined" style={styles.feedbackCard}>
          <Text variant="h4">Could not load trip</Text>
          <Text variant="bodySmall" color="secondary">
            {errorMessage}
          </Text>
        </Card>
      ) : trip ? (
        <>
          <Card variant="elevated" style={styles.summaryCard}>
            <View style={styles.badgeRow}>
              <Badge
                variant={
                  trip.lifecycle === "active"
                    ? "success"
                    : trip.lifecycle === "completed"
                      ? "default"
                      : "info"
                }
              >
                {trip.lifecycle}
              </Badge>
              <Badge variant="warning">Planning</Badge>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Destination
                </Text>
                <Text variant="body" weight="semiBold">
                  {trip.destination}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Dates
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatDateRange(trip.startDate, trip.endDate)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Budget
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(trip.budgetAmount)} {trip.currency}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Itinerary items
                </Text>
                <Text variant="body" weight="semiBold">
                  {trip.itineraryItemCount ?? trip.itinerary?.length ?? 0}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Spent
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(trip.spendSummary?.spentAmount ?? "0")} {trip.currency}
                </Text>
              </View>
            </View>
          </Card>

          {errorMessage ? (
            <Card variant="outlined" style={styles.feedbackCard}>
              <Text variant="h4">Could not save</Text>
              <Text variant="bodySmall" color="secondary">
                {errorMessage}
              </Text>
            </Card>
          ) : null}

          {statusMessage ? (
            <Card variant="filled" style={styles.feedbackCard}>
              <Text variant="h4">Saved</Text>
              <Text variant="bodySmall" color="secondary">
                {statusMessage}
              </Text>
            </Card>
          ) : null}

          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">Trip details</Text>
              <Text variant="bodySmall" color="secondary">
                Keep the core plan accurate before booking and group features arrive.
              </Text>
            </View>

            <Input
              label="Trip name"
              value={title}
              onChangeText={setTitle}
            />
            <View style={styles.fieldGroup}>
              <Text variant="label">Destination</Text>
              <Pressable
                style={styles.pickerField}
                onPress={() => setShowLocationPicker("destination")}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.text.tertiary}
                />
                <Text
                  variant="body"
                  style={destination ? styles.pickerFieldText : styles.pickerFieldPlaceholder}
                  numberOfLines={1}
                >
                  {destination || "Choose destination or address"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.inlineInputs}>
              <View style={[styles.fieldGroup, styles.inlineInput]}>
                <Text variant="label">Start date</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setShowDatePicker("startDate")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.text.tertiary}
                  />
                  <Text
                    variant="body"
                    style={startDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder}
                  >
                    {formatDateFieldValue(startDate) || "Select start date"}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.fieldGroup, styles.inlineInput]}>
                <Text variant="label">End date</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setShowDatePicker("endDate")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.text.tertiary}
                  />
                  <Text
                    variant="body"
                    style={endDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder}
                  >
                    {formatDateFieldValue(endDate) || "Select end date"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Input
              label="Budget (MUSD)"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="decimal-pad"
            />
            <Input
              label="Trip note"
              value={note}
              onChangeText={setNote}
              placeholder="Hotel notes, transport plan, or itinerary summary"
            />

            <Button
              variant="secondary"
              fullWidth
              loading={isSaving}
              onPress={() => void handleSave()}
            >
              Save changes
            </Button>
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">Budget and expenses</Text>
              <Text variant="bodySmall" color="secondary">
                Track trip spend against budget before shared expenses and bookings land.
              </Text>
            </View>

            <Card variant="filled" style={styles.expenseSummaryCard}>
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text variant="caption" color="tertiary">
                    Budget
                  </Text>
                  <Text variant="body" weight="semiBold">
                    {formatTokenAmount(trip.spendSummary?.budgetAmount ?? trip.budgetAmount)} {trip.currency}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text variant="caption" color="tertiary">
                    Spent
                  </Text>
                  <Text variant="body" weight="semiBold">
                    {formatTokenAmount(trip.spendSummary?.spentAmount ?? "0")} {trip.currency}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text variant="caption" color="tertiary">
                    Remaining
                  </Text>
                  <Text variant="body" weight="semiBold">
                    {formatTokenAmount(trip.spendSummary?.remainingAmount ?? trip.budgetAmount)} {trip.currency}
                  </Text>
                </View>
              </View>

              <Text variant="caption" color="tertiary">
                {trip.spendSummary?.progressPercent ?? 0}% of budget used
                {(trip.spendSummary?.overBudgetAmount ?? "0") !== "0"
                  ? ` · Over by ${formatTokenAmount(trip.spendSummary?.overBudgetAmount ?? "0")} ${trip.currency}`
                  : ""}
              </Text>

              {(trip.spendSummary?.byCategory?.length ?? 0) > 0 ? (
                <View style={styles.expenseCategoryList}>
                  {trip.spendSummary?.byCategory.map((entry) => (
                    <View key={entry.category} style={styles.expenseCategoryRow}>
                      <Badge variant="info">{entry.category}</Badge>
                      <Text variant="bodySmall" color="secondary">
                        {formatTokenAmount(entry.amount)} {trip.currency}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>

            <View style={styles.chipRow}>
              {expenseCategories.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  selected={expenseCategory === category}
                  onPress={() => setExpenseCategory(category)}
                />
              ))}
            </View>

            <Input
              label="Expense title"
              value={expenseTitle}
              onChangeText={setExpenseTitle}
              placeholder="Airport train"
            />
            <View style={styles.inlineInputs}>
              <Input
                label="Amount"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="decimal-pad"
                placeholder="24"
                containerStyle={styles.inlineInput}
              />
              <View style={[styles.fieldGroup, styles.inlineInput]}>
                <Text variant="label">Date</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setShowDatePicker("expenseDate")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.text.tertiary}
                  />
                  <Text
                    variant="body"
                    style={expenseDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder}
                  >
                    {formatDateFieldValue(expenseDate) || "Select expense date"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Input
              label="Note"
              value={expenseNote}
              onChangeText={setExpenseNote}
              placeholder="One-way train from airport"
            />

            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                fullWidth
                loading={isSavingExpense}
                onPress={() => void handleSaveExpense()}
                style={styles.flexButton}
              >
                {editingExpenseId ? "Update expense" : "Add expense"}
              </Button>
              {editingExpenseId ? (
                <Button
                  variant="ghost"
                  onPress={() => resetExpenseForm(trip.startDate)}
                  style={styles.flexButton}
                >
                  Cancel edit
                </Button>
              ) : null}
            </View>

            {(trip.expenses?.length ?? 0) > 0 ? (
              <View style={styles.expenseList}>
                {trip.expenses?.map((expense) => (
                  <Card key={expense.id} variant="filled" style={styles.expenseCard}>
                    <View style={styles.expenseCardHeader}>
                      <View style={styles.expenseCardTitleBlock}>
                        <View style={styles.itineraryItemHeader}>
                          <Badge variant="default">{expense.category}</Badge>
                          <Text variant="body" weight="semiBold">
                            {expense.title}
                          </Text>
                        </View>
                        <Text variant="bodySmall" color="secondary">
                          {formatItineraryDate(expense.occurredAt)}
                          {expense.note ? ` · ${expense.note}` : ""}
                        </Text>
                      </View>
                      <View style={styles.expenseCardActions}>
                        <Text variant="body" weight="semiBold">
                          {formatTokenAmount(expense.amount)} {expense.currency}
                        </Text>
                        <Button
                          variant="ghost"
                          onPress={() => handleEditExpense(expense)}
                        >
                          Edit
                        </Button>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Text variant="bodySmall" color="secondary">
                No expenses yet. Start logging transport, food, hotel, and activity costs here.
              </Text>
            )}
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">AI draft</Text>
              <Text variant="bodySmall" color="secondary">
                Generate a first-pass itinerary from the trip details, then review before adding it.
              </Text>
            </View>

            <Input
              label="AI preferences"
              value={aiPreferences}
              onChangeText={setAiPreferences}
              placeholder="Food focus, slow pace, family friendly, beach first..."
              hint="Optional. Use this to steer the draft without changing the saved trip."
            />

            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                fullWidth
                loading={isGeneratingDraft}
                onPress={() => void handleGenerateDraft()}
                style={styles.flexButton}
              >
                {generatedDraft ? "Regenerate draft" : "Generate draft"}
              </Button>
              {generatedDraft ? (
                <Button
                  variant="ghost"
                  onPress={() => setGeneratedDraft(null)}
                  style={styles.flexButton}
                >
                  Clear draft
                </Button>
              ) : null}
            </View>

            {generatedDraft ? (
              <Card variant="filled" style={styles.aiDraftCard}>
                <View style={styles.aiDraftHeader}>
                  <View style={styles.aiDraftHeaderCopy}>
                    <Text variant="h4">Review AI itinerary</Text>
                    <Text variant="bodySmall" color="secondary">
                      {generatedDraft.summary}
                    </Text>
                    <Text variant="caption" color="tertiary">
                      {generatedDraft.items.length} draft items from {generatedDraft.model}
                      {generatedDraft.droppedItemCount > 0
                        ? ` · ${generatedDraft.droppedItemCount} out-of-range item(s) dropped`
                        : ""}
                    </Text>
                  </View>
                  <Badge variant="info">{generatedDraft.items.length}</Badge>
                </View>

                {generatedDraft.items.length > 0 ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    loading={draftActionId === "all"}
                    onPress={() => void handleAcceptAllDraftItems()}
                  >
                    Accept all
                  </Button>
                ) : (
                  <Text variant="bodySmall" color="secondary">
                    No draft items left to review.
                  </Text>
                )}

                <View style={styles.generatedDraftList}>
                  {generatedDraft.items.map((item) => (
                    <Card key={item.draftId} variant="default" style={styles.generatedDraftItem}>
                      <View style={styles.itineraryItemHeader}>
                        <Badge variant="default">{item.type}</Badge>
                        <Text variant="body" weight="semiBold">
                          {item.title}
                        </Text>
                      </View>
                      <Text variant="bodySmall" color="secondary">
                        {formatItineraryDate(item.date)}
                        {item.location ? ` · ${item.location}` : ""}
                      </Text>
                      {item.note ? (
                        <Text variant="bodySmall" color="secondary">
                          {item.note}
                        </Text>
                      ) : null}
                      <View style={styles.generatedDraftActions}>
                        <Button
                          variant="secondary"
                          onPress={() => void handleAcceptDraftItem(item)}
                          loading={draftActionId === item.draftId}
                          style={styles.generatedDraftActionButton}
                        >
                          Add
                        </Button>
                        <Button
                          variant="outline"
                          onPress={() => handleLoadDraftIntoForm(item)}
                          style={styles.generatedDraftActionButton}
                        >
                          Edit in form
                        </Button>
                        <Button
                          variant="ghost"
                          onPress={() => handleDiscardDraftItem(item.draftId)}
                          style={styles.generatedDraftActionButton}
                        >
                          Discard
                        </Button>
                      </View>
                    </Card>
                  ))}
                </View>
              </Card>
            ) : null}
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">Itinerary</Text>
              <Text variant="bodySmall" color="secondary">
                Add day-by-day travel blocks now. Bookings and richer timelines can layer on later.
              </Text>
            </View>

            <View style={styles.chipRow}>
              {itineraryItemTypes.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  selected={itineraryType === type}
                  onPress={() => setItineraryType(type)}
                />
              ))}
            </View>

            <Input
              label="Itinerary title"
              value={itineraryTitle}
              onChangeText={setItineraryTitle}
              placeholder="Flight to Barcelona"
            />
            <View style={styles.inlineInputs}>
              <View style={[styles.fieldGroup, styles.inlineInput]}>
                <Text variant="label">Date</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setShowDatePicker("itineraryDate")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.text.tertiary}
                  />
                  <Text
                    variant="body"
                    style={
                      itineraryDate ? styles.pickerFieldText : styles.pickerFieldPlaceholder
                    }
                  >
                    {formatDateFieldValue(itineraryDate) || "Select itinerary date"}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.fieldGroup, styles.inlineInput]}>
                <Text variant="label">Location</Text>
                <Pressable
                  style={styles.pickerField}
                  onPress={() => setShowLocationPicker("itineraryLocation")}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={18}
                    color={colors.text.tertiary}
                  />
                  <Text
                    variant="body"
                    style={
                      itineraryLocation
                        ? styles.pickerFieldText
                        : styles.pickerFieldPlaceholder
                    }
                    numberOfLines={1}
                  >
                    {itineraryLocation || "Choose place or address"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <Input
              label="Note"
              value={itineraryNote}
              onChangeText={setItineraryNote}
              placeholder="Gate opens 90 minutes before departure"
            />

            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                fullWidth
                loading={isSavingItinerary}
                onPress={() => void handleSaveItineraryItem()}
                style={styles.flexButton}
              >
                {editingItineraryItemId ? "Update item" : "Add item"}
              </Button>
              {editingItineraryItemId ? (
                <Button
                  variant="ghost"
                  onPress={() => resetItineraryForm(trip.startDate)}
                  style={styles.flexButton}
                >
                  Cancel edit
                </Button>
              ) : null}
            </View>
          </Card>

          <Card variant="outlined" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">Day-by-day plan</Text>
              <Text variant="bodySmall" color="secondary">
                Tap any item to edit it in place.
              </Text>
            </View>

            {itineraryGroups.length === 0 ? (
              <Text variant="bodySmall" color="secondary">
                No itinerary items yet. Start with flights, hotels, activities, or transport.
              </Text>
            ) : (
              <View style={styles.itineraryGroupList}>
                {itineraryGroups.map((group) => (
                  <View key={group.date} style={styles.itineraryGroup}>
                    <View style={styles.itineraryGroupHeader}>
                      <Text variant="h4">{formatItineraryDate(group.date)}</Text>
                      <Badge variant="info">{group.items.length}</Badge>
                    </View>

                    <View style={styles.itineraryItemList}>
                      {group.items.map((item) => (
                        <Button
                          key={item.id}
                          variant="ghost"
                          onPress={() => handleEditItineraryItem(item)}
                          style={styles.itineraryItemButton}
                          textStyle={styles.itineraryItemButtonText}
                        >
                          {item.title}
                        </Button>
                      ))}
                    </View>

                    {group.items.map((item) => (
                      <Card key={`${group.date}-${item.id}`} variant="filled" style={styles.itineraryItemCard}>
                        <View style={styles.itineraryItemHeader}>
                          <Badge variant="default">{item.type}</Badge>
                          <Text variant="body" weight="semiBold">
                            {item.title}
                          </Text>
                        </View>
                        {item.location ? (
                          <Text variant="bodySmall" color="secondary">
                            {item.location}
                          </Text>
                        ) : null}
                        {item.note ? (
                          <Text variant="bodySmall" color="secondary">
                            {item.note}
                          </Text>
                        ) : null}
                      </Card>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      ) : null}

      <DatePickerSheet
        visible={showDatePicker !== null}
        title={
          showDatePicker === "startDate"
            ? "Trip start date"
            : showDatePicker === "endDate"
              ? "Trip end date"
              : showDatePicker === "itineraryDate"
                ? "Itinerary date"
                : "Expense date"
        }
        value={
          showDatePicker === "startDate"
            ? startDate
            : showDatePicker === "endDate"
              ? endDate
              : showDatePicker === "itineraryDate"
                ? itineraryDate
                : expenseDate
        }
        minimumDate={
          showDatePicker === "endDate"
            ? startDate || undefined
            : showDatePicker === "itineraryDate" || showDatePicker === "expenseDate"
              ? startDate || trip?.startDate || undefined
              : undefined
        }
        maximumDate={
          showDatePicker === "startDate"
            ? endDate || undefined
            : showDatePicker === "itineraryDate" || showDatePicker === "expenseDate"
              ? endDate || trip?.endDate || undefined
              : undefined
        }
        onClose={() => setShowDatePicker(null)}
        onConfirm={(nextValue) => {
          if (showDatePicker === "startDate") {
            setStartDate(nextValue);
            if (endDate && nextValue > endDate) {
              setEndDate(nextValue);
            }
            return;
          }

          if (showDatePicker === "endDate") {
            setEndDate(nextValue);
            return;
          }

          if (showDatePicker === "itineraryDate") {
            setItineraryDate(nextValue);
            return;
          }

          setExpenseDate(nextValue);
        }}
      />

      <LocationPickerSheet
        visible={showLocationPicker !== null}
        title={
          showLocationPicker === "destination"
            ? "Search destination"
            : "Search itinerary location"
        }
        scope="trip"
        accessToken={tokens?.accessToken}
        initialValue={
          showLocationPicker === "destination" ? destination : itineraryLocation
        }
        onClose={() => setShowLocationPicker(null)}
        onSelect={(suggestion) => {
          if (showLocationPicker) {
            applyLocationSelection(showLocationPicker, suggestion);
          }
        }}
        onSubmitText={(value) => {
          if (showLocationPicker) {
            applyTypedLocation(showLocationPicker, value);
          }
        }}
      />
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing[4],
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing[2],
  },
  summaryCard: {
    gap: spacing[4],
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  metricRow: {
    gap: spacing[3],
  },
  metricItem: {
    gap: spacing[1],
  },
  feedbackCard: {
    gap: spacing[2],
  },
  loadingCard: {
    gap: spacing[3],
    alignItems: "center",
  },
  sectionCard: {
    gap: spacing[4],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  sectionHeader: {
    gap: spacing[1.5],
  },
  inlineInputs: {
    flexDirection: "row",
    gap: spacing[3],
  },
  inlineInput: {
    flex: 1,
  },
  fieldGroup: {
    gap: spacing[2],
  },
  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  pickerFieldText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerFieldPlaceholder: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  aiDraftCard: {
    gap: spacing[4],
  },
  expenseSummaryCard: {
    gap: spacing[3],
  },
  expenseCategoryList: {
    gap: spacing[2],
  },
  expenseCategoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiDraftHeader: {
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  aiDraftHeaderCopy: {
    flex: 1,
    gap: spacing[1.5],
  },
  flexButton: {
    flex: 1,
  },
  generatedDraftList: {
    gap: spacing[3],
  },
  generatedDraftItem: {
    gap: spacing[3],
  },
  generatedDraftActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  generatedDraftActionButton: {
    flexGrow: 1,
  },
  expenseList: {
    gap: spacing[3],
  },
  expenseCard: {
    gap: spacing[2],
  },
  expenseCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  expenseCardTitleBlock: {
    flex: 1,
    gap: spacing[1.5],
  },
  expenseCardActions: {
    alignItems: "flex-end",
    gap: spacing[1.5],
  },
  itineraryGroupList: {
    gap: spacing[4],
  },
  itineraryGroup: {
    gap: spacing[3],
  },
  itineraryGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itineraryItemList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  itineraryItemButton: {
    minHeight: 40,
  },
  itineraryItemButtonText: {
    textTransform: "capitalize",
  },
  itineraryItemCard: {
    gap: spacing[2],
  },
  itineraryItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
});
