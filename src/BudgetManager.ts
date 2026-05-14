/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import type { CashlogEntry } from "./EntryLocation";
import type { BudgetConfig, GoalConfig } from "./Settings";
import { DateRange } from "./Query/DateRange";
import { moment } from "./types";
import type { Moment } from "./types";

export interface BudgetProgress {
  config: BudgetConfig;
  spent: number;
  remaining: number;
  percentage: number;
  isOverspent: boolean;
  // 该预算匹配的条目（已按时段和标签过滤）
  matchingEntries: CashlogEntry[];
}

export interface GoalProgress {
  config: GoalConfig;
  earned: number;
  remaining: number;
  percentage: number;
  isAchieved: boolean;
  // 该目标匹配的条目（已按时段和标签过滤）
  matchingEntries: CashlogEntry[];
}

// 周期类型（合并了 StatsMode 和 Budget period）
export type PeriodType = BudgetConfig["period"] | "day" | "all";

// 根据周期类型计算日期范围（Dashboard 和 Budget 共用）
export function computePeriodRange(
  period: PeriodType,
  statsWeekStartDay: number,
  statsMonthStartDay: number,
  startDate?: string,
  endDate?: string,
): DateRange | null {
  const now = moment();
  switch (period) {
    case "day":
      return new DateRange(now.clone().startOf("day"), now.clone().endOf("day"));
    case "week":
    case "weekly": {
      const dayOfWeek = now.isoWeekday();
      const diff = dayOfWeek < statsWeekStartDay
        ? 7 - (statsWeekStartDay - dayOfWeek)
        : dayOfWeek - statsWeekStartDay;
      const start = now.clone().subtract(diff, "days").startOf("day");
      return new DateRange(start, now.clone().endOf("day"));
    }
    case "month":
    case "monthly": {
      const currentDay = now.date();
      let start: Moment;
      if (currentDay >= statsMonthStartDay) {
        start = now.clone().date(statsMonthStartDay).startOf("day");
      } else {
        start = now.clone().subtract(1, "months").date(statsMonthStartDay).startOf("day");
      }
      return new DateRange(start, now.clone().endOf("day"));
    }
    case "yearly":
    case "year":
      return new DateRange(
        now.clone().startOf("year").startOf("day"),
        now.clone().endOf("day"),
      );
    case "custom":
      if (startDate && endDate) {
        const s = moment(startDate);
        const e = moment(endDate);
        if (s.isValid() && e.isValid()) {
          return new DateRange(s, e);
        }
      }
      return null;
    case "all":
    default:
      return null;
  }
}

export class BudgetManager {
  // 获取所有预算的进度
  getBudgetProgress(
    entries: CashlogEntry[],
    budgets: BudgetConfig[],
    statsWeekStartDay: number,
    statsMonthStartDay: number,
  ): BudgetProgress[] {
    return budgets.map((budget) => {
      const range = computePeriodRange(
        budget.period, statsWeekStartDay, statsMonthStartDay,
        budget.startDate, budget.endDate,
      );
      const matchingEntries = this.filterByBudget(
        entries, budget, range?.start ?? null, range?.end ?? null,
      );
      const spent = Math.abs(
        matchingEntries.reduce((sum, e) => sum + (e.amount < 0 ? e.amount : 0), 0),
      );
      const remaining = budget.amount - spent;
      const percentage = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;

      return {
        config: budget,
        spent,
        remaining: Math.max(0, remaining),
        percentage,
        isOverspent: spent > budget.amount,
        matchingEntries,
      };
    });
  }

  // 获取所有目标的进度
  getGoalProgress(
    entries: CashlogEntry[],
    goals: GoalConfig[],
    statsWeekStartDay: number,
    statsMonthStartDay: number,
  ): GoalProgress[] {
    return goals.map((goal) => {
      const range = computePeriodRange(
        goal.period, statsWeekStartDay, statsMonthStartDay,
        goal.startDate, goal.endDate,
      );
      const matchingEntries = this.filterByGoal(
        entries, goal, range?.start ?? null, range?.end ?? null,
      );
      const earned = matchingEntries.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0);
      const remaining = goal.targetAmount - earned;
      const percentage = goal.targetAmount > 0
        ? Math.min(100, (earned / goal.targetAmount) * 100)
        : 0;

      return {
        config: goal,
        earned,
        remaining: Math.max(0, remaining),
        percentage,
        isAchieved: earned >= goal.targetAmount,
        matchingEntries,
      };
    });
  }

  // 按条件过滤条目（共用：预算用 isExpense，目标用 isIncome）
  private filterByCondition(
    entries: CashlogEntry[],
    tag: string,
    periodStart: Moment | null,
    periodEnd: Moment | null,
    checkType: (e: CashlogEntry) => boolean,
  ): CashlogEntry[] {
    return entries.filter((entry) => {
      if (!checkType(entry)) return false;

      if (tag) {
        const matchesTag = entry.tags.some((t) =>
          t.toLowerCase().startsWith(tag.toLowerCase()),
        );
        if (!matchesTag) return false;
      }

      if (periodStart && periodEnd && entry.date) {
        return entry.date.isSameOrAfter(periodStart) && entry.date.isSameOrBefore(periodEnd);
      }

      return true;
    });
  }

  // 按预算条件过滤条目
  private filterByBudget(
    entries: CashlogEntry[],
    budget: BudgetConfig,
    periodStart: Moment | null,
    periodEnd: Moment | null,
  ): CashlogEntry[] {
    return this.filterByCondition(entries, budget.tag, periodStart, periodEnd, (e) => e.isExpense);
  }

  // 按目标条件过滤条目
  private filterByGoal(
    entries: CashlogEntry[],
    goal: GoalConfig,
    periodStart: Moment | null,
    periodEnd: Moment | null,
  ): CashlogEntry[] {
    return this.filterByCondition(entries, goal.tag, periodStart, periodEnd, (e) => e.isIncome);
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
