import { Keymap, Notice, TFile } from "obsidian";
import { CashlogEntry } from "./EntryLocation";
import { QueryResult, Summary } from "./Query/Filter";
import { Query } from "./Query/Query";
import { CashlogModal, EditableEntryData } from "./CashlogModal";
import { buildEntryFromModalData } from "./EntryEditor";
import { extractNoteName, renderAttachmentLink } from "./PathUtils";
import { t, tp } from "./i18n";
import type CashlogPlugin from "./main";

// 渲染查询结果到 HTML
export function renderQueryResult(
  containerEl: HTMLElement,
  result: QueryResult,
  query: Query,
  plugin: CashlogPlugin,
): void {
  containerEl.empty();
  containerEl.addClass("cashlog-results");

  for (const group of result.groups) {
    // 分组标题
    if (result.groups.length > 1) {
      const groupHeader = containerEl.createEl("div", {
        cls: "cashlog-group-header",
      });
      groupHeader.createEl("strong", { text: group.key });
    }

    // 条目列表
    const listStyle = query.listStyle;
    const listTag = listStyle === "ordered" ? "ol" : listStyle === "none" ? "div" : "ul";
    const list = containerEl.createEl(listTag);
    // none 样式沿用原 cashlog-list（无标记），ul/ol 用浏览器默认列表样式
    if (listStyle === "none") {
      list.addClass("cashlog-list");
    }

    for (const entry of group.entries) {
      renderEntry(list, entry, query, plugin, listStyle);
    }

    // 分组汇总
    if (result.groups.length > 1) {
      const groupSummary = calculateGroupSummary(group.entries);
      renderGroupSummary(containerEl, groupSummary);
    }
  }

  // 总汇总
  if (
    query.shouldShowTotal ||
    query.shouldShowTotalIncome ||
    query.shouldShowTotalExpense ||
    query.shouldShowBalance ||
    query.shouldShowCount
  ) {
    renderSummary(containerEl, result.summary, query);
  }
}

// 渲染单个条目
function renderEntry(
  list: HTMLElement,
  entry: CashlogEntry,
  query: Query,
  plugin: CashlogPlugin,
  listStyle: "unordered" | "ordered" | "none" = "unordered",
): void {
  const tag = listStyle === "none" ? "div" : "li";
  const li = list.createEl(tag, { cls: "cashlog-entry" });

  // 标签
  if (!query.shouldHideTag && entry.tags.length > 0) {
    const tagSpan = li.createEl("span", {
      cls: "cashlog-tag",
      text: entry.tags.join(" "),
    });
    tagSpan.insertAdjacentText("beforebegin", " ");
  }

  // 描述
  if (entry.description) {
    li.createEl("span", {
      cls: "cashlog-description",
      text: entry.description,
    });
  }

  // 转账和余额变更特殊显示
  if (entry.isTransfer || entry.isBalanceChange) {
    for (const aa of entry.accountAmounts) {
      li.createEl("span", {
        cls: `cashlog-account ${aa.amount < 0 ? "cashlog-transfer-from" : "cashlog-transfer-to"}`,
        text: `💳${aa.account}💴${aa.amount}`,
      });
    }
  } else {
    // 金额（无账户部分）
    if (!query.shouldHideAmount) {
      const noAcct = entry.noAccountAmount;
      if (noAcct !== 0) {
        const amountClass = entry.isExpense ? "cashlog-amount-expense" : "cashlog-amount-income";
        li.createEl("span", {
          cls: `cashlog-amount ${amountClass}`,
          text: `💴${noAcct}`,
        });
      }
    }

    // 账户
    for (const aa of entry.accountAmounts) {
      li.createEl("span", {
        cls: "cashlog-account",
        text: `💳${aa.account}💴${aa.amount}`,
      });
    }
  }

  // 附件
  if (entry.hasAttachments) {
    const folder = plugin.settings.attachmentFolder;
    for (const att of entry.attachments) {
      renderAttachmentLink(li, att, folder, (fullPath) => {
        const file = plugin.app.vault.getAbstractFileByPath(fullPath);
        if (file && file instanceof TFile) {
          void plugin.app.workspace.getLeaf().openFile(file);
        }
      });
    }
  }

  // 日期
  if (!query.shouldHideDate && entry.date) {
    li.createEl("span", {
      cls: "cashlog-date",
      text: `➕${entry.date.format("YYYY-MM-DD")}`,
    });
  }

  // 时间
  if (!query.shouldHideTime && entry.time) {
    li.createEl("span", {
      cls: "cashlog-time",
      text: `⏰${entry.time}`,
    });
  }

  // 编辑按钮
  if (plugin.settings.showEditButton && entry.location) {
    const editBtn = li.createEl("a", {
      cls: "cashlog-edit-button",
      attr: { href: "#" },
    });
    editBtn.setText(" ✏️");
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditModal(plugin, entry);
    });
  }

  // 笔记链接
  if (plugin.settings.showNoteLink && entry.location) {
    const noteName = extractNoteName(entry.location.path);
    const linkEl = li.createEl("a", {
      cls: "cashlog-note-link",
      text: ` ${noteName}`,
    });
    linkEl.addEventListener("click", (ev: MouseEvent) => {
      void openFileAtLine(plugin, entry, ev);
    });
    linkEl.addEventListener("mousedown", (ev: MouseEvent) => {
      // 中键点击在新标签页打开（仿 tasks）
      if (ev.button === 1) {
        void openFileAtLine(plugin, entry, ev);
      }
    });
  }
}

