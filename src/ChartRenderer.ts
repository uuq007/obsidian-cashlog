/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { MarkdownRenderChild, TFile } from "obsidian";
import { t, tp } from "./i18n";
import { Query, TableColConfig, parseTableConfig, createDefaultTableConfig } from "./Query/Query";
import type { ChartConfig, GroupByField, SplitBy, PieValueType } from "./Query/Query";
import { QueryResult, EntryGroup } from "./Query/Filter";
import { CashlogEntry } from "./EntryLocation";
import { extractNoteName, renderAttachmentLink } from "./PathUtils";
import type CashlogPlugin from "./main";
import { getErrorMessage } from "./ErrorUtils";
import { Chart, registerables, type TooltipItem } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Context as DatalabelsContext } from "chartjs-plugin-datalabels/types/context";

Chart.register(...registerables, ChartDataLabels);

// 字段标签映射
const FIELD_LABELS: Record<TableColConfig["field"], string> = {
  date: t("chart.field.date"),
  amount: t("chart.field.amount"),
  description: t("chart.field.description"),
  link: t("chart.field.link"),
  account: t("chart.field.account"),
  attachment: t("chart.field.attachment"),
};

// 渲染 cashlog-chart 代码块为动态 HTML 表格
export function renderChartTable(
  containerEl: HTMLElement,
  result: QueryResult,
  query: Query,
  tableConfig?: ReturnType<typeof parseTableConfig>,
  plugin?: CashlogPlugin,
): void {
  const config = tableConfig || createDefaultTableConfig();

  containerEl.empty();
  containerEl.addClass("cashlog-chart");

  // 外层容器用于统一表格对齐
  const wrapper = containerEl.createDiv({ cls: "cashlog-chart-table-wrapper" });

  if (!result.groups?.length) return;

  for (const group of result.groups) {
    // 分组标题
    if (result.groups.length > 1) {
      wrapper.createEl("h4", { cls: "cashlog-chart-group", text: group.key });
    }

    // 表格
    const table = wrapper.createEl("table", { cls: "cashlog-chart-table" });

    // 表头
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    const cols = config.cols.slice(0, config.colCount);
    for (const col of cols) {
      const th = headerRow.createEl("th");
      th.textContent = col.header || FIELD_LABELS[col.field];
      th.style.textAlign = col.align;
    }

    // 表体
    const tbody = table.createEl("tbody");
    for (const entry of group.entries) {
      renderEntryRow(tbody, entry, query, config, group.key, plugin);
    }

    // 分组小计
    if (result.groups.length > 1 && query.shouldShowGroupSubtotal) {
      renderGroupSubtotalRow(tbody, group, config.colCount);
    }
  }

  // 总汇总
  if (query.shouldShowChartSummary) {
    renderTotalSummary(containerEl, result);
  }
}

