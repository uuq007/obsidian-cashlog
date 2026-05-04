// 记账条目在文件中的位置信息
export class EntryLocation {
  constructor(
    public readonly path: string,
    public readonly lineNumber: number,
    public readonly sectionStart: number = lineNumber,
    public readonly sectionIndex: number = 0,
    public readonly precedingHeader: string | null = null,
  ) {}
}

// 从独立文件重新导出，保持向后兼容
export { CashlogEntry, type AccountAmount } from "./CashlogEntry";
