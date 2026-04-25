import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { TxType, CustomCategory } from '../../types';
import { fonts } from '../../theme';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{
        fontFamily: fonts.bodyMedium,
        fontSize: 10,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: colors.stone500,
      }}>{label}</Text>
      {children}
    </View>
  );
}

interface AddCategorySheetProps {
  type: TxType;
  onClose: () => void;
  onSave: (c: CustomCategory) => void;
}

export function AddCategorySheet({ type: initialType, onClose, onSave }: AddCategorySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedType, setSelectedType] = useState<TxType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!title) return;
    onSave({
      id: Date.now().toString(),
      title,
      description,
      type: selectedType,
      color: colors.rust, // Or random color logic
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>New Category</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={colors.stone500} />
          </Pressable>
        </View>

        <View style={styles.typeToggle}>
          {(['expense', 'income'] as TxType[]).map((t) => {
            const active = selectedType === t;
            const bg =
              active && t === 'income'
                ? colors.moss
                : active && t === 'expense'
                ? colors.clay
                : 'transparent';
            return (
              <Pressable
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typeButton, { backgroundColor: bg }]}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    { color: active ? colors.paper : colors.inkSoft },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Coffee"
            placeholderTextColor={colors.stone400}
            style={styles.input}
          />
        </Field>
        
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this for?"
            placeholderTextColor={colors.stone400}
            style={styles.input}
          />
        </Field>

        <Pressable
          onPress={handleSave}
          disabled={!title}
          style={({ pressed }) => [
            styles.submit,
            !title && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>Save Category</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: 'rgba(139,90,60,0.2)',
      gap: 18,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      marginTop: -8,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    typeToggle: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
    },
    typeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(139,90,60,0.2)',
      color: colors.ink,
    },
    submit: {
      backgroundColor: colors.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
      marginTop: 4,
    },
    submitLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.5,
    },
  });