// 渲染单行条目
function renderEntryRow(
  tbody: HTMLElement,
  entry: CashlogEntry,
  query: Query,
  config: ReturnType<typeof parseTableConfig>,
  groupKey: string,
  plugin?: CashlogPlugin,
): void {
  const tr = tbody.createEl("tr");
  const cols = config.cols.slice(0, config.colCount);

  for (const col of cols) {
    switch (col.field) {
      case "date": {
        let timeText = "";
        if (entry.date) {
          timeText = entry.date.format("YYYY-MM-DD");
          if (entry.time) {
            timeText += " " + entry.time;
          }
        }
        const td = tr.createEl("td", { text: timeText || "-" });
        td.style.textAlign = col.align;
        break;
      }
      case "amount": {
        const td = tr.createEl("td");
        td.style.textAlign = col.align;
        const displayAmount = getEntryDisplayAmount(entry, groupKey);
        // 转账/余额变更在非账户分组下总额为0，显示 / 表示无意义
        if ((entry.isTransfer || entry.isBalanceChange) && displayAmount === 0) {
          td.setText("/");
        } else {
          td.createSpan({
            cls: displayAmount < 0 ? "cashlog-amount-expense" : "cashlog-amount-income",
            text: `${displayAmount}`,
          });
        }
        break;
      }
      case "description": {
        const td = tr.createEl("td", { cls: "cashlog-chart-desc" });
        td.style.textAlign = col.align;
        if (query.shouldShowTagInDescription && entry.tags.length > 0) {
          for (const tag of entry.tags) {
            td.createEl("a", {
              cls: "tag",
              attr: { href: tag },
              text: tag,
            });
            td.appendText(" ");
          }
        }
        if (entry.description) {
          td.appendText(entry.description);
        }
        if (!td.textContent) {
          td.setText("-");
        }
        break;
      }
      case "account": {
        const td = tr.createEl("td");
        td.style.textAlign = col.align;
        if (entry.accountAmounts.length > 0) {
          for (const aa of entry.accountAmounts) {
            const amountCls = aa.amount < 0 ? "cashlog-amount-expense" : "cashlog-amount-income";
            const div = td.createDiv();
            div.createSpan({ text: `💳${aa.account}💴` });
            div.createSpan({ cls: amountCls, text: `${aa.amount}` });
          }
        } else {
          td.setText("-");
        }
        break;
      }
      case "attachment": {
        const td = tr.createEl("td");
        td.style.textAlign = col.align;
        if (entry.attachments.length > 0 && plugin) {
          const folder = plugin.settings.attachmentFolder;
          for (let i = 0; i < entry.attachments.length; i++) {
            renderAttachmentLink(td, entry.attachments[i], folder, (fullPath) => {
              const file = plugin.app.vault.getAbstractFileByPath(fullPath);
              if (file && file instanceof TFile) {
                void plugin.app.workspace.getLeaf().openFile(file);
              }
            });
            if (i < entry.attachments.length - 1) {
              td.appendText(" ");
            }
          }
        } else {
          td.setText("-");
        }
        break;
      }
      case "link": {
        const td = tr.createEl("td", { cls: "cashlog-chart-link" });
        td.style.textAlign = col.align;
        if (entry.location) {
          const noteName = extractNoteName(entry.location.path);
          const linkEl = td.createEl("a", {
            cls: "internal-link",
            text: noteName,
            attr: {
              "data-href": entry.location.path,
              href: entry.location.path,
            },
          });
          const locPath = entry.location.path;
          linkEl.addEventListener("click", (e) => {
            e.preventDefault();
            const file = plugin?.app.vault.getAbstractFileByPath(locPath);
            if (file && file instanceof TFile) {
              void plugin?.app.workspace.getLeaf().openFile(file);
            }
          });
        } else {
          td.setText("-");
        }
        break;
      }
    }
  }
}

// 渲染分组小计行
function renderGroupSubtotalRow(tbody: HTMLElement, group: EntryGroup, colCount: number): void {
  const groupKey = group.key;
  const totalIncome = group.entries
    .filter((e) => getEntryDisplayAmount(e, groupKey) > 0)
    .reduce((sum, e) => sum + getEntryDisplayAmount(e, groupKey), 0);
  const totalExpense = group.entries
    .filter((e) => getEntryDisplayAmount(e, groupKey) < 0)
    .reduce((sum, e) => sum + getEntryDisplayAmount(e, groupKey), 0);

  const tr = tbody.createEl("tr", { cls: "cashlog-chart-summary-row" });

  // 小计标签列（跨过第一列）
  tr.createEl("td", { text: t("renderer.subtotal") });

  // 收入/支出金额列
  const amountTd = tr.createEl("td", { attr: { colspan: String(colCount - 1) } });
  const roundedIncome = Math.round(totalIncome * 100) / 100;
  const roundedExpense = Math.round(totalExpense * 100) / 100;
  if (roundedIncome !== 0) {
    amountTd.createSpan({ cls: "cashlog-amount-income", text: `+${roundedIncome}` });
  }
  if (roundedExpense !== 0) {
    if (roundedIncome !== 0) amountTd.createSpan({ text: " / " });
    amountTd.createSpan({ cls: "cashlog-amount-expense", text: `${roundedExpense}` });
  }
}

