/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { CashlogEntry } from "../EntryLocation";
import { FilterFunction, Sorter, Grouper, QueryResult, EntryGroup, Summary } from "./Filter";
import { parseFilter } from "./FilterParser";
import type { CashlogSettings } from "../Settings";

// 表格列配置
export interface TableColConfig {
  field: "date" | "amount" | "description" | "link" | "account" | "attachment";
  header: string;
  align: "left" | "center" | "right";
}

// 表格配置（独立于 Query 类）
export interface TableConfig {
  colCount: number;
  cols: TableColConfig[];
}

// 默认表格配置
export function createDefaultTableConfig(): TableConfig {
  return {
    colCount: 6,
    cols: [
      { field: "date", header: "", align: "left" },
      { field: "amount", header: "", align: "left" },
      { field: "account", header: "", align: "left" },
      { field: "description", header: "", align: "left" },
      { field: "attachment", header: "", align: "left" },
      { field: "link", header: "", align: "left" },
    ],
  };
}

// 图表类型
export type ChartDisplayType = "table" | "bar" | "line" | "pie";

// 分组字段类型
export type GroupByField = "tag" | "date" | "week" | "month" | "year" | "account" | "type";

// 子分组依据（条形图/折线图通用）
export type SplitBy = "none" | "valueType" | "tag" | "account" | "type" | "date" | "week" | "month" | "year";

// 扇形图数值类型
export type PieValueType = "income" | "expense" | "balance" | "inflow" | "outflow" | "netflow";

// 将各种大小写形式的 splitBy 归一化为标准值
function normalizeSplitBy(raw: string): SplitBy {
  const lower = raw.toLowerCase().replace(/\s/g, "");
  const map: Record<string, SplitBy> = {
    none: "none",
    valuetype: "valueType",
    tag: "tag",
    account: "account",
    type: "type",
    date: "date",
    week: "week",
    month: "month",
    year: "year",
  };
  return map[lower] || "valueType";
}

// 图表配置接口
export interface ChartConfig {
  type: ChartDisplayType;
  title: string;
  groupBy: GroupByField;
  valueType: PieValueType;
  // 子分组（条形图/折线图通用）
  splitBy?: SplitBy;
  splitItems?: string[];
  width: number;
  height: number;
  showLegend: boolean;
  showLabels: boolean;
  colors: string[];
}

// 默认图表配置
export function createDefaultChartConfig(): ChartConfig {
  return {
    type: "table",
    title: "",
    groupBy: "month",
    valueType: "expense",
    splitBy: undefined,
    splitItems: undefined,
    width: 600,
    height: 400,
    showLegend: true,
    showLabels: false,
    colors: [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
      "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
    ],
  };
}

// 从源码解析表格配置
export function parseTableConfig(source: string): TableConfig {
  const config = createDefaultTableConfig();
  const lines = source.split("\n");

  for (const line of lines) {
    // 表格列数
    const colCountMatch = line.match(/^table\s+columns\s+(\d+)/i);
    if (colCountMatch) {
      config.colCount = Math.min(6, Math.max(1, parseInt(colCountMatch[1])));
      continue;
    }

    // 列配置
    const colMatch = line.match(/^col([1-6])\s+(\w+)(?:\s+"([^"]*)")?(?:\s+(left|center|right))?$/i);
    if (colMatch) {
      const idx = parseInt(colMatch[1]) - 1;
      const field = colMatch[2].toLowerCase() as TableColConfig["field"];
      if (["date", "amount", "description", "link", "account", "attachment"].includes(field)) {
        config.cols[idx].field = field;
      }
      if (colMatch[3]) {
        config.cols[idx].header = colMatch[3];
      }
      if (colMatch[4]) {
        config.cols[idx].align = colMatch[4] as TableColConfig["align"];
      }
    }
  }

  return config;
}

