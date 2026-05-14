/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { FolderSuggest } from "./FolderSuggest";
import type CashlogPlugin from "./main";
import { DEFAULT_SETTINGS } from "./Settings";
import type { BudgetConfig, GoalConfig } from "./Settings";
import { openTagEditModal } from "./ModalHelpers";
import { t } from "./i18n";
import { getErrorMessage } from "./ErrorUtils";

let budgetIdCounter = 0;
let goalIdCounter = 0;

export class CashlogSettingsTab extends PluginSettingTab {
  plugin: CashlogPlugin;

  constructor(app: App, plugin: CashlogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName(t("settings.heading")).setHeading();

    // ===== 标签设置 =====
    new Setting(containerEl).setName(t("settings.section.tags")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.incomeTag.name"))
      .setDesc(t("settings.incomeTag.desc"))
      .addButton((btn) => {
        const displayTag = this.plugin.settings.incomeTag.startsWith("#")
          ? this.plugin.settings.incomeTag.substring(1)
          : this.plugin.settings.incomeTag;
        btn.setButtonText(displayTag)
          .onClick(() => {
            openTagEditModal(containerEl, t("settings.incomeTag.name"), this.plugin.settings.incomeTag, async (newTag) => {
              this.plugin.settings.incomeTag = newTag;
              await this.plugin.saveSettings();
              this.display();
            });
          });
        btn.buttonEl.addClass("cashlog-settings-btn-tag");
      });

    new Setting(containerEl)
      .setName(t("settings.expenseTag.name"))
      .setDesc(t("settings.expenseTag.desc"))
      .addButton((btn) => {
        const displayTag = this.plugin.settings.expenseTag.startsWith("#")
          ? this.plugin.settings.expenseTag.substring(1)
          : this.plugin.settings.expenseTag;
        btn.setButtonText(displayTag)
          .onClick(() => {
            openTagEditModal(containerEl, t("settings.expenseTag.name"), this.plugin.settings.expenseTag, async (newTag) => {
              this.plugin.settings.expenseTag = newTag;
              await this.plugin.saveSettings();
              this.display();
            });
          });
        btn.buttonEl.addClass("cashlog-settings-btn-tag");
      });

    if (this.plugin.settings.enableAccounts) {
      new Setting(containerEl)
        .setName(t("settings.transferTag.name"))
        .setDesc(t("settings.transferTag.desc"))
        .addButton((btn) => {
          const displayTag = this.plugin.settings.transferTag.startsWith("#")
            ? this.plugin.settings.transferTag.substring(1)
            : this.plugin.settings.transferTag;
          btn.setButtonText(displayTag)
            .onClick(() => {
              openTagEditModal(containerEl, t("settings.transferTag.name"), this.plugin.settings.transferTag, async (newTag) => {
                this.plugin.settings.transferTag = newTag;
                await this.plugin.saveSettings();
                this.display();
              });
            });
          btn.buttonEl.addClass("cashlog-settings-btn-tag");
        });

      new Setting(containerEl)
        .setName(t("settings.balanceChangeTag.name"))
        .setDesc(t("settings.balanceChangeTag.desc"))
        .addButton((btn) => {
          const displayTag = this.plugin.settings.balanceChangeTag.startsWith("#")
            ? this.plugin.settings.balanceChangeTag.substring(1)
            : this.plugin.settings.balanceChangeTag;
          btn.setButtonText(displayTag)
            .onClick(() => {
              openTagEditModal(containerEl, t("settings.balanceChangeTag.name"), this.plugin.settings.balanceChangeTag, async (newTag) => {
                this.plugin.settings.balanceChangeTag = newTag;
                await this.plugin.saveSettings();
                this.display();
              });
            });
          btn.buttonEl.addClass("cashlog-settings-btn-tag");
        });
    }

    // ===== 子标签预设 =====
    new Setting(containerEl).setName(t("settings.section.subTagPresets")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.section.subTagPresets"))
      .setDesc(t("settings.subTagPresets.desc"));

    // ===== 账户设置 =====
    new Setting(containerEl).setName(t("settings.section.accounts")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.enableAccounts.name"))
      .setDesc(t("settings.enableAccounts.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAccounts)
          .onChange(async (value) => {
            this.plugin.settings.enableAccounts = value;
            await this.plugin.saveSettingsAndReindex();
            this.display();
          }),
      );

    // ===== 附件设置 =====
    new Setting(containerEl).setName(t("settings.section.attachments")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.enableAttachments.name"))
      .setDesc(t("settings.enableAttachments.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAttachments)
          .onChange(async (value) => {
            this.plugin.settings.enableAttachments = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.enableAttachments) {
      let inputEl: HTMLInputElement | null = null;
      new Setting(containerEl)
        .setName(t("settings.attachmentFolder.name"))
        .setDesc(t("settings.attachmentFolder.desc"))
        .addText((text) => {
          text
            .setValue(this.plugin.settings.attachmentFolder)
            .setPlaceholder(t("settings.attachmentFolder.placeholder"))
            .onChange(async (value) => {
              this.plugin.settings.attachmentFolder = normalizePath(value) || DEFAULT_SETTINGS.attachmentFolder;
              await this.plugin.saveSettings();
            });
          inputEl = text.inputEl;
        });
      // 绑定文件夹模糊匹配建议
      if (inputEl) {
        new FolderSuggest(this.app, inputEl, (folderPath: string) => {
          this.plugin.settings.attachmentFolder = normalizePath(folderPath) || DEFAULT_SETTINGS.attachmentFolder;
          this.plugin.saveSettings().catch((e) => {
            new Notice(t("error.queryError") + ": " + getErrorMessage(e));
          });
        });
      }
    }

    // ===== 预算设置 =====
    new Setting(containerEl).setName(t("settings.section.budget")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.enableBudgets.name"))
      .setDesc(t("settings.enableBudgets.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableBudgets)
          .onChange(async (value) => {
            this.plugin.settings.enableBudgets = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    // ===== 目标设置 =====
    new Setting(containerEl).setName(t("settings.section.goals")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.enableGoals.name"))
      .setDesc(t("settings.enableGoals.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableGoals)
          .onChange(async (value) => {
            this.plugin.settings.enableGoals = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    // ===== 统计设置 =====
    new Setting(containerEl).setName(t("settings.section.stats")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.statsMode.name"))
      .setDesc(t("settings.statsMode.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("day", t("settings.statsMode.day"))
          .addOption("week", t("settings.statsMode.week"))
          .addOption("month", t("settings.statsMode.month"))
          .addOption("year", t("settings.statsMode.year"))
          .addOption("all", t("settings.statsMode.all"))
          .setValue(this.plugin.settings.statsMode)
          .onChange(async (value: "day" | "week" | "month" | "year" | "all") => {
            this.plugin.settings.statsMode = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.statsMode === "month") {
      new Setting(containerEl)
        .setName(t("settings.monthStartDay.name"))
        .setDesc(t("settings.monthStartDay.desc"))
        .addText((text) =>
          text
            .setValue(String(this.plugin.settings.statsMonthStartDay))
            .onChange(async (value) => {
              const day = parseInt(value) || 1;
              this.plugin.settings.statsMonthStartDay = Math.max(1, Math.min(28, day));
              await this.plugin.saveSettings();
            }),
        );
    }

    if (this.plugin.settings.statsMode === "week") {
      new Setting(containerEl)
        .setName(t("settings.weekStartDay.name"))
        .setDesc(t("settings.weekStartDay.desc"))
        .addDropdown((dropdown) =>
          dropdown
            .addOption("0", t("settings.weekStartDay.0"))
            .addOption("1", t("settings.weekStartDay.1"))
            .addOption("2", t("settings.weekStartDay.2"))
            .addOption("3", t("settings.weekStartDay.3"))
            .addOption("4", t("settings.weekStartDay.4"))
            .addOption("5", t("settings.weekStartDay.5"))
            .addOption("6", t("settings.weekStartDay.6"))
            .setValue(String(this.plugin.settings.statsWeekStartDay))
            .onChange(async (value) => {
              this.plugin.settings.statsWeekStartDay = parseInt(value);
              await this.plugin.saveSettings();
            }),
        );
    }

    // ===== 高级设置 =====
    new Setting(containerEl).setName(t("settings.section.advanced")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.showEditButton.name"))
      .setDesc(t("settings.showEditButton.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showEditButton)
          .onChange(async (value) => {
            this.plugin.settings.showEditButton = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.showNoteLink.name"))
      .setDesc(t("settings.showNoteLink.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showNoteLink)
          .onChange(async (value) => {
            this.plugin.settings.showNoteLink = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.globalQuery.name"))
      .setDesc(t("settings.globalQuery.desc"))
      .addTextArea((text) =>
        text
          .setPlaceholder(t("settings.globalQuery.placeholder"))
          .setValue(this.plugin.settings.globalQuery)
          .onChange(async (value) => {
            this.plugin.settings.globalQuery = value;
            await this.plugin.saveSettings();
          }),
      );

    // ===== 路径设置 =====
    new Setting(containerEl).setName(t("settings.section.paths")).setHeading();

    let excludeInput: HTMLTextAreaElement;
    new Setting(containerEl)
      .setName(t("settings.excludePaths.name"))
      .setDesc(t("settings.excludePaths.desc"))
      .addTextArea((text) => {
        text
          .setPlaceholder(t("settings.excludePaths.placeholder"))
          .setValue(this.plugin.settings.excludePaths.join(", "));
        excludeInput = text.inputEl;
      })
      .addButton((btn) =>
        btn
          .setButtonText(t("modal.button.apply"))
          .setCta()
          .onClick(async () => {
            this.plugin.settings.excludePaths = excludeInput.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            this.plugin.settings.includePaths = [];
            await this.plugin.saveSettingsAndReindex();
            this.display();
          }),
      );

    let includeInput: HTMLTextAreaElement;
    new Setting(containerEl)
      .setName(t("settings.includePaths.name"))
      .setDesc(t("settings.includePaths.desc"))
      .addTextArea((text) => {
        text
          .setPlaceholder(t("settings.includePaths.placeholder"))
          .setValue(this.plugin.settings.includePaths.join(", "));
        includeInput = text.inputEl;
      })
      .addButton((btn) =>
        btn
          .setButtonText(t("modal.button.apply"))
          .setCta()
          .onClick(async () => {
            this.plugin.settings.includePaths = includeInput.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            this.plugin.settings.excludePaths = [];
            await this.plugin.saveSettingsAndReindex();
            this.display();
          }),
      );

    // 重置按钮
    new Setting(containerEl)
      .setName(t("settings.reset.name"))
      .setDesc(t("settings.reset.desc"))
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.reset")).onClick(async () => {
          this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }

  private renderBudgetList(container: HTMLElement): void {
    const budgets = this.plugin.settings.budgets;

    // 已有预算列表
    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i];
      const periodLabels: Record<string, string> = {
        weekly: t("settings.period.weekly"), monthly: t("settings.period.monthly"), yearly: t("settings.period.yearly"), custom: t("settings.period.custom"),
      };
      new Setting(container)
        .setName(budget.name || `预算 #${i + 1}`)
        .setDesc(`¥${budget.amount} / ${periodLabels[budget.period] || budget.period}，标签：${budget.tag}`)
        .addButton((btn) =>
          btn.setButtonText(t("modal.button.delete")).onClick(async () => {
            this.plugin.settings.budgets.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        );
    }

    // 新增预算表单
    const newBudget: Partial<BudgetConfig> = {
      name: "", amount: 0, period: "monthly", tag: "", rollover: false,
    };

    new Setting(container)
      .setName(t("settings.newBudget"))
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.name")).onChange((v) => (newBudget.name = v));
      })
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.amount")).onChange((v) => (newBudget.amount = parseFloat(v) || 0));
      });

    new Setting(container)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("weekly", t("settings.period.weeklyFull"))
          .addOption("monthly", t("settings.period.monthlyFull"))
          .addOption("yearly", t("settings.period.yearlyFull"))
          .addOption("custom", t("settings.period.customFull"))
          .onChange((v: BudgetConfig["period"]) => (newBudget.period = v));
      })
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.tag")).onChange((v) => (newBudget.tag = v));
      })
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.add")).setCta().onClick(async () => {
          if (!newBudget.name || !newBudget.amount) return;
          budgetIdCounter++;
          this.plugin.settings.budgets.push({
            id: `budget-${Date.now()}-${budgetIdCounter}`,
            name: newBudget.name,
            amount: newBudget.amount,
            period: newBudget.period ?? "monthly",
            tag: newBudget.tag ?? "",
            rollover: false,
          });
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }

  private renderGoalList(container: HTMLElement): void {
    const goals = this.plugin.settings.goals;

    // 已有目标列表
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i];
      const periodLabels: Record<string, string> = {
        weekly: t("settings.period.weekly"), monthly: t("settings.period.monthly"), yearly: t("settings.period.yearly"), custom: t("settings.period.custom"),
      };
      new Setting(container)
        .setName(goal.name || `目标 #${i + 1}`)
        .setDesc(`¥${goal.targetAmount} / ${periodLabels[goal.period] || goal.period}，标签：${goal.tag}`)
        .addButton((btn) =>
          btn.setButtonText(t("modal.button.delete")).onClick(async () => {
            this.plugin.settings.goals.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        );
    }

    // 新增目标表单
    const newGoal: Partial<GoalConfig> = {
      name: "", targetAmount: 0, period: "monthly", tag: "",
    };

    new Setting(container)
      .setName(t("settings.newGoal"))
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.name")).onChange((v) => (newGoal.name = v));
      })
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.targetAmount")).onChange((v) => (newGoal.targetAmount = parseFloat(v) || 0));
      });

    new Setting(container)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("weekly", t("settings.period.weeklyFull"))
          .addOption("monthly", t("settings.period.monthlyFull"))
          .addOption("yearly", t("settings.period.yearlyFull"))
          .addOption("custom", t("settings.period.customFull"))
          .onChange((v: GoalConfig["period"]) => (newGoal.period = v));
      })
      .addText((text) => {
        text.setPlaceholder(t("settings.placeholder.goalTag")).onChange((v) => (newGoal.tag = v));
      })
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.add")).setCta().onClick(async () => {
          if (!newGoal.name || !newGoal.targetAmount) return;
          goalIdCounter++;
          this.plugin.settings.goals.push({
            id: `goal-${Date.now()}-${goalIdCounter}`,
            name: newGoal.name,
            targetAmount: newGoal.targetAmount,
            period: newGoal.period ?? "monthly",
            tag: newGoal.tag ?? "",
          });
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
