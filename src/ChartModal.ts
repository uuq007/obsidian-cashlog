import { App, Editor, Modal, Notice, Setting, moment } from "obsidian";
import type CashlogPlugin from "./main";
import type { CashlogEntry } from "./CashlogEntry";
import { t, tp } from "./i18n";

// 图表类型
type ChartType = "table" | "bar" | "line" | "pie";

// 所有条目类型（模块级常量，避免硬编码）
const ALL_TYPES = ["income", "expense", "transfer", "balanceChange"] as const;
const TYPE_LABELS: Record<string, string> = {
  income: t("cashlogModal.type.income"),
  expense: t("cashlogModal.type.expense"),
  transfer: t("cashlogModal.type.transfer"),
  balanceChange: t("cashlogModal.type.balanceChange"),
};
const TYPE_QUERIES: Record<string, string> = {
  income: "is income",
  expense: "is expense",
  transfer: "is transfer",
  balanceChange: "is balance change",
};

export class ChartModal extends Modal {
  private plugin: CashlogPlugin;
  private editor: Editor;

  // 过滤条件
  private typeFilters: Set<string> = new Set(["income", "expense", "transfer", "balanceChange"]);
  private tagFilters: string[] = [];
  private descFilter: string = "";
  private amountMin: string = "";
  private amountMax: string = "";
  private dateStart: string = "";
  private dateEnd: string = "";
  private pathFilter: string = "";
  private sortField: string = "date";
  private sortDir: string = "descending";
  private groupBy: string = "none";

  // 显示选项
  private showTagInDesc: boolean = false;
  private showSummary: boolean = true;
  private showGroupSubtotal: boolean = false;

  // 图表类型
  private displayChartType: ChartType = "table";

  // 表格选项
  private tableColCount: number = 6;
  private tableCols: Array<{
    field: "date" | "amount" | "description" | "link" | "account" | "attachment";
    header: string;
    align: "left" | "center" | "right";
  }> = [
    { field: "date", header: "", align: "left" },
    { field: "amount", header: "", align: "left" },
    { field: "account", header: "", align: "left" },
    { field: "description", header: "", align: "left" },
    { field: "attachment", header: "", align: "left" },
    { field: "link", header: "", align: "left" },
  ];

  // 表格选项的 UI 容器
  private tableOptionsContainer: HTMLElement | null = null;

  // 图表通用选项
  private chartTitle: string = "";
  private chartWidth: number = 600;
  private chartHeight: number = 400;
  private chartShowLegend: boolean = true;
  private chartShowLabels: boolean = true;

  // 条形图专属选项
  private barXGroupBy: string = "month";
  private barSplitBy: string = "none";
  private barSplitItems: Set<string> = new Set();

  // 折线图专属选项
  private lineXGroupBy: string = "month";
  private lineSplitBy: string = "none";
  private lineSplitItems: Set<string> = new Set();

  // 扇形图专属选项
  private pieGroupBy: string = "tag";
  private pieValueType: string = "expense";

  // 图表选项的 UI 容器
  private chartOptionsContainer: HTMLElement | null = null;
  // 条形图子分组选项的 UI 容器（动态重建）
  private barSplitItemsContainer: HTMLElement | null = null;
  // 折线图子分组选项的 UI 容器（动态重建）
  private lineSplitItemsContainer: HTMLElement | null = null;


