import { App, Modal, Notice, Setting } from "obsidian";
import { CashlogEntry } from "./CashlogEntry";
import type { CashlogSettings } from "./Settings";
import type CashlogPlugin from "./main";
import { AttachmentManager } from "./AttachmentManager";
import { AccountManager } from "./AccountManager";
import { t, tp } from "./i18n";
import { moment } from "./types";

// 账户行数据（UI 用）
export interface AccountAmountItem {
  account: string; // "" = 无账户
  amount: string;  // 正数字符串，符号由 tagType 决定
}

// Modal 中可编辑的条目数据
export interface EditableEntryData {
  tagType: "income" | "expense" | "transfer" | "balanceChange";
  subTag: string;
  description: string;
  date: string;
  time: string;
  // 收入/支出的账户行（含无账户行）
  accounts: AccountAmountItem[];
  // 转账的转出/转入账户
  fromAccounts: AccountAmountItem[];
  toAccounts: AccountAmountItem[];
  // 余额变更的账户行（存储目标余额）
  balanceChangeAccounts: AccountAmountItem[];
  attachments: string[];
}

// 从 CashlogEntry 创建默认 EditableEntryData
function createDefaultData(settings: CashlogSettings, entry: CashlogEntry | null): EditableEntryData {
  const base = {
    description: entry?.description || "",
    date: entry?.date ? entry.date.format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"),
    time: entry?.time || "",
    accounts: [] as AccountAmountItem[],
    fromAccounts: [] as AccountAmountItem[],
    toAccounts: [] as AccountAmountItem[],
    balanceChangeAccounts: [] as AccountAmountItem[],
    attachments: entry?.attachments ? [...entry.attachments] : [],
  };

  if (!entry || entry.tags.length === 0) {
    return {
      ...base,
      tagType: "expense",
      subTag: "",
      accounts: [{ account: "", amount: "" }],
    };
  }

  if (entry.isBalanceChange) {
    return {
      ...base,
      tagType: "balanceChange",
      subTag: "",
      balanceChangeAccounts: entry.accountAmounts.length > 0
        ? entry.accountAmounts.map((aa) => ({ account: aa.account, amount: "" }))
        : [{ account: settings.accounts[0] || "", amount: "" }],
    };
  }

  if (entry.isTransfer) {
    const fromAccs = entry.accountAmounts.filter((aa) => aa.amount < 0);
    const toAccs = entry.accountAmounts.filter((aa) => aa.amount > 0);
    return {
      ...base,
      tagType: "transfer",
      subTag: "",
      accounts: [],
      fromAccounts: fromAccs.length > 0
        ? fromAccs.map((aa) => ({ account: aa.account, amount: Math.abs(aa.amount).toString() }))
        : [{ account: settings.accounts[0] || "", amount: "" }],
      toAccounts: toAccs.length > 0
        ? toAccs.map((aa) => ({ account: aa.account, amount: aa.amount.toString() }))
        : [{ account: settings.accounts[1] || settings.accounts[0] || "", amount: "" }],
    };
  }

  const primaryTag = entry.tags[0];
  const incomeBase = settings.incomeTag;
  const expenseBase = settings.expenseTag;

  let tagType: "income" | "expense" = "expense";
  let subTag = "";

  if (primaryTag.toLowerCase().startsWith(incomeBase.toLowerCase())) {
    tagType = "income";
    subTag = primaryTag.length > incomeBase.length ? primaryTag.substring(incomeBase.length + 1) : "";
  } else if (primaryTag.toLowerCase().startsWith(expenseBase.toLowerCase())) {
    tagType = "expense";
    subTag = primaryTag.length > expenseBase.length ? primaryTag.substring(expenseBase.length + 1) : "";
  }

  // 构建账户行列表
  const accounts: AccountAmountItem[] = [];
  const noAccountAmt = entry.noAccountAmount;
  if (noAccountAmt !== 0) {
    accounts.push({ account: "", amount: Math.abs(noAccountAmt).toString() });
  }
  for (const aa of entry.accountAmounts) {
    accounts.push({ account: aa.account, amount: Math.abs(aa.amount).toString() });
  }
  if (accounts.length === 0) {
    accounts.push({ account: "", amount: Math.abs(entry.amount).toString() || "" });
  }

  return { ...base, tagType, subTag, accounts };
}

