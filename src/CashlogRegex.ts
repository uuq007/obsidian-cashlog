// CashlogEntry 的正则表达式定义

// 缩进（空格、制表符、引用 >）
export const indentationRegex = /^([\s\t>]*)/;

// 列表标记：- * + 或 数字. / 数字)
export const listMarkerRegex = /([-*+]|[0-9]+[.)])/;

// 匹配列表行：缩进 + 列表标记 + 正文
export const listItemRegex = new RegExp(
  indentationRegex.source + listMarkerRegex.source + ' +(.*)',
  'u',
);

// 匹配任意行：缩进 + 可选的列表标记 + 剩余文本
export const nonCashlogRegex = new RegExp(
  indentationRegex.source +
  listMarkerRegex.source +
  '?' +
  ' *(.*)',
  'u',
);

// 金额：💴 后跟可选负号和数字（支持小数，最多两位）
export const amountRegex = /\u{1F4B4}(-?\d+(?:\.\d{1,2})?)/u;

// 日期：➕ 后跟 YYYY-MM-DD
export const dateRegex = /➕(\d{4}-\d{2}-\d{2})/u;

// 时间：⏰ 后跟 HH:mm
export const timeRegex = /⏰(\d{2}:\d{2})/u;

// 标签：#xxx 或 #xxx/yyy（全局匹配）
export const tagRegex = /#([^\s#]+)/gu;

// 账户（旧格式，无金额）：💳 后跟账户名
export const accountRegex = /\u{1F4B3}([^\s\u{1F4B4}\u{1F9F7}➕⏰#]+)/u;

// 账户+金额一体（旧转账格式）：💳账户名💴金额（全局匹配）
export const accountAmountRegex = /\u{1F4B3}([^\s\u{1F4B4}\u{1F9F7}➕⏰#]+)\u{1F4B4}(-?\d+(?:\.\d{1,2})?)/gu;

// 附件：🧷[[文件名|显示名]]（全局匹配）
export const attachmentRegex = /\u{1F9F7}\[\[([^|]+)(?:\|([^\]]+))?\]\]/gu;

// 用于从行尾剥离的辅助正则
export const trailingAmountRegex = /\u{1F4B4}-?\d+(?:\.\d{1,2})?\s*$/u;
export const trailingTimeRegex = /⏰\d{2}:\d{2}\s*$/u;
export const trailingDateRegex = /➕\d{4}-\d{2}-\d{2}\s*$/u;
export const trailingAttachmentRegex = /\u{1F9F7}\[\[[^\]]+\]\]\s*$/u;

