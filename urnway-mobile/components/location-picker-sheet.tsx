import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, Text } from "@/components/ui";
import { borderRadius, colors, spacing, typography } from "@/constants/design-tokens";
import {
  ApiError,
  fetchLocationSuggestions,
  type LocationSuggestion,
  type LocationSuggestionScope,
} from "@/lib/session";

type LocationPickerSheetProps = {
  visible: boolean;
  title: string;
  scope: LocationSuggestionScope;
  accessToken: string | null | undefined;
  initialValue?: string;
  onClose: () => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  onSubmitText?: (value: string) => void;
};

export default function LocationPickerSheet({
  visible,
  title,
  scope,
  accessToken,
  initialValue,
  onClose,
  onSelect,
  onSubmitText,
}: LocationPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialValue ?? "");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setQuery(initialValue ?? "");
    setSuggestions([]);
    setErrorMessage(null);
  }, [initialValue, visible]);

  useEffect(() => {
    if (!visible || !accessToken) {
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setErrorMessage(null);

    const timeoutId = setTimeout(() => {
      void fetchLocationSuggestions(
        {
          q: trimmed,
          scope,
        },
        accessToken
      )
        .then((results) => {
          if (!isActive) {
            return;
          }

          setSuggestions(results);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          setSuggestions([]);
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Unable to load location suggestions right now."
          );
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });
    }, 220);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [accessToken, query, scope, visible]);

  const placeholder = useMemo(() => {
    if (scope === "flight") {
      return "Search city, airport, or IATA code";
    }

    if (scope === "stay") {
      return "Search city, hotel, or area";
    }

    return "Search place or address";
  }, [scope]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <Pressable
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + spacing[10],
              paddingHorizontal: spacing[3],
              paddingBottom: spacing[3],
            },
          ]}
          onPress={onClose}
        >
          <Pressable style={styles.sheetShell} onPress={() => {}}>
            <View
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, spacing[4]) },
              ]}
            >
              <View style={styles.header}>
                <Text variant="h4">{title}</Text>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onPress={onClose}
                  icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
                />
              </View>

              <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={placeholder}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {isLoading ? (
                <View style={styles.feedbackRow}>
                  <ActivityIndicator color={colors.brand.default} />
                  <Text variant="bodySmall" color="secondary">
                    Loading suggestions...
                  </Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.status.error} />
                  <Text variant="bodySmall" style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <ScrollView
                style={styles.resultsList}
                contentContainerStyle={styles.resultsContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                showsVerticalScrollIndicator={false}
              >
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.id}
                    style={styles.resultRow}
                    onPress={() => {
                      onSelect(suggestion);
                      onClose();
                    }}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons
                        name={
                          scope === "flight"
                            ? "airplane-outline"
                            : scope === "stay"
                              ? "bed-outline"
                              : "location-outline"
                        }
                        size={18}
                        color={colors.brand.default}
                      />
                    </View>
                    <View style={styles.resultCopy}>
                      <Text variant="body" weight="semiBold">
                        {suggestion.primaryText}
                      </Text>
                      {suggestion.secondaryText ? (
                        <Text variant="caption" color="secondary">
                          {suggestion.secondaryText}
                        </Text>
                      ) : (
                        <Text variant="caption" color="tertiary">
                          {suggestion.source === "google"
                            ? "Maps suggestion"
                            : suggestion.source === "liteapi"
                              ? "Hotel inventory suggestion"
                              : scope === "flight"
                                ? "Airport or city match"
                                : "Saved location"}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}

                {!isLoading &&
                !errorMessage &&
                query.trim().length >= 2 &&
                suggestions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text variant="bodySmall" color="secondary" align="center">
                      No suggestions yet. Try a broader city, airport, or address query.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => {
                  const trimmed = query.trim();

                  if (trimmed && onSubmitText) {
                    onSubmitText(trimmed);
                  }

                  onClose();
                }}
              >
                {query.trim() && onSubmitText ? "Use typed location" : "Done"}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: "flex-end",
  },
  sheetShell: {
    width: "100%",
    maxHeight: "100%",
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius["3xl"],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
    minHeight: 380,
    maxHeight: "78%",
    flexShrink: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    minHeight: 56,
    backgroundColor: colors.background.primary,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    paddingVertical: spacing[3],
  },
  resultsList: {
    flex: 1,
    minHeight: 0,
  },
  resultsContent: {
    paddingBottom: spacing[2],
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.subtle,
  },
  resultCopy: {
    flex: 1,
    gap: spacing[1],
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  errorText: {
    color: colors.status.error,
  },
  emptyState: {
    paddingVertical: spacing[5],
  },
});