export class CashlogModal extends Modal {
  private entry: CashlogEntry | null;
  private onSubmit: (data: EditableEntryData) => void;
  private onChange: ((data: EditableEntryData) => void) | null;
  private settings: CashlogSettings;
  private data: EditableEntryData;
  private fileInputEl: HTMLInputElement | null = null;
  private plugin: CashlogPlugin | null;
  private pendingUploads: { file: File; tempId: string }[] = [];
  private pendingDeletions: string[] = [];
  private pendingIdCounter = 0;

  constructor(
    app: App,
    settings: CashlogSettings,
    entry: CashlogEntry | null,
    onSubmit: (data: EditableEntryData) => void,
    onChange?: (data: EditableEntryData) => void,
    plugin?: CashlogPlugin,
  ) {
    super(app);
    this.settings = settings;
    this.entry = entry;
    this.onSubmit = onSubmit;
    this.onChange = onChange || null;
    this.plugin = plugin || null;
    this.data = createDefaultData(settings, entry);
  }

  onOpen() {
    this.titleEl.setText(t("cashlogModal.title"));
    this.buildForm();
  }

  onClose() {
    this.contentEl.empty();
  }

  // 保存描述字段引用（用于增量更新时恢复）
  private descInputEl: HTMLInputElement | null = null;

  // 构建表单（优化版：类型变化时只重建条件字段区域，保留已填写内容）
  private buildForm(): void {
    const { contentEl } = this;
    contentEl.addClass("cashlog-modal");

    // 保存当前用户输入内容（用于重建后恢复）
    const savedDescription = this.data.description;
    const savedTime = this.data.time;
    const savedDate = this.data.date;
    const savedSubTag = this.data.subTag;
    const savedAccounts = [...this.data.accounts];
    const savedFromAccounts = [...this.data.fromAccounts];
    const savedToAccounts = [...this.data.toAccounts];
    const savedBalanceChangeAccounts = [...this.data.balanceChangeAccounts];
    const savedAttachments = [...this.data.attachments];

    // 检查是否需要完全重建（首次渲染）
    const needsFullRebuild = !contentEl.querySelector(".cashlog-modal-form");

    if (needsFullRebuild) {
      contentEl.empty();
      // 渲染类型选择器（稳定字段，永不重建）
      this.renderTypeFieldStable(contentEl);
    }

    // 获取或创建条件字段区域容器
    let conditionalArea = contentEl.querySelector(".cashlog-conditional-area") as HTMLElement;
    if (!conditionalArea) {
      conditionalArea = contentEl.createEl("div", { cls: "cashlog-conditional-area" });
    }
    conditionalArea.empty();

    // 根据当前类型渲染条件字段
    if (this.data.tagType === "transfer") {
      this.renderConditionalDescription(conditionalArea);
      if (this.settings.enableAccounts) {
        this.renderTransferFields(conditionalArea);
      }
    } else if (this.data.tagType === "balanceChange") {
      this.renderConditionalDescription(conditionalArea);
      if (this.settings.enableAccounts) {
        this.renderBalanceChangeFields(conditionalArea);
      }
    } else {
      this.renderSubTagField(conditionalArea);
      this.renderConditionalDescription(conditionalArea);
      if (this.settings.enableAccounts) {
        this.renderAccountRows(conditionalArea);
      } else {
        this.renderAmountField(conditionalArea);
      }
    }

    // 渲染附件、日期时间、按钮（仅首次渲染）
    if (needsFullRebuild) {
      if (this.settings.enableAttachments) {
        this.renderAttachmentSection(contentEl);
      }
      this.renderDateField(contentEl);
      this.renderTimeField(contentEl);
      this.renderButtons(contentEl);
    }

    // 恢复保存的内容到 data 和 UI
    this.data.description = savedDescription;
    this.data.time = savedTime;
    this.data.date = savedDate;
    this.data.subTag = savedSubTag;
    this.data.accounts = savedAccounts;
    this.data.fromAccounts = savedFromAccounts;
    this.data.toAccounts = savedToAccounts;
    this.data.balanceChangeAccounts = savedBalanceChangeAccounts;
    this.data.attachments = savedAttachments;

    // 恢复描述输入框的值
    if (this.descInputEl) {
      this.descInputEl.value = savedDescription;
    }

    // 自动聚焦描述字段（仅首次渲染）
    if (needsFullRebuild) {
      setTimeout(() => {
        const descInput = contentEl.querySelector(".cashlog-desc-input") as HTMLElement;
        if (descInput) descInput.focus();
      }, 10);
    }
  }

