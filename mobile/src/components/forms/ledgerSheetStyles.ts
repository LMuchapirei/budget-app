import { StyleSheet } from 'react-native';
import type { ColorPalette } from '../../context/ThemeContext';
import { fonts } from '../../theme';

export const createLedgerSheetStyles = (colors: ColorPalette) =>
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
      borderColor: colors.borderSoft,
      gap: 18,
      maxHeight: '92%',
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
    scroll: {
      maxHeight: 520,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    amountSign: { fontFamily: fonts.displayLight, fontSize: 24, color: colors.stone400 },
    amountInput: {
      flex: 1,
      fontFamily: fonts.displayLight,
      fontSize: 24,
      color: colors.ink,
      paddingVertical: 4,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    chipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    currencyOption: {
      minWidth: 70,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 2,
    },
    currencySymbol: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    currencyCode: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.stone500,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchActive: {
      borderWidth: 2,
      borderColor: colors.ink,
    },
    manageSection: {
      gap: 8,
      paddingTop: 12,
    },
    submit: {
      backgroundColor: colors.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
    },
    submitLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.5,
    },
    dangerPanel: {
      gap: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    dangerTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
      color: colors.ink,
    },
    dangerCopy: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
    },
    dangerActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
    },
    actionBtnGhost: {
      backgroundColor: colors.chip,
    },
    actionBtnDanger: {
      backgroundColor: colors.clay,
    },
    actionBtnLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
    },
    helperFootnote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      textAlign: 'center',
    },
  });
