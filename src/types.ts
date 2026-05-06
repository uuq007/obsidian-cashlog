// Obsidian 的 moment 类型导出存在已知问题（缺少调用签名）
// 此模块提供修正后的 moment 和 Moment 类型
import { moment as _obsMoment } from "obsidian";
import type { Moment } from "moment";

export const moment = _obsMoment as unknown as typeof import("moment");
export { Moment };
