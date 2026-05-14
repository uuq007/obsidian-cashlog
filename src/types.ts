// Obsidian 的 moment 类型导出存在已知问题（typeof Moment 是类构造器类型，缺少直接调用签名）
// 使用 moment npm 包的完整类型进行修正，仅在这一行需要 eslint-disable
import { moment as _obsMoment } from "obsidian";
import type _momentDefault from "moment";

type MomentFn = typeof _momentDefault;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const moment = _obsMoment as unknown as MomentFn;
export type Moment = ReturnType<MomentFn>;
