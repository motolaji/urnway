import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, Text } from "@/components/ui";
import { borderRadius, colors, spacing } from "@/constants/design-tokens";

type DatePickerSheetProps = {
  visible: boolean;
  title: string;
  value?: string | null;
  minimumDate?: string | null;
  maximumDate?: string | null;
  onClose: () => void;
  onConfirm: (nextValue: string) => void;
};

function parseIsoDate(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function DatePickerSheet({
  visible,
  title,
  value,
  minimumDate,
  maximumDate,
  onClose,
  onConfirm,
}: DatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [draftDate, setDraftDate] = useState(parseIsoDate(value));

  useEffect(() => {
    if (visible) {
      setDraftDate(parseIsoDate(value));
    }
  }, [value, visible]);

  const minDate = useMemo(() => parseIsoDate(minimumDate), [minimumDate]);
  const maxDate = useMemo(
    () => (maximumDate ? parseIsoDate(maximumDate) : undefined),
    [maximumDate]
  );

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android" && event.type === "dismissed") {
      onClose();
      return;
    }

    if (selectedDate) {
      if (Platform.OS === "android") {
        onConfirm(toIsoDate(selectedDate));
        onClose();
        return;
      }

      setDraftDate(selectedDate);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
          <View style={styles.header}>
            <Text variant="h4">{title}</Text>
            <IconButton
              variant="ghost"
              size="sm"
              onPress={onClose}
              icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
            />
          </View>

          <View style={styles.previewCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.brand.default} />
            <Text variant="body" weight="semiBold">
              {draftDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>

          <View style={styles.pickerCard}>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={handleChange}
            />
          </View>

          <View style={styles.footer}>
            <Button variant="secondary" size="lg" fullWidth onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                onConfirm(toIsoDate(draftDate));
                onClose();
              }}
            >
              Confirm date
            </Button>
          </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius["3xl"],
    borderTopRightRadius: borderRadius["3xl"],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.subtle,
  },
  pickerCard: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.secondary,
    overflow: "hidden",
  },
  footer: {
    gap: spacing[3],
  },
});
