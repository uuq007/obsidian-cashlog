import { Menu, Notice, Setting, normalizePath } from "obsidian";
import { FolderSuggest } from "./FolderSuggest";
import type CashlogPlugin from "./main";
import { DEFAULT_SETTINGS } from "./Settings";
import type { BudgetConfig, GoalConfig } from "./Settings";
import { validateTagName, validateSubTagName, validateAccountName } from "./TagValidation";
import { t, tp } from "./i18n";
import {
  createModalOverlay,
  createModalCard,
  createModalTitle,
  createModalInput,
  createModalError,
  createModalButtonRow,
  createModalButton,
  finishModal,
  openTagEditModal,
} from "./ModalHelpers";

export function renderPanelSettings(container: HTMLElement, plugin: CashlogPlugin): void {
  // 保存滚动位置
  const scrollTop = container.scrollTop;

  // 确保 container 有 createEl 方法
  if (!(container as any).createEl) {
    (container as any).createEl = function(tag: string, opts?: any) {
      const el = document.createElement(tag);
      if (opts) {
        if (opts.cls) el.className = opts.cls;
        if (opts.text) el.textContent = opts.text;
        if (opts.html) el.innerHTML = opts.html;
        if (opts.attr) {
          for (const k in opts.attr) el.setAttribute(k, opts.attr[k]);
        }
      }
      return el;
    };
  }

  container.empty();
  const s = plugin.settings;

  // ========== 标签设置 ==========
  renderSection(container, "tags", "💰", t("panelSettings.sectionTags"), () => {
    renderTagButton(container, t("panelSettings.incomeTag"), s.incomeTag, plugin, async (newTag) => {
      const oldTag = s.incomeTag;
      s.incomeTag = newTag;
      await plugin.saveData(s);
      const count = await plugin.migrateTag(oldTag, newTag);
      if (count > 0) {
        new Notice(tp("notice.migrated", { count }));
      }
    });

    renderTagButton(container, t("panelSettings.expenseTag"), s.expenseTag, plugin, async (newTag) => {
      const oldTag = s.expenseTag;
      s.expenseTag = newTag;
      await plugin.saveData(s);
      const count = await plugin.migrateTag(oldTag, newTag);
      if (count > 0) {
        new Notice(tp("notice.migrated", { count }));
      }
    });

    // 开启账户功能后才显示转账和余额变更标签设置
    if (s.enableAccounts) {
      renderTagButton(container, t("panelSettings.transferTag"), s.transferTag, plugin, async (newTag) => {
        const oldTag = s.transferTag;
        s.transferTag = newTag;
        await plugin.saveData(s);
        const count = await plugin.migrateTag(oldTag, newTag);
        if (count > 0) {
          new Notice(tp("notice.migrated", { count }));
        }
      });

      renderTagButton(container, t("panelSettings.balanceChangeTag"), s.balanceChangeTag, plugin, async (newTag) => {
        const oldTag = s.balanceChangeTag;
        s.balanceChangeTag = newTag;
        await plugin.saveData(s);
        const count = await plugin.migrateTag(oldTag, newTag);
        if (count > 0) {
          new Notice(tp("notice.migrated", { count }));
        }
      });
    }

    renderSubTagList(container, t("panelSettings.incomeSubTags"), s.incomeSubTags, s.incomeTag, plugin);

    renderSubTagList(container, t("panelSettings.expenseSubTags"), s.expenseSubTags, s.expenseTag, plugin);
  });

  // ========== 账户设置 ==========
  renderSection(container, "accounts", "💳", t("panelSettings.sectionAccounts"), () => {
    renderToggleRow(container, t("panelSettings.enableAccounts"), s.enableAccounts, async (v) => {
      s.enableAccounts = v;
      await plugin.saveSettingsAndReindex();
      renderPanelSettings(container, plugin);
    });

    if (s.enableAccounts) {
      renderDivider(container);

      // 账户 chip 列表
      renderAccountList(container, plugin);

      renderDivider(container);

      // 账户初始余额标题
      const balanceTitle = document.createElement("div");
      balanceTitle.className = "cashlog-settings-label cashlog-balance-title";
      balanceTitle.textContent = t("panelSettings.accountInitialBalance");
      container.appendChild(balanceTitle);

      // 每个账户的余额按钮
      for (const acct of s.accounts) {
        renderBalanceButton(container, acct, plugin);
      }
    }
  });

  // ========== 附件设置 ==========
  renderSection(container, "attachments", "📎", t("panelSettings.sectionAttachments"), () => {
    renderToggleRow(container, t("panelSettings.enableAttachments"), s.enableAttachments, async (v) => {
      s.enableAttachments = v;
      await plugin.saveSettings();
      renderPanelSettings(container, plugin);
    });

    if (s.enableAttachments) {
      renderDivider(container);
      renderAttachmentFolderRow(container, plugin);
    }
  });

  // ========== 预算设置 ==========
  renderSection(container, "budget", "📊", t("panelSettings.sectionBudget"), () => {
    renderToggleRow(container, t("panelSettings.enableBudgets"), s.enableBudgets, async (v) => {
      s.enableBudgets = v;
      await plugin.saveSettings();
      renderPanelSettings(container, plugin);
    });

    if (s.enableBudgets) {
      renderDivider(container);

      // 已有预算列表
      if (s.budgets.length > 0) {
        for (let i = 0; i < s.budgets.length; i++) {
          const b = s.budgets[i];
          renderBudgetCard(container, b, async () => {
            s.budgets.splice(i, 1);
            await plugin.saveSettings();
            renderPanelSettings(container, plugin);
          });
        }
      } else {
        container.createEl("div", {
          cls: "cashlog-settings-empty",
          text: t("panelSettings.noBudget")
        });
      }

      // 新增预算表单
      renderAddBudgetForm(container, plugin);
    }
  });

  // ========== 目标设置 ==========
  renderSection(container, "budget", "🎯", t("panelSettings.sectionGoals"), () => {
    renderToggleRow(container, t("panelSettings.enableGoals"), s.enableGoals, async (v) => {
      s.enableGoals = v;
      await plugin.saveSettings();
      renderPanelSettings(container, plugin);
    });

    if (s.enableGoals) {
      renderDivider(container);

      // 已有目标列表
      if (s.goals.length > 0) {
        for (let i = 0; i < s.goals.length; i++) {
          const g = s.goals[i];
          renderGoalCard(container, g, async () => {
            s.goals.splice(i, 1);
            await plugin.saveSettings();
            renderPanelSettings(container, plugin);
          });
        }
      } else {
        container.createEl("div", {
          cls: "cashlog-settings-empty",
          text: t("panelSettings.noGoal")
        });
      }

      // 新增目标表单
      renderAddGoalForm(container, plugin);
    }
  });

  // ========== 统计设置 ==========
  renderSection(container, "stats", "📈", t("panelSettings.sectionStats"), () => {
    renderSelectRow(container, t("panelSettings.statsMode"), s.statsMode, [
      { value: "day", label: t("dashboard.period.day") },
      { value: "week", label: t("dashboard.period.week") },
      { value: "month", label: t("dashboard.period.month") },
      { value: "year", label: t("dashboard.period.year") },
      { value: "all", label: t("dashboard.period.all") }
    ], async (v) => {
      s.statsMode = v as "day" | "week" | "month" | "year" | "all";
      await plugin.saveSettings();
      renderPanelSettings(container, plugin);
    });

    if (s.statsMode === "month") {
      renderInputRow(container, t("panelSettings.monthStartDay"), String(s.statsMonthStartDay), async (v) => {
        const d = parseInt(v) || 1;
        s.statsMonthStartDay = Math.max(1, Math.min(28, d));
        await plugin.saveSettings();
      }, t("panelSettings.monthStartDayDesc"));
    }

    if (s.statsMode === "week") {
      const weekDays = [
        { value: "0", label: t("settings.weekStartDay.0") },
        { value: "1", label: t("settings.weekStartDay.1") },
        { value: "2", label: t("settings.weekStartDay.2") },
        { value: "3", label: t("settings.weekStartDay.3") },
        { value: "4", label: t("settings.weekStartDay.4") },
        { value: "5", label: t("settings.weekStartDay.5") },
        { value: "6", label: t("settings.weekStartDay.6") }
      ];
      renderSelectRow(container, t("panelSettings.weekStartDay"), String(s.statsWeekStartDay), weekDays, async (v) => {
        s.statsWeekStartDay = parseInt(v);
        await plugin.saveSettings();
      });
    }
  });

  // ========== 高级设置 ==========
  renderSection(container, "advanced", "⚙️", t("panelSettings.sectionAdvanced"), () => {
    renderToggleRow(container, t("panelSettings.showEditButton"), s.showEditButton, async (v) => {
      s.showEditButton = v;
      await plugin.saveSettings();
    });

    renderToggleRow(container, t("panelSettings.showNoteLink"), s.showNoteLink, async (v) => {
      s.showNoteLink = v;
      await plugin.saveSettings();
    });
  });

  // ========== 重置 ==========
  renderSection(container, "advanced", "🔄", t("panelSettings.sectionReset"), () => {
    const row = container.createEl("div", { cls: "cashlog-settings-row" });

    const label = row.createEl("div");
    label.createEl("div", { text: t("panelSettings.restoreDefaults"), cls: "cashlog-settings-label" });
    label.createEl("div", { text: t("panelSettings.restoreDefaultsDesc"), cls: "cashlog-settings-desc" });

    const btn = row.createEl("button", {
      text: t("modal.button.reset"),
      cls: "cashlog-settings-btn cashlog-settings-btn-danger"
    });
    btn.addEventListener("click", async () => {
      Object.assign(s, DEFAULT_SETTINGS);
      await plugin.saveSettings();
      renderPanelSettings(container, plugin);
    });
  });

  // 恢复滚动位置
  requestAnimationFrame(() => {
    container.scrollTop = scrollTop;
  });
}

