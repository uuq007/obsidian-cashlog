import * as chrono from "chrono-node";
import { moment } from "obsidian";
import type { Moment } from "moment";
import { DateRange } from "./DateRange";

// 日期解析器：支持绝对日期、自然语言日期、编号日期范围、相对日期范围
export class DateParser {
  // 解析单个日期（使用 chrono）
  static parseDate(input: string, forwardDate: boolean = false): Moment {
    return moment(
      chrono.parseDate(input, undefined, { forwardDate }),
    ).startOf("day");
  }

  // 解析日期范围（按优先级依次尝试）
  static parseDateRange(input: string, forwardDate: boolean = false): DateRange {
    const parsers = [
      DateParser.parseRelativeDateRange,
      DateParser.parseNumberedDateRange,
      DateParser.parseAbsoluteDateRange,
    ];

    for (const parser of parsers) {
      const result = parser(input, forwardDate);
      if (result.isValid()) {
        return result;
      }
    }

    return DateRange.buildInvalid();
  }

  // 解析相对日期范围：last|this|next week|month|quarter|year
  private static parseRelativeDateRange(input: string, _forwardDate: boolean): DateRange {
    const match = input.match(/(last|this|next)\s+(week|month|quarter|year)/i);
    if (!match || match.length < 3) {
      return DateRange.buildInvalid();
    }

    const direction = match[1].toLowerCase();
    const range = match[2].toLowerCase() as moment.unitOfTime.StartOf;

    const dateRange = DateRange.buildRelative(range);

    switch (direction) {
      case "last":
        dateRange.moveToPrevious(range as moment.unitOfTime.DurationConstructor);
        break;
      case "next":
        dateRange.moveToNext(range as moment.unitOfTime.DurationConstructor);
        break;
    }

    return dateRange;
  }

  // 解析编号日期范围：YYYY、YYYY-mm、YYYY-Www、YYYY-Qq
  private static parseNumberedDateRange(input: string, _forwardDate: boolean): DateRange {
    const patterns: [RegExp, string, moment.unitOfTime.StartOf][] = [
      [/^\s*\d{4}\s*$/, "YYYY", "year"],
      [/^\s*\d{4}-Q[1-4]\s*$/i, "YYYY-Q", "quarter"],
      [/^\s*\d{4}-\d{2}\s*$/, "YYYY-MM", "month"],
      [/^\s*\d{4}-W\d{2}\s*$/i, "YYYY-WW", "isoWeek"],
    ];

    for (const [regex, format, range] of patterns) {
      const match = input.match(regex);
      if (match) {
        const date = match[0].trim();
        return new DateRange(
          moment(date, format).startOf(range),
          moment(date, format).endOf(range),
        );
      }
    }

    return DateRange.buildInvalid();
  }

  // 解析绝对日期范围：用 chrono 解析一个或两个日期
  private static parseAbsoluteDateRange(input: string, forwardDate: boolean): DateRange {
    const result = chrono.parse(input, undefined, { forwardDate });
    if (result.length === 0) {
      return DateRange.buildInvalid();
    }

    const startDate = result[0].start;
    const endDate = result[1] && result[1].start ? result[1].start : startDate;
    const start = moment(startDate.date());
    const end = moment(endDate.date());

    return new DateRange(start, end);
  }
}
