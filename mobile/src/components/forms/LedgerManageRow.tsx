import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';

interface LedgerManageRowProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  labelColor?: string;
}

export function LedgerManageRow({
  icon,
  label,
  onPress,
  disabled,
  labelColor,
}: LedgerManageRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: pressed ? colors.chip : colors.paper,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 13,
          color: labelColor ?? colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
