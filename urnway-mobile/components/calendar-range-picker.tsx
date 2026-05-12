import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, Text } from "@/components/ui";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "@/constants/design-tokens";

interface CalendarRangePickerProps {
  visible: boolean;
  startDate: string | null;
  endDate: string | null;
  onConfirm: (startDate: string, endDate: string) => void;
  onClose: () => void;
  title: string;
}

export default function CalendarRangePicker({
  visible,
  startDate,
  endDate,
  onConfirm,
  onClose,
  title,
}: CalendarRangePickerProps) {
  const insets = useSafeAreaInsets();
  const [localStartDate, setLocalStartDate] = useState<string | null>(startDate);
  const [localEndDate, setLocalEndDate] = useState<string | null>(endDate);

  const handleDayPress = (day: DateData) => {
    if (!localStartDate || (localStartDate && localEndDate)) {
      // Start new selection
      setLocalStartDate(day.dateString);
      setLocalEndDate(null);
    } else {
      // Set end date
      if (day.dateString > localStartDate) {
        setLocalEndDate(day.dateString);
      } else {
        // If selected date is before start, swap them
        setLocalEndDate(localStartDate);
        setLocalStartDate(day.dateString);
      }
    }
  };

  const handleConfirm = () => {
    if (localStartDate && localEndDate) {
      onConfirm(localStartDate, localEndDate);
      onClose();
    }
  };

  const handleCancel = () => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
    onClose();
  };

  // Build marked dates
  const markedDates: { [key: string]: any } = {};
  if (localStartDate) {
    markedDates[localStartDate] = {
      startingDay: true,
      color: colors.brand.default,
      textColor: colors.grays.white,
    };
  }
  if (localEndDate) {
    markedDates[localEndDate] = {
      endingDay: true,
      color: colors.brand.default,
      textColor: colors.grays.white,
    };
  }
  if (localStartDate && localEndDate) {
    // Mark all dates in between
    let currentDate = new Date(localStartDate);
    const end = new Date(localEndDate);
    currentDate.setDate(currentDate.getDate() + 1);

    while (currentDate < end) {
      const dateString = currentDate.toISOString().split("T")[0];
      markedDates[dateString] = {
        color: colors.brand.light,
        textColor: colors.text.primary,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable
          style={[
            styles.content,
            { paddingBottom: insets.bottom + spacing[4] },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text variant="h4">{title}</Text>
            <IconButton
              variant="ghost"
              size="sm"
              onPress={handleCancel}
              icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
            />
          </View>

          <Calendar
            current={localStartDate || undefined}
            onDayPress={handleDayPress}
            markingType="period"
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.background.primary,
              calendarBackground: colors.background.primary,
              textSectionTitleColor: colors.text.secondary,
              selectedDayBackgroundColor: colors.brand.default,
              selectedDayTextColor: colors.grays.white,
              todayTextColor: colors.brand.default,
              dayTextColor: colors.text.primary,
              textDisabledColor: colors.text.tertiary,
              monthTextColor: colors.text.primary,
              textMonthFontFamily: typography.fontFamily.semiBold,
              textDayFontFamily: typography.fontFamily.regular,
              textDayHeaderFontFamily: typography.fontFamily.medium,
              textDayFontSize: typography.fontSize.base,
              textMonthFontSize: typography.fontSize.lg,
              textDayHeaderFontSize: typography.fontSize.sm,
            }}
          />

          <View style={styles.footer}>
            <Button
              variant="ghost"
              onPress={handleCancel}
              style={styles.button}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              disabled={!localStartDate || !localEndDate}
              style={styles.button}
            >
              Confirm
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: colors.grays.white,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    padding: spacing[6],
    gap: spacing[4],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    gap: spacing[3],
  },
  button: {
    flex: 1,
  },
});