// ========== 辅助函数 ==========

function renderSection(
  container: HTMLElement,
  type: string,
  icon: string,
  title: string,
  renderContent: () => void
): void {
  const gradientMap: Record<string, string> = {
    tags: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    accounts: "linear-gradient(135deg, #10b981, #059669)",
    attachments: "linear-gradient(135deg, #f59e0b, #d97706)",
    budget: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    stats: "linear-gradient(135deg, #06b6d4, #0891b2)",
    advanced: "linear-gradient(135deg, #6b7280, #4b5563)"
  };

  // 使用原生 DOM API 避免 Obsidian 包装问题
  const section = document.createElement("div");
  section.className = `cashlog-settings-section ${type}`;

  const header = document.createElement("div");
  header.className = "cashlog-settings-header";
  header.createSpan({ text: icon });
  header.append(` ${title}`);
  section.appendChild(header);

  const content = document.createElement("div");
  content.className = "cashlog-settings-content";
  section.appendChild(content);

  container.appendChild(section);

  renderContent.call(null, content);
}

function renderToggleRow(
  container: HTMLElement,
  label: string,
  value: boolean,
  onChange: (v: boolean) => Promise<void>
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  row.appendChild(labelSpan);

  const toggle = document.createElement("div");
  toggle.className = "cashlog-settings-toggle" + (value ? " active" : "");
  toggle.addEventListener("click", async () => {
    const newValue = !value;
    toggle.classList.toggle("active", newValue);
    await onChange(newValue);
  });
  row.appendChild(toggle);
}

