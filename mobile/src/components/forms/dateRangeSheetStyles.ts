import { StyleSheet } from 'react-native';
import type { ColorPalette } from '../../context/ThemeContext';
import { fonts } from '../../theme';

export const createDateRangeSheetStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      maxHeight: '88%',
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 20,
      color: colors.ink,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateRowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.inkSoft,
    },
    datePill: {
      backgroundColor: colors.chip,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    datePillText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    resetBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      alignItems: 'center',
      backgroundColor: colors.clay,
    },
    resetLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.3,
    },
    applyBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      alignItems: 'center',
      backgroundColor: colors.ink,
    },
    applyLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.3,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      textAlign: 'center',
      marginTop: -4,
    },
  });