// 打开编辑 Modal
function openEditModal(plugin: CashlogPlugin, entry: CashlogEntry): void {
  const settings = plugin.settings;
  const app = plugin.app;

  const writeToFile = (data: EditableEntryData) => {
    if (!entry.location) return;

    // 余额变更需要校验缓存是否就绪
    if (data.tagType === "balanceChange") {
      if (!plugin.cache) {
        new Notice(t("notice.accountBalanceUnavailable"));
        return;
      }
    }
    const newEntry = buildEntryFromModalData(data, plugin, {
      indentation: entry.indentation,
      listMarker: entry.listMarker,
      location: entry.location ?? null,
    });
    const newLine = newEntry.toFileLineString();

    const file = app.vault.getAbstractFileByPath(entry.location.path);
    if (file instanceof TFile) {
      app.vault.process(file, (content) => {
        const lines = content.split("\n");
        lines[entry.location.lineNumber] = newLine;
        return lines.join("\n");
      }).catch((e) => {
        new Notice(t("error.queryError") + ": " + (e as Error).message);
      });
    }
  };

  const modal = new CashlogModal(app, settings, entry, writeToFile, writeToFile, plugin);
  modal.open();
}

// 打开文件并定位到行（仿 tasks：重新读取文件精确定位行号）
async function openFileAtLine(
  plugin: CashlogPlugin,
  entry: CashlogEntry,
  ev: MouseEvent,
): Promise<void> {
  ev.preventDefault();
  ev.stopPropagation();

  if (!entry.location) return;

  const file = plugin.app.vault.getAbstractFileByPath(entry.location.path);
  if (!(file instanceof TFile)) return;

  // 重新读取文件内容，精确定位行号（仿 tasks getTaskLineAndFile）
  const content = await plugin.app.vault.read(file);
  const lines = content.split("\n");
  const storedLine = entry.location.lineNumber;
  const originalLine = entry.originalMarkdown;

  let resolvedLine = storedLine;

  // 策略1：存储的行号处内容是否仍匹配
  if (storedLine < lines.length && lines[storedLine] === originalLine) {
    resolvedLine = storedLine;
  } else {
    // 策略2：搜索文件中唯一匹配的行（仿 tasks tryFindingIdenticalUniqueMarkdownLineInFile）
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === originalLine) {
        matches.push(i);
      }
    }
    if (matches.length === 1) {
      resolvedLine = matches[0];
    }
    // 如果多处匹配或无匹配，回退到存储的行号
  }

  const leaf = plugin.app.workspace.getLeaf(Keymap.isModEvent(ev));
  await leaf.openFile(file, { eState: { line: resolvedLine } });
}

// 计算分组汇总
function calculateGroupSummary(entries: CashlogEntry[]): Summary {
  const totalIncome = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + e.amount, 0);
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome + totalExpense,
    count: entries.length,
  };
}

// 渲染分组汇总
function renderGroupSummary(containerEl: HTMLElement, summary: Summary): void {
  const div = containerEl.createEl("div", { cls: "cashlog-group-summary" });
  if (summary.totalExpense !== 0) {
    div.createEl("span", {
      cls: "cashlog-summary-expense",
      text: tp("renderer.groupExpense", { amount: summary.totalExpense }),
    });
  }
  if (summary.totalIncome !== 0) {
    div.createEl("span", {
      cls: "cashlog-summary-income",
      text: tp("renderer.groupIncome", { amount: summary.totalIncome }),
    });
  }
}

// 渲染总汇总
function renderSummary(containerEl: HTMLElement, summary: Summary, query: Query): void {
  const div = containerEl.createEl("div", { cls: "cashlog-summary" });

  if (query.shouldShowTotalExpense || query.shouldShowTotal) {
    div.createEl("div", {
      cls: "cashlog-summary-expense",
      text: tp("renderer.totalExpense", { amount: summary.totalExpense }),
    });
  }

  if (query.shouldShowTotalIncome || query.shouldShowTotal) {
    div.createEl("div", {
      cls: "cashlog-summary-income",
      text: tp("renderer.totalIncome", { amount: summary.totalIncome }),
    });
  }

  if (query.shouldShowBalance || query.shouldShowTotal) {
    div.createEl("div", {
      cls: "cashlog-summary-balance",
      text: tp("renderer.netBalance", { amount: summary.balance }),
    });
  }

  if (query.shouldShowCount || query.shouldShowTotal) {
    div.createEl("div", {
      cls: "cashlog-summary-count",
      text: tp("renderer.entryCount", { count: summary.count }),
    });
  }
}
