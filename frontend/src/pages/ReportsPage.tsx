import { useState, useMemo } from "react";
import { formatCurrency, formatMonth, formatMonthFull, formatDayShort, formatDayFull, toISODate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import {
  TrendingUp,
  TrendingDown,
  Download,
  PiggyBank,
  CreditCard,
} from "lucide-react";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import { subMonths } from "date-fns";
import { useReports } from "../hooks/useReports";
import IncomeExpenseChart from "../components/reports/IncomeExpenseChart";
import CategoryBreakdown from "../components/reports/CategoryBreakdown";
import EquityEvolution from "../components/reports/EquityEvolution";
import MonthlySummaryTable from "../components/reports/MonthlySummaryTable";
import { SkeletonCard, SkeletonChart } from "../components/common/Skeleton";

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<"days" | "months">("months");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const { showMoney } = useMoneyVisibility();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    start: subMonths(today, 6),
    end: today,
    label: "Últimos 6 meses",
    months: 6,
  });

  const startStr = toISODate(dateRange.start);
  const endStr = toISODate(dateRange.end);

  const { data, isLoading: loading } = useReports({
    start_date: startStr,
    end_date: endStr,
    granularity: viewMode === "days" ? "day" : "month",
  });

  const isDaily = viewMode === "days";

  const barData = useMemo(() => {
    if (!data) return [];
    return data.monthly_trend.map((m: any) => ({
      ...m,
      name: isDaily ? formatDayShort(m.month) : formatMonth(m.month),
      fullName: isDaily ? formatDayFull(m.month) : formatMonthFull(m.month),
      saldo: m.income - m.expense,
    }));
  }, [data, isDaily]);

  const lineData = useMemo(() => {
    if (!data) return [];
    return (data.equity_trend || []).map((m: any) => ({
      name: isDaily ? formatDayShort(m.month) : formatMonth(m.month),
      patrimonio: m.equity,
    }));
  }, [data, isDaily]);

  const stats = useMemo(() => {
    if (!barData.length) return null;
    const totalIncome = barData.reduce((s: number, d: any) => s + d.income, 0);
    const totalExpense = barData.reduce((s: number, d: any) => s + d.expense, 0);
    const totalBalance = totalIncome - totalExpense;

    const lastMonth = barData[barData.length - 1];
    const prevMonth = barData.length > 1 ? barData[barData.length - 2] : null;

    const incomeChange =
      prevMonth && prevMonth.income > 0
        ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100
        : 0;
    const expenseChange =
      prevMonth && prevMonth.expense > 0
        ? ((lastMonth.expense - prevMonth.expense) / prevMonth.expense) * 100
        : 0;

    const balanceChange =
      totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

    const firstEquity = lineData.length > 0 ? lineData[0].patrimonio : 0;
    const lastEquity = lineData.length > 0 ? lineData[lineData.length - 1].patrimonio : 0;
    const equityGrowth =
      firstEquity > 0 ? ((lastEquity - firstEquity) / firstEquity) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      totalBalance,
      incomeChange,
      expenseChange,
      balanceChange,
      equityGrowth,
    };
  }, [barData, lineData]);

  const pieData = useMemo(() => {
    if (!data || !data.expense_by_category?.length) return [];
    const total = data.expense_by_category.reduce(
      (acc: number, e: any) => acc + e.value,
      0
    );
    return data.expense_by_category.map((e: any) => ({
      ...e,
      percent: total > 0 ? (e.value / total) * 100 : 0,
    }));
  }, [data]);

  const categoryInfo = useMemo(() => {
    if (!data?.trend_by_category) return { incomeCategories: [] as { name: string; color: string }[], expenseCategories: [] as { name: string; color: string }[] };

    const incomeCats = new Map<string, string>();
    const expenseCats = new Map<string, string>();

    for (const period of Object.values(data.trend_by_category) as any[]) {
      for (const cat of period.income) {
        incomeCats.set(cat.name, cat.color);
      }
      for (const cat of period.expense) {
        expenseCats.set(cat.name, cat.color);
      }
    }

    return {
      incomeCategories: Array.from(incomeCats.entries()).map(([name, color]) => ({ name, color })),
      expenseCategories: Array.from(expenseCats.entries()).map(([name, color]) => ({ name, color })),
    };
  }, [data]);

  const stackedBarData = useMemo(() => {
    if (!data?.trend_by_category || (!categoryInfo.incomeCategories.length && !categoryInfo.expenseCategories.length)) return barData;

    return barData.map((row: any) => {
      const periodCats = data.trend_by_category[row.month] || { income: [], expense: [] };
      const newRow = { ...row };

      for (const cat of categoryInfo.incomeCategories) {
        const found = periodCats.income.find((c: any) => c.name === cat.name);
        newRow[`inc_${cat.name}`] = found ? found.value : 0;
      }

      for (const cat of categoryInfo.expenseCategories) {
        const found = periodCats.expense.find((c: any) => c.name === cat.name);
        newRow[`exp_${cat.name}`] = found ? found.value : 0;
      }

      return newRow;
    });
  }, [barData, data, categoryInfo]);

  const activePieData = useMemo(() => {
    if (!selectedPeriod || !data?.trend_by_category?.[selectedPeriod]) {
      return pieData;
    }

    const periodExpenses = data.trend_by_category[selectedPeriod].expense as any[];
    if (!periodExpenses.length) return [];
    const total = periodExpenses.reduce((acc: number, e: any) => acc + e.value, 0);
    return periodExpenses.map((e: any) => ({
      ...e,
      percent: total > 0 ? (e.value / total) * 100 : 0,
    }));
  }, [selectedPeriod, data, pieData]);

  const activePieTotal = useMemo(() => {
    return activePieData.reduce((acc: number, e: any) => acc + e.value, 0);
  }, [activePieData]);

  const selectedPeriodName = useMemo(() => {
    if (!selectedPeriod) return null;
    return isDaily ? formatDayFull(selectedPeriod) : formatMonthFull(selectedPeriod);
  }, [selectedPeriod, isDaily]);

  function handleBarClick(data: any) {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const month = data.activePayload[0].payload.month;
      setSelectedPeriod((prev) => (prev === month ? null : month));
    }
  }

  function handleClearSelection() {
    setSelectedPeriod(null);
  }

  function handleDownload() {
    if (!barData.length) return;
    const headers = ["Mês", "Receitas", "Despesas"];
    const rows = barData.map((r: any) => [r.fullName, r.income, r.expense]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-surface animate-pulse rounded" />
            <div className="h-3 w-56 bg-surface/60 animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-surface animate-pulse rounded-xl" />
            <div className="h-9 w-36 bg-surface animate-pulse rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonChart className="h-64" />
        <SkeletonChart />
      </div>
    );
  }

  if (!data) return <p className="text-muted">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Relatórios</h2>
          <p className="text-sm text-muted mt-1">
            Visão geral detalhada do seu desempenho financeiro.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-primary-light rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("days")}
              className={`px-4 py-2 text-sm font-medium transition cursor-pointer ${
                viewMode === "days"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Dias
            </button>
            <button
              onClick={() => setViewMode("months")}
              className={`px-4 py-2 text-sm font-medium transition cursor-pointer ${
                viewMode === "months"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Meses
            </button>
          </div>

          <DateRangePicker value={dateRange} onChange={setDateRange} />

          <button
            onClick={handleDownload}
            className="p-2.5 bg-primary-light border border-border rounded-xl text-muted hover:text-white hover:border-accent transition cursor-pointer"
            title="Exportar CSV"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Total Receitas</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalIncome || 0, showMoney)}
            </p>
            {stats && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  stats.incomeChange >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {stats.incomeChange >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                <span>
                  {stats.incomeChange >= 0 ? "+" : ""}
                  {stats.incomeChange.toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-success" />
          </div>
        </div>

        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Total Despesas</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalExpense || 0, showMoney)}
            </p>
            {stats && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  stats.expenseChange <= 0 ? "text-success" : "text-danger"
                }`}
              >
                {stats.expenseChange <= 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                <span>
                  {stats.expenseChange >= 0 ? "+" : ""}
                  {stats.expenseChange.toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
            <CreditCard size={20} className="text-danger" />
          </div>
        </div>

        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Valor Investido</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(data.total_invested_net_period || 0, showMoney)}
            </p>
            <p className="text-xs text-muted mt-2">Aportes − resgates no período</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <PiggyBank size={20} className="text-accent" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <IncomeExpenseChart
          stackedBarData={stackedBarData}
          categoryInfo={categoryInfo}
          investmentTrend={data.investment_trend}
          selectedPeriod={selectedPeriod}
          onBarClick={handleBarClick}
          onClearSelection={handleClearSelection}
          showMoney={showMoney}
        />
        <CategoryBreakdown
          activePieData={activePieData}
          activePieTotal={activePieTotal}
          selectedPeriodName={selectedPeriodName}
          selectedPeriod={selectedPeriod}
          onClearSelection={handleClearSelection}
          showMoney={showMoney}
        />
      </div>

      {/* Equity Evolution */}
      <EquityEvolution
        lineData={lineData}
        equityGrowth={stats?.equityGrowth ?? null}
        showMoney={showMoney}
      />

      {/* Monthly Summary Table */}
      <MonthlySummaryTable
        barData={barData}
        trendByCategory={data.trend_by_category}
        isDaily={isDaily}
        showMoney={showMoney}
      />
    </div>
  );
}