// 渲染总汇总（从所有分组条目中独立计算）
function renderTotalSummary(containerEl: HTMLElement, result: QueryResult): void {
  // 去重：多账户条目会在多个分组中出现，总汇总只计一次
  const seen = new Set<CashlogEntry>();
  const allEntries: CashlogEntry[] = [];
  for (const g of result.groups) {
    for (const e of g.entries) {
      if (!seen.has(e)) {
        seen.add(e);
        allEntries.push(e);
      }
    }
  }
  const totalIncome = allEntries
    .filter((e) => e.amount > 0 && !e.isTransfer && !e.isBalanceChange)
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = allEntries
    .filter((e) => e.amount < 0 && !e.isTransfer && !e.isBalanceChange)
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome + totalExpense;

  const div = containerEl.createDiv({ cls: "cashlog-chart-total-summary" });

  const roundedIncome = Math.round(totalIncome * 100) / 100;
  const roundedExpense = Math.round(totalExpense * 100) / 100;
  const roundedBalance = Math.round(balance * 100) / 100;

  div.createDiv({
    cls: "cashlog-summary-income",
    text: tp("renderer.totalIncomeChart", { amount: roundedIncome.toLocaleString() }),
  });
  div.createDiv({
    cls: "cashlog-summary-expense",
    text: tp("renderer.totalExpenseChart", { amount: roundedExpense.toLocaleString() }),
  });
  div.createDiv({
    cls: "cashlog-summary-balance",
    text: tp("renderer.netBalanceChart", { amount: roundedBalance.toLocaleString() }),
  });
}

// 图表数据接口
export interface ChartDataResult {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor?: string;
    fill?: boolean;
  }[];
}

// 将查询结果转换为图表数据
// 单维度数据转换（扇形图用）
export function transformToChartData(
  result: QueryResult,
  groupBy: GroupByField,
  valueType: PieValueType,
  colors: string[],
): ChartDataResult {
  if (!result.groups?.length) {
    return { labels: [], datasets: [] };
  }

  const isTagOrType = groupBy === "tag" || groupBy === "type";
  const isAccount = groupBy === "account";

  // 收集 (标签, 显示值, 原始值) 三元组
  const slices: { label: string; display: number; raw: number }[] = [];

  for (const group of result.groups) {
    let raw = 0;

    if (isTagOrType) {
      // 按标签/类型：仅统计收支（排除转账和余额变更），显示绝对值
      raw = group.entries
        .filter((e) => !e.isTransfer && !e.isBalanceChange)
        .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
      const display = Math.round(Math.abs(raw) * 100) / 100;
      // 排除转账/余额变更分组（过滤后值为 0 的切片不显示）
      if (display !== 0) {
        slices.push({
          label: formatGroupLabel(group.key, groupBy),
          display,
          raw: Math.round(raw * 100) / 100,
        });
      }
    } else if (isAccount) {
      // 按账户
      switch (valueType) {
        case "income":
          raw = group.entries
            .filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          break;
        case "expense":
          raw = group.entries
            .filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          break;
        case "balance": {
          const inc = group.entries
            .filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          const exp = group.entries
            .filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          raw = inc + exp;
          break;
        }
        case "inflow":
          raw = group.entries
            .reduce((sum, e) => {
              const amt = pickEntryAmountValue(e, groupBy, group.key);
              return amt > 0 ? sum + amt : sum;
            }, 0);
          break;
        case "outflow":
          raw = group.entries
            .reduce((sum, e) => {
              const amt = pickEntryAmountValue(e, groupBy, group.key);
              return amt < 0 ? sum + amt : sum;
            }, 0);
          break;
        case "netflow":
          raw = group.entries
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          break;
      }
      slices.push({
        label: formatGroupLabel(group.key, groupBy),
        display: Math.round(Math.abs(raw) * 100) / 100,
        raw: Math.round(raw * 100) / 100,
      });
    } else {
      // 按日期/周/月/年：仅统计收支（排除转账和余额变更）
      switch (valueType) {
        case "income":
          raw = group.entries
            .filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          break;
        case "expense":
          raw = group.entries
            .filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          break;
        case "balance": {
          const inc = group.entries
            .filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          const exp = group.entries
            .filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((sum, e) => sum + pickEntryAmountValue(e, groupBy, group.key), 0);
          raw = inc + exp;
          break;
        }
        default:
          raw = 0;
      }
      slices.push({
        label: formatGroupLabel(group.key, groupBy),
        display: Math.round(Math.abs(raw) * 100) / 100,
        raw: Math.round(raw * 100) / 100,
      });
    }
  }

  const labels = slices.map((s) => s.label);
  const data = slices.map((s) => s.display);
  const rawValues = slices.map((s) => s.raw);

  const bgColors = data.map((_, i) => colors[i % colors.length]);

  const labelMap: Record<string, string> = {
    income: t("chart.label.income"), expense: t("chart.label.expense"), balance: t("chart.label.balance"),
    inflow: t("chart.label.inflow"), outflow: t("chart.label.outflow"), netflow: t("chart.label.netflow"),
  };
  const label = labelMap[valueType] || "";

  const dataset: ChartDataResult["datasets"][number] & { _rawValues: number[] } = {
    label,
    data,
    backgroundColor: bgColors,
    borderColor: colors[0],
    fill: false,
    _rawValues: rawValues,
  };

  return { labels, datasets: [dataset] };
}

