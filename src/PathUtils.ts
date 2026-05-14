/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
// 路径和 DOM 工具函数
import { tp } from "./i18n";

// 从路径提取笔记名（去掉目录和 .md 后缀）
export function extractNoteName(path: string): string {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.md$/, "");
}

// 渲染附件链接（用于查询结果和图表表格）
export function renderAttachmentLink(
  container: HTMLElement,
  attachment: string,
  attachmentFolder: string,
  onOpenFile: (fullPath: string) => void,
): HTMLElement {
  const parts = attachment.split("|");
  const fileName = parts[0];
  const displayName = parts.length > 1 ? parts[1] : fileName;
  const fullPath = `${attachmentFolder}/${fileName}`;
  const linkEl = container.createEl("a", {
    cls: "internal-link cashlog-attachment-link",
    text: `🧷${displayName}`,
    attr: {
      "data-href": fullPath,
      href: fullPath,
    },
  });
  linkEl.addEventListener("click", (e) => {
    e.preventDefault();
    onOpenFile(fullPath);
  });
  return linkEl;
}

// 检查文件路径是否被允许索引
export function isPathAllowed(
  filePath: string,
  excludePaths: string[],
  includePaths: string[],
): boolean {
  const lowerPath = filePath.toLowerCase();

  // 排除优先
  if (excludePaths.length > 0) {
    for (const excluded of excludePaths) {
      if (lowerPath.includes(excluded.trim().toLowerCase())) {
        return false;
      }
    }
    return true;
  }

  // 包含模式
  if (includePaths.length > 0) {
    for (const included of includePaths) {
      if (lowerPath.includes(included.trim().toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  // 都为空，允许所有
  return true;
}

// 检查查询路径过滤器是否与排除/包含设置冲突
export function checkPathFilterConflict(
  queryPath: string,
  excludePaths: string[],
  includePaths: string[],
): string | null {
  const lowerQuery = queryPath.toLowerCase();

  if (excludePaths.length > 0) {
    for (const excluded of excludePaths) {
      if (excluded.trim().toLowerCase() === lowerQuery) {
        return tp("error.pathExcluded", { path: queryPath });
      }
    }
  }

  if (includePaths.length > 0) {
    const isInIncludes = includePaths.some(
      (p) => p.trim().toLowerCase() === lowerQuery,
    );
    if (!isInIncludes) {
      return tp("error.pathNotIncluded", { path: queryPath });
    }
  }

  return null;
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
