import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Empty, Section } from '../../components/ui/Layout';
import { TxRow } from '../../components/ui/TxRow';
import type { CustomCategory, Transaction } from '../../types';
import { createDashboardStyles } from './dashboardStyles';
import { ENTRY_TABS, type EntryTab } from './dashboardMetrics';

interface RecentEntriesSectionProps {
  entries: Transaction[];
  entryTab: EntryTab;
  customCategories: CustomCategory[];
  onEntryTabChange: (tab: EntryTab) => void;
  onEditTransaction: (transaction: Transaction) => void;
}

export function RecentEntriesSection({
  entries,
  entryTab,
  customCategories,
  onEntryTabChange,
  onEditTransaction,
}: RecentEntriesSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);

  return (
    <Section title="Recent Entries" subtitle={`${entries.length} shown`}>
      <View style={styles.entryTabs}>
        {ENTRY_TABS.map(({ id, label }) => {
          const active = entryTab === id;
          const activeBg =
            id === 'expense'
              ? colors.clay
              : id === 'income'
              ? colors.moss
              : id === 'transfer'
              ? colors.rust
              : colors.ink;

          return (
            <Pressable
              key={id}
              onPress={() => onEntryTabChange(id)}
              style={[
                styles.entryTab,
                active && { backgroundColor: activeBg },
              ]}
            >
              <Text
                style={[
                  styles.entryTabLabel,
                  { color: active ? colors.paper : colors.inkSoft },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {entries.length === 0 ? (
        <Empty msg="No entries for this period." />
      ) : (
        <View style={styles.list}>
          {entries.map((transaction, index) => (
            <View key={transaction.id}>
              <TxRow
                t={transaction}
                isLast={index === entries.length - 1}
                customCategories={customCategories}
                onEdit={onEditTransaction}
              />
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}