// 扇形图用的简易金额取值（按账户分组时取对应账户金额，否则用总额）
function pickEntryAmountValue(entry: CashlogEntry, groupBy: GroupByField, groupKey: string): number {
  if (groupBy === "account" && entry.accountAmounts.length > 0) {
    const aa = entry.accountAmounts.find((a) => a.account === groupKey);
    if (aa) return aa.amount;
  }
  return entry.amount;
}

// 双维度数据转换（条形图/折线图通用）
function transformSplitChartData(
  result: QueryResult,
  xGroupBy: GroupByField,
  splitBy: SplitBy,
  splitItems: string[],
  colors: string[],
  chartType: "bar" | "line",
): ChartDataResult {
  const labels: string[] = [];

  if (!result.groups?.length) {
    return { labels, datasets: [] };
  }

  // 从 result.groups 获取已按 xGroupBy 分组的条目（Query 已处理好分组）
  // 收集所有 X 组及其条目
  const xGroups: { key: string; entries: CashlogEntry[] }[] = result.groups.map((g) => ({
    key: g.key,
    entries: g.entries,
  }));

  // 日期/周/月份/年份分组时，确保按时间先后排序（渲染层保障）
  if (xGroupBy === "date" || xGroupBy === "week" || xGroupBy === "month" || xGroupBy === "year") {
    xGroups.sort((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  }

  // 格式化 X 轴标签
  for (const g of xGroups) {
    labels.push(formatGroupLabel(g.key, xGroupBy));
  }

  // 确定子分组项
  let splitItemsList: string[] = [];
  switch (splitBy) {
    case "none":
      splitItemsList = ["balance"];
      break;
    case "valueType":
      splitItemsList = ["balance", "income", "expense"];
      break;
    case "type":
      splitItemsList = ["income", "expense"];
      break;
    case "tag":
    case "account":
      splitItemsList = splitItems;
      break;
    case "date":
      splitItemsList = collectDistinctDates(xGroups);
      break;
    case "week":
      splitItemsList = collectDistinctWeeks(xGroups);
      break;
    case "month":
      splitItemsList = collectDistinctMonths(xGroups);
      break;
    case "year":
      splitItemsList = collectDistinctYears(xGroups);
      break;
  }

  if (splitItemsList.length === 0) {
    return { labels, datasets: [] };
  }

  // 为每个子分组项构建数据集
  const datasets: ChartDataResult["datasets"] = splitItemsList.map((item, idx) => {
    const data: number[] = [];
    const rawData: number[] = [];
    for (const xg of xGroups) {
      const rawValue = computeBarValue(xg.entries, splitBy, item, xg.key, xGroupBy);
      rawData.push(Math.round(rawValue * 100) / 100);
      // 条形图用绝对值，折线图保留原始符号
      const displayValue = chartType === "bar" ? Math.abs(rawValue) : rawValue;
      data.push(Math.round(displayValue * 100) / 100);
    }
    const ds: ChartDataResult["datasets"][number] & { _rawData: number[] } = {
      label: formatSplitItemLabel(item, splitBy),
      data,
      backgroundColor: [colors[idx % colors.length]],
      _rawData: rawData,
    };
    return ds;
  });

  return { labels, datasets };
}

// 格式化分组标签
function formatGroupLabel(key: string, groupBy: GroupByField): string {
  switch (groupBy) {
    case "tag": {
      const parts = key.split("/");
      return parts[parts.length - 1];
    }
    case "week":
      return key;
    case "month": {
      const parts = key.split("-");
      if (parts.length >= 2) return `${parts[0]}年${parseInt(parts[1])}月`;
      return key;
    }
    case "year":
      return `${key}年`;
    case "date":
      return key;
    default:
      return key;
  }
}

// 格式化子分组项标签
function formatSplitItemLabel(item: string, splitBy: SplitBy): string {
  switch (splitBy) {
    case "none":
    case "valueType":
      return item === "balance" ? t("chart.label.balance") : item === "income" ? t("chart.label.income") : t("chart.label.expense");
    case "type":
      return item === "income" ? t("chart.label.income") : t("chart.label.expense");
    case "week":
      return item;
    default:
      return item;
  }
}

// 从 accountAmounts 中获取当前分组的金额（可为负）
function getGroupAccountAmount(entry: CashlogEntry, groupKey: string): number {
  const aa = entry.accountAmounts.find((a) => a.account === groupKey);
  return aa?.amount ?? 0;
}

// 获取条目在表格中的显示金额：groupKey 匹配某个账户时才取专属金额，否则用总额
function getEntryDisplayAmount(entry: CashlogEntry, groupKey: string): number {
  if (entry.accountAmounts.length > 0) {
    const aa = entry.accountAmounts.find((a) => a.account === groupKey);
    if (aa) return aa.amount;
  }
  return entry.amount;
}

// 选择计算时使用的金额：子分组按账户时取对应账户金额，X轴按账户时取分组对应金额，否则用总额
function pickEntryAmount(entry: CashlogEntry, splitBy: SplitBy, xGroupBy: GroupByField, item: string, groupKey: string): number {
  if (splitBy === "account") {
    const aa = entry.accountAmounts.find((a) => a.account === item);
    return aa?.amount ?? 0;
  }
  if (xGroupBy === "account" && entry.accountAmounts.length > 0) {
    return getGroupAccountAmount(entry, groupKey);
  }
  return entry.amount;
}

// 计算单个子分组项在某个 X 组内的原始值（带符号）
function computeBarValue(entries: CashlogEntry[], splitBy: SplitBy, item: string, groupKey: string, xGroupBy: GroupByField): number {
  switch (splitBy) {
    case "none": {
      const inc = entries.filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
        .reduce((s, e) => s + e.amount, 0);
      const exp = entries.filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
        .reduce((s, e) => s + e.amount, 0);
      return inc + exp;
    }
    case "valueType": {
      switch (item) {
        case "income":
          return entries.filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        case "expense":
          return entries.filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        case "balance": {
          const inc = entries.filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
          const exp = entries.filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
          return inc + exp;
        }
        default: return 0;
      }
    }
    case "type": {
      switch (item) {
        case "income":
          return entries.filter((e) => e.isIncome && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        case "expense":
          return entries.filter((e) => e.isExpense && !e.isTransfer && !e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        case "transfer":
          return entries.filter((e) => e.isTransfer)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        case "balanceChange":
          return entries.filter((e) => e.isBalanceChange)
            .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
        default: return 0;
      }
    }
    case "tag":
      return entries.filter((e) => e.tags.some((t) => t === item || t.startsWith(item + "/")))
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    case "account":
      return entries.filter((e) => e.accountAmounts.some((aa) => aa.account === item))
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    case "date": {
      return entries.filter((e) => e.date && e.date.format("YYYY-MM-DD") === item)
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    }
    case "week": {
      return entries.filter((e) => e.date && e.date.format("GGGG-WW") + "周" === item)
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    }
    case "month": {
      return entries.filter((e) => e.date && e.date.format("YYYY-MM") === item)
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    }
    case "year": {
      return entries.filter((e) => e.date && e.date.format("YYYY") === item)
        .reduce((s, e) => s + pickEntryAmount(e, splitBy, xGroupBy, item, groupKey), 0);
    }
    default: return 0;
  }
}

// 从数据中收集所有不同日期
function collectDistinctDates(xGroups: { key: string; entries: CashlogEntry[] }[]): string[] {
  const dateSet = new Set<string>();
  for (const xg of xGroups) {
    for (const e of xg.entries) {
      if (e.date) dateSet.add(e.date.format("YYYY-MM-DD"));
    }
  }
  return Array.from(dateSet).sort();
}

// 从数据中收集所有不同月份
function collectDistinctMonths(xGroups: { key: string; entries: CashlogEntry[] }[]): string[] {
  const monthSet = new Set<string>();
  for (const xg of xGroups) {
    for (const e of xg.entries) {
      if (e.date) monthSet.add(e.date.format("YYYY-MM"));
    }
  }
  return Array.from(monthSet).sort();
}

// 从数据中收集所有不同周
function collectDistinctWeeks(xGroups: { key: string; entries: CashlogEntry[] }[]): string[] {
  const weekSet = new Set<string>();
  for (const xg of xGroups) {
    for (const e of xg.entries) {
      if (e.date) weekSet.add(e.date.format("GGGG-WW") + "周");
    }
  }
  return Array.from(weekSet).sort();
}

// 从数据中收集所有不同年份
function collectDistinctYears(xGroups: { key: string; entries: CashlogEntry[] }[]): string[] {
  const yearSet = new Set<string>();
  for (const xg of xGroups) {
    for (const e of xg.entries) {
      if (e.date) yearSet.add(e.date.format("YYYY"));
    }
  }
  return Array.from(yearSet).sort();
}

// 创建图表容器（公共逻辑）
export function createChartContainer(containerEl: HTMLElement, config: ChartConfig) {
  containerEl.empty();
  containerEl.addClass("cashlog-chart");

  const wrapper = containerEl.createDiv({ cls: "cashlog-chart-container" });

  if (config.title) {
    wrapper.createDiv({ cls: "cashlog-chart-title", text: config.title });
  }

  const canvas = wrapper.createEl("canvas", {
    cls: "cashlog-chart-canvas",
  });

  // 设置容器固定尺寸，配合 maintainAspectRatio: false 使图表精确匹配
  wrapper.style.width = `${config.width}px`;
  wrapper.style.height = `${config.height}px`;

  return { wrapper, canvas };
}

// 缓存主题文字颜色，避免反复创建 DOM 探针
let _cachedLabelColor: string | null = null;

function getLabelColor(): string {
  if (_cachedLabelColor) return _cachedLabelColor;
  const probe = activeDocument.createElement("span");
  probe.className = "cashlog-chart-probe";
  probe.textContent = ".";
  activeDocument.body.appendChild(probe);
  _cachedLabelColor = getComputedStyle(probe).color || "#333333";
  activeDocument.body.removeChild(probe);
  return _cachedLabelColor;
}

// 主题切换时清除缓存，由外部在恰当时机调用
export function clearLabelColorCache(): void {
  _cachedLabelColor = null;
}

// Chart.js 回调中用到的扩展数据集类型（包含自定义 _rawData/_rawValues）
type ChartDatasetExtended = { _rawData?: number[]; _rawValues?: number[]; data: number[]; label: string };

// 构建 datalabels 插件配置（条形图/折线图通用）
function buildDatalabelsConfig(config: ChartConfig) {
  if (!config.showLabels) return {};
  return {
    datalabels: {
      anchor: "end" as const,
      align: "end" as const,
      offset: 6,
      formatter: (value: number, context: DatalabelsContext) => {
        const ds = context.dataset as ChartDatasetExtended;
        const raw = ds._rawData?.[context.dataIndex];
        if (raw !== undefined) return raw.toLocaleString();
        return value.toLocaleString();
      },
      font: { weight: "bold" as const, size: 11 },
      color: getLabelColor(),
    },
  };
}

// 渲染条形图
function renderBarChart(
  containerEl: HTMLElement,
  chartData: ChartDataResult,
  config: ChartConfig,
): Chart {
  const { canvas } = createChartContainer(containerEl, config);

  const datasets = chartData.datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    backgroundColor: ds.backgroundColor[0] || config.colors[i % config.colors.length],
    borderWidth: 1,
    _rawData: (ds as ChartDatasetExtended)._rawData,
  }));

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: chartData.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 50 },
      },
      plugins: {
        legend: {
          display: config.showLegend,
          position: "top",
          labels: { padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"bar">) => {
              const ds = context.dataset as ChartDatasetExtended;
              const raw = ds._rawData?.[context.dataIndex];
              const displayVal = raw !== undefined ? raw : (context.parsed.y ?? 0);
              return `${context.dataset.label}: ${displayVal.toLocaleString()}`;
            },
          },
        },
        ...buildDatalabelsConfig(config),
      },
      scales: { y: { beginAtZero: true, grace: "25%" } },
    },
  });
}

