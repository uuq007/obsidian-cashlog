import { setIcon } from "obsidian";
import type CashlogPlugin from "./main";
import type { CashlogEntry } from "./EntryLocation";
import type { CashlogSettings } from "./Settings";
import { AccountManager } from "./AccountManager";
import { BudgetManager, computePeriodRange } from "./BudgetManager";
import { DateRange } from "./Query/DateRange";
import { t, tp, formatMoney, formatMoneyUnsigned } from "./i18n";

// 仪表盘回调接口
export interface DashboardCallbacks {
  showEntries: (entries: CashlogEntry[], title: string, extra?: { accountName?: string; initialBalance?: number }) => void;
  showPieChart: (entries: CashlogEntry[], expenseTag: string) => void;
}

export function renderDashboard(container: HTMLElement, plugin: CashlogPlugin, callbacks: DashboardCallbacks, hideAmounts: boolean, onToggleHide: () => void): void {
  const entries = plugin.cache.getEntries();
  const settings = plugin.settings;
  const budgetManager = new BudgetManager();

  // 计算统计周期
  const period = getStatsPeriod(settings);
  const periodEntries = period
    ? entries.filter((e) => e.date && e.date.isSameOrAfter(period.start) && e.date.isSameOrBefore(period.end))
    : entries;

  // 单次遍历分类计算概要数据
  let totalIncome = 0;
  let totalExpense = 0;
  const incomeEntries: CashlogEntry[] = [];
  const expenseEntries: CashlogEntry[] = [];
  const normalEntries: CashlogEntry[] = [];

  for (const e of periodEntries) {
    if (e.isTransfer || e.isBalanceChange) continue;
    normalEntries.push(e);
    if (e.isIncome) {
      totalIncome += e.amount;
      incomeEntries.push(e);
    } else if (e.isExpense) {
      totalExpense += Math.abs(e.amount);
      expenseEntries.push(e);
    }
  }
  const balance = totalIncome - totalExpense;
  const count = periodEntries.length;

  // 统计时间范围
  renderPeriodLabel(container, period, settings, hideAmounts, onToggleHide);

  // 摘要卡片
  renderSummaryCards(container, totalIncome, totalExpense, balance, count, incomeEntries, expenseEntries, normalEntries, periodEntries, callbacks, hideAmounts);

  // 账户余额（如开启账户功能）
  if (settings.enableAccounts) {
    const balances = AccountManager.getBalanceList(
      entries,
      settings.accountBalances,
      settings.accounts,
    );
    renderAccountBalances(container, balances, entries, settings, callbacks, hideAmounts);
  }

  // 预算进度（如开启预算功能）
  if (settings.enableBudgets && settings.budgets.length > 0) {
    const budgetProgress = budgetManager.getBudgetProgress(
      entries,
      settings.budgets,
      settings.statsWeekStartDay,
      settings.statsMonthStartDay,
    );
    renderBudgetProgress(container, budgetProgress, callbacks);
  }

  // 目标进度（如开启目标功能）
  if (settings.enableGoals && settings.goals.length > 0) {
    const goalProgress = budgetManager.getGoalProgress(
      entries,
      settings.goals,
      settings.statsWeekStartDay,
      settings.statsMonthStartDay,
    );
    renderGoalProgress(container, goalProgress, callbacks);
  }

  // 最近交易（复用已分类的 normalEntries）
  const recentEntries = [...normalEntries]
    .sort((a, b) => {
      const da = a.date ? a.date.valueOf() : 0;
      const db = b.date ? b.date.valueOf() : 0;
      return db - da;
    })
    .slice(0, 10);
  renderRecentEntries(container, recentEntries);

  // 支出分类排行（复用已分离的 expenseEntries）
  if (totalExpense > 0) {
    renderCategoryRankFromEntries(container, expenseEntries, periodEntries, settings, callbacks);
  }
}

// 根据设置计算统计周期（委托共用函数）
function getStatsPeriod(settings: CashlogSettings): DateRange | null {
  return computePeriodRange(
    settings.statsMode,
    settings.statsWeekStartDay,
    settings.statsMonthStartDay,
  );
}

