/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { EntryLocation } from "./EntryLocation";
import type { Moment } from "./types";
import { round2 } from "./MoneyUtils";

// 账户-金额对
export interface AccountAmount {
  account: string;
  amount: number;
}

// 记账条目数据模型（不可变）
export class CashlogEntry {
  constructor(
    public readonly description: string = "",
    public readonly amount: number = 0,
    public readonly date: Moment | null = null,
    public readonly time: string | null = null,
    public readonly tags: string[] = [],
    public readonly indentation: string = "",
    public readonly listMarker: string = "-",
    public readonly location: EntryLocation | null = null,
    public readonly originalMarkdown: string = "",
    public readonly accountAmounts: AccountAmount[] = [],
    public readonly attachments: string[] = [],
    public readonly entryType: "normal" | "transfer" | "balanceChange" = "normal",
  ) {}

  // 无账户金额（💴）
  get noAccountAmount(): number {
    if (this.entryType === "transfer" || this.entryType === "balanceChange") return 0;
    return round2(this.amount - this.accountAmounts.reduce((s, aa) => s + aa.amount, 0));
  }

  // 总金额
  get totalAmount(): number {
    if (this.entryType === "transfer" || this.entryType === "balanceChange") return 0;
    return this.amount;
  }

  get isIncome(): boolean {
    return this.totalAmount > 0;
  }

  get isExpense(): boolean {
    return this.totalAmount < 0;
  }

  get hasAccount(): boolean {
    return this.accountAmounts.length > 0;
  }

  get hasAttachments(): boolean {
    return this.attachments.length > 0;
  }

  get isTransfer(): boolean {
    return this.entryType === "transfer";
  }

  get isBalanceChange(): boolean {
    return this.entryType === "balanceChange";
  }

  // 向后兼容 getter
  get account(): string | null {
    if (this.entryType === "transfer") return null;
    return this.accountAmounts[0]?.account ?? null;
  }

  get fromAccount(): string | null {
    return this.accountAmounts.find((aa) => aa.amount < 0)?.account ?? null;
  }

  get toAccount(): string | null {
    return this.accountAmounts.find((aa) => aa.amount > 0)?.account ?? null;
  }

  get fromAmount(): number {
    return Math.abs(this.accountAmounts.find((aa) => aa.amount < 0)?.amount ?? 0);
  }

  get toAmount(): number {
    return this.accountAmounts.find((aa) => aa.amount > 0)?.amount ?? 0;
  }

  // 获取子标签部分（如 #支出/交通 → "交通"）
  getCategory(mainTag: string): string | null {
    const fullTag = this.tags.find((t) =>
      t.toLowerCase().startsWith(mainTag.toLowerCase() + "/"),
    );
    if (!fullTag) return null;
    return fullTag.substring(mainTag.length + 1);
  }

  // 获取主要标签（第一个标签）
  get primaryTag(): string | null {
    return this.tags.length > 0 ? this.tags[0] : null;
  }

  // 将 Entry 序列化为 Markdown 行
  toFileLineString(): string {
    const parts: string[] = [];

    if (this.tags.length > 0) {
      parts.push(this.tags.join(" "));
    }

    if (this.description) {
      parts.push(this.description);
    }

    if (this.entryType === "transfer") {
      for (const aa of this.accountAmounts) {
        parts.push(`💳${aa.account}💴${aa.amount}`);
      }
    } else if (this.entryType === "balanceChange") {
      for (const aa of this.accountAmounts) {
        parts.push(`💳${aa.account}💴${aa.amount}`);
      }
    } else {
      const noAccount = this.noAccountAmount;
      if (noAccount !== 0) {
        parts.push(`💴${noAccount}`);
      }
      for (const aa of this.accountAmounts) {
        parts.push(`💳${aa.account}💴${aa.amount}`);
      }
    }

    for (const attachment of this.attachments) {
      parts.push(`🧷[[${attachment}]]`);
    }

    if (this.date) {
      parts.push(`➕${this.date.format("YYYY-MM-DD")}`);
    }

    if (this.time) {
      parts.push(`⏰${this.time}`);
    }

    return `${this.indentation}${this.listMarker} ${parts.join(" ")}`;
  }

  // 克隆并修改部分字段
  clone(overrides: Partial<CashlogEntry>): CashlogEntry {
    return new CashlogEntry(
      overrides.description ?? this.description,
      overrides.amount ?? this.amount,
      overrides.date !== undefined ? overrides.date : this.date,
      overrides.time !== undefined ? overrides.time : this.time,
      overrides.tags ?? this.tags,
      overrides.indentation ?? this.indentation,
      overrides.listMarker ?? this.listMarker,
      overrides.location ?? this.location,
      overrides.originalMarkdown ?? this.originalMarkdown,
      overrides.accountAmounts ?? this.accountAmounts,
      overrides.attachments ?? this.attachments,
      overrides.entryType ?? this.entryType,
    );
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
