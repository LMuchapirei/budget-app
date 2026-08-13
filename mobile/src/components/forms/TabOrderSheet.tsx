// Tab order + default-tab editor.
//
// Drag-reorder is implemented with bare React Native primitives — PanResponder
// for gesture, Animated.Value for the dragged row's transform, and
// LayoutAnimation for the smooth shift of sibling rows on commit. We
// deliberately avoid react-native-reanimated and react-native-gesture-handler
// because reanimated has caused opaque iOS runtime crashes in this project
// before (see memory.md / project notes).
//
// UX trade-off: there is no live preview of the drop slot during drag — the
// other rows stay put until release, then animate to their new positions.
// With only four reorderable rows the rounding-on-release approach feels
// fine in practice and the implementation stays understandable.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {
  Bell,
  Check,
  GripVertical,
  PieChart as PieIcon,
  RotateCcw,
  Settings as SettingsIcon,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  useLayout,
  REORDERABLE_TABS,
  FIXED_LAST_TAB,
} from '../../context/LayoutContext';
import { fonts } from '../../theme';
import type { ViewTab } from '../../types';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_META: Record<ViewTab, { label: string; Icon: LucideIcon; hint: string }> = {
  dashboard: { label: 'Ledger', Icon: Wallet, hint: 'Balances, charts, recent entries' },
  bills: { label: 'Bills', Icon: Bell, hint: 'Recurring income & expense schedule' },
  projections: { label: 'Projections', Icon: TrendingUp, hint: 'Forward-looking forecasts' },
  reports: { label: 'Reports', Icon: PieIcon, hint: 'Spending by category & comparisons' },
  settings: { label: 'Settings', Icon: SettingsIcon, hint: 'Always last — fixed for safety.' },
};

const ROW_HEIGHT = 64;
const ROW_GAP = 10;
const SLOT_HEIGHT = ROW_HEIGHT + ROW_GAP;