  // 渲染类型选择器（稳定字段）
  private renderTypeFieldStable(container: HTMLElement): void {
    const wrapper = container.createEl("div", { cls: "cashlog-modal-form" });
    wrapper.addClass("cashlog-type-stable");

    const setting = new Setting(wrapper).setName(t("cashlogModal.type"));
    setting.addDropdown((dropdown) => {
      dropdown.addOption("expense", t("cashlogModal.type.expense"));
      dropdown.addOption("income", t("cashlogModal.type.income"));
      if (this.settings.enableAccounts) {
        dropdown.addOption("transfer", t("cashlogModal.type.transfer"));
        dropdown.addOption("balanceChange", t("cashlogModal.type.balanceChange"));
      }
      dropdown.setValue(this.data.tagType);
      dropdown.onChange((value: "income" | "expense" | "transfer" | "balanceChange") => {
        this.data.tagType = value;
        if (value === "transfer") {
          this.data.subTag = "";
          if (this.data.fromAccounts.length === 0) {
            this.data.fromAccounts.push({ account: this.settings.accounts[0] || "", amount: "" });
          }
          if (this.data.toAccounts.length === 0) {
            this.data.toAccounts.push({ account: this.settings.accounts[1] || this.settings.accounts[0] || "", amount: "" });
          }
        }
        if (value === "balanceChange") {
          this.data.subTag = "";
          if (this.data.balanceChangeAccounts.length === 0) {
            this.data.balanceChangeAccounts.push({ account: this.settings.accounts[0] || "", amount: "" });
          }
        }
        // 增量更新：只重建条件区域
        this.buildForm();
      });
    });
  }

  // 渲染子标签
  private renderSubTagField(container: HTMLElement): void {
    new Setting(container)
      .setName(t("cashlogModal.category"))
      .addDropdown((dropdown) => {
        this.populateSubTags(dropdown);
        dropdown.onChange((value) => {
          this.data.subTag = value;
        });
      });
  }