// 统计时间范围标签
function renderPeriodLabel(
  container: HTMLElement,
  period: DateRange | null,
  settings: CashlogSettings,
  hideAmounts: boolean,
  onToggleHide: () => void,
): void {
  const modeLabels: Record<string, string> = {
    day: t("dashboard.period.day"),
    week: t("dashboard.period.week"),
    month: t("dashboard.period.month"),
    year: t("dashboard.period.year"),
    all: t("dashboard.period.all")
  };
  const modeLabel = modeLabels[settings.statsMode] || t("dashboard.period.all");

  if (period) {
    const startStr = period.start.format("YYYY-MM-DD");
    const endStr = period.end.format("YYYY-MM-DD");
    const label = container.createEl("div", { cls: "cashlog-period-label" });
    label.createEl("span", { text: modeLabel, cls: "cashlog-period-mode" });
    label.createEl("span", { text: `${startStr} ~ ${endStr}`, cls: "cashlog-period-range" });
    const toggleBtn = label.createEl("span", { cls: "cashlog-period-toggle" });
    setIcon(toggleBtn, hideAmounts ? "eye-off" : "eye");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onToggleHide();
    });
  } else {
    const label = container.createEl("div", { cls: "cashlog-period-label" });
    label.createEl("span", { text: modeLabel, cls: "cashlog-period-mode" });
    const toggleBtn = label.createEl("span", { cls: "cashlog-period-toggle" });
    setIcon(toggleBtn, hideAmounts ? "eye-off" : "eye");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onToggleHide();
    });
  }
}

// 概要卡片
function renderSummaryCards(
  container: HTMLElement,
  income: number,
  expense: number,
  balance: number,
  count: number,
  incomeEntries: CashlogEntry[],
  expenseEntries: CashlogEntry[],
  normalEntries: CashlogEntry[],
  allEntries: CashlogEntry[],
  callbacks: DashboardCallbacks,
  hideAmounts: boolean,
): void {
  const cardsRow = container.createEl("div", { cls: "cashlog-summary-cards" });

  renderCard(cardsRow, t("dashboard.card.income"), income, "cashlog-card-income", hideAmounts, () => {
    callbacks.showEntries(incomeEntries, t("dashboard.incomeDetail"));
  });
  renderCard(cardsRow, t("dashboard.card.expense"), expense, "cashlog-card-expense", hideAmounts, () => {
    callbacks.showEntries(expenseEntries, t("dashboard.expenseDetail"));
  });
  renderCard(cardsRow, t("dashboard.card.balance"), balance, "cashlog-card-balance", hideAmounts, () => {
    callbacks.showEntries(normalEntries, t("dashboard.incomeExpenseDetail"));
  });
  renderCard(cardsRow, t("dashboard.card.count"), count, "cashlog-card-count", false, () => {
    callbacks.showEntries(allEntries, t("dashboard.allEntries"));
  });
}

function renderCard(
  row: HTMLElement,
  label: string,
  value: number,
  cls: string,
  hideAmounts: boolean,
  onClick?: () => void,
): void {
  const card = row.createEl("div", { cls: `cashlog-card ${cls}` });
  card.createEl("div", { cls: "cashlog-card-label", text: label });
  const formatted = label === t("dashboard.card.count")
    ? String(value)
    : hideAmounts
      ? "***"
      : formatMoney(value);
  card.createEl("div", { cls: "cashlog-card-value", text: formatted });

  if (onClick) {
    card.addEventListener("click", onClick);
  }
}

// 账户余额
function renderAccountBalances(
  container: HTMLElement,
  balances: Array<{ account: string; balance: number }>,
  allEntries: CashlogEntry[],
  settings: CashlogSettings,
  callbacks: DashboardCallbacks,
  hideAmounts: boolean,
): void {
  const section = container.createEl("div", { cls: "cashlog-section" });
  section.createEl("h4", { text: t("dashboard.section.accountBalances"), cls: "cashlog-section-title" });

  const table = section.createEl("table", { cls: "cashlog-account-table" });
  for (const b of balances) {
    const row = table.createEl("tr");
    row.createEl("td", { text: `💳 ${b.account}`, cls: "cashlog-account-name" });
    const amount = hideAmounts
      ? "***"
      : formatMoney(b.balance);
    const valueCls = b.balance >= 0 ? "cashlog-amount-income" : "cashlog-amount-expense";
    row.createEl("td", { text: amount, cls: valueCls });

    // 点击跳转到该账户的明细页面
    row.addEventListener("click", () => {
      const accountEntries = allEntries.filter((e) =>
        e.accountAmounts.some((aa) => aa.account === b.account),
      );
      const initialBalance = settings.accountBalances[b.account] || 0;
      callbacks.showEntries(accountEntries, tp("dashboard.accountLabel", { account: b.account }), {
        accountName: b.account,
        initialBalance,
      });
    });
  }
}

