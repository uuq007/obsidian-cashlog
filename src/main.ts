/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { Events, MarkdownRenderChild, Plugin, TFile } from "obsidian";
import { CashlogSettings, DEFAULT_SETTINGS } from "./Settings";
import { CashlogSettingsTab } from "./SettingsTab";
import { addCommands } from "./Commands";
import { Cache } from "./Cache";
import { Query } from "./Query/Query";
import { renderQueryResult } from "./Renderer";
import { CashlogChartRenderChild } from "./ChartRenderer";
import { AttachmentManager } from "./AttachmentManager";
import { AccountManager } from "./AccountManager";
import { BudgetManager } from "./BudgetManager";
import { CashlogView, CASHLOG_VIEW_TYPE } from "./CashlogView";
import { initI18n, tp } from "./i18n";

export default class CashlogPlugin extends Plugin {
  settings: CashlogSettings = DEFAULT_SETTINGS;
  cache!: Cache;
  events = new Events();
  attachmentManager!: AttachmentManager;
  accountManager!: AccountManager;
  budgetManager!: BudgetManager;

  async onload() {
    initI18n();
    await this.loadSettings();

    // 初始化管理器
    this.attachmentManager = new AttachmentManager(this.app, this.app.vault, this.settings);
    this.accountManager = new AccountManager();
    this.budgetManager = new BudgetManager();

    // 初始化缓存
    this.cache = new Cache(this.app.vault, this.app.metadataCache, this.events, this.settings);

    // 注册命令
    addCommands(this);

    // 注册 Cashlog 面板视图
    this.registerView(CASHLOG_VIEW_TYPE, (leaf) => new CashlogView(leaf, this));

    // 注册设置页
    this.addSettingTab(new CashlogSettingsTab(this.app, this));

    // 注册 cashlog 代码块处理器
    this.registerMarkdownCodeBlockProcessor("cashlog", (source, el, ctx) => {
      this.app.workspace.onLayoutReady(() => {
        const child = new CashlogRenderChild(el, source, this);
        ctx.addChild(child);
      });
    });

    // 注册 cashlog-chart 代码块处理器（动态表格）
    this.registerMarkdownCodeBlockProcessor("cashlog-chart", (source, el, ctx) => {
      this.app.workspace.onLayoutReady(() => {
        const child = new CashlogChartRenderChild(el, source, this);
        ctx.addChild(child);
      });
    });

    // 监听缓存更新事件，触发重渲染
    this.events.on("cashlog-cache-update", () => {
      this.events.trigger("cashlog-render-refresh");
    });

    // 监听文件变更以更新缓存
    this.app.workspace.onLayoutReady(async () => {
      await this.cache.initialize();

      this.registerEvent(
        this.app.vault.on("modify", async (file) => {
          if (file instanceof TFile && file.extension === "md") {
            await this.cache.onFileChanged(file);
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on("create", async (file) => {
          if (file instanceof TFile && file.extension === "md") {
            await this.cache.onFileCreated(file);
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (file instanceof TFile) {
            this.cache.onFileDeleted(file);
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on("rename", async (file, oldPath) => {
          if (file instanceof TFile && file.extension === "md") {
            await this.cache.onFileRenamed(file, oldPath);
          }
        }),
      );
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.events.trigger("cashlog-render-refresh");
  }

  // 保存设置并重建缓存（路径设置变更时调用）
  async saveSettingsAndReindex() {
    await this.saveData(this.settings);
    this.cache.updateSettings(this.settings);
    await this.cache.reindex();
  }

  // 将行替换写入对应文件（migrateTag / migrateAccount 共用）
  private async applyLineReplacements(fileChanges: Map<string, Map<number, string>>): Promise<void> {
    for (const [filePath, lineChanges] of fileChanges) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) continue;

      await this.app.vault.process(file, (content) => {
        const lines = content.split("\n");
        for (const [lineNumber, newLine] of lineChanges) {
          if (lineNumber < lines.length) {
            lines[lineNumber] = newLine;
          }
        }
        return lines.join("\n");
      });
    }
  }

  // 标签迁移：将缓存中所有旧标签替换为新标签，保留子标签
  async migrateTag(oldTag: string, newTag: string): Promise<number> {
    const entries = this.cache.getEntries();
    const fileChanges = new Map<string, Map<number, string>>();
    let migrationCount = 0;

    for (const entry of entries) {
      if (!entry.location) continue;

      let changed = false;
      const newTags = entry.tags.map((t) => {
        // 精确匹配旧标签（不区分大小写）
        if (t.toLowerCase() === oldTag.toLowerCase()) {
          changed = true;
          return newTag;
        }
        // 前缀匹配：旧标签/子标签 → 新标签/子标签
        if (t.toLowerCase().startsWith(oldTag.toLowerCase() + "/")) {
          changed = true;
          return newTag + t.substring(oldTag.length);
        }
        return t;
      });

      if (!changed) continue;

      const updatedEntry = entry.clone({ tags: newTags });
      const newLine = updatedEntry.toFileLineString();

      if (!fileChanges.has(entry.location.path)) {
        fileChanges.set(entry.location.path, new Map());
      }
      fileChanges.get(entry.location.path)!.set(entry.location.lineNumber, newLine);
      migrationCount++;
    }

    if (migrationCount === 0) return 0;

    await this.applyLineReplacements(fileChanges);
    await this.cache.reindex();
    return migrationCount;
  }

  // 按标签删除所有关联的记账条目
  async deleteEntriesByTag(tag: string): Promise<number> {
    const entries = this.cache.getEntries();
    const fileLinesToDelete = new Map<string, number[]>();
    let count = 0;

    for (const entry of entries) {
      if (!entry.location) continue;
      const hasTag = entry.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (!hasTag) continue;

      if (!fileLinesToDelete.has(entry.location.path)) {
        fileLinesToDelete.set(entry.location.path, []);
      }
      fileLinesToDelete.get(entry.location.path)!.push(entry.location.lineNumber);
      count++;
    }

    if (count === 0) return 0;

    // 逐个文件删除行（按行号倒序处理避免偏移）
    for (const [filePath, lineNumbers] of fileLinesToDelete) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) continue;

      const sortedLines = [...lineNumbers].sort((a, b) => b - a);

      await this.app.vault.process(file, (content) => {
        const lines = content.split("\n");
        for (const lineNumber of sortedLines) {
          lines.splice(lineNumber, 1);
        }
        return lines.join("\n");
      });
    }

    await this.cache.reindex();
    return count;
  }

  // 账户迁移：将缓存中所有旧账户名替换为新账户名
  async migrateAccount(oldName: string, newName: string): Promise<number> {
    const entries = this.cache.getEntries();
    const fileChanges = new Map<string, Map<number, string>>();
    let count = 0;

    for (const entry of entries) {
      if (!entry.location) continue;

      const hasOld = entry.accountAmounts.some((aa) => aa.account === oldName);
      if (!hasOld) continue;

      const newAccountAmounts = entry.accountAmounts.map((aa) => ({
        ...aa,
        account: aa.account === oldName ? newName : aa.account,
      }));

      const newLine = entry.clone({ accountAmounts: newAccountAmounts }).toFileLineString();

      if (!fileChanges.has(entry.location.path)) {
        fileChanges.set(entry.location.path, new Map());
      }
      fileChanges.get(entry.location.path)!.set(entry.location.lineNumber, newLine);
      count++;
    }

    if (count === 0) return 0;

    await this.applyLineReplacements(fileChanges);
    await this.cache.reindex();
    return count;
  }

  // 打开 Cashlog 面板
  async activateCashlogPanel(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(CASHLOG_VIEW_TYPE);
    if (leaves.length > 0) {
      await this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: CASHLOG_VIEW_TYPE,
        active: true,
      });
    }
  }
}

// 代码块渲染子组件，支持自动刷新
class CashlogRenderChild extends MarkdownRenderChild {
  private source: string;
  private plugin: CashlogPlugin;

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

  private render() {
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
    const result = query.apply(entries);
    renderQueryResult(this.containerEl, result, query, this.plugin);
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
