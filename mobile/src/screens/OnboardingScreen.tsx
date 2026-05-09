import React, { useMemo, useRef, useState } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowRight,
  ExternalLink,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme';
import { PRIVACY_POLICY_URL } from '../services/legal';
import { DataHandlingSheet } from '../components/forms/DataHandlingSheet';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface Slide {
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    Icon: Wallet,
    eyebrow: 'Welcome',
    title: 'Take control of your money.',
    body: 'The Budget keeps every transaction on your device, never on a server. No accounts, no trackers, no surprises.',
  },
  {
    Icon: TrendingUp,
    eyebrow: 'Track',
    title: 'Track every move.',
    body: 'Log income and expenses across multiple accounts and currencies. Filter by date, search by description, see daily cash flow.',
  },
  {
    Icon: Target,
    eyebrow: 'Plan',
    title: 'Plan ahead.',
    body: 'Set monthly budgets, savings goals, and bill reminders. Project your finances 12 months out and stay ahead of due dates.',
  },
  {
    Icon: Sparkles,
    eyebrow: 'Privacy first',
    title: 'Your data is yours.',
    body: 'Read how your information is handled and review the privacy policy before you begin.',
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(0);
  const [showDataSheet, setShowDataSheet] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const lastIndex = SLIDES.length - 1;
  const isLast = page === lastIndex;

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(lastIndex, index));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {!isLast ? (
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skipButton}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => {
          const Icon = slide.Icon;
          const isPrivacy = i === lastIndex;
          return (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <View style={styles.iconHero}>
                <Icon size={36} color={colors.rust} strokeWidth={1.4} />
              </View>
              <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>

              {isPrivacy ? (
                <View style={styles.privacyBlock}>
                  <Pressable
                    onPress={() => setShowDataSheet(true)}
                    style={({ pressed }) => [
                      styles.linkButton,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Sparkles size={14} color={colors.rust} />
                    <Text style={styles.linkLabel}>How your data is handled</Text>
                  </Pressable>
                  <Pressable
                    onPress={openPrivacyPolicy}
                    style={({ pressed }) => [
                      styles.linkButton,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <ExternalLink size={14} color={colors.rust} />
                    <Text style={styles.linkLabel}>Privacy policy</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page && {
                  backgroundColor: colors.rust,
                  width: 18,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={isLast ? onComplete : () => goTo(page + 1)}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.ctaLabel}>{isLast ? 'Get started' : 'Next'}</Text>
          <ArrowRight size={16} color={colors.paper} />
        </Pressable>
      </View>

      <DataHandlingSheet
        visible={showDataSheet}
        onClose={() => setShowDataSheet(false)}
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.paper,
      paddingTop: 48,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      minHeight: 28,
    },
    skipButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    skipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.stone500,
      letterSpacing: 0.4,
    },
    scroll: {
      flex: 1,
    },
    slide: {
      paddingHorizontal: 32,
      paddingTop: 36,
      paddingBottom: 24,
      gap: 14,
      alignItems: 'flex-start',
    },
    iconHero: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.cream,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    eyebrow: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    title: {
      fontFamily: fonts.displayLight,
      fontSize: 34,
      color: colors.ink,
      letterSpacing: -0.5,
      lineHeight: 40,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.stone600,
    },
    privacyBlock: {
      marginTop: 12,
      gap: 10,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.cream,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignSelf: 'flex-start',
    },
    linkLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.rust,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginBottom: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.borderSoft,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    ctaLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.paper,
      letterSpacing: 0.4,
    },
  });
