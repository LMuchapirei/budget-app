import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  tag?: string;
}

function Fallback({ resetError }: { resetError: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong here</Text>
      <Text style={styles.body}>
        This screen hit an unexpected error. Your data is safe — try reloading.
      </Text>
      <Pressable
        onPress={resetError}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <RefreshCw size={14} color={colors.paper} />
        <Text style={styles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function ErrorBoundary({ children, tag }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <Fallback resetError={resetError} />}
      beforeCapture={(scope) => {
        if (tag) scope.setTag('boundary', tag);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 32,
      gap: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: fonts.displayMedium,
      fontSize: 20,
      color: colors.ink,
      textAlign: 'center',
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 320,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.rust,
    },
    buttonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
  });
