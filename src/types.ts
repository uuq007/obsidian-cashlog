// Obsidian 的 moment 类型导出存在已知问题（缺少调用签名）
// 此模块提供修正后的 moment 和 Moment 类型
import { moment as _obsMoment } from "obsidian";

// 先导出 moment 常量
export const moment = _obsMoment as unknown as typeof import("moment");

// 从 moment 函数推断 Moment 类型（避免从 moment 包直接导入）
export type Moment = ReturnType<typeof moment>;
