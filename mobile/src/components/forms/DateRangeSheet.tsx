import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { DateFilter } from '../../context/BudgetContext';
import { fonts } from '../../theme';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

type CalMode = 'day' | 'month' | 'year';

interface CalendarProps {
  selected: string;
  min?: string;
  max?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onSelect: (iso: string) => void;
  colors: any;
}

export function Calendar({ selected, min, max, rangeStart, rangeEnd, onSelect, colors }: CalendarProps) {
  const selDate = parseIso(selected);
  const [calYear, setCalYear] = useState(selDate.getFullYear());
  const [calMonth, setCalMonth] = useState(selDate.getMonth());
  const [mode, setMode] = useState<CalMode>('day');

  const styles = useMemo(() => calStyles(colors), [colors]);

  const todayYear = new Date().getFullYear();
  const minYear = min ? parseIso(min).getFullYear() : todayYear - 10;
  const maxYear = max ? parseIso(max).getFullYear() : Math.max(todayYear + 10, minYear + 10);
  const minMonthBoundary = min ? parseIso(min) : new Date(minYear, 0, 1);
  const maxMonthBoundary = max ? parseIso(max) : new Date(maxYear, 11, 31);
  const canGoPrevMonth =
    calYear > minMonthBoundary.getFullYear() ||
    (calYear === minMonthBoundary.getFullYear() && calMonth > minMonthBoundary.getMonth());
  const canGoNextMonth =
    calYear < maxMonthBoundary.getFullYear() ||
    (calYear === maxMonthBoundary.getFullYear() && calMonth < maxMonthBoundary.getMonth());

  useEffect(() => {
    const nextSelected = parseIso(selected);
    setCalYear(nextSelected.getFullYear());
    setCalMonth(nextSelected.getMonth());
    setMode('day');
  }, [selected]);

  // ─── Day View ────────────────────────────────────────────────────────────────
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!canGoNextMonth) return;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // ─── Year View ────────────────────────────────────────────────────────────────
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const handleYearSelect = (y: number) => {
    setCalYear(y);
    setMode('month');
  };

  // ─── Month View ───────────────────────────────────────────────────────────────
  const handleMonthSelect = (m: number) => {
    setCalMonth(m);
    setMode('day');
  };

  // ─── Back navigation label ────────────────────────────────────────────────────
  const headerLabel = mode === 'year'
    ? 'Select Year'
    : mode === 'month'
    ? `${calYear}`
    : `${MONTHS_LONG[calMonth]} ${calYear}`;

  const canDrillUp = mode !== 'year';

  return (
    <View style={styles.cal}>
      {/* Header */}
      <View style={styles.calHeader}>
        {mode === 'day' && (
          <Pressable
            onPress={prevMonth}
            style={[styles.calArrow, !canGoPrevMonth && { opacity: 0.25 }]}
            hitSlop={8}
            disabled={!canGoPrevMonth}
          >
            <ChevronLeft size={16} color={colors.inkSoft} />
          </Pressable>
        )}
        {mode !== 'day' && (
          <Pressable
            onPress={() => setMode(mode === 'month' ? 'year' : 'day')}
            style={styles.calArrow}
            hitSlop={8}
          >
            <ChevronLeft size={16} color={colors.inkSoft} />
          </Pressable>
        )}

        <Pressable
          onPress={() => canDrillUp && setMode(mode === 'day' ? 'year' : 'year')}
          style={styles.calHeaderBtn}
          hitSlop={4}
          disabled={!canDrillUp}
        >
          <Text style={styles.calMonthLabel}>{headerLabel}</Text>
          {canDrillUp && <ChevronDown size={13} color={colors.rust} style={{ marginLeft: 4 }} />}
        </Pressable>

        {mode === 'day' && (
          <Pressable
            onPress={nextMonth}
            style={[styles.calArrow, !canGoNextMonth && { opacity: 0.25 }]}
            hitSlop={8}
            disabled={!canGoNextMonth}
          >
            <ChevronRight size={16} color={colors.inkSoft} />
          </Pressable>
        )}
        {mode !== 'day' && <View style={styles.calArrow} />}
      </View>

      {/* ── Year Grid ── */}
      {mode === 'year' && (
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          <View style={styles.gridWrap}>
            {years.map((y) => {
              const active = y === calYear;
              return (
                <Pressable
                  key={y}
                  onPress={() => handleYearSelect(y)}
                  style={[styles.gridCell, active && { backgroundColor: colors.rust }]}
                >
                  <Text style={[styles.gridLabel, active && { color: colors.paper }]}>
                    {y}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Month Grid ── */}
      {mode === 'month' && (
        <View style={styles.gridWrap}>
          {MONTHS_SHORT.map((m, i) => {
            const active = i === calMonth;
            const isDisabled =
              calYear < minMonthBoundary.getFullYear() ||
              (calYear === minMonthBoundary.getFullYear() && i < minMonthBoundary.getMonth()) ||
              calYear > maxMonthBoundary.getFullYear() ||
              (calYear === maxMonthBoundary.getFullYear() && i > maxMonthBoundary.getMonth());
            return (
              <Pressable
                key={m}
                onPress={() => !isDisabled && handleMonthSelect(i)}
                style={[
                  styles.gridCell,
                  active && { backgroundColor: colors.rust },
                  isDisabled && { opacity: 0.25 },
                ]}
              >
                <Text style={[styles.gridLabel, active && { color: colors.paper }]}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── Day Grid ── */}
      {mode === 'day' && (
        <>
          {/* Day-of-week headers */}
          <View style={styles.calRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={styles.calDayLabel}>{d}</Text>
            ))}
          </View>

          {/* Day cells */}
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={styles.calRow}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (!day) return <View key={col} style={styles.calCell} />;

                const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = iso === selected;
                const disabled = (min ? iso < min : false) || (max ? iso > max : false);
                const inRange = rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd;

                return (
                  <Pressable
                    key={col}
                    onPress={() => !disabled && onSelect(iso)}
                    style={[
                      styles.calCell,
                      inRange && { backgroundColor: `${colors.rust}18` },
                      (iso === rangeStart || iso === rangeEnd) && { backgroundColor: `${colors.rust}30` },
                      isSelected && styles.calCellSelected,
                      disabled && { opacity: 0.25 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayNum,
                        { color: colors.ink },
                        isSelected && { color: colors.paper, fontFamily: fonts.bodyMedium },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ─── Main Sheet ────────────────────────────────────────────────────────────────

interface DateRangeSheetProps {
  visible: boolean;
  current: DateFilter;
  onApply: (f: DateFilter) => void;
  onClose: () => void;
}

export function DateRangeSheet({ visible, current, onApply, onClose }: DateRangeSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const today = isoDate(new Date());
  const [startDate, setStartDate] = useState(current.startDate);
  const [endDate, setEndDate] = useState(current.endDate);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  const handleStartSelect = (iso: string) => {
    setStartDate(iso);
    if (iso > endDate) setEndDate(iso);
    setActivePicker(null);
  };

  const handleEndSelect = (iso: string) => {
    setEndDate(iso);
    if (iso < startDate) setStartDate(iso);
    setActivePicker(null);
  };

  const handleReset = () => {
    const t = new Date();
    setStartDate(isoDate(new Date(t.getFullYear(), t.getMonth(), 1)));
    setEndDate(today);
    setActivePicker(null);
  };

  const handleApply = () => {
    onApply({ startDate, endDate });
    onClose();
  };

  const formatDisplay = (iso: string) => {
    const d = parseIso(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filter Date Range</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {/* Scrollable section: date rows + calendars */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 4 }}
          >
            {/* Start Date */}
            <View style={styles.dateRow}>
              <Text style={styles.dateRowLabel}>Start Date</Text>
              <Pressable
                onPress={() => setActivePicker(activePicker === 'start' ? null : 'start')}
                style={[styles.datePill, activePicker === 'start' && { borderColor: colors.rust, borderWidth: 1.5 }]}
              >
                <Text style={styles.datePillText}>{formatDisplay(startDate)}</Text>
              </Pressable>
            </View>

            {activePicker === 'start' && (
              <Calendar
                selected={startDate}
                max={today}
                rangeStart={startDate}
                rangeEnd={endDate}
                onSelect={handleStartSelect}
                colors={colors}
              />
            )}

            {/* End Date */}
            <View style={styles.dateRow}>
              <Text style={styles.dateRowLabel}>End Date</Text>
              <Pressable
                onPress={() => setActivePicker(activePicker === 'end' ? null : 'end')}
                style={[styles.datePill, activePicker === 'end' && { borderColor: colors.rust, borderWidth: 1.5 }]}
              >
                <Text style={styles.datePillText}>{formatDisplay(endDate)}</Text>
              </Pressable>
            </View>

            {activePicker === 'end' && (
              <Calendar
                selected={endDate}
                min={startDate}
                max={today}
                rangeStart={startDate}
                rangeEnd={endDate}
                onSelect={handleEndSelect}
                colors={colors}
              />
            )}
          </ScrollView>

          {/* Actions — always pinned at bottom */}
          <View style={styles.actions}>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={styles.resetLabel}>Reset</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyLabel}>Apply</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>Showing transactions within the selected range.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const calStyles = (colors: any) =>
  StyleSheet.create({
    cal: {
      backgroundColor: colors.paper,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      marginBottom: 4,
    },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    calHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    calArrow: { padding: 4, width: 28, alignItems: 'center' },
    calMonthLabel: {
      fontFamily: fonts.displayMedium,
      fontSize: 14,
      color: colors.ink,
    },
    calRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 4,
    },
    calDayLabel: {
      width: 32,
      textAlign: 'center',
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone400,
      letterSpacing: 0.5,
    },
    calCell: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calCellSelected: { backgroundColor: colors.rust },
    calDayNum: {
      fontFamily: fonts.body,
      fontSize: 13,
    },
    // Year / Month grid
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 6,
      paddingVertical: 4,
    },
    gridCell: {
      width: '22%',
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.chip,
    },
    gridLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
  });

const createStyles = (colors: any) =>
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
