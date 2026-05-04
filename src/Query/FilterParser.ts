import { CashlogEntry } from "../EntryLocation";
import { FilterFunction, FilterOrError } from "./Filter";
import type { CashlogSettings } from "../Settings";
import { checkPathFilterConflict } from "../PathUtils";
import { DateParser } from "./DateParser";
import { DateRange } from "./DateRange";

// 用 OR 分割值（不区分大小写）
function splitByOr(value: string): string[] {
  return value.split(/\s+OR\s+/i).map((s) => s.trim()).filter(Boolean);
}

// 标签匹配：完全匹配或前缀匹配
function tagMatches(entryTag: string, target: string): boolean {
  const t = entryTag.toLowerCase();
  return t === target || t.startsWith(target + "/");
}

// 解析一行查询文本为过滤器
export function parseFilter(
  line: string,
  settings: CashlogSettings,
): FilterOrError | null {
  const trimLine = line.trim().toLowerCase();

  // is income / is expense
  if (trimLine === "is income") {
    return { filter: (e) => e.amount > 0 };
  }
  if (trimLine === "is expense") {
    return { filter: (e) => e.amount < 0 };
  }

  // tag includes（支持 OR）
  const tagIncludesMatch = line.match(/^tag\s+includes\s+(.+)/i);
  if (tagIncludesMatch) {
    const tags = splitByOr(tagIncludesMatch[1]).map((t) => t.toLowerCase());
    return {
      filter: (e) =>
        tags.some((tag) => e.tags.some((t) => tagMatches(t, tag))),
    };
  }

  // tag does not include（支持 OR）
  const tagNotMatch = line.match(/^tag\s+does not include\s+(.+)/i);
  if (tagNotMatch) {
    const tags = splitByOr(tagNotMatch[1]).map((t) => t.toLowerCase());
    return {
      filter: (e) =>
        tags.every((tag) => !e.tags.some((t) => tagMatches(t, tag))),
    };
  }

  // description includes（支持 OR）
  const descMatch = line.match(/^description\s+includes\s+(.+)/i);
  if (descMatch) {
    const texts = splitByOr(descMatch[1]).map((t) => t.toLowerCase());
    return { filter: (e) => texts.some((t) => e.description.toLowerCase().includes(t)) };
  }

  // description does not include（支持 OR）
  const descNotMatch = line.match(/^description\s+does not include\s+(.+)/i);
  if (descNotMatch) {
    const texts = splitByOr(descNotMatch[1]).map((t) => t.toLowerCase());
    return { filter: (e) => texts.every((t) => !e.description.toLowerCase().includes(t)) };
  }

  // amount above / above or equal / below / below or equal / equals（支持 OR）
  const amountMatch = line.match(/^amount\s+(above or equal|below or equal|above|below|equals)\s+(.+)/i);
  if (amountMatch) {
    const op = amountMatch[1].toLowerCase();
    const values = splitByOr(amountMatch[2])
      .map((s) => parseFloat(s.trim()))
      .filter((v) => !isNaN(v));
    return {
      filter: (e) => {
        const abs = Math.abs(e.amount);
        return values.some((value) => {
          switch (op) {
            case "above": return abs > value;
            case "above or equal": return abs >= value;
            case "below": return abs < value;
            case "below or equal": return abs <= value;
            case "equals": return abs === value;
            default: return true;
          }
        });
      },
    };
  }

  // date 过滤（仿 tasks 插件的 DateField）
  const dateMatch = line.match(
    /^date\s+(((?:on|in)\s+or\s+before|before|(?:on|in)\s+or\s+after|after|on|in)?\s*(.*))/i,
  );
  if (dateMatch) {
    const keywordAndDate = dateMatch[1];
    const fieldKeyword = (dateMatch[2] || "").toLowerCase().trim();
    const dateString = dateMatch[3] || "";

    if (dateString.trim() === "" && fieldKeyword === "") {
      return null;
    }

    // 尝试解析为日期范围
    let fieldDates = DateParser.parseDateRange(dateString.trim());

    // 范围无效时，回退到解析整个关键字+日期部分为单日期
    if (!fieldDates.isValid()) {
      const date = DateParser.parseDate(keywordAndDate.trim());
      if (date.isValid()) {
        fieldDates = new DateRange(date, date);
      }
    }

    if (!fieldDates.isValid()) {
      return { error: `无法解析日期: ${line}` };
    }

    // 根据操作符构建过滤函数
    const dateFilter = buildDateFilter(fieldKeyword, fieldDates);
    return { filter: dateFilter };
  }

  // path includes（支持 OR）
  const pathMatch = line.match(/^path\s+includes\s+(.+)/i);
  if (pathMatch) {
    const paths = splitByOr(pathMatch[1]).map((p) => p.toLowerCase());
    // 只对第一个路径检查冲突
    const conflictError = checkPathFilterConflict(paths[0], settings.excludePaths, settings.includePaths);
    if (conflictError) {
      return { error: conflictError };
    }
    return { filter: (e) => e.location !== null && paths.some((p) => e.location!.path.toLowerCase().includes(p)) };
  }

  // account is <name>
  const accountIsMatch = line.match(/^account\s+is\s+(.+)/i);
  if (accountIsMatch) {
    const names = splitByOr(accountIsMatch[1]).map((n) => n.toLowerCase());
    return {
      filter: (e) => {
        const acct = e.accountAmounts.map((aa) => aa.account.toLowerCase());
        return names.some((n) => acct.some((a) => a.includes(n)));
      },
    };
  }

  // account is not <name>
  const accountNotMatch = line.match(/^account\s+is not\s+(.+)/i);
  if (accountNotMatch) {
    const names = splitByOr(accountNotMatch[1]).map((n) => n.toLowerCase());
    return {
      filter: (e) => {
        const acct = e.accountAmounts.map((aa) => aa.account.toLowerCase());
        return names.every((n) => !acct.some((a) => a.includes(n)));
      },
    };
  }

  // has attachment
  if (trimLine === "has attachment" || trimLine === "has attachments") {
    return { filter: (e) => e.attachments.length > 0 };
  }

  // is transfer
  if (trimLine === "is transfer") {
    return { filter: (e) => e.isTransfer };
  }

  // is balance change
  if (trimLine === "is balance change") {
    return { filter: (e) => e.isBalanceChange };
  }

  // type includes（支持 OR，用于多类型选择）
  const typeIncludesMatch = line.match(/^type\s+includes\s+(.+)/i);
  if (typeIncludesMatch) {
    const types = splitByOr(typeIncludesMatch[1]).map((t) => t.toLowerCase().trim());
    const typeCheckers: Record<string, (e: CashlogEntry) => boolean> = {
      income: (e) => e.isIncome && !e.isTransfer && !e.isBalanceChange,
      expense: (e) => e.isExpense && !e.isTransfer && !e.isBalanceChange,
      transfer: (e) => e.isTransfer,
      balancechange: (e) => e.isBalanceChange,
    };
    const validCheckers = types
      .map((t) => typeCheckers[t])
      .filter(Boolean);
    if (validCheckers.length > 0) {
      return { filter: (e) => validCheckers.some((check) => check(e)) };
    }
  }

  return null;
}

// 根据操作符构建日期过滤函数
function buildDateFilter(
  fieldKeyword: string,
  fieldDates: DateRange,
): FilterFunction {
  switch (fieldKeyword) {
    case "before":
      return (e: CashlogEntry) =>
        e.date !== null && e.date.isBefore(fieldDates.start);
    case "after":
      return (e: CashlogEntry) =>
        e.date !== null && e.date.isAfter(fieldDates.end);
    case "on or before":
    case "in or before":
      return (e: CashlogEntry) =>
        e.date !== null && e.date.isSameOrBefore(fieldDates.end);
    case "on or after":
    case "in or after":
      return (e: CashlogEntry) =>
        e.date !== null && e.date.isSameOrAfter(fieldDates.start);
    default:
      // on / in / 省略 → 匹配范围内的所有日期（含两端）
      return (e: CashlogEntry) =>
        e.date !== null &&
        e.date.isSameOrAfter(fieldDates.start) &&
        e.date.isSameOrBefore(fieldDates.end);
  }
}
