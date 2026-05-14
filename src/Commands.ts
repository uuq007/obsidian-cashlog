/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { Editor, MarkdownView, Notice } from "obsidian";
import type CashlogPlugin from "./main";
import { CashlogEntry } from "./CashlogEntry";
import { parseCashlogLineLenient } from "./CashlogSerializer";
import { CashlogModal, EditableEntryData } from "./CashlogModal";
import { ChartModal } from "./ChartModal";
import { nonCashlogRegex } from "./CashlogRegex";
import { buildEntryFromModalData } from "./EntryEditor";
import { t } from "./i18n";
import { moment } from "./types";

// 注册所有命令
export function addCommands(plugin: CashlogPlugin): void {
  plugin.addCommand({
    id: "create-or-edit",
    name: "Create or edit",
    icon: "yen-sign",
    editorCheckCallback: (checking, editor, view) => {
      return createOrEdit(checking, editor, view, plugin);
    },
  });

  plugin.addCommand({
    id: "insert-chart",
    name: t("commands.insertChart"),
    icon: "table",
    editorCheckCallback: (checking, editor, _view) => {
      if (checking) return true;
      const modal = new ChartModal(plugin.app, plugin, editor);
      modal.open();
      return true;
    },
  });

  plugin.addCommand({
    id: "open-panel",
    name: t("commands.openPanel"),
    icon: "yen-sign",
    callback: () => {
      void plugin.activateCashlogPanel();
    },
  });
}

// 从任意行提取缩进和列表标记
function extractLineContext(line: string): { indentation: string; listMarker: string } {
  const match = line.match(nonCashlogRegex);
  if (match === null) {
    return { indentation: "", listMarker: "-" };
  }
  return {
    indentation: match[1],
    listMarker: match[2] ?? "-",
  };
}

// 创建或编辑记账条目
function createOrEdit(
  checking: boolean,
  editor: Editor,
  _view: MarkdownView,
  plugin: CashlogPlugin,
): boolean {
  if (checking) {
    return true;
  }

  const cursor = editor.getCursor();
  const lineNumber = cursor.line;
  const line = editor.getLine(lineNumber);

  const context = extractLineContext(line);

  let entry = parseCashlogLineLenient(line, null, plugin.settings);

  if (entry === null) {
    const nonMatch = line.match(nonCashlogRegex);
    const description = nonMatch ? (nonMatch[3] || "").trim() : line.trim();
    entry = new CashlogEntry(
      description,
      0,
      moment(),
      null,
      [],
      context.indentation,
      context.listMarker,
      null,
      "",
    );
  }

  const writeToEditor = (data: EditableEntryData) => {
    if (data.tagType === "balanceChange") {
      if (!plugin.cache) {
        new Notice(t("notice.accountBalanceUnavailable"));
        return;
      }
    }
    const newEntry = buildEntryFromModalData(data, plugin, {
      indentation: context.indentation,
      listMarker: context.listMarker,
      location: entry?.location ?? null,
    });
    const newLine = newEntry.toFileLineString();

    if (line.trim() === "") {
      editor.replaceRange(newLine + "\n", cursor);
    } else {
      editor.setLine(lineNumber, newLine);
    }
  };

  const modal = new CashlogModal(
    plugin.app, plugin.settings, entry, writeToEditor, writeToEditor, plugin,
  );
  modal.open();

  return true;
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
