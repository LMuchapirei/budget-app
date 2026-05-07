import React, { useMemo } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  Bug,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';
import { PRIVACY_POLICY_URL } from '../../services/legal';

interface DataHandlingSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface DataSection {
  Icon: LucideIcon;
  title: string;
  body: string;
}

const SECTIONS: DataSection[] = [
  {
    Icon: Smartphone,
    title: 'Stored on this device',
    body: 'Every transaction, account, budget, goal, and bill lives in your phone\'s local storage. Nothing is uploaded to a server.',
  },
  {
    Icon: ImageIcon,
    title: 'Receipt photos',
    body: 'Photos you attach as bill payment proof are saved inside the app\'s document directory on this device. They are never uploaded.',
  },
  {
    Icon: Globe,
    title: 'Currency exchange rates',
    body: 'When you use multiple currencies the app fetches public exchange rates over the internet. No personal or financial data is sent in those requests.',
  },
  {
    Icon: Bell,
    title: 'Notifications',
    body: 'Bill reminders are scheduled directly with the operating system. They never leave your device and require permission you can revoke at any time.',
  },
  {
    Icon: ShieldCheck,
    title: 'App lock',
    body: 'Biometric and passcode unlocks are handled by Android or iOS. Your fingerprint or face data is never accessible to the app.',
  },
  {
    Icon: Bug,
    title: 'Crash reports — opt-in',
    body: "Off by default. If you turn on diagnostics in Settings, the app sends technical error details (stack traces, device model, app version) to help fix bugs. No transactions, balances, names, or contacts are sent. You can turn it off any time.",
  },
  {
    Icon: ShieldCheck,
    title: 'No ads or third-party trackers',
    body: 'There are no advertising trackers, behavioural analytics, or accounts. The only network calls are exchange-rate lookups and the optional crash reports above.',
  },
];

export function DataHandlingSheet({ visible, onClose }: DataHandlingSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>How your data is handled</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <Text style={styles.intro}>
            The Budget is a local-first app. Here is exactly what happens to the
            information you enter.
          </Text>

          <ScrollView
            contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            {SECTIONS.map(({ Icon, title, body }) => (
              <View key={title} style={styles.row}>
                <View style={styles.iconWrap}>
                  <Icon size={16} color={colors.rust} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowBody}>{body}</Text>
                </View>
              </View>
            ))}

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                The app does not collect personal information, contacts, location,
                or device identifiers. The Play Store data-safety disclosure
                reflects exactly the items above.
              </Text>
            </View>
          </ScrollView>

          <Pressable
            onPress={openPrivacyPolicy}
            style={styles.privacyButton}
            accessibilityRole="link"
          >
            <ExternalLink size={14} color={colors.paper} />
            <Text style={styles.privacyButtonLabel}>Read full privacy policy</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
      borderColor: colors.borderSoft,
      gap: 16,
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
      flex: 1,
      paddingRight: 12,
    },
    intro: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
      lineHeight: 19,
    },
    scroll: {
      maxHeight: 460,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 14,
      color: colors.ink,
    },
    rowBody: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.stone600,
    },
    disclaimer: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.chip,
    },
    disclaimerText: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.stone600,
    },
    privacyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    privacyButtonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
  });