function renderInputRow(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => Promise<void>,
  desc?: string
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelDiv = document.createElement("div");
  row.appendChild(labelDiv);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  labelDiv.appendChild(labelSpan);

  if (desc) {
    const descDiv = document.createElement("div");
    descDiv.className = "cashlog-settings-desc";
    descDiv.textContent = desc;
    labelDiv.appendChild(descDiv);
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cashlog-settings-input";
  input.value = value;
  input.addEventListener("change", async () => {
    await onChange(input.value);
  });
  row.appendChild(input);
}

// 附件存储目录输入行（带文件夹模糊匹配建议）
function renderAttachmentFolderRow(
  container: HTMLElement,
  plugin: CashlogPlugin
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelDiv = document.createElement("div");
  row.appendChild(labelDiv);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = t("panelSettings.attachmentFolder");
  labelDiv.appendChild(labelSpan);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cashlog-settings-input";
  input.value = plugin.settings.attachmentFolder;
  input.placeholder = t("panelSettings.attachmentFolderPlaceholder");
  row.appendChild(input);

  // 绑定文件夹建议
  new FolderSuggest(plugin.app, input, async (folderPath: string) => {
    plugin.settings.attachmentFolder = normalizePath(folderPath) || DEFAULT_SETTINGS.attachmentFolder;
    await plugin.saveSettings();
  });

  // 手动输入时也保存（失焦触发）
  input.addEventListener("change", async () => {
    plugin.settings.attachmentFolder = normalizePath(input.value) || DEFAULT_SETTINGS.attachmentFolder;
    await plugin.saveSettings();
  });
}

function renderTextareaRow(
  container: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => Promise<void>,
  desc?: string
): void {
  const row = document.createElement("div");
  row.className = "cashlog-textarea-row";
  container.appendChild(row);

  const labelDiv = document.createElement("div");
  labelDiv.className = "cashlog-textarea-label";
  row.appendChild(labelDiv);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  labelDiv.appendChild(labelSpan);

  if (desc) {
    const descDiv = document.createElement("div");
    descDiv.className = "cashlog-settings-desc";
    descDiv.textContent = desc;
    labelDiv.appendChild(descDiv);
  }

  const textarea = document.createElement("textarea");
  textarea.className = "cashlog-settings-textarea cashlog-settings-textarea-full";
  textarea.value = value;
  textarea.rows = 3;
  textarea.placeholder = t("panelSettings.placeholder.globalQuery");
  textarea.addEventListener("change", async () => {
    await onChange(textarea.value);
  });
  row.appendChild(textarea);
}

function renderSelectRow(
  container: HTMLElement,
  label: string,
  value: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => Promise<void>
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  row.appendChild(labelSpan);

  const select = document.createElement("select");
  select.className = "cashlog-settings-select";
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", async () => {
    await onChange(select.value);
  });
  row.appendChild(select);
}

function renderDivider(container: HTMLElement): void {
  const divider = document.createElement("div");
  divider.className = "cashlog-settings-divider";
  container.appendChild(divider);
}

// 标签编辑按钮：替换原来的文本框，点击弹出编辑弹窗
function renderTagButton(
  container: HTMLElement,
  label: string,
  tagValue: string,
  plugin: CashlogPlugin,
  onConfirm: (newTag: string) => Promise<void>
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  row.appendChild(labelSpan);

  const btn = document.createElement("button");
  btn.className = "cashlog-settings-btn cashlog-settings-btn-tag";
  // 显示不带 # 号的标签名
  btn.textContent = tagValue.startsWith("#") ? tagValue.substring(1) : tagValue;
  btn.addEventListener("click", () => {
    const panelContent = container.closest(".cashlog-panel-content");
    openTagEditModal(container, label, tagValue, async (newTag) => {
      await onConfirm(newTag);
      if (panelContent) {
        renderPanelSettings(panelContent as HTMLElement, plugin);
      }
    });
  });
  row.appendChild(btn);
}

// 从缓存中发现某个基础标签下的所有子标签
function discoverSubTagsFromCache(baseTag: string, plugin: CashlogPlugin): string[] {
  const entries = plugin.cache.getEntries();
  const found = new Set<string>();
  const baseLower = baseTag.toLowerCase();

  for (const entry of entries) {
    for (const tag of entry.tags) {
      const tagLower = tag.toLowerCase();
      if (tagLower.startsWith(baseLower + "/")) {
        const sub = tag.substring(baseTag.length + 1);
        // 只取第一级子标签
        const slashIdx = sub.indexOf("/");
        found.add(slashIdx === -1 ? sub : sub.substring(0, slashIdx));
      }
    }
  }

  return [...found];
}