  constructor(app: App, plugin: CashlogPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen() {
    this.titleEl.setText(t("chartModal.title"));

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cashlog-modal");
    contentEl.addClass("cashlog-chart-modal");

    // === 过滤条件 ===
    contentEl.createEl("h3", { text: t("chartModal.filterSection") });

    // 类型（多选复选框）
    new Setting(contentEl)
      .setName(t("chartModal.typeFilter"));

    const typeContainer = contentEl.createEl("div", {
      cls: "cashlog-checkbox-list",
    });

    const allCheckbox = typeContainer.createEl("label", {
      cls: "cashlog-checkbox-label",
    });
    const allCb = allCheckbox.createEl("input", { attr: { type: "checkbox" } });
    allCb.checked = this.typeFilters.size === ALL_TYPES.length;
    allCheckbox.createSpan({ text: t("chartModal.all") });

    const typeCheckboxes: HTMLInputElement[] = [];
    for (const t of ALL_TYPES) {
      const label = typeContainer.createEl("label", {
        cls: "cashlog-checkbox-label",
      });
      const cb = label.createEl("input", { attr: { type: "checkbox" } });
      cb.checked = this.typeFilters.has(t);
      typeCheckboxes.push(cb);
      label.createSpan({ text: TYPE_LABELS[t] });

      cb.addEventListener("change", () => {
        // 从全选状态点击单项：切换为仅勾选该项（e2f28c4 行为）
        if (this.typeFilters.size === ALL_TYPES.length) {
          this.typeFilters.clear();
          this.typeFilters.add(t);
          for (let j = 0; j < typeCheckboxes.length; j++) {
            typeCheckboxes[j].checked = ALL_TYPES[j] === t;
          }
        } else if (cb.checked) {
          this.typeFilters.add(t);
        } else {
          this.typeFilters.delete(t);
        }
        allCb.checked = this.typeFilters.size === ALL_TYPES.length;
        rebuildTags();
      });
    }

    allCb.addEventListener("change", () => {
      if (allCb.checked) {
        for (const t of ALL_TYPES) this.typeFilters.add(t);
        for (const cb of typeCheckboxes) cb.checked = true;
      } else {
        this.typeFilters.clear();
        for (const cb of typeCheckboxes) cb.checked = false;
      }
      rebuildTags();
    });

    // 标签区域（类型变更时重建）
    const tagSection = contentEl.createEl("div", { cls: "cashlog-tag-section" });
    const rebuildTags = () => {
      tagSection.empty();
      const allTags = this.getUniqueTags();
      if (allTags.length > 0) {
        new Setting(tagSection)
          .setName(t("chartModal.tagFilter"))
          .setDesc(t("chartModal.tagFilterDesc"));

        const tagContainer = tagSection.createEl("div", {
          cls: "cashlog-checkbox-list",
        });
        for (const tag of allTags) {
          const label = tagContainer.createEl("label", {
            cls: "cashlog-checkbox-label",
          });
          const checkbox = label.createEl("input", { attr: { type: "checkbox" } });
          checkbox.checked = this.tagFilters.includes(tag);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
              if (!this.tagFilters.includes(tag)) {
                this.tagFilters.push(tag);
              }
            } else {
              this.tagFilters = this.tagFilters.filter((t) => t !== tag);
            }
          });
          label.createSpan({ text: tag });
        }
      } else {
        new Setting(tagSection)
          .setName(t("chartModal.tagFilter"))
          .setDesc(t("chartModal.noTags"));
      }
    };
    rebuildTags();

    // 描述包含
    new Setting(contentEl)
      .setName(t("chartModal.descFilter"))
      .setDesc(t("chartModal.descFilterDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.descFilterPlaceholder"))
          .setValue(this.descFilter)
          .onChange((v) => { this.descFilter = v; }),
      );

    // 金额范围
    contentEl.createEl("div", { cls: "cashlog-field-row", attr: { style: "display:flex;gap:8px;align-items:center;margin-bottom:8px;" } });
    new Setting(contentEl)
      .setName(t("chartModal.amountRange"))
      .setDesc(t("chartModal.amountRangeDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.minValue"))
          .setValue(this.amountMin)
          .onChange((v) => { this.amountMin = v; }),
      )
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.maxValue"))
          .setValue(this.amountMax)
          .onChange((v) => { this.amountMax = v; }),
      );

    // 日期范围（原生日期选择器）
    new Setting(contentEl)
      .setName(t("chartModal.dateRange"))
      .setDesc(t("chartModal.dateRangeDesc"))
      .addText((text) => {
        text.inputEl.type = "date";
        if (this.dateStart) text.inputEl.value = this.dateStart;
        text.onChange((v) => { this.dateStart = v; });
      })
      .addText((text) => {
        text.inputEl.type = "date";
        if (this.dateEnd) text.inputEl.value = this.dateEnd;
        text.onChange((v) => { this.dateEnd = v; });
      });

    // 路径包含
    new Setting(contentEl)
      .setName(t("chartModal.pathFilter"))
      .setDesc(t("chartModal.pathFilterDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.pathFilterPlaceholder"))
          .setValue(this.pathFilter)
          .onChange((v) => { this.pathFilter = v; }),
      );

    // === 图表类型 ===
    contentEl.createEl("h3", { text: t("chartModal.chartTypeSection") });

    new Setting(contentEl)
      .setName(t("chartModal.selectType"))
      .addDropdown((dd) =>
        dd
          .addOption("table", t("chartModal.chartType.table"))
          .addOption("bar", t("chartModal.chartType.bar"))
          .addOption("line", t("chartModal.chartType.line"))
          .addOption("pie", t("chartModal.chartType.pie"))
          .setValue(this.displayChartType)
          .onChange((v) => {
            this.displayChartType = v as ChartType;
            this.updateOptionsVisibility();
            this.buildChartOptionsUI();
          }),
      );

    // === 表格选项（仅当选择表格时显示）===
    this.tableOptionsContainer = contentEl.createEl("div", {
      cls: "cashlog-table-options",
    });
    this.tableOptionsContainer.addClass("hidden");
    this.buildTableOptionsUI();

    // === 图表选项（仅当选择图表时显示）===
    this.chartOptionsContainer = contentEl.createEl("div", {
      cls: "cashlog-chart-options",
    });
    this.chartOptionsContainer.addClass("hidden");
    this.buildChartOptionsUI();

    // === 按钮 ===
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(t("modal.button.insert"))
          .setCta()
          .onClick(() => {
            if (this.insert()) {
              this.close();
            }
          }),
      )
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.cancel")).onClick(() => {
          this.close();
        }),
      );

    // 初始化选项可见性
    this.updateOptionsVisibility();
  }

  onClose() {
    this.contentEl.empty();
  }

  // 从缓存中提取匹配当前类型筛选的唯一标签
  private getUniqueTags(): string[] {
    const entries = this.plugin.cache.getEntries();
    const tagSet = new Set<string>();
    for (const entry of entries) {
      if (!this.matchesTypeFilter(entry)) continue;
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }

  // 判断条目是否匹配当前类型筛选
  private matchesTypeFilter(entry: CashlogEntry): boolean {
    if (this.typeFilters.size === ALL_TYPES.length) return true;
    if (this.typeFilters.has("income") && entry.isIncome && !entry.isTransfer && !entry.isBalanceChange) return true;
    if (this.typeFilters.has("expense") && entry.isExpense && !entry.isTransfer && !entry.isBalanceChange) return true;
    if (this.typeFilters.has("transfer") && entry.isTransfer) return true;
    if (this.typeFilters.has("balanceChange") && entry.isBalanceChange) return true;
    return false;
  }

  // 构建查询字符串
  private buildQueryString(): string {
    const lines: string[] = [];

    // 类型
    const selected = ALL_TYPES.filter((t) => this.typeFilters.has(t));
    if (selected.length === 1) {
      lines.push(TYPE_QUERIES[selected[0]]);
    } else if (selected.length > 0 && selected.length < ALL_TYPES.length) {
      // 多选非全选：使用 type includes 精确过滤
      const typeValues = selected.map((t) => {
        if (t === "balanceChange") return "balancechange";
        return t;
      });
      lines.push(`type includes ${typeValues.join(" OR ")}`);
    }

    // 标签（多个标签用 OR 合并为一行）
    if (this.tagFilters.length > 0) {
      lines.push(`tag includes ${this.tagFilters.join(" OR ")}`);
    }

    // 描述
    if (this.descFilter.trim()) {
      lines.push(`description includes ${this.descFilter.trim()}`);
    }

    // 金额范围
    const minVal = parseFloat(this.amountMin);
    const maxVal = parseFloat(this.amountMax);
    if (!isNaN(minVal)) {
      lines.push(`amount above or equal ${minVal}`);
    }
    if (!isNaN(maxVal)) {
      lines.push(`amount below or equal ${maxVal}`);
    }

    // 日期范围
    if (this.dateStart.trim()) {
      lines.push(`date on or after ${this.dateStart.trim()}`);
    }
    if (this.dateEnd.trim()) {
      lines.push(`date on or before ${this.dateEnd.trim()}`);
    }

    // 路径
    if (this.pathFilter.trim()) {
      lines.push(`path includes ${this.pathFilter.trim()}`);
    }

    if (this.displayChartType === "table") {
      // 排序（仅表格）
      lines.push(`sort by ${this.sortField} ${this.sortDir}`);

      // 分组（仅表格，使用过滤条件区保存的分组方式）
      if (this.groupBy !== "none") {
        lines.push(`group by ${this.groupBy}`);
      }

      // 显示选项（仅表格）
      if (this.showTagInDesc) {
        lines.push("show tag in description");
      }
      if (this.showSummary) {
        lines.push("show summary");
      }
      if (this.showGroupSubtotal) {
        lines.push("show group subtotal");
      }
    } else {
      // 图表使用图表专属分组
      let groupForChart: string;
      if (this.displayChartType === "bar") {
        groupForChart = this.barXGroupBy;
      } else if (this.displayChartType === "line") {
        groupForChart = this.lineXGroupBy;
      } else {
        groupForChart = this.pieGroupBy;
      }
      lines.push(`group by ${groupForChart}`);
    }

    return lines.join("\n");
  }

  // 安全转义用户输入中的双引号
  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  // 插入到编辑器，返回是否插入成功
  private insert(): boolean {
    // 校验金额范围
    const minVal = parseFloat(this.amountMin);
    const maxVal = parseFloat(this.amountMax);
    if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
      new Notice(t("notice.amountRangeInvalid"));
      return false;
    }

    // 校验日期范围
    if (this.dateStart && this.dateEnd && this.dateStart > this.dateEnd) {
      new Notice(t("notice.dateRangeInvalid"));
      return false;
    }

    // 校验图表尺寸（仅图表类型）
    if (this.displayChartType !== "table") {
      if (isNaN(this.chartWidth) || this.chartWidth < 200 || this.chartWidth > 1200) {
        new Notice(t("notice.widthInvalid"));
        return false;
      }
      if (isNaN(this.chartHeight) || this.chartHeight < 150 || this.chartHeight > 800) {
        new Notice(t("notice.heightInvalid"));
        return false;
      }
    }

    const queryString = this.buildQueryString();
    let block: string;

    if (this.displayChartType === "table") {
      // 表格类型
      const tableParams: string[] = [];

      if (this.tableColCount !== 6) {
        tableParams.push(`table columns ${this.tableColCount}`);
      }

      for (let i = 0; i < this.tableColCount; i++) {
        const col = this.tableCols[i];
        const colConfig: string[] = [];
        colConfig.push(col.field);
        if (col.header.trim()) {
          colConfig.push(`"${this.escapeQuotes(col.header.trim())}"`);
        }
        if (col.align !== "left") {
          colConfig.push(col.align);
        }
        tableParams.push(`col${i + 1} ${colConfig.join(" ")}`);
      }

      const tableOptionsStr = tableParams.join("\n");
      block = `\`\`\`cashlog-chart\n${queryString}\n${tableOptionsStr}\n\`\`\``;
    } else if (this.displayChartType === "bar") {
      // 条形图：新语法
      const chartParams: string[] = [];

      chartParams.push(`chart type bar`);

      if (this.chartTitle.trim()) {
        chartParams.push(`chart title "${this.escapeQuotes(this.chartTitle.trim())}"`);
      }

      chartParams.push(`chart bar split by ${this.barSplitBy}`);

      // 仅当子分组项不是固定类型时才输出（tag/account 需要指定具体项）
      if ((this.barSplitBy === "tag" || this.barSplitBy === "account") && this.barSplitItems.size > 0) {
        const items = Array.from(this.barSplitItems);
        if (items.length > 0) {
          chartParams.push(`chart bar items ${items.join(" ")}`);
        }
      }

      if (this.chartWidth !== 600) {
        chartParams.push(`chart width ${this.chartWidth}`);
      }
      if (this.chartHeight !== 400) {
        chartParams.push(`chart height ${this.chartHeight}`);
      }

      chartParams.push(`chart legend ${this.chartShowLegend}`);
      chartParams.push(`chart labels ${this.chartShowLabels}`);

      block = `\`\`\`cashlog-chart\n${queryString}\n${chartParams.join("\n")}\n\`\`\``;
    } else if (this.displayChartType === "line") {
      // 折线图：新语法
      const chartParams: string[] = [];

      chartParams.push(`chart type line`);

      if (this.chartTitle.trim()) {
        chartParams.push(`chart title "${this.escapeQuotes(this.chartTitle.trim())}"`);
      }

      chartParams.push(`chart line split by ${this.lineSplitBy}`);

      // 仅当子分组项不是固定类型时才输出
      if ((this.lineSplitBy === "tag" || this.lineSplitBy === "account") && this.lineSplitItems.size > 0) {
        const items = Array.from(this.lineSplitItems);
        if (items.length > 0) {
          chartParams.push(`chart line items ${items.join(" ")}`);
        }
      }

      if (this.chartWidth !== 600) {
        chartParams.push(`chart width ${this.chartWidth}`);
      }
      if (this.chartHeight !== 400) {
        chartParams.push(`chart height ${this.chartHeight}`);
      }

      chartParams.push(`chart legend ${this.chartShowLegend}`);
      chartParams.push(`chart labels ${this.chartShowLabels}`);

      block = `\`\`\`cashlog-chart\n${queryString}\n${chartParams.join("\n")}\n\`\`\``;
    } else {
      // 扇形图
      const chartParams: string[] = [];

      chartParams.push(`chart type pie`);

      if (this.chartTitle.trim()) {
        chartParams.push(`chart title "${this.escapeQuotes(this.chartTitle.trim())}"`);
      }

      // 按标签/类型时数值类型固定（绝对值），不输出 chart value
      if (this.pieGroupBy !== "tag" && this.pieGroupBy !== "type") {
        chartParams.push(`chart value ${this.pieValueType}`);
      }

      if (this.chartWidth !== 600) {
        chartParams.push(`chart width ${this.chartWidth}`);
      }
      if (this.chartHeight !== 400) {
        chartParams.push(`chart height ${this.chartHeight}`);
      }

      chartParams.push(`chart legend ${this.chartShowLegend}`);
      chartParams.push(`chart labels ${this.chartShowLabels}`);

      block = `\`\`\`cashlog-chart\n${queryString}\n${chartParams.join("\n")}\n\`\`\``;
    }

    const cursor = this.editor.getCursor();
    this.editor.replaceRange(block + "\n", cursor);
    return true;
  }

  // 更新选项的可见性
  private updateOptionsVisibility(): void {
    const isTable = this.displayChartType === "table";
    if (this.tableOptionsContainer) {
      this.tableOptionsContainer.toggleClass("hidden", !isTable);
    }
    if (this.chartOptionsContainer) {
      this.chartOptionsContainer.toggleClass("hidden", isTable);
    }
  }

  // 构建表格选项 UI
  private buildTableOptionsUI(): void {
    if (!this.tableOptionsContainer) return;

    this.tableOptionsContainer.empty();

    // === 以下选项仅对表格生效 ===

    // 排序方式
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.sortBy"))
      .addDropdown((dd) =>
        dd
          .addOption("date descending", t("chartModal.sort.dateDesc"))
          .addOption("date ascending", t("chartModal.sort.dateAsc"))
          .addOption("amount descending", t("chartModal.sort.amountDesc"))
          .addOption("amount ascending", t("chartModal.sort.amountAsc"))
          .setValue(`${this.sortField} ${this.sortDir}`)
          .onChange((v) => {
            const [field, dir] = v.split(" ");
            this.sortField = field;
            this.sortDir = dir;
          }),
      );

    // 分组方式
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.groupBy"))
      .addDropdown((dd) =>
        dd
          .addOption("none", t("chartModal.group.none"))
          .addOption("tag", t("chartModal.group.tag"))
          .addOption("type", t("chartModal.group.type"))
          .addOption("date", t("chartModal.group.date"))
          .addOption("week", t("chartModal.group.week"))
          .addOption("month", t("chartModal.group.month"))
          .addOption("year", t("chartModal.group.year"))
          .addOption("account", t("chartModal.group.account"))
          .setValue(this.groupBy)
          .onChange((v) => { this.groupBy = v; }),
      );

    // 描述中显示标签
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.showTagInDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.showTagInDesc)
          .onChange((v) => { this.showTagInDesc = v; }),
      );

    // 显示统计信息
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.showSummary"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.showSummary)
          .onChange((v) => { this.showSummary = v; }),
      );

    // 显示分组小计
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.showGroupSubtotal"))
      .setDesc(t("chartModal.showGroupSubtotalDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.showGroupSubtotal)
          .onChange((v) => { this.showGroupSubtotal = v; }),
      );

    // 表格列数
    new Setting(this.tableOptionsContainer)
      .setName(t("chartModal.tableColCount"))
      .addDropdown((dd) =>
        dd
          .addOption("1", "1")
          .addOption("2", "2")
          .addOption("3", "3")
          .addOption("4", "4")
          .addOption("5", "5")
          .addOption("6", "6")
          .setValue(String(this.tableColCount))
          .onChange((v) => {
            this.tableColCount = parseInt(v);
            // 仅重建 UI，不重置列配置数据
            this.buildTableOptionsUI();
          }),
      );

    // 列配置
    const fields = [
      { value: "date" as const, label: t("chartModal.field.date") },
      { value: "amount" as const, label: t("chartModal.field.amount") },
      { value: "account" as const, label: t("chartModal.field.account") },
      { value: "description" as const, label: t("chartModal.field.description") },
      { value: "attachment" as const, label: t("chartModal.field.attachment") },
      { value: "link" as const, label: t("chartModal.field.link") },
    ];

    for (let i = 0; i < this.tableColCount; i++) {
      const col = this.tableCols[i];
      const colContainer = this.tableOptionsContainer.createEl("div", {
        cls: "cashlog-col-config-card",
      });

      colContainer.createEl("strong", { text: tp("chartModal.colPrefix", { n: i + 1 }) });

      // 显示数据
      new Setting(colContainer)
        .setName(t("chartModal.col.field"))
        .addDropdown((dd) => {
          for (const f of fields) {
            dd.addOption(f.value, f.label);
          }
          dd.setValue(col.field)
            .onChange((v) => {
              this.tableCols[i].field = v as typeof col.field;
            });
        });

      // 显示内容（表头名称）
      new Setting(colContainer)
        .setName(t("chartModal.col.header"))
        .setDesc(t("chartModal.col.headerDesc"))
        .addText((text) =>
          text
            .setPlaceholder(
              col.field === "date" ? t("chartModal.field.date") :
              col.field === "amount" ? t("chartModal.field.amount") :
              col.field === "account" ? t("chartModal.field.account") :
              col.field === "attachment" ? t("chartModal.field.attachment") :
              col.field === "description" ? t("chartModal.field.description") : t("chartModal.field.link")
            )
            .setValue(col.header)
            .onChange((v) => { this.tableCols[i].header = v; }),
        );

      // 对齐方式
      new Setting(colContainer)
        .setName(t("chartModal.col.align"))
        .addDropdown((dd) =>
          dd
            .addOption("left", t("chartModal.col.alignLeft"))
            .addOption("center", t("chartModal.col.alignCenter"))
            .addOption("right", t("chartModal.col.alignRight"))
            .setValue(col.align)
            .onChange((v) => {
              this.tableCols[i].align = v as typeof col.align;
            }),
        );
    }

  }

  // 构建图表选项 UI（根据类型分派）
  private buildChartOptionsUI(): void {
    if (!this.chartOptionsContainer) return;
    this.chartOptionsContainer.empty();

    if (this.displayChartType === "bar") {
      this.buildBarChartOptions();
      return;
    }

    if (this.displayChartType === "line") {
      this.buildLineChartOptions();
      return;
    }

    if (this.displayChartType === "pie") {
      this.buildPieChartOptions();
      return;
    }
  }

  // 构建条形图专属选项
  private buildBarChartOptions(): void {
    if (!this.chartOptionsContainer) return;

    // 图表标题
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartTitle"))
      .setDesc(t("chartModal.chartTitleDesc"))
      .addText((text) => {
        text.inputEl.addClass("cashlog-chart-input-full");
        text
          .setPlaceholder(t("chartModal.chartTitlePlaceholder"))
          .setValue(this.chartTitle)
          .onChange((v) => { this.chartTitle = v; });
      });

    // X轴分组
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.xGroupBy"))
      .setDesc(t("chartModal.xGroupByDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("month", t("chartModal.group.month"))
          .addOption("week", t("chartModal.group.week"))
          .addOption("date", t("chartModal.group.date"))
          .addOption("tag", t("chartModal.group.tag"))
          .addOption("account", t("chartModal.group.account"))
          .addOption("type", t("chartModal.group.type"))
          .addOption("year", t("chartModal.group.year"))
          .setValue(this.barXGroupBy)
          .onChange((v) => { this.barXGroupBy = v; }),
      );

    // 子分组依据
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.splitBy"))
      .setDesc(t("chartModal.splitByBarDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("none", t("chartModal.split.none"))
          .addOption("valueType", t("chartModal.split.valueType"))
          .addOption("tag", t("chartModal.group.tag"))
          .addOption("account", t("chartModal.group.account"))
          .addOption("type", t("chartModal.group.type"))
          .addOption("date", t("chartModal.group.date"))
          .addOption("week", t("chartModal.group.week"))
          .addOption("month", t("chartModal.group.month"))
          .addOption("year", t("chartModal.group.year"))
          .setValue(this.barSplitBy)
          .onChange((v) => {
            this.barSplitBy = v;
            this.resetBarSplitItems();
            this.rebuildBarSplitItemsUI();
          }),
      );

    // 子分组项选择区域（动态重建）
    this.barSplitItemsContainer = this.chartOptionsContainer.createEl("div");
    this.rebuildBarSplitItemsUI();

    // 图表尺寸
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartSize"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.width"))
          .setValue(String(this.chartWidth))
          .onChange((v) => { this.chartWidth = parseInt(v); }),
      )
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.height"))
          .setValue(String(this.chartHeight))
          .onChange((v) => { this.chartHeight = parseInt(v); }),
      );

    // 显示选项
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLegend"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLegend)
          .onChange((v) => { this.chartShowLegend = v; }),
      );

    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLabels"))
      .setDesc(t("chartModal.showLabelsBarDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLabels)
          .onChange((v) => { this.chartShowLabels = v; }),
      );
  }

  // 根据 barSplitBy 类型重置 barSplitItems 的默认值
  private resetBarSplitItems(): void {
    switch (this.barSplitBy) {
      case "none":
        this.barSplitItems = new Set();
        break;
      case "valueType":
        this.barSplitItems = new Set(["balance", "income", "expense"]);
        break;
      case "type":
        this.barSplitItems = new Set(["income", "expense"]);
        break;
      case "tag":
        this.barSplitItems = new Set();  // 用户手动选择
        break;
      case "account":
        this.barSplitItems = new Set(this.getAvailableAccounts());  // 默认全选
        break;
      case "date":
      case "week":
      case "month":
      case "year":
        this.barSplitItems = new Set();  // 自动收集
        break;
    }
  }

  // 重建子分组项选择 UI
  private rebuildBarSplitItemsUI(): void {
    if (!this.barSplitItemsContainer) return;
    this.barSplitItemsContainer.empty();

    const container = this.barSplitItemsContainer;
    container.addClass("cashlog-col-config-card");

    switch (this.barSplitBy) {
      case "none": {
        new Setting(container)
          .setName(t("chartModal.splitItems"))
          .setDesc(t("chartModal.splitItems.noSplit"));
        break;
      }
      case "valueType": {
        new Setting(container)
          .setName(t("chartModal.splitItems"))
          .setDesc(t("chartModal.splitItems.fixedBar"));
        break;
      }
      case "type": {
        this.buildCheckboxItemList(container, t("chartModal.selectTypeLabel"), ["income", "expense"], { income: t("cashlogModal.type.income"), expense: t("cashlogModal.type.expense") }, "bar");
        break;
      }
      case "tag": {
        this.buildCheckboxItemList(container, t("chartModal.selectTagLabel"), this.getAvailableTags(), undefined, "bar");
        break;
      }
      case "account": {
        this.buildCheckboxItemList(container, t("chartModal.selectAccountLabel"), this.getAvailableAccounts(), undefined, "bar");
        break;
      }
      case "date":
      case "week":
      case "month":
      case "year": {
        new Setting(container)
          .setName(t("chartModal.splitItems"))
          .setDesc(t("chartModal.splitItems.autoDesc"));
        break;
      }
    }
  }

  // 构建折线图专属选项
  private buildLineChartOptions(): void {
    if (!this.chartOptionsContainer) return;

    // 图表标题
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartTitle"))
      .setDesc(t("chartModal.chartTitleDesc"))
      .addText((text) => {
        text.inputEl.addClass("cashlog-chart-input-full");
        text
          .setPlaceholder(t("chartModal.chartTitlePlaceholderLine"))
          .setValue(this.chartTitle)
          .onChange((v) => { this.chartTitle = v; });
      });

    // X轴分组（仅时间维度）
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.xGroupBy"))
      .setDesc(t("chartModal.xGroupByDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("month", t("chartModal.group.month"))
          .addOption("week", t("chartModal.group.week"))
          .addOption("date", t("chartModal.group.date"))
          .addOption("year", t("chartModal.group.year"))
          .setValue(this.lineXGroupBy)
          .onChange((v) => { this.lineXGroupBy = v; }),
      );

    // 子分组依据
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.splitBy"))
      .setDesc(t("chartModal.splitByLineDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("none", t("chartModal.split.none"))
          .addOption("valueType", t("chartModal.split.valueType"))
          .addOption("tag", t("chartModal.group.tag"))
          .addOption("account", t("chartModal.group.account"))
          .addOption("type", t("chartModal.group.type"))
          .setValue(this.lineSplitBy)
          .onChange((v) => {
            this.lineSplitBy = v;
            this.resetLineSplitItems();
            this.rebuildLineSplitItemsUI();
          }),
      );

    // 子分组项选择区域（动态重建）
    this.lineSplitItemsContainer = this.chartOptionsContainer.createEl("div");
    this.rebuildLineSplitItemsUI();

    // 图表尺寸
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartSize"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.width"))
          .setValue(String(this.chartWidth))
          .onChange((v) => { this.chartWidth = parseInt(v); }),
      )
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.height"))
          .setValue(String(this.chartHeight))
          .onChange((v) => { this.chartHeight = parseInt(v); }),
      );

    // 显示选项
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLegend"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLegend)
          .onChange((v) => { this.chartShowLegend = v; }),
      );

    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLabels"))
      .setDesc(t("chartModal.showLabelsLineDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLabels)
          .onChange((v) => { this.chartShowLabels = v; }),
      );
  }

  // 根据 lineSplitBy 类型重置 lineSplitItems 的默认值
  private resetLineSplitItems(): void {
    switch (this.lineSplitBy) {
      case "none":
        this.lineSplitItems = new Set();
        break;
      case "valueType":
        this.lineSplitItems = new Set(["balance", "income", "expense"]);
        break;
      case "type":
        this.lineSplitItems = new Set(["income", "expense"]);
        break;
      case "tag":
        this.lineSplitItems = new Set();
        break;
      case "account":
        this.lineSplitItems = new Set(this.getAvailableAccounts());
        break;
    }
  }

  // 重建折线图子分组项选择 UI
  private rebuildLineSplitItemsUI(): void {
    if (!this.lineSplitItemsContainer) return;
    this.lineSplitItemsContainer.empty();

    const container = this.lineSplitItemsContainer;
    container.addClass("cashlog-col-config-card");

    switch (this.lineSplitBy) {
      case "none": {
        new Setting(container)
          .setName(t("chartModal.splitItems"))
          .setDesc(t("chartModal.splitItems.noSplit"));
        break;
      }
      case "valueType": {
        new Setting(container)
          .setName(t("chartModal.splitItems"))
          .setDesc(t("chartModal.splitItems.fixedLine"));
        break;
      }
      case "type": {
        this.buildCheckboxItemList(container, t("chartModal.selectTypeLabel"), ["income", "expense"], { income: t("cashlogModal.type.income"), expense: t("cashlogModal.type.expense") }, "line");
        break;
      }
      case "tag": {
        this.buildCheckboxItemList(container, t("chartModal.selectTagLabel"), this.getAvailableTags(), undefined, "line");
        break;
      }
      case "account": {
        this.buildCheckboxItemList(container, t("chartModal.selectAccountLabel"), this.getAvailableAccounts(), undefined, "line");
        break;
      }
    }
  }

  // 扇形图数值类型选项容器（分组方式变更时重建）
  private pieValueTypeContainer: HTMLElement | null = null;

  // 构建扇形图专属选项
  private buildPieChartOptions(): void {
    if (!this.chartOptionsContainer) return;

    // 图表标题
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartTitle"))
      .setDesc(t("chartModal.chartTitleDesc"))
      .addText((text) => {
        text.inputEl.addClass("cashlog-chart-input-full");
        text
          .setPlaceholder(t("chartModal.chartTitlePlaceholderPie"))
          .setValue(this.chartTitle)
          .onChange((v) => { this.chartTitle = v; });
      });

    // 分组方式
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.pieGroupBy"))
      .setDesc(t("chartModal.pieGroupByDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("tag", t("chartModal.group.tag"))
          .addOption("type", t("chartModal.group.type"))
          .addOption("month", t("chartModal.group.month"))
          .addOption("week", t("chartModal.group.week"))
          .addOption("date", t("chartModal.group.date"))
          .addOption("year", t("chartModal.group.year"))
          .addOption("account", t("chartModal.group.account"))
          .setValue(this.pieGroupBy)
          .onChange((v) => {
            this.pieGroupBy = v;
            this.resetPieValueType();
            this.rebuildPieValueTypeUI();
          }),
      );

    // 数值类型（动态重建）
    this.pieValueTypeContainer = this.chartOptionsContainer.createEl("div");
    this.rebuildPieValueTypeUI();

    // 图表尺寸
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.chartSize"))
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.width"))
          .setValue(String(this.chartWidth))
          .onChange((v) => { this.chartWidth = parseInt(v); }),
      )
      .addText((text) =>
        text
          .setPlaceholder(t("chartModal.height"))
          .setValue(String(this.chartHeight))
          .onChange((v) => { this.chartHeight = parseInt(v); }),
      );

    // 显示选项
    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLegend"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLegend)
          .onChange((v) => { this.chartShowLegend = v; }),
      );

    new Setting(this.chartOptionsContainer)
      .setName(t("chartModal.showLabels"))
      .setDesc(t("chartModal.showLabelsPieDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.chartShowLabels)
          .onChange((v) => { this.chartShowLabels = v; }),
      );
  }

  // 分组方式变更时，重置数值类型的默认值
  private resetPieValueType(): void {
    if (this.pieGroupBy === "account") {
      this.pieValueType = "inflow";
    } else {
      this.pieValueType = "expense";
    }
  }

  // 根据当前分组方式重建数值类型选项
  private rebuildPieValueTypeUI(): void {
    if (!this.pieValueTypeContainer) return;
    this.pieValueTypeContainer.empty();

    const isTagOrType = this.pieGroupBy === "tag" || this.pieGroupBy === "type";
    const isAccount = this.pieGroupBy === "account";

    if (isTagOrType) {
      // 按标签/类型：数值固定为绝对值，不显示选择器
      new Setting(this.pieValueTypeContainer)
        .setName(t("chartModal.pieValueType"))
        .setDesc(t("chartModal.splitItems.fixedPie"));
    } else if (isAccount) {
      // 按账户：进账/转出/进账-转出
      new Setting(this.pieValueTypeContainer)
        .setName(t("chartModal.pieValueType"))
        .setDesc(t("chartModal.pieValueTypeAccountDesc"))
        .addDropdown((dd) =>
          dd
            .addOption("income", t("chartModal.valueType.income"))
            .addOption("expense", t("chartModal.valueType.expense"))
            .addOption("balance", t("chartModal.valueType.balance"))
            .addOption("inflow", t("chartModal.valueType.inflow"))
            .addOption("outflow", t("chartModal.valueType.outflow"))
            .addOption("netflow", t("chartModal.valueType.netflow"))
            .setValue(this.pieValueType)
            .onChange((v) => { this.pieValueType = v; }),
        );
    } else {
      // 按时间维度：收入/支出/净收支
      new Setting(this.pieValueTypeContainer)
        .setName(t("chartModal.pieValueType"))
        .setDesc(t("chartModal.pieValueTypeTimeDesc"))
        .addDropdown((dd) =>
          dd
            .addOption("expense", t("chartModal.valueType.expense"))
            .addOption("income", t("chartModal.valueType.income"))
            .addOption("balance", t("chartModal.valueType.balance"))
            .setValue(this.pieValueType)
            .onChange((v) => { this.pieValueType = v; }),
        );
    }
  }

  // 构建复选框列表（用于标签/账户/类型选择）
  private buildCheckboxItemList(container: HTMLElement, title: string, items: string[], labelMap?: Record<string, string>, chartKind?: "bar" | "line"): void {
    container.createEl("strong", { text: title });

    if (items.length === 0) {
      container.createEl("div", { text: t("chartModal.noItems"), cls: "cashlog-empty" });
      return;
    }

    const targetItems = chartKind === "line" ? this.lineSplitItems : this.barSplitItems;
    const list = container.createEl("div", { cls: "cashlog-checkbox-list cashlog-checkbox-list-no-pad" });

    for (const item of items) {
      const lbl = list.createEl("label", { cls: "cashlog-checkbox-label" });
      const cb = lbl.createEl("input", { attr: { type: "checkbox" } });
      cb.checked = targetItems.has(item);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          targetItems.add(item);
        } else {
          targetItems.delete(item);
        }
      });
      lbl.createSpan({ text: labelMap?.[item] ?? item });
    }
  }

  // 获取可用的标签列表
  private getAvailableTags(): string[] {
    const entries = this.plugin.cache.getEntries();
    const tagSet = new Set<string>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        if (tag) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }

  // 获取可用的账户列表
  private getAvailableAccounts(): string[] {
    const entries = this.plugin.cache.getEntries();
    const acctSet = new Set<string>();
    for (const entry of entries) {
      for (const aa of entry.accountAmounts) {
        if (aa.account) acctSet.add(aa.account);
      }
    }
    return Array.from(acctSet).sort();
  }
}