// 预算进度条
function renderBudgetProgress(
  container: HTMLElement,
  progress: Array<{ config: { name: string; amount: number; tag?: string; period?: string }; spent: number; remaining: number; percentage: number; isOverspent: boolean; matchingEntries: CashlogEntry[] }>,
  callbacks: DashboardCallbacks,
): void {
  const section = container.createEl("div", { cls: "cashlog-section" });
  section.createEl("h4", { text: t("dashboard.section.budgetProgress"), cls: "cashlog-section-title" });

  for (const p of progress) {
    const item = section.createEl("div", { cls: "cashlog-progress-item" });
    const header = item.createEl("div", { cls: "cashlog-progress-header" });
    header.createEl("span", { text: p.config.name });
    const periodLabel = p.config.period ? ` · ${p.config.period}` : "";
    header.createEl("span", {
      text: `¥${formatMoneyUnsigned(p.spent)} / ¥${formatMoneyUnsigned(p.config.amount)}${periodLabel}`,
      cls: p.isOverspent ? "cashlog-amount-expense" : "",
    });

    const bar = item.createEl("div", { cls: "cashlog-progress-bar" });
    const fill = bar.createEl("div", {
      cls: "cashlog-progress-fill" + (p.isOverspent ? " overspent" : ""),
    });
    fill.style.width = `${Math.min(100, p.percentage)}%`;

    // 点击跳转到该预算的支出条目（使用 BudgetManager 已过滤的条目）
    item.addEventListener("click", () => {
      callbacks.showEntries(p.matchingEntries, tp("dashboard.budgetLabel", { name: p.config.name }));
    });
  }
}

// 目标进度条
function renderGoalProgress(
  container: HTMLElement,
  progress: Array<{ config: { name: string; targetAmount: number; tag?: string; period?: string }; earned: number; remaining: number; percentage: number; isAchieved: boolean; matchingEntries: CashlogEntry[] }>,
  callbacks: DashboardCallbacks,
): void {
  const section = container.createEl("div", { cls: "cashlog-section" });
  section.createEl("h4", { text: t("dashboard.section.goalProgress"), cls: "cashlog-section-title" });

  for (const p of progress) {
    const item = section.createEl("div", { cls: "cashlog-progress-item" });
    const header = item.createEl("div", { cls: "cashlog-progress-header" });
    header.createEl("span", { text: p.config.name });
    const periodLabel = p.config.period ? ` · ${p.config.period}` : "";
    header.createEl("span", {
      text: `¥${formatMoneyUnsigned(p.earned)} / ¥${formatMoneyUnsigned(p.config.targetAmount)}${periodLabel}`,
      cls: p.isAchieved ? "cashlog-amount-income" : "",
    });

    const bar = item.createEl("div", { cls: "cashlog-progress-bar" });
    const fill = bar.createEl("div", {
      cls: "cashlog-progress-fill goal" + (p.isAchieved ? " achieved" : ""),
    });
    fill.style.width = `${Math.min(100, p.percentage)}%`;

    // 点击跳转到该目标的收入条目（使用 BudgetManager 已过滤的条目）
    item.addEventListener("click", () => {
      callbacks.showEntries(p.matchingEntries, tp("dashboard.goalLabel", { name: p.config.name }));
    });
  }
}

// 最近交易
function renderRecentEntries(container: HTMLElement, entries: CashlogEntry[]): void {
  const section = container.createEl("div", { cls: "cashlog-section" });
  section.createEl("h4", { text: t("dashboard.section.recentTransactions"), cls: "cashlog-section-title" });

  const list = section.createEl("div", { cls: "cashlog-recent-list" });

  for (const entry of entries) {
    const row = list.createEl("div", { cls: "cashlog-recent-row" });

    const dateStr = entry.date ? entry.date.format("MM-DD") : "--";
    row.createEl("span", { cls: "cashlog-recent-date", text: dateStr });

    const desc = entry.description || entry.tags.join(" ");
    row.createEl("span", { cls: "cashlog-recent-desc", text: desc });

    if (entry.accountAmounts.length > 0) {
      const text = entry.accountAmounts.map((aa) => `💳${aa.account}`).join(" ");
      row.createEl("span", { cls: "cashlog-recent-account", text });
    }

    const sign = entry.isIncome ? "+" : "-";
    const amountCls = entry.isIncome ? "cashlog-amount-income" : "cashlog-amount-expense";
    row.createEl("span", {
      cls: `cashlog-recent-amount ${amountCls}`,
      text: `${sign}¥${formatMoneyUnsigned(Math.abs(entry.totalAmount))}`,
    });

    // 悬浮显示详细信息
    row.addEventListener("mouseenter", (e) => {
      showTooltip(row, entry, e);
    });
    row.addEventListener("mouseleave", () => {
      hideTooltip();
    });
  }

  if (entries.length === 0) {
    list.createEl("div", { cls: "cashlog-empty", text: t("dashboard.emptyTransactions") });
  }
}

// 渲染 tooltip（清理旧 tooltip 后创建新 tooltip）
// 使用闭包变量避免多面板冲突
let _currentTooltip: HTMLElement | null = null;