// 渲染折线图（支持多数据集）
function renderLineChart(
  containerEl: HTMLElement,
  chartData: ChartDataResult,
  config: ChartConfig,
): Chart {
  const { canvas } = createChartContainer(containerEl, config);

  const datasets = chartData.datasets.map((ds, i) => {
    const color = config.colors[i % config.colors.length];
    return {
      label: ds.label,
      data: ds.data,
      borderColor: color,
      backgroundColor: color + "1a",
      fill: false,
      tension: 0.3,
      pointBackgroundColor: color,
      _rawData: (ds as ChartDatasetExtended)._rawData,
    };
  });

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 50 },
      },
      plugins: {
        legend: {
          display: config.showLegend,
          position: "top",
          labels: { padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"line">) => {
              const ds = context.dataset as ChartDatasetExtended;
              const raw = ds._rawData?.[context.dataIndex];
              const displayVal = raw !== undefined ? raw : (context.parsed.y ?? 0);
              return `${context.dataset.label}: ${displayVal.toLocaleString()}`;
            },
          },
        },
        ...buildDatalabelsConfig(config),
      },
      scales: { y: { grace: "25%" } },
    },
  });
}

// 构建扇形图专用的 datalabels 插件配置
export function buildPieDatalabelsConfig(config: ChartConfig) {
  if (!config.showLabels) return {};
  return {
    datalabels: {
      anchor: "center" as const,
      formatter: (_value: number, context: DatalabelsContext) => {
        const ds = context.dataset as ChartDatasetExtended;
        const total = ds.data.reduce((a: number, b: number) => a + b, 0);
        if (total === 0) return "";
        const percentage = ((ds.data[context.dataIndex] / total) * 100).toFixed(0);
        return `${percentage}%`;
      },
      font: { weight: "bold" as const, size: 12 },
      color: "#fff",
    },
  };
}