// 从源码解析图表配置
export function parseChartConfig(source: string): ChartConfig {
  const config = createDefaultChartConfig();
  const lines = source.split("\n");

  for (const line of lines) {
    // chart type
    const typeMatch = line.match(/^chart\s+type\s+(bar|line|pie)/i);
    if (typeMatch) {
      config.type = typeMatch[1].toLowerCase() as ChartDisplayType;
      continue;
    }

    // chart title
    const titleMatch = line.match(/^chart\s+title\s+"([^"]*)"/i);
    if (titleMatch) {
      config.title = titleMatch[1];
      continue;
    }

    // chart (bar|line) split by（子分组依据，条形图/折线图通用）
    const splitMatch = line.match(/^chart\s+(bar|line)\s+split\s+by\s+(none|valuetype|tag|account|type|date|week|month|year)/i);
    if (splitMatch) {
      config.splitBy = normalizeSplitBy(splitMatch[2]);
      continue;
    }

    // chart (bar|line) items（子分组具体项，条形图/折线图通用）
    const splitItemsMatch = line.match(/^chart\s+(bar|line)\s+items\s+(.+)/i);
    if (splitItemsMatch) {
      config.splitItems = splitItemsMatch[2].split(/\s+/).filter(Boolean);
      continue;
    }

    // chart value（扇形图用）
    const valueMatch = line.match(/^chart\s+value\s+(income|expense|balance|inflow|outflow|netflow)/i);
    if (valueMatch) {
      config.valueType = valueMatch[1].toLowerCase() as PieValueType;
      continue;
    }

    // chart width
    const widthMatch = line.match(/^chart\s+width\s+(\d+)/i);
    if (widthMatch) {
      config.width = Math.max(200, Math.min(1200, parseInt(widthMatch[1])));
      continue;
    }

    // chart height
    const heightMatch = line.match(/^chart\s+height\s+(\d+)/i);
    if (heightMatch) {
      config.height = Math.max(150, Math.min(800, parseInt(heightMatch[1])));
      continue;
    }

    // chart legend
    const legendMatch = line.match(/^chart\s+legend\s+(true|false)/i);
    if (legendMatch) {
      config.showLegend = legendMatch[1].toLowerCase() === "true";
      continue;
    }

    // chart labels
    const labelsMatch = line.match(/^chart\s+labels\s+(true|false)/i);
    if (labelsMatch) {
      config.showLabels = labelsMatch[1].toLowerCase() === "true";
      continue;
    }

    // chart colors
    const colorsMatch = line.match(/^chart\s+colors\s+(.+)/i);
    if (colorsMatch) {
      const colors = colorsMatch[1].split(",").map((c: string) => c.trim());
      if (colors.length > 0) {
        config.colors = colors;
      }
      continue;
    }
  }

  return config;
}

// 生成所有分组键组合（笛卡尔积，用于多账户转账条目分发到各账户分组）
function combineKeyOptions(options: string[][]): string[] {
  if (options.length === 0) return ["全部"];
  let results: string[] = options[0];
  for (let i = 1; i < options.length; i++) {
    const next: string[] = [];
    for (const r of results) {
      for (const o of options[i]) {
        next.push(r + " / " + o);
      }
    }
    results = next;
  }
  return results;
}

export class Query {
  private filters: FilterFunction[] = [];
  private sorters: Sorter[] = [];
  private groupers: Grouper[] = [];
  private limit: number = Infinity;
  private showTotal: boolean = false;
  private showTotalIncome: boolean = false;
  private showTotalExpense: boolean = false;
  private showBalance: boolean = false;
  private showCount: boolean = false;
  private hideDate: boolean = false;
  private hideTime: boolean = false;
  private hideTag: boolean = false;
  private hideAmount: boolean = false;
  private hideAccount: boolean = false;
  private showAccount: boolean = false;
  private showTagInDescription: boolean = false;
  private showChartSummary: boolean = false;
  private showGroupSubtotal: boolean = false;
  private error: string | null = null;
  private settings: CashlogSettings;

  // 表格选项
  private chartTableColCount: number = 6;
  private chartTableCols: TableColConfig[] = [
    { field: "date", header: "", align: "left" },
    { field: "amount", header: "", align: "left" },
    { field: "account", header: "", align: "left" },
    { field: "description", header: "", align: "left" },
    { field: "attachment", header: "", align: "left" },
    { field: "link", header: "", align: "left" },
  ];

