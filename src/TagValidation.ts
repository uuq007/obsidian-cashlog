// 标签校验共享模块
import { t } from "./i18n";

// 主标签校验
export function validateTagName(name: string): { valid: boolean; message?: string } {
  if (!name) {
    return { valid: false, message: t("validation.tagName.empty") };
  }

  if (name.length > 25) {
    return { valid: false, message: t("validation.tagName.tooLong") };
  }

  if (name.includes(" ")) {
    return { valid: false, message: t("validation.tagName.hasSpace") };
  }

  // 只允许 Unicode 字母、数字、下划线、连字符
  if (!/^[\p{L}\p{N}_-]+$/u.test(name)) {
    return { valid: false, message: t("validation.tagName.invalidChars") };
  }

  // 必须包含至少一个非数字字符（纯数字如 #1984 无效，#y1984 有效）
  if (/^[\p{N}]+$/u.test(name)) {
    return { valid: false, message: t("validation.tagName.pureNumeric") };
  }

  return { valid: true };
}

// 子标签校验（相比主标签：允许纯数字）
export function validateSubTagName(name: string): { valid: boolean; message?: string } {
  if (!name) {
    return { valid: false, message: t("validation.subTagName.empty") };
  }

  if (name.includes(" ")) {
    return { valid: false, message: t("validation.subTagName.hasSpace") };
  }

  if (!/^[\p{L}\p{N}_-]+$/u.test(name)) {
    return { valid: false, message: t("validation.subTagName.invalidChars") };
  }

  return { valid: true };
}

// 账户名校验
export function validateAccountName(name: string): { valid: boolean; message?: string } {
  if (!name || !name.trim()) {
    return { valid: false, message: t("validation.accountName.empty") };
  }
  if (name.trim().length > 25) {
    return { valid: false, message: t("validation.accountName.tooLong") };
  }
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  if (emojiRegex.test(name)) {
    return { valid: false, message: t("validation.accountName.hasEmoji") };
  }
  return { valid: true };
}