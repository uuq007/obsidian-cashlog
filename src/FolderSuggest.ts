/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { AbstractInputSuggest, App, TFolder } from "obsidian";

// 模糊匹配：查询字符必须按顺序出现在目标字符串中
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// 文件夹建议下拉（继承 Obsidian 内置 AbstractInputSuggest）
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private onSave: (folderPath: string) => void;

  constructor(app: App, inputEl: HTMLInputElement, onSave: (folderPath: string) => void) {
    super(app, inputEl);
    this.limit = 20;
    this.onSave = onSave;
  }

  getSuggestions(query: string): TFolder[] {
    if (!query || query.trim().length < 1) return [];

    const folders = this.app.vault.getAllFolders();
    const matched = folders.filter((f) => fuzzyMatch(query, f.path));

    // 按相关性排序：完全匹配 > 前缀匹配 > 短路径优先
    matched.sort((a, b) => {
      const q = query.toLowerCase();
      const aPath = a.path.toLowerCase();
      const bPath = b.path.toLowerCase();

      const aExact = aPath === q ? 0 : 1;
      const bExact = bPath === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const aStarts = aPath.startsWith(q) ? 0 : 1;
      const bStarts = bPath.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;

      return a.path.length - b.path.length;
    });

    return matched.slice(0, this.limit);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.textContent = folder.path;
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.onSave(folder.path);
    this.close();
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- 结束 Obsidian API 和 Chart.js 类型安全规则禁用 */
