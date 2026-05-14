/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { CashlogEntry, type AccountAmount } from "./CashlogEntry";
import { moment } from "./types";
import type { Moment } from "./types";
import { EntryLocation } from "./EntryLocation";
import {
  listItemRegex,
  amountRegex,
  dateRegex,
  timeRegex,
  tagRegex,
  accountRegex,
  accountAmountRegex,
  attachmentRegex,
  trailingAmountRegex,
  trailingTimeRegex,
  trailingDateRegex,
  trailingAttachmentRegex,
} from "./CashlogRegex";
import type { CashlogSettings } from "./Settings";

// 从 body 中提取所有 💳 账户-金额标记
function extractAccountTokens(body: string): {
  accountAmounts: AccountAmount[];
  oldAccountNoAmount: string | null;
  cleanedBody: string;
} {
  const accountAmounts: AccountAmount[] = [];
  const phase1Matches: string[] = [];

  // 阶段1：旧格式 💳账户💴金额
  accountAmountRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = accountAmountRegex.exec(body)) !== null) {
    accountAmounts.push({ account: match[1], amount: parseFloat(match[2]) });
    phase1Matches.push(match[0]);
  }

  let remaining = body;
  for (const ms of phase1Matches) {
    remaining = remaining.replace(ms, " ");
  }


  // 阶段3：旧格式 💳账户（无金额）
  let oldAccountNoAmount: string | null = null;
  const acctMatch = remaining.match(accountRegex);
  if (acctMatch) {
    oldAccountNoAmount = acctMatch[1];
    remaining = remaining.replace(acctMatch[0], " ");
  }

  return {
    accountAmounts,
    oldAccountNoAmount,
    cleanedBody: remaining.replace(/\s+/g, " ").trim(),
  };
}

// 从右向左剥离时间、日期、附件
function stripTrailingMetadata(
  body: string,
): { body: string; time: string | null; date: Moment | null; attachments: string[] } {
  let time: string | null = null;
  let date: Moment | null = null;
  const attachments: string[] = [];
  let b = body;

  const timeMatch = b.match(timeRegex);
  if (timeMatch) {
    time = timeMatch[1];
    b = b.replace(trailingTimeRegex, "").trim();
  }

  const dateMatch = b.match(dateRegex);
  if (dateMatch) {
    date = moment(dateMatch[1], "YYYY-MM-DD");
    b = b.replace(trailingDateRegex, "").trim();
  }

  attachmentRegex.lastIndex = 0;
  const attMatches: string[] = [];
  let attMatch: RegExpExecArray | null;
  while ((attMatch = attachmentRegex.exec(b)) !== null) {
    attMatches.push(attMatch[0]);
  }
  for (const att of attMatches) {
    const m = att.match(/\u{1F9F7}\[\[([^|]+)(?:\|([^\]]+))?\]\]/u);
    if (m) {
      attachments.push(`${m[1]}|${m[2] || m[1]}`);
    }
    b = b.replace(trailingAttachmentRegex, "").trim();
  }

  return { body: b, time, date, attachments };
}

// 从 body 提取标签和描述
function extractTagsAndDescription(body: string): { tags: string[]; description: string } {
  const tags: string[] = [];
  tagRegex.lastIndex = 0;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(body)) !== null) {
    tags.push("#" + tagMatch[1]);
  }

  let description = body;
  for (const tag of tags) {
    description = description.replace(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "");
  }
  description = description.replace(/\s+/g, " ").trim();

  return { tags, description };
}

// 判断是否为余额变更类型（基于标签）
function isBalanceChangeEntry(tags: string[], settings: CashlogSettings): boolean {
  const bcTag = settings.balanceChangeTag.toLowerCase();
  return tags.some((t) => t.toLowerCase() === bcTag);
}

// 判断是否为转账类型（基于标签或账户结构）
function isTransferEntry(tags: string[], accountAmounts: AccountAmount[], settings: CashlogSettings): boolean {
  const tfTag = settings.transferTag.toLowerCase();
  if (tags.some((t) => t.toLowerCase() === tfTag)) return true;
  // 有正负金额混合的账户也视为转账
  const hasNeg = accountAmounts.some((aa) => aa.amount < 0);
  const hasPos = accountAmounts.some((aa) => aa.amount > 0);
  return hasNeg && hasPos && accountAmounts.length >= 2;
}

// 默认设置常量（避免重复创建）
const DEFAULT_PARSE_SETTINGS: CashlogSettings = {
  transferTag: "#转账",
  balanceChangeTag: "#余额变更",
} as CashlogSettings;

// 核心解析逻辑（内部共用）
function parseLineCore(
  line: string,
  location: EntryLocation | null,
  settings: CashlogSettings,
  lenient: boolean,
): CashlogEntry | null {
  const trimmed = line.trimEnd();
  if (trimmed === "") {
    return lenient ? new CashlogEntry("", 0, moment(), null, [], "", "-", location, "") : null;
  }

  const listMatch = trimmed.match(listItemRegex);
  if (!listMatch) return null;

  const indentation = listMatch[1];
  const listMarker = listMatch[2];
  let body = listMatch[3].trim();

  // 从右向左剥离元数据
  const meta = stripTrailingMetadata(body);
  body = meta.body;

  // 提取账户标记
  const { accountAmounts, oldAccountNoAmount, cleanedBody } = extractAccountTokens(body);
  body = cleanedBody;

  // 提取 💴 无账户金额
  const amountMatch = body.match(amountRegex);
  let yenAmount = 0;
  if (amountMatch) {
    yenAmount = parseFloat(amountMatch[1]);
    body = body.replace(trailingAmountRegex, "").trim();
  }

  // 提取标签和描述
  const { tags, description } = extractTagsAndDescription(body);

  // 判断类型
  let entryType: "normal" | "transfer" | "balanceChange" = "normal";
  if (isBalanceChangeEntry(tags, settings)) {
    entryType = "balanceChange";
  } else if (isTransferEntry(tags, accountAmounts, settings)) {
    entryType = "transfer";
  }

  // 计算总金额
  let amount: number;
  if (oldAccountNoAmount && accountAmounts.length === 0) {
    accountAmounts.push({ account: oldAccountNoAmount, amount: yenAmount });
    amount = yenAmount;
  } else {
    amount = yenAmount + accountAmounts.reduce((s, aa) => s + aa.amount, 0);
  }

  // 严格模式：必须有金额
  if (!lenient && amount === 0 && accountAmounts.length === 0) return null;

  // 转账和余额变更的 amount 设为 0
  if (entryType === "transfer" || entryType === "balanceChange") amount = 0;

  return new CashlogEntry(
    description,
    amount,
    // 宽松模式日期为空时用当前时间
    lenient ? (meta.date || moment()) : meta.date,
    meta.time,
    tags,
    indentation,
    listMarker,
    location,
    line,
    accountAmounts,
    meta.attachments,
    entryType,
  );
}

// 严格模式：从 Markdown 行解析 CashlogEntry，失败返回 null
export function parseCashlogLine(
  line: string,
  location: EntryLocation | null = null,
  settings?: CashlogSettings,
): CashlogEntry | null {
  return parseLineCore(line, location, settings || DEFAULT_PARSE_SETTINGS, false);
}

// 宽松模式：不要求必须有金额（用于编辑已有条目）
export function parseCashlogLineLenient(
  line: string,
  location: EntryLocation | null = null,
  settings?: CashlogSettings,
): CashlogEntry | null {
  return parseLineCore(line, location, settings || DEFAULT_PARSE_SETTINGS, true);
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
