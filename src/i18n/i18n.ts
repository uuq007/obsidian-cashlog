/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
// 国际化翻译引擎
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

type StringMap = Record<string, string>;

// 支持的语言包（后续添加新语言时在这里注册）
const localeMap: Record<string, StringMap> = {};
let currentLocale: string = "zh-CN";
let currentStrings: StringMap = zhCN as StringMap;

// 注册语言包
function registerLocale(locale: string, strings: StringMap): void {
  localeMap[locale] = strings;
}

// 判断是否为中文语言
function isZhLang(lang: string): boolean {
  const lower = lang.toLowerCase();
  return lower.startsWith("zh");
}

// 初始化：自动检测用户语言
export function initI18n(): void {
  // 注册语言包
  registerLocale("zh-CN", zhCN as StringMap);
  registerLocale("en", en as StringMap);

  // 优先使用 moment locale（反映 Obsidian 的语言设置）
  const momentLocale = (window as unknown as { moment?: { locale?: () => string } }).moment?.locale?.() || "";
  if (momentLocale) {
    currentLocale = isZhLang(momentLocale) ? "zh-CN" : "en";
  } else {
    // 回退到浏览器语言
    currentLocale = isZhLang(navigator.language) ? "zh-CN" : "en";
  }
  currentStrings = currentLocale === "zh-CN" ? (zhCN as StringMap) : (en as StringMap);
}

// 简单翻译
export function t(key: string): string {
  return currentStrings[key] ?? (zhCN as StringMap)[key] ?? key;
}

// 带插值的翻译（替换 {name} 占位符）
export function tp(key: string, params: Record<string, string | number>): string {
  let str = t(key);
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return str;
}

// 获取当前语言
export function getLocale(): string {
  return currentLocale;
}

// 格式化金额（根据当前语言环境）
export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(currentLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = currentLocale === "en" ? "$" : "¥";
  return value < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

// 格式化无符号金额
export function formatMoneyUnsigned(value: number): string {
  return value.toLocaleString(currentLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
