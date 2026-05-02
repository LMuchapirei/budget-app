import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';
import { Calendar } from './DateRangeSheet';

interface DatePickerSheetProps {
  visible: boolean;
  title: string;
  value?: string;
  min?: string;
  max?: string;
  allowClear?: boolean;
  clearLabel?: string;
  onSelect: (iso: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function clampIso(value: string, min?: string, max?: string) {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function formatDisplay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DatePickerSheet({
  visible,
  title,
  value,
  min,
  max,
  allowClear,
  clearLabel = 'No date',
  onSelect,
  onClear,
  onClose,
}: DatePickerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fallbackDate = useMemo(
    () => clampIso(value || min || todayISO(), min, max),
    [max, min, value],
  );
  const [draftDate, setDraftDate] = useState(fallbackDate);

  useEffect(() => {
    if (visible) {
      setDraftDate(fallbackDate);
    }
  }, [fallbackDate, visible]);

  const handleSelect = (iso: string) => {
    setDraftDate(iso);
    onSelect(iso);
    onClose();
  };

  const handleClear = () => {
    onClear?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.selectedLabel}>{formatDisplay(draftDate)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <Calendar
            selected={draftDate}
            min={min}
            max={max}
            onSelect={handleSelect}
            colors={colors}
          />

          {allowClear ? (
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearLabel}>{clearLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 34,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      maxHeight: '86%',
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      marginTop: -8,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    selectedLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.stone500,
      marginTop: 4,
    },
    clearBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    clearLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
  });
