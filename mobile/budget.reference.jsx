import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart
} from 'recharts';
import {
  Plus, Trash2, TrendingUp, TrendingDown, Wallet,
  Calendar, PieChart as PieIcon, BarChart3, Repeat, X
} from 'lucide-react';

const STORAGE_KEY = 'budget:transactions:v1';

const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other Income'],
  expense: ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Subscriptions', 'Other']
};

const CATEGORY_COLORS = {
  Housing: '#8B5A3C', Food: '#C97B4A', Transport: '#6B8E6B',
  Utilities: '#9B7FA0', Entertainment: '#D4A04A', Health: '#A85751',
  Shopping: '#7A8FA8', Subscriptions: '#5C7A8E', Other: '#8A8275',
  Salary: '#3D6B4A', Freelance: '#5A8A6F', Investments: '#7AAF8E',
  Gifts: '#9BC4A8', 'Other Income': '#B8D4BF'
};

const fmt = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BudgetApp() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setTransactions(JSON.parse(r.value));
      } catch (e) { /* first run */ }
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setTransactions(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next)); }
    catch (e) { console.error(e); }
  };

  const addTransaction = (t) => persist([{ ...t, id: Date.now().toString() }, ...transactions]);
  const removeTransaction = (id) => persist(transactions.filter(t => t.id !== id));

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = transactions.filter(t => new Date(t.date) >= monthStart);
    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: thisMonth.length };
  }, [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F1E8' }}>
        <div className="text-stone-600 font-serif italic text-lg">Loading your ledger…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{
      background: '#F5F1E8',
      backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(139,90,60,0.04) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(107,142,107,0.05) 0%, transparent 40%)',
      fontFamily: 'Georgia, "Times New Roman", serif'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap');
        .display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: "ss01","ss02"; }
        .body-sans { font-family: 'Inter', system-ui, sans-serif; }
        .number { font-family: 'Fraunces', Georgia, serif; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        .ornament::before { content: '§'; opacity: 0.4; margin-right: 0.5rem; }
        .rule { background-image: linear-gradient(to right, #8B5A3C 50%, transparent 50%); background-size: 8px 1px; background-repeat: repeat-x; }
      `}</style>

      <Header view={view} setView={setView} />

      <main className="max-w-6xl mx-auto px-6 pb-32">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Dashboard stats={stats} transactions={transactions} onRemove={removeTransaction} />
            </motion.div>
          )}
          {view === 'projections' && (
            <motion.div key="proj" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Projections transactions={transactions} />
            </motion.div>
          )}
          {view === 'reports' && (
            <motion.div key="rep" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Reports transactions={transactions} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full text-white shadow-2xl flex items-center justify-center z-40"
        style={{ background: '#8B5A3C', boxShadow: '0 10px 30px -5px rgba(139,90,60,0.5)' }}
      >
        <Plus size={28} strokeWidth={2} />
      </motion.button>

      <AnimatePresence>
        {showForm && <TransactionForm onClose={() => setShowForm(false)} onSave={addTransaction} />}
      </AnimatePresence>
    </div>
  );
}

function Header({ view, setView }) {
  const tabs = [
    { id: 'dashboard', label: 'Ledger', icon: Wallet },
    { id: 'projections', label: 'Projections', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: PieIcon }
  ];
  return (
    <header className="max-w-6xl mx-auto px-6 pt-12 pb-8">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="display text-5xl md:text-6xl font-light tracking-tight" style={{ color: '#2C2416' }}>
          The <em className="italic" style={{ color: '#8B5A3C' }}>Budget</em>
        </h1>
        <span className="body-sans text-xs uppercase tracking-[0.25em] text-stone-500 hidden md:block">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>
      <div className="rule h-px mb-6" />
      <p className="display italic text-stone-500 text-base md:text-lg mb-8 max-w-xl">
        For your finances — a quiet place to keep score.
      </p>

      <nav className="flex gap-1 p-1 rounded-full w-fit" style={{ background: 'rgba(44,36,22,0.06)' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className="body-sans px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all"
            style={{
              background: view === id ? '#2C2416' : 'transparent',
              color: view === id ? '#F5F1E8' : '#5C5142'
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Dashboard({ stats, transactions, onRemove }) {
  const recent = transactions.slice(0, 8);
  const last30 = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayTx = transactions.filter(t => t.date === key);
      const inc = dayTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const exp = dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income: inc, expenses: exp });
    }
    return days;
  }, [transactions]);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Income this month" value={stats.income} color="#3D6B4A" Icon={TrendingUp} accent="i." />
        <StatCard label="Expenses this month" value={stats.expenses} color="#A85751" Icon={TrendingDown} accent="ii." />
        <StatCard label="Net balance" value={stats.balance} color={stats.balance >= 0 ? '#2C2416' : '#A85751'} Icon={Wallet} accent="iii." signed />
      </div>

      <Section title="Cash Flow" subtitle="The last thirty days">
        {transactions.length === 0 ? (
          <Empty msg="No transactions yet. Tap the + below to begin." />
        ) : (
          <div className="rounded-2xl p-6 md:p-8" style={{ background: 'rgba(255,251,242,0.7)', border: '1px solid rgba(139,90,60,0.15)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={last30} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3D6B4A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3D6B4A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gEx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A85751" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#A85751" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(44,36,22,0.08)" />
                <XAxis dataKey="date" stroke="#8A8275" fontSize={10} tick={{ fontFamily: 'Inter' }} interval={5} />
                <YAxis stroke="#8A8275" fontSize={10} tick={{ fontFamily: 'Inter' }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.3)', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="income" stroke="#3D6B4A" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="expenses" stroke="#A85751" strokeWidth={2} fill="url(#gEx)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Recent Entries" subtitle={`${transactions.length} total`}>
        {recent.length === 0 ? (
          <Empty msg="Your ledger awaits its first entry." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'rgba(139,90,60,0.15)' }}>
            {recent.map((t) => <TxRow key={t.id} t={t} onRemove={onRemove} />)}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, color, Icon, accent, signed }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl p-7 overflow-hidden"
      style={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.18)' }}
    >
      <div className="absolute top-4 right-5 display italic text-xs" style={{ color: '#8B5A3C', opacity: 0.5 }}>{accent}</div>
      <Icon size={20} style={{ color }} className="mb-5" strokeWidth={1.5} />
      <div className="body-sans text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">{label}</div>
      <div className="number text-4xl font-light" style={{ color }}>
        {signed && value < 0 && '−'}{fmt(value)}
      </div>
    </motion.div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="display text-2xl md:text-3xl font-light" style={{ color: '#2C2416' }}>
          <span className="ornament" />{title}
        </h2>
        {subtitle && <span className="body-sans text-xs uppercase tracking-[0.2em] text-stone-500">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function TxRow({ t, onRemove }) {
  const isIncome = t.type === 'income';
  return (
    <motion.li
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="py-4 flex items-center gap-4 group"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${CATEGORY_COLORS[t.category] || '#8A8275'}20` }}>
        <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[t.category] || '#8A8275' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="display text-base text-stone-800 truncate flex items-center gap-2">
          {t.description}
          {t.recurring && <Repeat size={11} className="text-stone-400" />}
        </div>
        <div className="body-sans text-xs text-stone-500 mt-0.5">
          {t.category} · {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div className="number text-lg font-light" style={{ color: isIncome ? '#3D6B4A' : '#2C2416' }}>
        {isIncome ? '+' : '−'}{fmt(t.amount)}
      </div>
      <button onClick={() => onRemove(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-stone-100 rounded">
        <Trash2 size={14} className="text-stone-400" />
      </button>
    </motion.li>
  );
}

function Projections({ transactions }) {
  const recurring = transactions.filter(t => t.recurring);
  const monthlyRecurringIncome = recurring.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthlyRecurringExpense = recurring.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netMonthly = monthlyRecurringIncome - monthlyRecurringExpense;

  const projection = useMemo(() => {
    const months = [];
    let cumulative = 0;
    for (let i = 0; i < 12; i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      cumulative += netMonthly;
      months.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        income: monthlyRecurringIncome,
        expenses: monthlyRecurringExpense,
        cumulative
      });
    }
    return months;
  }, [netMonthly, monthlyRecurringIncome, monthlyRecurringExpense]);

  return (
    <div className="space-y-10">
      <div className="rounded-2xl p-8 md:p-10" style={{ background: 'rgba(44,36,22,0.97)', color: '#F5F1E8' }}>
        <div className="display italic text-xs tracking-wider opacity-60 mb-3">A look ahead</div>
        <div className="display text-3xl md:text-4xl font-light mb-1">
          {netMonthly >= 0 ? 'You\'re saving ' : 'You\'re losing '}
          <em className="italic" style={{ color: netMonthly >= 0 ? '#9BC4A8' : '#D89992' }}>
            {fmt(Math.abs(netMonthly))}
          </em>
          {' '}per month
        </div>
        <div className="body-sans text-sm opacity-70 mt-2">
          Based on {recurring.length} recurring {recurring.length === 1 ? 'item' : 'items'}.
          In a year, that's <span className="number">{fmt(Math.abs(netMonthly * 12))}</span>.
        </div>
      </div>

      <Section title="12-Month Projection" subtitle="Cumulative balance">
        {recurring.length === 0 ? (
          <Empty msg="Mark transactions as recurring to see projections here." />
        ) : (
          <div className="rounded-2xl p-6 md:p-8" style={{ background: 'rgba(255,251,242,0.7)', border: '1px solid rgba(139,90,60,0.15)' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={projection} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(44,36,22,0.08)" />
                <XAxis dataKey="month" stroke="#8A8275" fontSize={11} tick={{ fontFamily: 'Inter' }} />
                <YAxis stroke="#8A8275" fontSize={11} tick={{ fontFamily: 'Inter' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.3)', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="cumulative" stroke="#8B5A3C" strokeWidth={2.5} dot={{ fill: '#8B5A3C', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Recurring Items" subtitle={`${recurring.length} active`}>
        {recurring.length === 0 ? (
          <Empty msg="No recurring transactions yet." />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {recurring.map(t => (
              <div key={t.id} className="rounded-xl p-5 flex items-center justify-between" style={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.15)' }}>
                <div>
                  <div className="display text-base text-stone-800">{t.description}</div>
                  <div className="body-sans text-xs text-stone-500 mt-1">{t.category} · monthly</div>
                </div>
                <div className="number text-lg" style={{ color: t.type === 'income' ? '#3D6B4A' : '#A85751' }}>
                  {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Reports({ transactions }) {
  const expenses = transactions.filter(t => t.type === 'expense');

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byMonth = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: key, income: 0, expenses: 0 };
      map[key][t.type === 'income' ? 'income' : 'expenses'] += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(m => ({
      ...m,
      label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' })
    }));
  }, [transactions]);

  const totalExpenses = byCategory.reduce((s, c) => s + c.value, 0);

  if (transactions.length === 0) {
    return <Empty msg="Add some transactions to see reports." />;
  }

  return (
    <div className="space-y-10">
      <Section title="Spending by Category" subtitle={fmt(totalExpenses) + ' total'}>
        {byCategory.length === 0 ? (
          <Empty msg="No expenses recorded yet." />
        ) : (
          <div className="grid md:grid-cols-2 gap-8 rounded-2xl p-6 md:p-8" style={{ background: 'rgba(255,251,242,0.7)', border: '1px solid rgba(139,90,60,0.15)' }}>
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {byCategory.map((c, i) => <Cell key={i} fill={CATEGORY_COLORS[c.name] || '#8A8275'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.3)', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }} formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {byCategory.map((c, i) => {
                const pct = (c.value / totalExpenses * 100).toFixed(1);
                return (
                  <div key={c.name}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="display text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[c.name] || '#8A8275' }} />
                        {c.name}
                      </span>
                      <span className="number text-sm">{fmt(c.value)} <span className="text-stone-400 text-xs">· {pct}%</span></span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(44,36,22,0.06)' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-full rounded-full" style={{ background: CATEGORY_COLORS[c.name] || '#8A8275' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Monthly Comparison" subtitle="Last 6 months">
        <div className="rounded-2xl p-6 md:p-8" style={{ background: 'rgba(255,251,242,0.7)', border: '1px solid rgba(139,90,60,0.15)' }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(44,36,22,0.08)" />
              <XAxis dataKey="label" stroke="#8A8275" fontSize={11} tick={{ fontFamily: 'Inter' }} />
              <YAxis stroke="#8A8275" fontSize={11} tick={{ fontFamily: 'Inter' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.3)', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }} formatter={(v) => fmt(v)} />
              <Bar dataKey="income" fill="#3D6B4A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="#A85751" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

function TransactionForm({ onClose, onSave }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);

  const handleSubmit = () => {
    if (!amount || !description || Number(amount) <= 0) return;
    onSave({ type, amount: Number(amount), description, category, date, recurring });
    onClose();
  };

  useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
  }, [type]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: 'rgba(44,36,22,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-7"
        style={{ background: '#FFFBF2', border: '1px solid rgba(139,90,60,0.2)' }}
      >
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="display text-2xl font-light" style={{ color: '#2C2416' }}>New entry</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-full" style={{ background: 'rgba(44,36,22,0.06)' }}>
          {['expense', 'income'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className="body-sans py-2.5 rounded-full text-sm font-medium capitalize transition-all"
              style={{
                background: type === t ? (t === 'income' ? '#3D6B4A' : '#A85751') : 'transparent',
                color: type === t ? '#F5F1E8' : '#5C5142'
              }}>{t}</button>
          ))}
        </div>

        <div className="space-y-4">
          <Field label="Amount">
            <div className="flex items-baseline gap-2">
              <span className="display text-3xl text-stone-400">$</span>
              <input
                type="number" step="0.01" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="number text-3xl bg-transparent outline-none flex-1 font-light"
                style={{ color: '#2C2416' }}
              />
            </div>
          </Field>

          <Field label="Description">
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What was it for?"
              className="body-sans w-full bg-transparent outline-none py-1 border-b"
              style={{ borderColor: 'rgba(139,90,60,0.2)', color: '#2C2416' }}
            />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES[type].map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className="body-sans text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: category === c ? (CATEGORY_COLORS[c] || '#8A8275') : 'rgba(44,36,22,0.05)',
                    color: category === c ? '#FFFBF2' : '#5C5142'
                  }}>{c}</button>
              ))}
            </div>
          </Field>

          <Field label="Date">
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="body-sans bg-transparent outline-none py-1 border-b"
              style={{ borderColor: 'rgba(139,90,60,0.2)', color: '#2C2416' }}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4 accent-amber-800" />
            <span className="body-sans text-sm text-stone-600 flex items-center gap-1.5">
              <Repeat size={13} /> This repeats every month
            </span>
          </label>
        </div>

        <button onClick={handleSubmit}
          disabled={!amount || !description}
          className="body-sans w-full mt-7 py-3.5 rounded-full font-medium text-sm tracking-wide transition-all disabled:opacity-40"
          style={{ background: '#2C2416', color: '#F5F1E8' }}>
          Add to ledger
        </button>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="body-sans text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">{label}</div>
      {children}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="rounded-2xl py-16 text-center" style={{ background: 'rgba(255,251,242,0.4)', border: '1px dashed rgba(139,90,60,0.2)' }}>
      <p className="display italic text-stone-500">{msg}</p>
    </div>
  );
}