  // 图表选项
  private _displayChartType: ChartDisplayType = "table";
  private _chartTitle: string = "";
  private _chartWidth: number = 600;
  private _chartHeight: number = 400;
  private _chartShowLegend: boolean = true;
  private _chartShowLabels: boolean = false;
  private _chartColors: string[] = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
  ];
  // 子分组（条形图/折线图通用）
  private _chartSplitBy: SplitBy | null = null;
  private _chartSplitItems: string[] = [];
  // 数值类型（扇形图用）
  private _chartValueType: PieValueType = "expense";
  // 列表样式
  private _listStyle: "unordered" | "ordered" | "none" = "unordered";

  constructor(source: string, settings: CashlogSettings) {
    this.settings = settings;
    const lines = source.split("\n");
    for (const line of lines) {
      this.parseLine(line.trim());
    }
  }

  getError(): string | null {
    return this.error;
  }

  // 解析查询指令
  private parseLine(line: string): void {
    if (line === "" || line.startsWith("#")) return;
    const trimLine = line.trim().toLowerCase();

    // 表格列数
    const colCountMatch = line.match(/^table\s+columns\s+(\d+)/i);
    if (colCountMatch) {
      this.chartTableColCount = Math.min(6, Math.max(1, parseInt(colCountMatch[1])));
      return;
    }

    // 列配置 col1-col6
    const colMatch = line.match(/^col([1-6])\s+(\w+)(?:\s+"([^"]*)")?(?:\s+(left|center|right))?$/i);
    if (colMatch) {
      const colIndex = parseInt(colMatch[1]) - 1;
      if (colIndex < this.chartTableCols.length) {
        const field = colMatch[2].toLowerCase() as TableColConfig["field"];
        if (["date", "amount", "description", "link", "account", "attachment"].includes(field)) {
          this.chartTableCols[colIndex].field = field;
        }
        if (colMatch[3]) {
          this.chartTableCols[colIndex].header = colMatch[3];
        }
        if (colMatch[4]) {
          this.chartTableCols[colIndex].align = colMatch[4] as TableColConfig["align"];
        }
      }
      return;
    }

    // limit
    const limitMatch = line.match(/^limit\s+to\s+(\d+)/i);
    if (limitMatch) {
      this.limit = parseInt(limitMatch[1]);
      return;
    }

    // sort by
    const sortMatch = line.match(
      /^sort\s+by\s+(date|amount|description|account)\s+(ascending|descending)/i,
    );
    if (sortMatch) {
      this.sorters.push({
        field: sortMatch[1].toLowerCase(),
        direction: sortMatch[2].toLowerCase() as "ascending" | "descending",
      });
      return;
    }

    // group by
    const groupMatch = line.match(/^group\s+by\s+(tag|date|week|month|year|account|type)/i);
    if (groupMatch) {
      this.groupers.push({ field: groupMatch[1].toLowerCase() });
      return;
    }

    // show
    // list style
    const listStyleMatch = line.match(/^list\s+style\s+(unordered|ordered|none)/i);
    if (listStyleMatch) {
      this._listStyle = listStyleMatch[1].toLowerCase() as "unordered" | "ordered" | "none";
      return;
    }

    if (trimLine === "show tag in description") {
      this.showTagInDescription = true;
      return;
    }
    if (trimLine === "show summary") {
      this.showChartSummary = true;
      return;
    }
    if (trimLine === "show group subtotal") {
      this.showGroupSubtotal = true;
      return;
    }
    const showMatch = line.match(/^show\s+(total|total income|total expense|balance|count)/i);
    if (showMatch) {
      const what = showMatch[1].toLowerCase();
      switch (what) {
        case "total":
          this.showTotal = true;
          break;
        case "total income":
          this.showTotalIncome = true;
          break;
        case "total expense":
          this.showTotalExpense = true;
          break;
        case "balance":
          this.showBalance = true;
          break;
        case "count":
          this.showCount = true;
          break;
      }
      return;
    }

    // hide
    const hideMatch = line.match(/^hide\s+(date|time|tag|amount|account)/i);
    if (hideMatch) {
      const what = hideMatch[1].toLowerCase();
      switch (what) {
        case "date":
          this.hideDate = true;
          break;
        case "time":
          this.hideTime = true;
          break;
        case "tag":
          this.hideTag = true;
          break;
        case "amount":
          this.hideAmount = true;
          break;
        case "account":
          this.hideAccount = true;
          break;
      }
      return;
    }

    // show account
    if (trimLine === "show account") {
      this.showAccount = true;
      return;
    }

    // chart type
    const chartTypeMatch = line.match(/^chart\s+type\s+(bar|line|pie)/i);
    if (chartTypeMatch) {
      this._displayChartType = chartTypeMatch[1].toLowerCase() as ChartDisplayType;
      return;
    }

    // chart title
    const chartTitleMatch = line.match(/^chart\s+title\s+"([^"]*)"/i);
    if (chartTitleMatch) {
      this._chartTitle = chartTitleMatch[1];
      return;
    }

    // chart (bar|line) split by（子分组依据，条形图/折线图通用）
    const splitMatch = line.match(/^chart\s+(bar|line)\s+split\s+by\s+(none|valuetype|tag|account|type|date|week|month|year)/i);
    if (splitMatch) {
      this._chartSplitBy = normalizeSplitBy(splitMatch[2]);
      return;
    }

    // chart (bar|line) items（子分组具体项，条形图/折线图通用）
    const splitItemsMatch = line.match(/^chart\s+(bar|line)\s+items\s+(.+)/i);
    if (splitItemsMatch) {
      this._chartSplitItems = splitItemsMatch[2].split(/\s+/).filter(Boolean);
      return;
    }

    // chart value（扇形图用）
    const chartValueMatch = line.match(/^chart\s+value\s+(income|expense|balance|inflow|outflow|netflow)/i);
    if (chartValueMatch) {
      this._chartValueType = chartValueMatch[1].toLowerCase() as PieValueType;
      return;
    }

    // chart width
    const chartWidthMatch = line.match(/^chart\s+width\s+(\d+)/i);
    if (chartWidthMatch) {
      this._chartWidth = Math.max(200, Math.min(1200, parseInt(chartWidthMatch[1])));
      return;
    }

    // chart height
    const chartHeightMatch = line.match(/^chart\s+height\s+(\d+)/i);
    if (chartHeightMatch) {
      this._chartHeight = Math.max(150, Math.min(800, parseInt(chartHeightMatch[1])));
      return;
    }

    // chart legend
    const chartLegendMatch = line.match(/^chart\s+legend\s+(true|false)/i);
    if (chartLegendMatch) {
      this._chartShowLegend = chartLegendMatch[1].toLowerCase() === "true";
      return;
    }

    // chart labels
    const chartLabelsMatch = line.match(/^chart\s+labels\s+(true|false)/i);
    if (chartLabelsMatch) {
      this._chartShowLabels = chartLabelsMatch[1].toLowerCase() === "true";
      return;
    }

    // chart colors
    const chartColorsMatch = line.match(/^chart\s+colors\s+(.+)/i);
    if (chartColorsMatch) {
      const colors = chartColorsMatch[1].split(",").map((c: string) => c.trim());
      if (colors.length > 0) {
        this._chartColors = colors;
      }
      return;
    }

    // 过滤指令
    const result = parseFilter(line, this.settings);
    if (result) {
      if (result.filter) {
        this.filters.push(result.filter);
      } else if (result.error) {
        this.error = result.error;
      }
      return;
    }

    // 未知指令
    this.error = `未知指令: ${line}`;
  }

  // 执行查询
  apply(entries: CashlogEntry[]): QueryResult {
    // 1. 过滤
    let filtered = entries.filter((e) => this.filters.every((f) => f(e)));

    // 2. 排序
    filtered = this.sort(filtered);

    // 3. 限制
    filtered = filtered.slice(0, this.limit);

    // 4. 分组
    const groups = this.group(filtered);

    // 5. 汇总
    const summary = this.summarize(filtered);

    return { groups, summary };
  }

  // 排序
  private sort(entries: CashlogEntry[]): CashlogEntry[] {
    if (this.sorters.length === 0) return entries;

    return [...entries].sort((a, b) => {
      for (const sorter of this.sorters) {
        let cmp = 0;
        switch (sorter.field) {
          case "date": {
            const aDate = a.date ? a.date.valueOf() : 0;
            const bDate = b.date ? b.date.valueOf() : 0;
            cmp = aDate - bDate;
            break;
          }
          case "amount":
            cmp = Math.abs(a.amount) - Math.abs(b.amount);
            break;
          case "description":
            cmp = a.description.localeCompare(b.description);
            break;
          case "account": {
            const aAcct = (a.accountAmounts[0]?.account || "").toLowerCase();
            const bAcct = (b.accountAmounts[0]?.account || "").toLowerCase();
            cmp = aAcct.localeCompare(bAcct);
            break;
          }
        }
        if (sorter.direction === "descending") cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }

  // 分组
  private group(entries: CashlogEntry[]): EntryGroup[] {
    if (this.groupers.length === 0) {
      return [{ key: "全部", entries }];
    }

    const isTagGroup = this.groupers.some((g) => g.field === "tag");
    const groupMap = new Map<string, CashlogEntry[]>();

    for (const entry of entries) {
      // 每个 grouper 可能产生多个分组键（如账户分组时转账涉及多个账户）
      const keyOptions: string[][] = [];

      for (const grouper of this.groupers) {
        switch (grouper.field) {
          case "tag":
            keyOptions.push([entry.primaryTag || "无标签"]);
            break;
          case "date":
            keyOptions.push([entry.date ? entry.date.format("YYYY-MM-DD") : "无日期"]);
            break;
          case "week":
            keyOptions.push([entry.date ? entry.date.format("GGGG-WW") + "周" : "无日期"]);
            break;
          case "month":
            keyOptions.push([entry.date ? entry.date.format("YYYY-MM") : "无日期"]);
            break;
          case "year":
            keyOptions.push([entry.date ? entry.date.format("YYYY") : "无日期"]);
            break;
          case "account": {
            const accts = entry.accountAmounts.map((aa) => aa.account).filter(Boolean);
            keyOptions.push(accts.length > 0 ? accts : ["无账户"]);
            break;
          }
          case "type": {
            const typeLabels: Record<string, string> = {
              normal: "其他",
              transfer: "转账",
              balanceChange: "余额变更",
            };
            let typeKey: string;
            if (entry.entryType !== "normal") {
              typeKey = typeLabels[entry.entryType] || entry.entryType;
            } else if (entry.isIncome) {
              typeKey = "收入";
            } else if (entry.isExpense) {
              typeKey = "支出";
            } else {
              typeKey = "其他";
            }
            keyOptions.push([typeKey]);
            break;
          }
        }
      }

      // 生成所有分组键组合（对多账户转账会生成多个分组）
      const combinedKeys = combineKeyOptions(keyOptions);
      for (const key of combinedKeys) {
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(entry);
      }
    }

    const groups = Array.from(groupMap.entries()).map(([key, entries]) => ({ key, entries }));

    // 按标签分组时：收入标签在前，支出标签在后
    if (isTagGroup) {
      const incomeBase = this.settings.incomeTag.toLowerCase();
      groups.sort((a, b) => {
        const aIncome = a.key.toLowerCase().startsWith(incomeBase) ? 0 : 1;
        const bIncome = b.key.toLowerCase().startsWith(incomeBase) ? 0 : 1;
        return aIncome - bIncome;
      });
    }

    return groups;
  }

  // 汇总
  private summarize(entries: CashlogEntry[]): Summary {
    const totalIncome = entries
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = entries
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalIncome: this.showTotal || this.showTotalIncome ? totalIncome : 0,
      totalExpense: this.showTotal || this.showTotalExpense ? totalExpense : 0,
      balance: this.showTotal || this.showBalance ? totalIncome + totalExpense : 0,
      count: this.showTotal || this.showCount ? entries.length : 0,
    };
  }

  // 显示选项的 getter
  get shouldHideDate(): boolean { return this.hideDate; }
  get shouldHideTime(): boolean { return this.hideTime; }
  get shouldHideTag(): boolean { return this.hideTag; }
  get shouldHideAmount(): boolean { return this.hideAmount; }
  get shouldHideAccount(): boolean { return this.hideAccount; }
  get shouldShowAccount(): boolean { return this.showAccount; }
  get shouldShowTotal(): boolean { return this.showTotal; }
  get shouldShowTotalIncome(): boolean { return this.showTotalIncome; }
  get shouldShowTotalExpense(): boolean { return this.showTotalExpense; }
  get shouldShowBalance(): boolean { return this.showBalance; }
  get shouldShowCount(): boolean { return this.showCount; }
  get shouldShowTagInDescription(): boolean { return this.showTagInDescription; }
  get shouldShowChartSummary(): boolean { return this.showChartSummary; }
  get shouldShowGroupSubtotal(): boolean { return this.showGroupSubtotal; }
  get listStyle(): "unordered" | "ordered" | "none" { return this._listStyle; }

  // 表格选项 getter
  get tableColCount(): number { return this.chartTableColCount; }
  get tableCols(): TableColConfig[] { return this.chartTableCols; }

  // 图表选项 getter
  get displayChartType(): ChartDisplayType { return this._displayChartType; }
  get chartTitle(): string { return this._chartTitle; }
  get chartWidth(): number { return this._chartWidth; }
  get chartHeight(): number { return this._chartHeight; }
  get chartShowLegend(): boolean { return this._chartShowLegend; }
  get chartShowLabels(): boolean { return this._chartShowLabels; }
  get chartColors(): string[] { return this._chartColors; }
  // 当前数据分组的字段（由 group by 指令决定）
  get groupField(): string | null {
    return this.groupers.length > 0 ? this.groupers[0].field : null;
  }
  // 子分组 getter
  get chartSplitBy(): SplitBy | null { return this._chartSplitBy; }
  get chartSplitItems(): string[] { return this._chartSplitItems; }

  // 获取完整图表配置
  getChartConfig(): ChartConfig {
    return {
      type: this._displayChartType,
      title: this._chartTitle,
      groupBy: this.groupers.length > 0 ? (this.groupers[0].field as GroupByField) : "month",
      valueType: this._chartValueType,
      splitBy: this._chartSplitBy ?? undefined,
      splitItems: this._chartSplitItems.length > 0 ? this._chartSplitItems : undefined,
      width: this._chartWidth,
      height: this._chartHeight,
      showLegend: this._chartShowLegend,
      showLabels: this._chartShowLabels,
      colors: this._chartColors,
    };
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