// 子标签 chip 列表：合并 settings 子标签 + 缓存中发现的子标签
function renderSubTagList(
  container: HTMLElement,
  label: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin
): void {
  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = label;
  row.appendChild(labelSpan);

  const chipContainer = document.createElement("div");
  chipContainer.className = "cashlog-subtag-chips";
  row.appendChild(chipContainer);

  // 合并 settings 和缓存中发现的子标签（去重，保持顺序）
  const cacheSubTags = discoverSubTagsFromCache(baseTag, plugin);
  const allSubTags: string[] = [...settingsSubTags];
  for (const sub of cacheSubTags) {
    if (!allSubTags.includes(sub)) {
      allSubTags.push(sub);
    }
  }

  // 刷新回调：重新渲染面板
  const refreshPanel = () => {
    const panelContent = container.closest(".cashlog-panel-content");
    if (panelContent) {
      renderPanelSettings(panelContent as HTMLElement, plugin);
    }
  };

  // 渲染每个子标签 chip
  for (const subTag of allSubTags) {
    const isFromCache = !settingsSubTags.includes(subTag);

    const chip = document.createElement("span");
    chip.className = "cashlog-subtag-chip";
    if (isFromCache) {
      chip.classList.add("cashlog-subtag-chip-cache");
    }
    chip.textContent = subTag;

    // 右键菜单
    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle(t("panelSettings.modifySubTag"))
          .setIcon("pencil")
          .onClick(() => {
            openEditSubTagModal(container, subTag, settingsSubTags, baseTag, plugin, refreshPanel);
          });
      });
      menu.addItem((item) => {
        item
          .setTitle(t("panelSettings.deleteItem"))
          .setIcon("trash")
          .onClick(() => {
            openDeleteSubTagDialog(container, subTag, settingsSubTags, baseTag, plugin, refreshPanel);
          });
      });
      menu.showAtMouseEvent(e);
    });

    chipContainer.appendChild(chip);
  }

  // + 添加按钮
  const addChip = document.createElement("span");
  addChip.className = "cashlog-subtag-chip cashlog-subtag-add";
  addChip.textContent = "+";
  addChip.addEventListener("click", () => {
    openAddSubTagModal(container, settingsSubTags, plugin, refreshPanel);
  });
  chipContainer.appendChild(addChip);
}

// 新增子标签弹窗
function openAddSubTagModal(
  container: HTMLElement,
  subTags: string[],
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const overlay = createModalOverlay(container);

  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.newSubTag")));

  const input = createModalInput(modal, t("modal.placeholder.subTagName"));

  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const newName = input.value.trim();

    const validation = validateSubTagName(newName);
    if (!validation.valid) {
      errorEl.textContent = validation.message || t("validation.subTagName.invalid");
      errorEl.style.display = "block";
      return;
    }

    // 检查是否重复
    if (subTags.includes(newName)) {
      errorEl.textContent = t("validation.subTagName.exists");
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");

    try {
      subTags.push(newName);
      await plugin.saveSettings();
      overlay.remove();
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.addSubTagFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, input);
}

// 修改子标签弹窗
function openEditSubTagModal(
  container: HTMLElement,
  oldSubTag: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const overlay = createModalOverlay(container);

  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.editSubTag")));

  const input = createModalInput(modal, t("modal.placeholder.subTagName"), oldSubTag);

  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const newName = input.value.trim();

    // 未变化，直接关闭
    if (newName === oldSubTag) {
      overlay.remove();
      return;
    }

    // 空名称 → 合并到基础标签
    if (!newName) {
      overlay.remove();
      openMergeToBaseDialog(container, oldSubTag, settingsSubTags, baseTag, plugin, refreshPanel);
      return;
    }

    // 格式校验
    const validation = validateSubTagName(newName);
    if (!validation.valid) {
      errorEl.textContent = validation.message || t("validation.subTagName.invalid");
      errorEl.style.display = "block";
      return;
    }

    // 与其他子标签重复 → 合并确认
    const duplicate = settingsSubTags.find((t) => t !== oldSubTag && t === newName);
    if (duplicate) {
      overlay.remove();
      openMergeConfirmDialog(container, oldSubTag, duplicate, settingsSubTags, baseTag, plugin, refreshPanel);
      return;
    }

    // 直接改名 + 迁移
    await executeRenameSubTag(btn, overlay, oldSubTag, newName, settingsSubTags, baseTag, plugin, refreshPanel);
  }));

  finishModal(overlay, container, input);
}

// 执行子标签改名 + 迁移
async function executeRenameSubTag(
  btn: HTMLButtonElement,
  overlay: HTMLElement,
  oldSubTag: string,
  newSubTag: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): Promise<void> {
  btn.disabled = true;
  btn.textContent = t("modal.button.processing");

  try {
    // 更新子标签列表
    const idx = settingsSubTags.indexOf(oldSubTag);
    if (idx !== -1) {
      settingsSubTags[idx] = newSubTag;
    } else {
      // 缓存专属子标签改名后需要记录到 settings
      if (!settingsSubTags.includes(newSubTag)) {
        settingsSubTags.push(newSubTag);
      }
    }
    await plugin.saveData(plugin.settings);

    // 迁移标签
    const oldFullTag = baseTag + "/" + oldSubTag;
    const newFullTag = baseTag + "/" + newSubTag;
    const count = await plugin.migrateTag(oldFullTag, newFullTag);

    overlay.remove();
    if (count > 0) {
      new Notice(tp("notice.migrated", { count }));
    }
    refreshPanel();
  } catch (e) {
    new Notice(tp("notice.editSubTagFailed", { message: (e as Error).message }));
    btn.disabled = false;
    btn.textContent = t("modal.button.confirm");
  }
}

// 删除子标签确认弹窗（含记账条目删除）
function openDeleteSubTagDialog(
  container: HTMLElement,
  subTag: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const fullTag = baseTag + "/" + subTag;

  const overlay = createModalOverlay(container);

  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.deleteSubTag")));

  const desc = document.createElement("div");
  desc.className = "cashlog-tag-modal-desc";
  desc.textContent = t("panelSettings.deleteSubTagDesc");
  modal.appendChild(desc);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));

  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    btn.disabled = true;
    btn.textContent = t("modal.button.processing");

    try {
      // 删除该子标签下所有记账条目
      const deletedCount = await plugin.deleteEntriesByTag(fullTag);

      // 从 settings 子标签列表中移除
      const idx = settingsSubTags.indexOf(subTag);
      if (idx !== -1) settingsSubTags.splice(idx, 1);
      await plugin.saveSettings();

      overlay.remove();
      if (deletedCount > 0) {
        new Notice(tp("notice.deleted", { count: deletedCount }));
      }
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.deleteSubTagFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, null);
}