// 渲染扇形图
export function renderPieChart(
  containerEl: HTMLElement,
  chartData: ChartDataResult,
  config: ChartConfig,
): Chart {
  const { canvas } = createChartContainer(containerEl, config);

  return new Chart(canvas, {
    type: "pie",
    data: {
      labels: chartData.labels,
      datasets: [{
        label: chartData.datasets[0].label,
        data: chartData.datasets[0].data,
        backgroundColor: chartData.datasets[0].backgroundColor,
        borderColor: "var(--background-primary, #ffffff)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: config.showLegend },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"pie">) => {
              const ds = context.dataset as ChartDatasetExtended;
              const rawValues = ds._rawValues;
              const raw = rawValues?.[context.dataIndex];
              const displayVal = raw !== undefined ? raw : context.parsed;
              const total = ds.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = total > 0 ? ((context.dataset.data[context.dataIndex] / total) * 100).toFixed(1) : "0.0";
              return `${context.label}: ${displayVal.toLocaleString()} (${percentage}%)`;
            },
          },
        },
        ...buildPieDatalabelsConfig(config),
      },
    },
  });
}

// 代码块渲染子组件，支持自动刷新
export class CashlogChartRenderChild extends MarkdownRenderChild {
  private source: string;
  private plugin: CashlogPlugin;
  private chartInstance: { destroy(): void } | null = null;

