import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieIcon,
  Repeat,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import {
  CATEGORIES,
  CATEGORY_COLORS,
  Category,
  CustomCategory,
  Transaction,
  TxType,
  colorFor,
  colors,
  fmt,
  fonts,
} from './theme';
import { AreaChart } from './charts/AreaChart';
import { LineChart } from './charts/LineChart';
import { PieChart } from './charts/PieChart';
import { BarChart } from './charts/BarChart';

const STORAGE_KEY = 'budget:transactions:v1';
const CAT_STORAGE_KEY = 'budget:categories:v1';

type View_ = 'dashboard' | 'projections' | 'reports';

interface Stats {
  income: number;
  expenses: number;
  balance: number;
  count: number;
}

export default function BudgetApp() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View_>('dashboard');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setTransactions(JSON.parse(raw) as Transaction[]);
        const rawCat = await AsyncStorage.getItem(CAT_STORAGE_KEY);
        if (rawCat) setCustomCategories(JSON.parse(rawCat) as CustomCategory[]);
      } catch {
        // first run
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next: Transaction[]) => {
    setTransactions(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistCategories = useCallback(async (next: CustomCategory[]) => {
    setCustomCategories(next);
    try {
      await AsyncStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addTransaction = (t: Omit<Transaction, 'id'>) =>
    persist([{ ...t, id: Date.now().toString() }, ...transactions]);

  const removeTransaction = (id: string) =>
    persist(transactions.filter((x) => x.id !== id));

  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
  };

  const stats = useMemo<Stats>(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = transactions.filter((t) => new Date(t.date) >= monthStart);
    const income = thisMonth
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = thisMonth
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: thisMonth.length };
  }, [transactions]);

  if (!fontsLoaded || loading) {
    return (
      <SafeAreaView style={styles.loaderRoot}>
        <ActivityIndicator color={colors.rust} />
        <Text style={styles.loaderText}>Loading your ledger…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Header view={view} setView={setView} />
        {view === 'dashboard' && (
          <Dashboard
            stats={stats}
            transactions={transactions}
            customCategories={customCategories}
            onRemove={removeTransaction}
          />
        )}
        {view === 'projections' && <Projections transactions={transactions} />}
        {view === 'reports' && <Reports transactions={transactions} customCategories={customCategories} />}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => setShowForm(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Plus size={28} color="#fff" strokeWidth={2} />
      </Pressable>

      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <TransactionForm
          onClose={() => setShowForm(false)}
          onSave={addTransaction}
          customCategories={customCategories}
          onAddCategory={addCustomCategory}
        />
      </Modal>
    </SafeAreaView>
  );
}

interface HeaderProps {
  view: View_;
  setView: (v: View_) => void;
}

function Header({ view, setView }: HeaderProps) {
  const tabs: { id: View_; label: string; Icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Ledger', Icon: Wallet },
    { id: 'projections', label: 'Projections', Icon: TrendingUp },
    { id: 'reports', label: 'Reports', Icon: PieIcon },
  ];
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>
          The <Text style={styles.titleEm}>Budget</Text>
        </Text>
        <Text style={styles.dateLabel}>
          {new Date()
            .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            .toUpperCase()}
        </Text>
      </View>
      <View style={styles.rule} />
      <Text style={styles.subtitle}>
        For your finances — a quiet place to keep score.
      </Text>

      <View style={styles.tabs}>
        {tabs.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <Pressable
              key={id}
              onPress={() => setView(id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Icon size={14} color={active ? colors.paper : colors.inkSoft} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface DashboardProps {
  stats: Stats;
  transactions: Transaction[];
  customCategories: CustomCategory[];
  onRemove: (id: string) => void;
}

function Dashboard({ stats, transactions, customCategories, onRemove }: DashboardProps) {
  const { width } = useWindowDimensions();
  const recent = transactions.slice(0, 8);

  const last30 = useMemo(() => {
    const days: { key: string; label: string; income: number; expenses: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayTx = transactions.filter((t) => t.date === key);
      const inc = dayTx
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0);
      const exp = dayTx
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0);
      days.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: inc,
        expenses: exp,
      });
    }
    return days;
  }, [transactions]);

  const chartW = width - 24 * 2 - 16 * 2;

  return (
    <View style={{ gap: 32 }}>
      <View style={{ gap: 12 }}>
        <StatCard
          label="Income this month"
          value={stats.income}
          color={colors.moss}
          Icon={TrendingUp}
          accent="i."
        />
        <StatCard
          label="Expenses this month"
          value={stats.expenses}
          color={colors.clay}
          Icon={TrendingDown}
          accent="ii."
        />
        <StatCard
          label="Net balance"
          value={stats.balance}
          color={stats.balance >= 0 ? colors.ink : colors.clay}
          Icon={Wallet}
          accent="iii."
          signed
        />
      </View>

      <Section title="Cash Flow" subtitle="Last 30 days">
        {transactions.length === 0 ? (
          <Empty msg="No transactions yet. Tap the + below to begin." />
        ) : (
          <View style={styles.card}>
            <AreaChart
              width={chartW}
              height={220}
              labels={last30.map((d) => d.label)}
              series={[
                {
                  color: colors.moss,
                  gradientId: 'gIn',
                  values: last30.map((d) => d.income),
                },
                {
                  color: colors.clay,
                  gradientId: 'gEx',
                  values: last30.map((d) => d.expenses),
                },
              ]}
            />
            <View style={styles.legend}>
              <Legend color={colors.moss} label="Income" />
              <Legend color={colors.clay} label="Expenses" />
            </View>
          </View>
        )}
      </Section>

      <Section title="Recent Entries" subtitle={`${transactions.length} total`}>
        {recent.length === 0 ? (
          <Empty msg="Your ledger awaits its first entry." />
        ) : (
          <View style={styles.list}>
            {recent.map((t, i) => (
              <TxRow
                key={t.id}
                t={t}
                onRemove={onRemove}
                isLast={i === recent.length - 1}
                customCategories={customCategories}
              />
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  Icon: LucideIcon;
  accent: string;
  signed?: boolean;
}

function StatCard({ label, value, color, Icon, accent, signed }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statAccent}>{accent}</Text>
      <Icon size={20} color={color} strokeWidth={1.5} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>
        {signed && value < 0 ? '−' : ''}
        {fmt(value)}
      </Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.sectionOrnament}>§ </Text>
          {title}
        </Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

interface TxRowProps {
  t: Transaction;
  onRemove: (id: string) => void;
  isLast: boolean;
  customCategories: CustomCategory[];
}

function TxRow({ t, onRemove, isLast, customCategories }: TxRowProps) {
  const isIncome = t.type === 'income';
  const accent = colorFor(t.category, customCategories);
  return (
    <View style={[styles.txRow, !isLast && styles.txRowBorder]}>
      <View style={[styles.txDot, { backgroundColor: `${accent}20` }]}>
        <View style={[styles.txDotInner, { backgroundColor: accent }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.txDescription} numberOfLines={1}>
            {t.description}
          </Text>
          {t.recurring && <Repeat size={11} color={colors.stone400} />}
        </View>
        <Text style={styles.txMeta}>
          {t.category} ·{' '}
          {new Date(t.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: isIncome ? colors.moss : colors.ink },
        ]}
      >
        {isIncome ? '+' : '−'}
        {fmt(t.amount)}
      </Text>
      <Pressable
        onPress={() => onRemove(t.id)}
        hitSlop={8}
        style={styles.txDelete}
        accessibilityLabel={`Delete ${t.description}`}
      >
        <Trash2 size={14} color={colors.stone400} />
      </Pressable>
    </View>
  );
}

interface ProjectionsProps {
  transactions: Transaction[];
}

function Projections({ transactions }: ProjectionsProps) {
  const { width } = useWindowDimensions();
  const recurring = transactions.filter((t) => t.recurring);
  const monthlyRecurringIncome = recurring
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyRecurringExpense = recurring
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const netMonthly = monthlyRecurringIncome - monthlyRecurringExpense;

  const projection = useMemo(() => {
    const months: { label: string; cumulative: number }[] = [];
    let cumulative = 0;
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      cumulative += netMonthly;
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        cumulative,
      });
    }
    return months;
  }, [netMonthly]);

  const chartW = width - 24 * 2 - 16 * 2;
  const positive = netMonthly >= 0;

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.heroDark}>
        <Text style={styles.heroEyebrow}>A look ahead</Text>
        <Text style={styles.heroTitle}>
          {positive ? "You're saving " : "You're losing "}
          <Text
            style={[
              styles.heroEm,
              { color: positive ? '#9BC4A8' : '#D89992' },
            ]}
          >
            {fmt(Math.abs(netMonthly))}
          </Text>{' '}
          per month
        </Text>
        <Text style={styles.heroBody}>
          Based on {recurring.length} recurring{' '}
          {recurring.length === 1 ? 'item' : 'items'}. In a year, that's{' '}
          {fmt(Math.abs(netMonthly * 12))}.
        </Text>
      </View>

      <Section title="12-Month Projection" subtitle="Cumulative balance">
        {recurring.length === 0 ? (
          <Empty msg="Mark transactions as recurring to see projections here." />
        ) : (
          <View style={styles.card}>
            <LineChart
              width={chartW}
              height={240}
              values={projection.map((p) => p.cumulative)}
              labels={projection.map((p) => p.label)}
            />
          </View>
        )}
      </Section>

      <Section title="Recurring Items" subtitle={`${recurring.length} active`}>
        {recurring.length === 0 ? (
          <Empty msg="No recurring transactions yet." />
        ) : (
          <View style={{ gap: 10 }}>
            {recurring.map((t) => (
              <View key={t.id} style={styles.recurringCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurringTitle}>{t.description}</Text>
                  <Text style={styles.recurringMeta}>{t.category} · monthly</Text>
                </View>
                <Text
                  style={[
                    styles.recurringAmount,
                    { color: t.type === 'income' ? colors.moss : colors.clay },
                  ]}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {fmt(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

interface ReportsProps {
  transactions: Transaction[];
  customCategories: CustomCategory[];
}

function Reports({ transactions, customCategories }: ReportsProps) {
  const { width } = useWindowDimensions();
  const expenses = transactions.filter((t) => t.type === 'expense');

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byMonth = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number }> = {};
    transactions.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: key, income: 0, expenses: 0 };
      map[key][t.type === 'income' ? 'income' : 'expenses'] += Number(t.amount);
    });
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((m) => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('en-US', {
          month: 'short',
        }),
      }));
  }, [transactions]);

  const totalExpenses = byCategory.reduce((s, c) => s + c.value, 0);
  const chartW = width - 24 * 2 - 16 * 2;

  if (transactions.length === 0) {
    return <Empty msg="Add some transactions to see reports." />;
  }

  return (
    <View style={{ gap: 32 }}>
      <Section title="Spending by Category" subtitle={`${fmt(totalExpenses)} total`}>
        {byCategory.length === 0 ? (
          <Empty msg="No expenses recorded yet." />
        ) : (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <PieChart
                size={Math.min(chartW, 220)}
                data={byCategory.map((c) => ({
                  value: c.value,
                  color: colorFor(c.name, customCategories),
                }))}
              />
            </View>
            <View style={{ gap: 10 }}>
              {byCategory.map((c) => {
                const pct = (c.value / totalExpenses) * 100;
                return (
                  <View key={c.name} style={{ gap: 4 }}>
                    <View style={styles.legendRow}>
                      <View style={styles.legendLabelGroup}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: colorFor(c.name, customCategories) },
                          ]}
                        />
                        <Text style={styles.legendName}>{c.name}</Text>
                      </View>
                      <Text style={styles.legendValue}>
                        {fmt(c.value)}{' '}
                        <Text style={styles.legendPct}>· {pct.toFixed(1)}%</Text>
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: colorFor(c.name, customCategories),
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      <Section title="Monthly Comparison" subtitle="Last 6 months">
        <View style={styles.card}>
          <BarChart width={chartW} height={240} data={byMonth} />
          <View style={[styles.legend, { marginTop: 12 }]}>
            <Legend color={colors.moss} label="Income" />
            <Legend color={colors.clay} label="Expenses" />
          </View>
        </View>
      </Section>
    </View>
  );
}

interface TransactionFormProps {
  onClose: () => void;
  onSave: (t: Omit<Transaction, 'id'>) => void;
  customCategories: CustomCategory[];
  onAddCategory: (c: CustomCategory) => void;
}

function TransactionForm({ onClose, onSave, customCategories, onAddCategory }: TransactionFormProps) {
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);

  useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
  }, [type]);

  const handleSubmit = () => {
    const n = Number(amount);
    if (!amount || !description || Number.isNaN(n) || n <= 0) return;
    onSave({ type, amount: n, description, category, date, recurring });
    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalRoot}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>New entry</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <X size={20} color={colors.stone500} />
          </Pressable>
        </View>

        <View style={styles.typeToggle}>
          {(['expense', 'income'] as TxType[]).map((t) => {
            const active = type === t;
            const bg =
              active && t === 'income'
                ? colors.moss
                : active && t === 'expense'
                ? colors.clay
                : 'transparent';
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeButton, { backgroundColor: bg }]}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    { color: active ? colors.paper : colors.inkSoft },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Amount">
            <View style={styles.amountRow}>
              <Text style={styles.amountSign}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.stone400}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
            </View>
          </Field>

          <Field label="Description">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What was it for?"
              placeholderTextColor={colors.stone400}
              style={styles.input}
            />
          </Field>

          <Field label="Category">
            <Pressable
              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink }}>{category}</Text>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.rust }}>Change</Text>
            </Pressable>
          </Field>

          <Field label="Date">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.stone400}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>

          <View style={styles.recurringRow}>
            <View style={styles.recurringLabelGroup}>
              <Repeat size={14} color={colors.stone500} />
              <Text style={styles.recurringRowLabel}>This repeats every month</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ true: colors.rust, false: colors.chip }}
              thumbColor={colors.cream}
            />
          </View>
        </ScrollView>

        <Pressable
          onPress={handleSubmit}
          disabled={!amount || !description}
          style={({ pressed }) => [
            styles.submit,
            (!amount || !description) && styles.submitDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>Add to ledger</Text>
        </Pressable>
      </View>

      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <CategoryPickerSheet
          type={type}
          selected={category}
          customCategories={customCategories}
          onSelect={(c) => { setCategory(c); setShowCategoryPicker(false); }}
          onClose={() => setShowCategoryPicker(false)}
          onAdd={() => { setShowCategoryPicker(false); setShowAddCategory(true); }}
        />
      </Modal>

      <Modal visible={showAddCategory} transparent animationType="slide">
        <AddCategorySheet
          type={type}
          onClose={() => setShowAddCategory(false)}
          onSave={(c) => {
            onAddCategory(c);
            setCategory(c.title);
            setShowAddCategory(false);
          }}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

interface CategoryPickerSheetProps {
  type: TxType;
  selected: string;
  customCategories: CustomCategory[];
  onSelect: (c: string) => void;
  onClose: () => void;
  onAdd: () => void;
}

function CategoryPickerSheet({ type, selected, customCategories, onSelect, onClose, onAdd }: CategoryPickerSheetProps) {
  const defaultChoices = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
  const customChoices = customCategories.filter(c => c.type === type);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Select Category</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <X size={20} color={colors.stone500} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 400 }}>
          {defaultChoices.map((c) => (
            <Pressable key={c} style={styles.catPickerRow} onPress={() => onSelect(c)}>
              <View style={[styles.txDot, { backgroundColor: `${colorFor(c, customCategories)}20` }]}>
                <View style={[styles.txDotInner, { backgroundColor: colorFor(c, customCategories) }]} />
              </View>
              <Text style={styles.catPickerLabel}>{c}</Text>
            </Pressable>
          ))}
          {customChoices.map((c) => (
            <Pressable key={c.id} style={styles.catPickerRow} onPress={() => onSelect(c.title)}>
              <View style={[styles.txDot, { backgroundColor: `${c.color}20` }]}>
                <View style={[styles.txDotInner, { backgroundColor: c.color }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.catPickerLabel}>{c.title}</Text>
                {c.description ? <Text style={styles.catPickerDesc}>{c.description}</Text> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.catAddBtn} onPress={onAdd}>
          <Text style={styles.catAddBtnLabel}>+ Create New Category</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

interface AddCategorySheetProps {
  type: TxType;
  onClose: () => void;
  onSave: (c: CustomCategory) => void;
}

function AddCategorySheet({ type: initialType, onClose, onSave }: AddCategorySheetProps) {
  const [selectedType, setSelectedType] = useState<TxType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!title) return;
    onSave({
      id: Date.now().toString(),
      title,
      description,
      type: selectedType,
      color: colors.rust,
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>New Category</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={colors.stone500} />
          </Pressable>
        </View>

        <View style={styles.typeToggle}>
          {(['expense', 'income'] as TxType[]).map((t) => {
            const active = selectedType === t;
            const bg =
              active && t === 'income'
                ? colors.moss
                : active && t === 'expense'
                ? colors.clay
                : 'transparent';
            return (
              <Pressable
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typeButton, { backgroundColor: bg }]}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    { color: active ? colors.paper : colors.inkSoft },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Coffee"
            placeholderTextColor={colors.stone400}
            style={styles.input}
          />
        </Field>
        
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this for?"
            placeholderTextColor={colors.stone400}
            style={styles.input}
          />
        </Field>

        <Pressable
          onPress={handleSave}
          disabled={!title}
          style={({ pressed }) => [
            styles.submit,
            !title && styles.submitDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>Save Category</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{msg}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  loaderRoot: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: fonts.displayItalic,
    color: colors.stone600,
    fontSize: 16,
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },

  header: { paddingTop: 16, paddingBottom: 24, gap: 8 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.displayLight,
    fontSize: 44,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  titleEm: {
    fontFamily: fonts.displayItalic,
    color: colors.rust,
  },
  dateLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.stone500,
    letterSpacing: 2,
    marginBottom: 8,
  },
  rule: {
    height: 1,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: colors.rust,
    borderStyle: 'dashed',
    marginVertical: 8,
    opacity: 0.5,
  },
  subtitle: {
    fontFamily: fonts.displayItalic,
    fontSize: 16,
    color: colors.stone500,
    marginBottom: 20,
  },

  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.chip,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: colors.ink },
  tabLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  tabLabelActive: { color: colors.paper },

  statCard: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 8,
    position: 'relative',
  },
  statAccent: {
    position: 'absolute',
    top: 14,
    right: 18,
    fontFamily: fonts.displayItalic,
    fontSize: 12,
    color: colors.rust,
    opacity: 0.5,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.stone500,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  statValue: {
    fontFamily: fonts.displayLight,
    fontSize: 32,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.displayLight,
    fontSize: 24,
    color: colors.ink,
  },
  sectionOrnament: {
    color: colors.rust,
    opacity: 0.4,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.stone500,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: 'rgba(255,251,242,0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
  },

  list: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  txDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDotInner: { width: 8, height: 8, borderRadius: 4 },
  txDescription: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  txMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.stone500,
    marginTop: 2,
  },
  txAmount: {
    fontFamily: fonts.displayLight,
    fontSize: 17,
  },
  txDelete: { padding: 6 },

  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.rust,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  heroDark: {
    backgroundColor: 'rgba(44,36,22,0.97)',
    borderRadius: 22,
    padding: 28,
    gap: 6,
  },
  heroEyebrow: {
    fontFamily: fonts.displayItalic,
    color: colors.paper,
    opacity: 0.6,
    letterSpacing: 2,
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: fonts.displayLight,
    color: colors.paper,
    fontSize: 26,
    lineHeight: 32,
  },
  heroEm: { fontFamily: fonts.displayItalic },
  heroBody: {
    fontFamily: fonts.body,
    color: colors.paper,
    opacity: 0.7,
    fontSize: 13,
    marginTop: 6,
  },

  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    gap: 12,
  },
  recurringTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  recurringMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.stone500,
    marginTop: 2,
  },
  recurringAmount: { fontFamily: fonts.displayLight, fontSize: 17 },

  legend: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.stone500,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  legendLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
  },
  legendValue: {
    fontFamily: fonts.displayLight,
    fontSize: 13,
    color: colors.ink,
  },
  legendPct: { color: colors.stone400, fontSize: 11 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chip,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },

  empty: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: 'rgba(255,251,242,0.4)',
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(139,90,60,0.2)',
  },
  emptyText: {
    fontFamily: fonts.displayItalic,
    color: colors.stone500,
    fontSize: 14,
  },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(139,90,60,0.2)',
    gap: 18,
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
  typeToggle: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: colors.chip,
    borderRadius: 999,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  typeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.stone500,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amountSign: { fontFamily: fonts.displayLight, fontSize: 28, color: colors.stone400 },
  amountInput: {
    flex: 1,
    fontFamily: fonts.displayLight,
    fontSize: 28,
    color: colors.ink,
    paddingVertical: 4,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,90,60,0.2)',
    color: colors.ink,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  recurringLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recurringRowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.stone600,
  },
  submit: {
    backgroundColor: colors.ink,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.4 },
  submitLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  catPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  catPickerLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  catPickerDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.stone500,
    marginTop: 2,
  },
  catAddBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.chip,
  },
  catAddBtnLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
});