function showTooltip(anchor: HTMLElement, entry: CashlogEntry, _event: MouseEvent): void {
  hideTooltip();

  _currentTooltip = document.body.createEl("div", { cls: "cashlog-tooltip" });
  const tip = _currentTooltip;

  // 日期时间
  if (entry.date) {
    const dateRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    dateRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.date") });
    let dateText = entry.date.format("YYYY-MM-DD");
    if (entry.time) dateText += " " + entry.time;
    dateRow.createEl("span", { cls: "cashlog-tooltip-value", text: dateText });
  }

  // 标签
  if (entry.tags.length > 0) {
    const tagRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    tagRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.tags") });
    tagRow.createEl("span", { cls: "cashlog-tooltip-value", text: entry.tags.join(" ") });
  }

  // 描述
  if (entry.description) {
    const descRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    descRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.description") });
    descRow.createEl("span", { cls: "cashlog-tooltip-value", text: entry.description });
  }

  // 账户金额明细
  if (entry.accountAmounts.length > 0) {
    for (const aa of entry.accountAmounts) {
      const aaRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
      aaRow.createEl("span", { cls: "cashlog-tooltip-label", text: tp("dashboard.tooltip.account", { account: aa.account }) });
      aaRow.createEl("span", { cls: "cashlog-tooltip-value", text: `¥${aa.amount.toFixed(2)}` });
    }
  } else if (!entry.isTransfer && !entry.isBalanceChange) {
    const amtRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    amtRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.amount") });
    amtRow.createEl("span", { cls: "cashlog-tooltip-value", text: `¥${entry.amount.toFixed(2)}` });
  }

  // 类型标签
  if (entry.isTransfer) {
    const typeRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    typeRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.type") });
    typeRow.createEl("span", { cls: "cashlog-tooltip-value", text: t("dashboard.tooltip.transfer") });
  } else if (entry.isBalanceChange) {
    const typeRow = tip.createEl("div", { cls: "cashlog-tooltip-row" });
    typeRow.createEl("span", { cls: "cashlog-tooltip-label", text: t("dashboard.tooltip.type") });
    typeRow.createEl("span", { cls: "cashlog-tooltip-value", text: t("dashboard.tooltip.balanceChange") });
  }

  // 定位 tooltip
  const rect = anchor.getBoundingClientRect();
  tip.style.left = `${Math.min(rect.right + 8, window.innerWidth - 290)}px`;
  tip.style.top = `${rect.top}px`;
}

function hideTooltip(): void {
  if (_currentTooltip) {
    _currentTooltip.remove();
    _currentTooltip = null;
  }
}

// 支出分类排行（接收预筛选的 expenseEntries 和全部 periodEntries）
function renderCategoryRankFromEntries(
  container: HTMLElement,
  expenseEntries: CashlogEntry[],
  allEntries: CashlogEntry[],
  settings: { expenseTag: string },
  callbacks: DashboardCallbacks,
): void {
  const section = container.createEl("div", { cls: "cashlog-section" });
  const titleEl = section.createEl("h4", { text: t("dashboard.section.categoryRanking"), cls: "cashlog-section-title" });
  titleEl.addEventListener("click", () => {
    callbacks.showPieChart(allEntries, settings.expenseTag);
  });

  const categoryMap: Record<string, number> = {};
  const categoryEntryMap: Record<string, CashlogEntry[]> = {};

  for (const entry of expenseEntries) {
    const category = entry.getCategory(settings.expenseTag) || t("dashboard.categoryFallback");
    categoryMap[category] = (categoryMap[category] || 0) + Math.abs(entry.amount);
    if (!categoryEntryMap[category]) categoryEntryMap[category] = [];
    categoryEntryMap[category].push(entry);
  }

  const ranked = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalExpense = ranked.reduce((sum, [, amt]) => sum + amt, 0);

  for (const [category, amount] of ranked) {
    const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
    const item = section.createEl("div", { cls: "cashlog-progress-item" });
    const header = item.createEl("div", { cls: "cashlog-progress-header" });
    header.createEl("span", { text: category });
    header.createEl("span", {
      text: `¥${formatMoneyUnsigned(amount)} (${pct.toFixed(1)}%)`,
    });

    const bar = item.createEl("div", { cls: "cashlog-progress-bar" });
    const fill = bar.createEl("div", { cls: "cashlog-progress-fill category" });
    fill.style.width = `${Math.min(100, pct)}%`;

    // 点击跳转到该分类的支出条目
    item.addEventListener("click", () => {
      const catEntries = categoryEntryMap[category] || [];
      callbacks.showEntries(catEntries, tp("dashboard.categoryLabel", { category }));
    });
  }
}