// 合并确认弹窗：修改子标签时目标名称已存在
function openMergeConfirmDialog(
  container: HTMLElement,
  oldSubTag: string,
  existingSubTag: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const overlay = createModalOverlay(container);

  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.mergeSubTag")));

  const desc = document.createElement("div");
  desc.className = "cashlog-tag-modal-desc";
  desc.textContent = tp("panelSettings.mergeSubTagDesc", { oldTag: oldSubTag, existingTag: existingSubTag });
  modal.appendChild(desc);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));

  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    btn.disabled = true;
    btn.textContent = t("modal.button.processing");

    try {
      // 迁移标签：旧子标签 → 已存在子标签
      const oldFullTag = baseTag + "/" + oldSubTag;
      const newFullTag = baseTag + "/" + existingSubTag;
      const count = await plugin.migrateTag(oldFullTag, newFullTag);

      // 从 settings 列表中移除旧子标签
      const idx = settingsSubTags.indexOf(oldSubTag);
      if (idx !== -1) settingsSubTags.splice(idx, 1);
      await plugin.saveSettings();

      overlay.remove();
      if (count > 0) {
        new Notice(tp("notice.migrated", { count }));
      }
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.mergeFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, null);
}

// 合并到基础标签确认弹窗：修改子标签时名称为空
function openMergeToBaseDialog(
  container: HTMLElement,
  oldSubTag: string,
  settingsSubTags: string[],
  baseTag: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const oldFullTag = baseTag + "/" + oldSubTag;

  const overlay = createModalOverlay(container);

  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.mergeToBase")));

  const desc = document.createElement("div");
  desc.className = "cashlog-tag-modal-desc";
  desc.textContent = tp("panelSettings.mergeToBaseDesc", { oldFullTag, baseTag });
  modal.appendChild(desc);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));

  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    btn.disabled = true;
    btn.textContent = t("modal.button.processing");

    try {
      // 迁移标签：旧子标签 → 基础标签
      const count = await plugin.migrateTag(oldFullTag, baseTag);

      // 从 settings 列表中移除旧子标签
      const idx = settingsSubTags.indexOf(oldSubTag);
      if (idx !== -1) settingsSubTags.splice(idx, 1);
      await plugin.saveSettings();

      overlay.remove();
      if (count > 0) {
        new Notice(tp("notice.migrated", { count }));
      }
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.mergeFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, null);
}

// 从缓存中发现所有账户名
function discoverAccountsFromCache(plugin: CashlogPlugin): string[] {
  const entries = plugin.cache.getEntries();
  const found = new Set<string>();
  for (const entry of entries) {
    for (const aa of entry.accountAmounts) {
      if (aa.account) found.add(aa.account);
    }
  }
  return [...found];
}

// 账户 chip 列表
function renderAccountList(container: HTMLElement, plugin: CashlogPlugin): void {
  const s = plugin.settings;

  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = t("panelSettings.accountList");
  row.appendChild(labelSpan);

  const chipContainer = document.createElement("div");
  chipContainer.className = "cashlog-subtag-chips";
  row.appendChild(chipContainer);

  const refreshPanel = () => {
    const panelContent = container.closest(".cashlog-panel-content");
    if (panelContent) {
      renderPanelSettings(panelContent as HTMLElement, plugin);
    }
  };

  // 合并 settings 和缓存中发现的账户
  const cacheAccounts = discoverAccountsFromCache(plugin);
  const allAccounts: string[] = [...s.accounts];
  for (const acct of cacheAccounts) {
    if (!allAccounts.includes(acct)) {
      allAccounts.push(acct);
    }
  }

  for (const acct of allAccounts) {
    const isFromCache = !s.accounts.includes(acct);

    const chip = document.createElement("span");
    chip.className = "cashlog-subtag-chip";
    if (isFromCache) {
      chip.classList.add("cashlog-subtag-chip-cache");
    }
    chip.textContent = acct;

    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle(t("panelSettings.modifyAccount"))
          .setIcon("pencil")
          .onClick(() => {
            openEditAccountModal(container, acct, plugin, refreshPanel);
          });
      });
      menu.addItem((item) => {
        item
          .setTitle(t("panelSettings.deleteItem"))
          .setIcon("trash")
          .onClick(() => {
            openDeleteAccountDialog(container, acct, plugin, refreshPanel);
          });
      });
      menu.showAtMouseEvent(e);
    });

    chipContainer.appendChild(chip);
  }

  // + 添加按钮
  const addChip = document.createElement("span");
  addChip.className = "cashlog-subtag-chip cashlog-subtag-add";
  addChip.textContent = "+";
  addChip.addEventListener("click", () => {
    openAddAccountModal(container, plugin, refreshPanel);
  });
  chipContainer.appendChild(addChip);
}

