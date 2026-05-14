import { moment } from "obsidian";

export { moment };

// 自定义 Moment 接口，声明代码库中实际使用的方法
// 避免审核环境无法解析 obsidian 的 moment 类型导出导致 Moment 解析为 any
export interface Moment {
  clone(): Moment;
  startOf(unit: string): Moment;
  endOf(unit: string): Moment;
  add(amount: number, unit: string): Moment;
  subtract(amount: number, unit: string): Moment;
  date(): number;
  date(value: number): Moment;
  isoWeekday(): number;
  valueOf(): number;
  isValid(): boolean;
  isSameOrAfter(other: Moment): boolean;
  isSameOrBefore(other: Moment): boolean;
  isBefore(other: Moment): boolean;
  isAfter(other: Moment): boolean;
  format(format?: string): string;
}