interface TabOrderSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function TabOrderSheet({ visible, onClose }: TabOrderSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tabOrder, defaultTab, setTabOrder, setDefaultTab, resetLayout } = useLayout();

  // Local working copy so reorder + default changes feel immediate.
  // Persisted to context (and thus storage) on every change.
  const [workingOrder, setWorkingOrder] = useState<ViewTab[]>(tabOrder);

  // Mirror the latest order in a ref so the stable `commitReorder` below
  // never closes over a stale snapshot. Without this, the PanResponder
  // memo would have to depend on `workingOrder` and recreate on every
  // reorder — losing the gesture mid-drag on slower devices.
  const workingOrderRef = useRef<ViewTab[]>(workingOrder);
  useEffect(() => {
    workingOrderRef.current = workingOrder;
  }, [workingOrder]);

  useEffect(() => {
    if (visible) setWorkingOrder(tabOrder);
  }, [visible, tabOrder]);

  const commitReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = [...workingOrderRef.current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setWorkingOrder(next);
      setTabOrder(next);
    },
    [setTabOrder],
  );

  const handleSetDefault = (tab: ViewTab) => {
    if (tab === defaultTab) return;
    setDefaultTab(tab);
  };

  const handleReset = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkingOrder([...REORDERABLE_TABS]);
    resetLayout();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Tabs</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <Text style={styles.intro}>
            Drag the handle to reorder. Settings always stays at the end so you
            can find it.
          </Text>

          <Text style={styles.sectionLabel}>Order</Text>
          <View style={[styles.list, { height: workingOrder.length * SLOT_HEIGHT - ROW_GAP }]}>
            {workingOrder.map((tabId, index) => (
              <DraggableRow
                key={tabId}
                index={index}
                totalRows={workingOrder.length}
                tab={tabId}
                onCommitReorder={commitReorder}
                colors={colors}
              />
            ))}
          </View>

          <View style={styles.fixedRow}>
            <View style={styles.iconWrap}>
              <SettingsIcon size={16} color={colors.stone500} />
            </View>
            <View style={styles.fixedCopy}>
              <Text style={styles.rowLabel}>{TAB_META.settings.label}</Text>
              <Text style={styles.rowHint}>{TAB_META.settings.hint}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Open to</Text>
          <View style={styles.defaultGrid}>
            {workingOrder.map((tabId) => {
              const active = defaultTab === tabId;
              const Icon = TAB_META[tabId].Icon;
              return (
                <Pressable
                  key={tabId}
                  onPress={() => handleSetDefault(tabId)}
                  style={[
                    styles.defaultChip,
                    active && {
                      borderColor: colors.rust,
                      backgroundColor: colors.cream,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Open to ${TAB_META[tabId].label}`}
                >
                  <Icon size={14} color={active ? colors.rust : colors.stone500} />
                  <Text
                    style={[
                      styles.defaultChipLabel,
                      active && { color: colors.rust },
                    ]}
                  >
                    {TAB_META[tabId].label}
                  </Text>
                  {active ? (
                    <Check size={12} color={colors.rust} strokeWidth={3} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <RotateCcw size={14} color={colors.stone500} />
            <Text style={styles.resetLabel}>Reset to default</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface DraggableRowProps {
  index: number;
  totalRows: number;
  tab: ViewTab;
  onCommitReorder: (from: number, to: number) => void;
  colors: any;
}

function DraggableRow({
  index,
  totalRows,
  tab,
  onCommitReorder,
  colors,
}: DraggableRowProps) {
  const styles = useMemo(() => createDraggableStyles(colors), [colors]);
  const pan = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  // Keep changing values in refs so the PanResponder below can be created
  // exactly once. Recreating it across renders during an active gesture
  // (which is what happens on iOS when state changes) drops the touch.
  const indexRef = useRef(index);
  const totalRowsRef = useRef(totalRows);
  const onCommitRef = useRef(onCommitReorder);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    totalRowsRef.current = totalRows;
  }, [totalRows]);
  useEffect(() => {
    onCommitRef.current = onCommitReorder;
  }, [onCommitReorder]);

  const movedRef = useRef(false);

  // Created once, stable for the row's lifetime. The `[pan]` dep array is
  // intentional — pan never changes either; everything else is a ref.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim on touch-down. On iOS, the Pressable backdrop sitting under
        // the sheet competes for the gesture during responder negotiation;
        // a row that defers to `onMoveShouldSetPanResponder` loses the touch
        // before our move handler can claim it. Rows have no inner taps so
        // this is safe.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        // Don't let parent views yank the gesture mid-drag.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          movedRef.current = false;
          pan.stopAnimation();
          pan.setValue(0);
          // setActive is deferred to first real movement so a quick tap on
          // the row doesn't briefly flash the active (scaled + shadowed) state.
        },
        onPanResponderMove: (_, g) => {
          if (!movedRef.current && Math.abs(g.dy) > 2) {
            movedRef.current = true;
            setActive(true);
          }
          if (movedRef.current) pan.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (!movedRef.current) {
            // Tap, not a drag — nothing to do.
            return;
          }
          const delta = Math.round(g.dy / SLOT_HEIGHT);
          const start = indexRef.current;
          const target = Math.max(
            0,
            Math.min(totalRowsRef.current - 1, start + delta),
          );
          if (target !== start) {
            onCommitRef.current(start, target);
          }
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            speed: 20,
            bounciness: 0,
          }).start(() => setActive(false));
        },
        onPanResponderTerminate: () => {
          if (!movedRef.current) return;
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            speed: 20,
            bounciness: 0,
          }).start(() => setActive(false));
        },
      }),
    [pan],
  );

  const meta = TAB_META[tab];
  const Icon = meta.Icon;

  const dragStyle = active
    ? {
        transform: [{ translateY: pan }, { scale: 1.02 }],
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        zIndex: 100,
        elevation: 12,
      }
    : null;

  // panHandlers on the OUTER Animated.View so the whole row is the drag
  // target. The grip remains as a visual affordance only. iOS users tend
  // to grab the row body, not the icon — small targets feel unresponsive.
  return (
    <Animated.View style={[styles.row, dragStyle]} {...panResponder.panHandlers}>
      <View style={styles.iconWrap}>
        <Icon size={16} color={colors.rust} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowLabel}>{meta.label}</Text>
        <Text style={styles.rowHint}>{meta.hint}</Text>
      </View>
      <View style={styles.handleHit} accessibilityLabel="Drag to reorder">
        <GripVertical size={20} color={colors.stone500} />
      </View>
    </Animated.View>
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
      gap: 14,
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
    },
    intro: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone600,
      lineHeight: 17,
    },
    sectionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.stone500,
      marginTop: 2,
    },
    list: { position: 'relative' },
    fixedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      height: ROW_HEIGHT,
      borderRadius: 14,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed' as const,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fixedCopy: { flex: 1, minWidth: 0, gap: 2 },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.ink,
    },
    rowHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 14,
    },
    defaultGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    defaultChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
    },
    defaultChipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.chip,
      marginTop: 4,
    },
    resetLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.stone500,
    },
  });

const createDraggableStyles = (colors: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 14,
      paddingRight: 6,
      height: ROW_HEIGHT,
      marginBottom: ROW_GAP,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      shadowColor: '#000',
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.ink,
    },
    rowHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 14,
    },
    handleHit: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

// Re-exported for tests / introspection.
export { REORDERABLE_TABS, FIXED_LAST_TAB };