  constructor(containerEl: HTMLElement, source: string, plugin: CashlogPlugin) {
    super(containerEl);
    this.source = source;
    this.plugin = plugin;
  }

  onload() {
    this.render();
    this.registerEvent(
      this.plugin.events.on("cashlog-render-refresh", () => {
        this.render();
      }),
    );
  }

  onunload() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private render() {
    try {
      // 渲染前销毁旧图表实例
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }

      const query = new Query(this.source, this.plugin.settings);
      const error = query.getError();

      if (error) {
        this.containerEl.empty();
        this.containerEl.createDiv({
          cls: "cashlog-error",
          text: tp("error.queryError", { error }),
        });
        return;
      }

      const entries = this.plugin.cache.getEntries();
      if (!entries?.length) {
        this.containerEl.empty();
        this.containerEl.createDiv({
          cls: "cashlog-error",
          text: t("error.noData"),
        });
        return;
      }

      const result = query.apply(entries);
      const tableConfig = parseTableConfig(this.source);
      const chartConfig = query.getChartConfig();

      if (chartConfig.type === "table") {
        renderChartTable(this.containerEl, result, query, tableConfig, this.plugin);
      } else if (chartConfig.type === "bar") {
        // 条形图：双维度分组
        const chartData = transformSplitChartData(
          result,
          chartConfig.groupBy,
          chartConfig.splitBy || "valueType",
          chartConfig.splitItems || [],
          chartConfig.colors,
          "bar",
        );
        this.chartInstance = renderBarChart(this.containerEl, chartData, chartConfig);
      } else if (chartConfig.type === "line") {
        // 折线图：双维度分组
        const chartData = transformSplitChartData(
          result,
          chartConfig.groupBy,
          chartConfig.splitBy || "valueType",
          chartConfig.splitItems || [],
          chartConfig.colors,
          "line",
        );
        this.chartInstance = renderLineChart(this.containerEl, chartData, chartConfig);
      } else if (chartConfig.type === "pie") {
        // 扇形图
        const chartData = transformToChartData(
          result,
          chartConfig.groupBy,
          chartConfig.valueType,
          chartConfig.colors,
        );
        this.chartInstance = renderPieChart(this.containerEl, chartData, chartConfig);
      } else {
        this.containerEl.empty();
        this.containerEl.createDiv({
          cls: "cashlog-error",
          text: tp("error.unsupportedChartType", { type: chartConfig.type }),
        });
      }
    } catch (err) {
      this.containerEl.empty();
      this.containerEl.createDiv({
        cls: "cashlog-error",
        text: tp("error.chartRenderFailed", { message: getErrorMessage(err) }),
      });
    }
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
