import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useLock } from '../context/LockContext';
import { fonts } from '../theme';

export function LockScreen() {
  const { colors } = useTheme();
  const { unlock } = useLock();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Try to unlock automatically once when the screen appears
  useEffect(() => {
    // A small timeout ensures the native UI is fully ready to present the FaceID modal
    const t = setTimeout(() => {
      unlock();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <Lock size={32} color={colors.rust} />
      </View>
      <Text style={styles.title}>
        The <Text style={styles.titleEm}>Budget</Text>
      </Text>
      <Text style={styles.subtitle}>App is locked</Text>

      <Pressable onPress={() => unlock()} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
        <Text style={styles.buttonText}>Tap to Unlock</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999, // Ensure it sits on top of everything
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontFamily: fonts.displayLight,
      fontSize: 32,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    titleEm: {
      fontFamily: fonts.displayItalic,
      color: colors.rust,
    },
    subtitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.stone500,
      marginTop: 8,
      marginBottom: 48,
    },
    button: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    buttonText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.paper,
    },
  });
