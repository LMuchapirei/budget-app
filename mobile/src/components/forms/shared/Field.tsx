import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { fonts } from '../../../theme';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 10,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: colors.stone500,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}