  // 渲染描述（条件字段）
  private renderConditionalDescription(container: HTMLElement): void {
    const setting = new Setting(container).setName(t("cashlogModal.description"));
    setting.controlEl.empty();
    setting.descEl.remove();

    this.descInputEl = setting.controlEl.createEl("input", {
      cls: "cashlog-desc-input",
      attr: {
        type: "text",
        placeholder: this.data.tagType === "transfer" ? t("cashlogModal.placeholder.transferDesc") : t("cashlogModal.placeholder.expenseDesc"),
        value: this.data.description,
      },
    });

    this.descInputEl.addEventListener("input", () => {
      if (this.descInputEl) this.data.description = this.descInputEl.value;
    });

    this.descInputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        this.close();
        this.onSubmit(this.data);
      }
    });
  }

  // 渲染金额字段
  private renderAmountField(container: HTMLElement): void {
    const amt = this.data.accounts[0]?.amount || "";
    const setting = new Setting(container)
      .setName(t("cashlogModal.amount"))
      .setDesc(t("cashlogModal.amountDesc"));

    setting.controlEl.empty();
    const wrapper = setting.controlEl.createEl("div", { cls: "cashlog-field-row" });
    wrapper.createEl("span", { cls: "cashlog-amount-icon", text: "💴" });

    const input = wrapper.createEl("input", {
      cls: "cashlog-field-input",
      attr: {
        type: "number",
        placeholder: "100",
        step: "0.01",
        min: "0",
        value: amt,
      },
    });
    input.addEventListener("input", () => {
      if (this.data.accounts.length === 0) {
        this.data.accounts.push({ account: "", amount: "" });
      }
      this.data.accounts[0].amount = input.value;
    });
  }

  // 收入/支出的账户行
  private renderAccountRows(container: HTMLElement): void {
    const section = container.createEl("div", { cls: "cashlog-account-section" });
    new Setting(section).setName(t("cashlogModal.account")).setDesc(t("cashlogModal.accountDesc"));

    const listEl = section.createEl("div", { cls: "cashlog-account-list" });

    // 渲染所有账户行
    for (let i = 0; i < this.data.accounts.length; i++) {
      this.renderAccountRow(listEl, i);
    }

    // + 添加账户按钮
    const addBtn = section.createEl("button", {
      cls: "cashlog-account-add-btn",
      text: t("cashlogModal.addAccount"),
    });
    addBtn.addEventListener("click", () => {
      // 默认选第一个可用账户
      const usedAccounts = new Set(this.data.accounts.map((a) => a.account));
      const available = this.settings.accounts.find((a) => !usedAccounts.has(a));
      this.data.accounts.push({ account: available || "", amount: "" });
      this.buildForm();
    });
  }

  // 渲染单个账户行
  private renderAccountRow(listEl: HTMLElement, index: number): void {
    const row = listEl.createEl("div", { cls: "cashlog-account-row" });
    const item = this.data.accounts[index];

    // 账户下拉
    const select = row.createEl("select", { cls: "cashlog-account-select" });
    const noAcctOpt = select.createEl("option", { text: t("cashlogModal.noAccount"), value: "" });
    for (const acct of this.settings.accounts) {
      const opt = select.createEl("option", { text: acct, value: acct });
      if (item.account === acct) opt.selected = true;
    }
    if (item.account === "") noAcctOpt.selected = true;

    select.addEventListener("change", () => {
      this.data.accounts[index].account = select.value;
    });

    // 金额输入
    const amountInput = row.createEl("input", {
      cls: "cashlog-account-amount",
      attr: {
        type: "number",
        placeholder: t("cashlogModal.amount"),
        step: "0.01",
        min: "0",
        value: item.amount,
      },
    });
    amountInput.addEventListener("input", () => {
      this.data.accounts[index].amount = amountInput.value;
    });

    // - 删除按钮（多于一行时显示）
    if (this.data.accounts.length > 1) {
      const removeBtn = row.createEl("button", {
        cls: "cashlog-account-remove-btn",
        text: t("cashlogModal.remove"),
      });
      removeBtn.addEventListener("click", () => {
        this.data.accounts.splice(index, 1);
        this.buildForm();
      });
    }
  }

  // 转账字段
  private renderTransferFields(container: HTMLElement): void {
    // 转出账户
    const fromSection = container.createEl("div", { cls: "cashlog-account-section" });
    new Setting(fromSection).setName(t("cashlogModal.fromAccount"));

    const fromList = fromSection.createEl("div", { cls: "cashlog-account-list" });
    for (let i = 0; i < this.data.fromAccounts.length; i++) {
      this.renderTransferRow(fromList, "from", i);
    }

    const addFromBtn = fromSection.createEl("button", {
      cls: "cashlog-account-add-btn",
      text: t("cashlogModal.addFromAccount"),
    });
    addFromBtn.addEventListener("click", () => {
      this.data.fromAccounts.push({ account: this.settings.accounts[0] || "", amount: "" });
      this.buildForm();
    });

    // 转入账户
    const toSection = container.createEl("div", { cls: "cashlog-account-section" });
    new Setting(toSection).setName(t("cashlogModal.toAccount"));

    const toList = toSection.createEl("div", { cls: "cashlog-account-list cashlog-transfer-to" });
    for (let i = 0; i < this.data.toAccounts.length; i++) {
      this.renderTransferRow(toList, "to", i);
    }

    const addToBtn = toSection.createEl("button", {
      cls: "cashlog-account-add-btn",
      text: t("cashlogModal.addToAccount"),
    });
    addToBtn.addEventListener("click", () => {
      this.data.toAccounts.push({ account: this.settings.accounts[0] || "", amount: "" });
      this.buildForm();
    });
  }

  // 渲染转账账户行
  private renderTransferRow(listEl: HTMLElement, direction: "from" | "to", index: number): void {
    const row = listEl.createEl("div", { cls: "cashlog-account-row" });
    const items = direction === "from" ? this.data.fromAccounts : this.data.toAccounts;
    const item = items[index];

    // 账户下拉
    const select = row.createEl("select", { cls: "cashlog-account-select" });
    for (const acct of this.settings.accounts) {
      const opt = select.createEl("option", { text: acct, value: acct });
      if (item.account === acct) opt.selected = true;
    }

    select.addEventListener("change", () => {
      item.account = select.value;
    });

    // 金额输入
    const amountInput = row.createEl("input", {
      cls: "cashlog-account-amount",
      attr: {
        type: "number",
        placeholder: t("cashlogModal.amount"),
        step: "0.01",
        min: "0",
        value: item.amount,
      },
    });
    amountInput.addEventListener("input", () => {
      item.amount = amountInput.value;
    });
    // 失焦时同步转出总额到转入账户（仅一个转入账户时）
    if (direction === "from") {
      amountInput.addEventListener("blur", () => {
        if (this.data.toAccounts.length === 1) {
          const sum = this.data.fromAccounts.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
          const syncValue = sum.toString() || "";
          this.data.toAccounts[0].amount = syncValue;
          // 直接更新转入金额输入框的 DOM
          const toInputs = listEl.closest(".cashlog-modal")?.querySelectorAll(".cashlog-transfer-to .cashlog-account-amount") as NodeListOf<HTMLInputElement>;
          if (toInputs && toInputs.length > 0) {
            toInputs[0].value = syncValue;
          }
        }
      });
    }

    // - 删除按钮
    const list = direction === "from" ? this.data.fromAccounts : this.data.toAccounts;
    if (list.length > 1) {
      const removeBtn = row.createEl("button", {
        cls: "cashlog-account-remove-btn",
        text: t("cashlogModal.remove"),
      });
      removeBtn.addEventListener("click", () => {
        list.splice(index, 1);
        this.buildForm();
      });
    }
  }

  // 余额变更字段
  private renderBalanceChangeFields(container: HTMLElement): void {
    const section = container.createEl("div", { cls: "cashlog-account-section" });
    new Setting(section).setName(t("cashlogModal.balanceChange")).setDesc(t("cashlogModal.balanceChangeDesc"));

    const listEl = section.createEl("div", { cls: "cashlog-account-list" });

    // 提前计算一次余额，避免每行重复遍历全部条目
    let balances: Record<string, number> = {};
    if (this.plugin?.cache) {
      balances = AccountManager.recomputeBalances(
        this.plugin.cache.getEntries(),
        this.settings.accountBalances,
        this.settings.accounts,
      );
    }

    for (let i = 0; i < this.data.balanceChangeAccounts.length; i++) {
      this.renderBalanceChangeRow(listEl, i, balances);
    }

    const addBtn = section.createEl("button", {
      cls: "cashlog-account-add-btn",
      text: t("cashlogModal.addAccount"),
    });
    addBtn.addEventListener("click", () => {
      const usedAccounts = new Set(this.data.balanceChangeAccounts.map((a) => a.account));
      const available = this.settings.accounts.find((a) => !usedAccounts.has(a));
      this.data.balanceChangeAccounts.push({ account: available || "", amount: "" });
      this.buildForm();
    });
  }

  // 渲染余额变更单行（balances 由父方法预计算传入）
  private renderBalanceChangeRow(listEl: HTMLElement, index: number, balances: Record<string, number>): void {
    const row = listEl.createEl("div", { cls: "cashlog-account-row" });
    const item = this.data.balanceChangeAccounts[index];

    // 账户下拉
    const select = row.createEl("select", { cls: "cashlog-account-select" });
    for (const acct of this.settings.accounts) {
      const opt = select.createEl("option", { text: acct, value: acct });
      if (item.account === acct) opt.selected = true;
    }

    select.addEventListener("change", () => {
      this.data.balanceChangeAccounts[index].account = select.value;
    });

    // 当前余额提示（使用预计算的余额）
    const currentBalance = balances[item.account] || 0;
    row.createEl("span", {
      cls: "cashlog-balance-hint",
      text: tp("cashlogModal.currentBalance", { amount: currentBalance.toFixed(2) }),
    });

    // 目标余额输入
    const amountInput = row.createEl("input", {
      cls: "cashlog-account-amount",
      attr: {
        type: "number",
        placeholder: t("cashlogModal.adjustedBalance"),
        step: "0.01",
        value: item.amount,
      },
    });
    amountInput.addEventListener("input", () => {
      this.data.balanceChangeAccounts[index].amount = amountInput.value;
    });

    // 删除按钮（多于一行时显示）
    if (this.data.balanceChangeAccounts.length > 1) {
      const removeBtn = row.createEl("button", {
        cls: "cashlog-account-remove-btn",
        text: t("cashlogModal.remove"),
      });
      removeBtn.addEventListener("click", () => {
        this.data.balanceChangeAccounts.splice(index, 1);
        this.buildForm();
      });
    }
  }

  // 附件区域
  private renderAttachmentSection(container: HTMLElement): void {
    const setting = new Setting(container)
      .setName(t("cashlogModal.attachment"))
      .setDesc(t("cashlogModal.attachmentDesc"));

    setting.controlEl.empty();
    const attContainer = setting.controlEl.createEl("div", { cls: "cashlog-attachment-area" });

    const listEl = attContainer.createEl("div", { cls: "cashlog-attachment-list" });
    this.renderAttachmentList(listEl);

    const btnRow = attContainer.createEl("div", { cls: "cashlog-attachment-btns" });

    const fileInput = attContainer.createEl("input", {
      cls: "cashlog-file-input",
      attr: { type: "file", accept: "image/*", multiple: "multiple" },
    });
    fileInput.addClass("cashlog-hidden");
    this.fileInputEl = fileInput;

    fileInput.addEventListener("change", () => {
      if (fileInput.files) {
        for (let i = 0; i < fileInput.files.length; i++) {
          const file = fileInput.files[i];
          if (!file.type.startsWith("image/")) {
            new Notice(t("notice.imageOnly"));
            continue;
          }
          const tempId = `__pending_${this.pendingIdCounter++}`;
          this.pendingUploads.push({ file, tempId });
          const num = this.data.attachments.length + 1;
          this.data.attachments.push(`${tempId}|附件${num}`);
        }
        this.renumberAttachments();
        this.renderAttachmentList(listEl);
        fileInput.value = "";
      }
    });

    const addBtn = btnRow.createEl("button", {
      cls: "cashlog-attachment-add-btn",
      text: t("cashlogModal.addAttachment"),
    });
    addBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  private renumberAttachments(): void {
    for (let i = 0; i < this.data.attachments.length; i++) {
      const [fileName] = this.data.attachments[i].split("|");
      this.data.attachments[i] = `${fileName}|附件${i + 1}`;
    }
  }

  // 确认时批量处理附件：上传待上传的、删除待删除的
  private async processAttachments(): Promise<void> {
    const attManager = new AttachmentManager(this.app, this.app.vault, this.settings);

    // 上传待上传文件，用真实文件名替换 tempId
    for (const { file, tempId } of this.pendingUploads) {
      try {
        const attStr = await attManager.saveAttachment(file);
        const [realName] = attStr.split("|");
        for (let i = 0; i < this.data.attachments.length; i++) {
          if (this.data.attachments[i].startsWith(tempId + "|")) {
            const displayPart = this.data.attachments[i].split("|")[1] || "附件";
            this.data.attachments[i] = `${realName}|${displayPart}`;
            break;
          }
        }
      } catch (e) {
        console.error("附件上传失败:", e);
        new Notice(t("notice.uploadFailed"));
      }
    }

    // 删除标记的已有附件
    for (const fileName of this.pendingDeletions) {
      try {
        await attManager.deleteAttachment(fileName);
      } catch (e) {
        console.error("附件删除失败:", e);
      }
    }

    this.renumberAttachments();
  }

  private renderAttachmentList(listEl: HTMLElement): void {
    listEl.empty();
    for (let i = 0; i < this.data.attachments.length; i++) {
      const att = this.data.attachments[i];
      const item = listEl.createEl("div", { cls: "cashlog-attachment-item" });
      const [fileName, displayName] = att.includes("|") ? att.split("|") : [att, att];
      const isPending = fileName.startsWith("__pending_");

      const label = item.createEl("span", { text: `🧷 ${displayName}` });
      if (isPending) {
        label.addClass("cashlog-field-disabled");
        label.setAttr("title", t("cashlogModal.pending"));
      }

      const removeBtn = item.createEl("button", {
        cls: "cashlog-attachment-remove",
        text: t("cashlogModal.remove"),
      });
      const idx = i;
      removeBtn.addEventListener("click", () => {
        if (isPending) {
          this.pendingUploads = this.pendingUploads.filter((p) => p.tempId !== fileName);
        } else {
          this.pendingDeletions.push(fileName);
        }
        this.data.attachments.splice(idx, 1);
        this.renumberAttachments();
        this.renderAttachmentList(listEl);
      });
    }
  }

  // 日期
  private renderDateField(container: HTMLElement): void {
    const setting = new Setting(container).setName(t("cashlogModal.date"));
    setting.controlEl.empty();
    const wrapper = setting.controlEl.createEl("div", { cls: "cashlog-field-row-icon" });

    const dateInput = wrapper.createEl("input", {
      cls: "cashlog-field-input cashlog-field-input-icon",
      attr: { type: "date", value: this.data.date },
    });

    const calendarBtn = wrapper.createEl("button", {
      cls: "cashlog-icon-btn-inner",
      attr: { type: "button", title: t("cashlogModal.selectDate") },
    });
    const calSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    calSvg.setAttribute("width", "14");
    calSvg.setAttribute("height", "14");
    calSvg.setAttribute("viewBox", "0 0 24 24");
    calSvg.setAttribute("fill", "none");
    calSvg.setAttribute("stroke", "currentColor");
    calSvg.setAttribute("stroke-width", "2");
    calSvg.setAttribute("stroke-linecap", "round");
    calSvg.setAttribute("stroke-linejoin", "round");
    const calRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    calRect.setAttribute("x", "3"); calRect.setAttribute("y", "4");
    calRect.setAttribute("width", "18"); calRect.setAttribute("height", "18");
    calRect.setAttribute("rx", "2"); calRect.setAttribute("ry", "2");
    calSvg.appendChild(calRect);
    for (const [x1, y1, x2, y2] of [["16","2","16","6"],["8","2","8","6"],["3","10","21","10"]]) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1);
      l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      calSvg.appendChild(l);
    }
    calendarBtn.appendChild(calSvg);
    calendarBtn.addEventListener("click", () => {
      (dateInput as HTMLInputElement & { showPicker: () => void }).showPicker();
    });
    dateInput.addEventListener("change", () => {
      this.data.date = dateInput.value;
    });
  }

  // 时间
  private renderTimeField(container: HTMLElement): void {
    const setting = new Setting(container).setName(t("cashlogModal.time")).setDesc(t("cashlogModal.timeDesc"));
    setting.controlEl.empty();
    const wrapper = setting.controlEl.createEl("div", { cls: "cashlog-field-row-icon" });

    const timeInput = wrapper.createEl("input", {
      cls: "cashlog-field-input cashlog-field-input-icon",
      attr: { type: "time", value: this.data.time || "" },
    });

    const clockBtn = wrapper.createEl("button", {
      cls: "cashlog-icon-btn-inner",
      attr: { type: "button", title: t("cashlogModal.selectTime") },
    });
    const clkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    clkSvg.setAttribute("width", "14");
    clkSvg.setAttribute("height", "14");
    clkSvg.setAttribute("viewBox", "0 0 24 24");
    clkSvg.setAttribute("fill", "none");
    clkSvg.setAttribute("stroke", "currentColor");
    clkSvg.setAttribute("stroke-width", "2");
    clkSvg.setAttribute("stroke-linecap", "round");
    clkSvg.setAttribute("stroke-linejoin", "round");
    const clkCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    clkCircle.setAttribute("cx", "12"); clkCircle.setAttribute("cy", "12"); clkCircle.setAttribute("r", "10");
    clkSvg.appendChild(clkCircle);
    const clkPoly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    clkPoly.setAttribute("points", "12 6 12 12 16 14");
    clkSvg.appendChild(clkPoly);
    clockBtn.appendChild(clkSvg);
    clockBtn.addEventListener("click", () => {
      (timeInput as HTMLInputElement & { showPicker: () => void }).showPicker();
    });
    timeInput.addEventListener("change", () => {
      this.data.time = timeInput.value;
    });
  }

  // 渲染按钮
  private renderButtons(container: HTMLElement): void {
    new Setting(container)
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.confirm")).setCta().onClick(async () => {
          await this.processAttachments();
          this.close();
          this.onSubmit(this.data);
        }),
      )
      .addButton((btn) =>
        btn.setButtonText(t("modal.button.cancel")).onClick(() => {
          this.close();
        }),
      );
  }

  // 填充子标签（合并 settings 和缓存中发现的子标签）
  private populateSubTags(dropdown: { addOption: (value: string, display: string) => void; setValue: (value: string) => void }): void {
    dropdown.addOption("", t("cashlogModal.noSubTag"));
    const baseTag = this.data.tagType === "income"
      ? this.settings.incomeTag
      : this.settings.expenseTag;
    const subTags = this.data.tagType === "income"
      ? [...this.settings.incomeSubTags]
      : [...this.settings.expenseSubTags];

    // 合并缓存中发现的子标签
    if (this.plugin?.cache) {
      const allEntries = this.plugin.cache.getEntries();
      const baseLower = baseTag.toLowerCase();
      for (const entry of allEntries) {
        for (const tag of entry.tags) {
          if (tag.toLowerCase().startsWith(baseLower + "/")) {
            const sub = tag.substring(baseTag.length + 1);
            const slashIdx = sub.indexOf("/");
            const subTag = slashIdx === -1 ? sub : sub.substring(0, slashIdx);
            if (!subTags.includes(subTag)) {
              subTags.push(subTag);
            }
          }
        }
      }
    }

    for (const tag of subTags) {
      dropdown.addOption(tag, tag);
    }
    if (this.data.subTag) {
      dropdown.setValue(this.data.subTag);
    }
  }
}