// 新增账户弹窗
function openAddAccountModal(
  container: HTMLElement,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const overlay = createModalOverlay(container);
  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.newAccount")));

  const input = createModalInput(modal, t("modal.placeholder.accountName"));
  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const name = input.value.trim();
    const validation = validateAccountName(name);
    if (!validation.valid) {
      errorEl.textContent = validation.message || t("validation.accountName.invalid");
      errorEl.style.display = "block";
      return;
    }
    if (plugin.settings.accounts.includes(name)) {
      errorEl.textContent = t("validation.accountName.exists");
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");
    try {
      plugin.settings.accounts.push(name);
      plugin.settings.accountBalances[name] = 0;
      await plugin.saveSettings();
      overlay.remove();
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.addAccountFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, input);
}

// 修改账户名弹窗
function openEditAccountModal(
  container: HTMLElement,
  oldName: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const overlay = createModalOverlay(container);
  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.editAccountName")));

  const input = createModalInput(modal, t("modal.placeholder.accountName"), oldName);
  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const newName = input.value.trim();
    if (newName === oldName) {
      overlay.remove();
      return;
    }
    const validation = validateAccountName(newName);
    if (!validation.valid) {
      errorEl.textContent = validation.message || t("validation.accountName.invalid");
      errorEl.style.display = "block";
      return;
    }
    if (plugin.settings.accounts.some((a) => a !== oldName && a === newName)) {
      errorEl.textContent = t("validation.accountName.exists");
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");
    try {
      // 更新账户列表
      const idx = plugin.settings.accounts.indexOf(oldName);
      if (idx !== -1) plugin.settings.accounts[idx] = newName;

      // 迁移余额
      plugin.settings.accountBalances[newName] =
        plugin.settings.accountBalances[oldName] || 0;
      delete plugin.settings.accountBalances[oldName];

      await plugin.saveData(plugin.settings);

      // 迁移所有记账条目中的账户名
      const count = await plugin.migrateAccount(oldName, newName);

      overlay.remove();
      if (count > 0) {
        new Notice(tp("notice.migrated", { count }));
      }
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.editAccountFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, input);
}

// 删除账户确认弹窗（含转移目标选择）
function openDeleteAccountDialog(
  container: HTMLElement,
  acct: string,
  plugin: CashlogPlugin,
  refreshPanel: () => void
): void {
  const s = plugin.settings;
  const targetAccounts = s.accounts.filter((a) => a !== acct);

  const overlay = createModalOverlay(container);
  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(t("panelSettings.deleteAccount")));

  const desc = document.createElement("div");
  desc.className = "cashlog-tag-modal-desc";
  desc.textContent = tp("panelSettings.deleteAccountDesc", { account: acct });
  modal.appendChild(desc);

  // 目标账户下拉菜单
  const select = document.createElement("select");
  select.className = "cashlog-settings-select cashlog-settings-select-full";
  if (targetAccounts.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("panelSettings.noAvailableAccount");
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
  } else {
    for (const tgt of targetAccounts) {
      const opt = document.createElement("option");
      opt.value = tgt;
      opt.textContent = tgt;
      select.appendChild(opt);
    }
  }
  modal.appendChild(select);

  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const target = select.value;
    if (!target) {
      errorEl.textContent = t("panelSettings.selectTargetAccount");
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");
    try {
      // 迁移记账条目到目标账户
      const count = await plugin.migrateAccount(acct, target);

      // 合并余额
      s.accountBalances[target] = (s.accountBalances[target] || 0) + (s.accountBalances[acct] || 0);
      delete s.accountBalances[acct];

      // 从账户列表中移除
      const idx = s.accounts.indexOf(acct);
      if (idx !== -1) s.accounts.splice(idx, 1);
      await plugin.saveSettings();

      overlay.remove();
      if (count > 0) {
        new Notice(tp("notice.transferred", { count, target }));
      }
      refreshPanel();
    } catch (e) {
      new Notice(tp("notice.deleteAccountFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, null);
}

// 账户初始余额按钮
function renderBalanceButton(
  container: HTMLElement,
  acct: string,
  plugin: CashlogPlugin
): void {
  const s = plugin.settings;
  const balance = s.accountBalances[acct] || 0;

  const row = document.createElement("div");
  row.className = "cashlog-settings-row";
  container.appendChild(row);

  const labelSpan = document.createElement("span");
  labelSpan.className = "cashlog-settings-label";
  labelSpan.textContent = acct;
  row.appendChild(labelSpan);

  const btn = document.createElement("button");
  btn.className = "cashlog-settings-btn cashlog-settings-btn-tag";
  btn.textContent = `💴 ${balance.toFixed(2)}`;
  btn.addEventListener("click", () => {
    openBalanceEditModal(container, acct, balance, plugin);
  });
  row.appendChild(btn);
}

// 账户初始余额编辑弹窗
function openBalanceEditModal(
  container: HTMLElement,
  acct: string,
  currentBalance: number,
  plugin: CashlogPlugin
): void {
  const overlay = createModalOverlay(container);
  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(tp("panelSettings.initialBalance", { account: acct })));

  // 警告提示
  const warning = document.createElement("div");
  warning.className = "cashlog-warning-box";
  warning.textContent = t("panelSettings.balanceWarning");
  modal.appendChild(warning);

  const input = document.createElement("input");
  input.type = "number";
  input.className = "cashlog-tag-modal-input";
  input.value = String(currentBalance);
  input.step = "0.01";
  modal.appendChild(input);

  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const value = parseFloat(input.value);
    if (isNaN(value)) {
      errorEl.textContent = t("validation.invalidAmount");
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");
    try {
      plugin.settings.accountBalances[acct] = value;
      await plugin.saveSettings();
      overlay.remove();
      // 刷新面板
      const panelContent = container.closest(".cashlog-panel-content");
      if (panelContent) {
        renderPanelSettings(panelContent as HTMLElement, plugin);
      }
    } catch (e) {
      new Notice(tp("notice.editBalanceFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, input);
}

function renderBudgetCard(
  container: HTMLElement,
  budget: BudgetConfig,
  onDelete: () => Promise<void>
): void {
  const periodLabels: Record<string, string> = {
    weekly: t("settings.period.weekly"), monthly: t("settings.period.monthly"), yearly: t("settings.period.yearly"), custom: t("settings.period.custom")
  };

  const card = document.createElement("div");
  card.className = "cashlog-budget-card";
  container.appendChild(card);

  const info = document.createElement("div");
  info.className = "cashlog-budget-info";
  card.appendChild(info);

  const nameDiv = document.createElement("div");
  nameDiv.className = "cashlog-budget-name";
  nameDiv.textContent = budget.name;
  info.appendChild(nameDiv);

  const metaDiv = document.createElement("div");
  metaDiv.className = "cashlog-budget-meta";
  metaDiv.textContent = `¥${budget.amount.toLocaleString()} / ${periodLabels[budget.period] || budget.period}`;
  info.appendChild(metaDiv);

  if (budget.tag) {
    const tagSpan = document.createElement("span");
    tagSpan.className = "cashlog-budget-tag";
    tagSpan.textContent = budget.tag;
    info.appendChild(tagSpan);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("modal.button.delete");
  deleteBtn.className = "cashlog-budget-delete";
  deleteBtn.addEventListener("click", async () => {
    await onDelete();
  });
  card.appendChild(deleteBtn);
}

function renderGoalCard(
  container: HTMLElement,
  goal: GoalConfig,
  onDelete: () => Promise<void>
): void {
  const periodLabels: Record<string, string> = {
    weekly: t("settings.period.weekly"), monthly: t("settings.period.monthly"), yearly: t("settings.period.yearly"), custom: t("settings.period.custom")
  };

  const card = document.createElement("div");
  card.className = "cashlog-goal-card";
  container.appendChild(card);

  const info = document.createElement("div");
  info.className = "cashlog-goal-info";
  card.appendChild(info);

  const nameDiv = document.createElement("div");
  nameDiv.className = "cashlog-goal-name";
  nameDiv.textContent = goal.name;
  info.appendChild(nameDiv);

  const metaDiv = document.createElement("div");
  metaDiv.className = "cashlog-goal-meta";
  metaDiv.textContent = `¥${goal.targetAmount.toLocaleString()} / ${periodLabels[goal.period] || goal.period}`;
  info.appendChild(metaDiv);

  if (goal.tag) {
    const tagSpan = document.createElement("span");
    tagSpan.className = "cashlog-goal-tag";
    tagSpan.textContent = goal.tag;
    info.appendChild(tagSpan);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = t("modal.button.delete");
  deleteBtn.className = "cashlog-goal-delete";
  deleteBtn.addEventListener("click", async () => {
    await onDelete();
  });
  card.appendChild(deleteBtn);
}

// 构建预算标签下拉选项：基础标签 + 所有子标签
function buildBudgetTagOptions(plugin: CashlogPlugin): string[] {
  const s = plugin.settings;
  const options: string[] = [s.expenseTag];
  const cacheSubTags = discoverSubTagsFromCache(s.expenseTag, plugin);
  const allSubTags = [...s.expenseSubTags];
  for (const sub of cacheSubTags) {
    if (!allSubTags.includes(sub)) allSubTags.push(sub);
  }
  for (const sub of allSubTags) {
    options.push(`${s.expenseTag}/${sub}`);
  }
  return options;
}

// 构建目标标签下拉选项：基础标签 + 所有子标签
function buildGoalTagOptions(plugin: CashlogPlugin): string[] {
  const s = plugin.settings;
  const options: string[] = [s.incomeTag];
  const cacheSubTags = discoverSubTagsFromCache(s.incomeTag, plugin);
  const allSubTags = [...s.incomeSubTags];
  for (const sub of cacheSubTags) {
    if (!allSubTags.includes(sub)) allSubTags.push(sub);
  }
  for (const sub of allSubTags) {
    options.push(`${s.incomeTag}/${sub}`);
  }
  return options;
}

function renderAddBudgetForm(container: HTMLElement, plugin: CashlogPlugin): void {
  const form = document.createElement("div");
  form.className = "cashlog-settings-add-form";
  container.appendChild(form);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "cashlog-settings-input";
  nameInput.placeholder = t("panelSettings.budgetName");
  form.appendChild(nameInput);

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.className = "cashlog-settings-input";
  amountInput.placeholder = t("settings.placeholder.amount");
  form.appendChild(amountInput);

  // 标签和周期放在同一行
  const selectRow = document.createElement("div");
  selectRow.className = "cashlog-settings-select-row";
  form.appendChild(selectRow);

  const tagSelect = document.createElement("select");
  tagSelect.className = "cashlog-settings-select cashlog-settings-select-flex";
  const budgetTagOptions = buildBudgetTagOptions(plugin);
  for (const opt of budgetTagOptions) {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    tagSelect.appendChild(option);
  }
  selectRow.appendChild(tagSelect);

  const select = document.createElement("select");
  select.className = "cashlog-settings-select cashlog-settings-select-flex";
  selectRow.appendChild(select);

  const opt1 = document.createElement("option");
  opt1.value = "weekly";
  opt1.textContent = t("settings.period.weeklyFull");
  select.appendChild(opt1);

  const opt2 = document.createElement("option");
  opt2.value = "monthly";
  opt2.textContent = t("settings.period.monthlyFull");
  opt2.selected = true;
  select.appendChild(opt2);

  const opt3 = document.createElement("option");
  opt3.value = "yearly";
  opt3.textContent = t("settings.period.yearlyFull");
  select.appendChild(opt3);

  const opt4 = document.createElement("option");
  opt4.value = "custom";
  opt4.textContent = t("settings.period.customFull");
  select.appendChild(opt4);

  // 自定义日期范围（初始隐藏）
  const dateRangeContainer = document.createElement("div");
  dateRangeContainer.className = "cashlog-settings-date-range cashlog-settings-date-range-hidden";
  form.appendChild(dateRangeContainer);

  const startDateInput = document.createElement("input");
  startDateInput.type = "date";
  startDateInput.className = "cashlog-settings-input cashlog-settings-date-input";
  dateRangeContainer.appendChild(startDateInput);

  const endDateInput = document.createElement("input");
  endDateInput.type = "date";
  endDateInput.className = "cashlog-settings-input cashlog-settings-date-input";
  dateRangeContainer.appendChild(endDateInput);

  select.addEventListener("change", () => {
    const isCustom = select.value === "custom";
    dateRangeContainer.style.display = isCustom ? "flex" : "none";
    if (!isCustom) {
      startDateInput.value = "";
      endDateInput.value = "";
    }
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = t("modal.button.add");
  addBtn.className = "cashlog-settings-btn cashlog-settings-btn-primary";
  form.appendChild(addBtn);

  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value) || 0;
    const tag = tagSelect.value;
    const period = select.value as BudgetConfig["period"];

    if (!name || !amount) {
      new Notice(t("notice.fillBudgetName"));
      return;
    }

    panelBudgetId++;
    const budget: BudgetConfig = {
      id: `b-${Date.now()}-${panelBudgetId}`,
      name,
      amount,
      period,
      tag,
      rollover: false
    };
    if (period === "custom") {
      if (startDateInput.value) budget.startDate = startDateInput.value;
      if (endDateInput.value) budget.endDate = endDateInput.value;
    }
    plugin.settings.budgets.push(budget);
    await plugin.saveSettings();

    // 重新渲染整个设置页面
    const panelContent = container.closest(".cashlog-panel-content");
    if (panelContent) {
      renderPanelSettings(panelContent as HTMLElement, plugin);
    }
  });
}

function renderAddGoalForm(container: HTMLElement, plugin: CashlogPlugin): void {
  const form = document.createElement("div");
  form.className = "cashlog-settings-add-form";
  container.appendChild(form);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "cashlog-settings-input";
  nameInput.placeholder = t("panelSettings.goalName");
  form.appendChild(nameInput);

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.className = "cashlog-settings-input";
  amountInput.placeholder = t("settings.placeholder.targetAmount");
  form.appendChild(amountInput);

  // 标签和周期放在同一行
  const selectRow = document.createElement("div");
  selectRow.className = "cashlog-settings-select-row";
  form.appendChild(selectRow);

  const tagSelect = document.createElement("select");
  tagSelect.className = "cashlog-settings-select cashlog-settings-select-flex";
  const goalTagOptions = buildGoalTagOptions(plugin);
  for (const opt of goalTagOptions) {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    tagSelect.appendChild(option);
  }
  selectRow.appendChild(tagSelect);

  const select = document.createElement("select");
  select.className = "cashlog-settings-select cashlog-settings-select-flex";
  selectRow.appendChild(select);

  const opt1 = document.createElement("option");
  opt1.value = "weekly";
  opt1.textContent = t("settings.period.weeklyFull");
  select.appendChild(opt1);

  const opt2 = document.createElement("option");
  opt2.value = "monthly";
  opt2.textContent = t("settings.period.monthlyFull");
  opt2.selected = true;
  select.appendChild(opt2);

  const opt3 = document.createElement("option");
  opt3.value = "yearly";
  opt3.textContent = t("settings.period.yearlyFull");
  select.appendChild(opt3);

  const opt4 = document.createElement("option");
  opt4.value = "custom";
  opt4.textContent = t("settings.period.customFull");
  select.appendChild(opt4);

  // 自定义日期范围（初始隐藏）
  const dateRangeContainer = document.createElement("div");
  dateRangeContainer.className = "cashlog-settings-date-range cashlog-settings-date-range-hidden";
  form.appendChild(dateRangeContainer);

  const startDateInput = document.createElement("input");
  startDateInput.type = "date";
  startDateInput.className = "cashlog-settings-input cashlog-settings-date-input";
  dateRangeContainer.appendChild(startDateInput);

  const endDateInput = document.createElement("input");
  endDateInput.type = "date";
  endDateInput.className = "cashlog-settings-input cashlog-settings-date-input";
  dateRangeContainer.appendChild(endDateInput);

  select.addEventListener("change", () => {
    const isCustom = select.value === "custom";
    dateRangeContainer.style.display = isCustom ? "flex" : "none";
    if (!isCustom) {
      startDateInput.value = "";
      endDateInput.value = "";
    }
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = t("modal.button.add");
  addBtn.className = "cashlog-settings-btn cashlog-settings-btn-primary";
  form.appendChild(addBtn);

  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const targetAmount = parseFloat(amountInput.value) || 0;
    const tag = tagSelect.value;
    const period = select.value as GoalConfig["period"];

    if (!name || !targetAmount) {
      new Notice(t("notice.fillGoalName"));
      return;
    }

    panelGoalId++;
    const goal: GoalConfig = {
      id: `g-${Date.now()}-${panelGoalId}`,
      name,
      targetAmount,
      period,
      tag
    };
    if (period === "custom") {
      if (startDateInput.value) goal.startDate = startDateInput.value;
      if (endDateInput.value) goal.endDate = endDateInput.value;
    }
    plugin.settings.goals.push(goal);
    await plugin.saveSettings();

    // 重新渲染整个设置页面
    const panelContent = container.closest(".cashlog-panel-content");
    if (panelContent) {
      renderPanelSettings(panelContent as HTMLElement, plugin);
    }
  });
}
