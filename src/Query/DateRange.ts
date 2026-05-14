/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { moment, type Moment } from "../types";

// 日期范围：表示两个日期之间的闭区间
export class DateRange {
  start: Moment;
  end: Moment;

  constructor(start: Moment, end: Moment) {
    this.start = start;
    this.end = end;

    // 自动排序
    if (end.isBefore(start)) {
      this.start = end;
      this.end = start;
    }

    // 归零到 00:00
    this.start = this.start.startOf("day");
    this.end = this.end.startOf("day");
  }

  // 构建相对日期范围（this week/month/quarter/year）
  static buildRelative(range: moment.unitOfTime.StartOf): DateRange {
    const unitOfTime = range === "week" ? "isoWeek" : range;
    return new DateRange(
      moment().startOf(unitOfTime).startOf("day"),
      moment().endOf(unitOfTime).startOf("day"),
    );
  }

  // 构建无效日期范围
  static buildInvalid(): DateRange {
    return new DateRange(moment.invalid(), moment.invalid());
  }

  // 检查范围是否有效
  isValid(): boolean {
    return this.start.isValid() && this.end.isValid();
  }

  // 向前偏移一个周期（last）
  moveToPrevious(duration: moment.unitOfTime.DurationConstructor): void {
    const delta = moment.duration(1, duration);
    this.start.subtract(delta);
    this.end.subtract(delta);

    if (duration === "month" || duration === "quarter") {
      this.end = this.end.endOf(duration).startOf("day");
    }
  }

  // 向后偏移一个周期（next）
  moveToNext(duration: moment.unitOfTime.DurationConstructor): void {
    const delta = moment.duration(1, duration);
    this.start.add(delta);
    this.end.add(delta);

    if (duration === "month" || duration === "quarter") {
      this.end = this.end.endOf(duration).startOf("day");
    }
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
