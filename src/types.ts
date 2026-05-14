import type MomentModule from "moment";

// Obsidian 在运行时通过 window.moment 暴露 moment 库
// 直接从 window 获取，避免 obsidian.d.ts 中 typeof Moment 类型不完整导致的 ESLint 级联错误
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Obsidian 通过 window.moment 暴露 moment，需类型断言中转获取 moment npm 包完整类型
export const moment = (window as unknown as { moment: typeof MomentModule }).moment;
export type Moment = ReturnType<typeof MomentModule>;
