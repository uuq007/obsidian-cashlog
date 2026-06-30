/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { moment } from "./types";
import { CashlogEntry, type AccountAmount } from "./CashlogEntry";
import { EditableEntryData } from "./CashlogModal";
import type CashlogPlugin from "./main";
import { AccountManager } from "./AccountManager";
import type { EntryLocation } from "./EntryLocation";
import { round2 } from "./MoneyUtils";

// 构建上下文：indentation、listMarker、location 可能来自新条目的行上下文，也可能来自原条目
export interface EntryBuildContext {
  indentation: string;
  listMarker: string;
  location: EntryLocation | null;
}

// 从 Modal 数据构建 CashlogEntry（统一版本，支持新建和编辑）
export function buildEntryFromModalData(
  data: EditableEntryData,
  plugin: CashlogPlugin,
  context: EntryBuildContext,
): CashlogEntry {
  const settings = plugin.settings;
  const date = data.date ? moment(data.date, "YYYY-MM-DD") : moment();
  const validDate = date.isValid() ? date : moment();

  if (data.tagType === "transfer") {
    const accountAmounts: AccountAmount[] = [
      ...data.fromAccounts.map((a) => ({
        account: a.account,
        amount: -(parseFloat(a.amount) || 0),
      })),
      ...data.toAccounts.map((a) => ({
        account: a.account,
        amount: parseFloat(a.amount) || 0,
      })),
    ];

    return new CashlogEntry(
      data.description,
      0,
      validDate,
      data.time || null,
      [settings.transferTag],
      context.indentation,
      context.listMarker,
      context.location,
      "",
      accountAmounts,
      data.attachments,
      "transfer",
    );
  }

  // 余额变更类型
  if (data.tagType === "balanceChange") {
    const entries = plugin.cache.getEntries();
    const currentBalances = AccountManager.recomputeBalances(
      entries,
      settings.accountBalances,
      settings.accounts,
    );

    const accountAmounts: AccountAmount[] = [];
    for (const item of data.balanceChangeAccounts) {
      const targetBalance = parseFloat(item.amount) || 0;
      const currentBalance = currentBalances[item.account] || 0;
      const difference = targetBalance - currentBalance;
      accountAmounts.push({ account: item.account, amount: parseFloat(difference.toFixed(2)) });
    }

    return new CashlogEntry(
      data.description,
      0,
      validDate,
      data.time || null,
      [settings.balanceChangeTag],
      context.indentation,
      context.listMarker,
      context.location,
      "",
      accountAmounts,
      data.attachments,
      "balanceChange",
    );
  }

  const sign = data.tagType === "income" ? 1 : -1;
  const baseTag = data.tagType === "income" ? settings.incomeTag : settings.expenseTag;
  const fullTag = data.subTag ? `${baseTag}/${data.subTag}` : baseTag;

  let noAccountAmt = 0;
  const accountAmounts: AccountAmount[] = [];

  for (const item of data.accounts) {
    const amt = (parseFloat(item.amount) || 0) * sign;
    if (item.account === "") {
      noAccountAmt += amt;
    } else {
      accountAmounts.push({ account: item.account, amount: amt });
    }
  }

  const amount = round2(noAccountAmt + accountAmounts.reduce((s, aa) => s + aa.amount, 0));

  return new CashlogEntry(
    data.description,
    amount,
    validDate,
    data.time || null,
    [fullTag],
    context.indentation,
    context.listMarker,
    context.location,
    "",
    accountAmounts,
    data.attachments,
    "normal",
  );
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
