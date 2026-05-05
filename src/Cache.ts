import { Events, MetadataCache, TFile, Vault } from "obsidian";
import { CashlogEntry, EntryLocation } from "./EntryLocation";
import { parseCashlogLine } from "./CashlogSerializer";
import { isPathAllowed } from "./PathUtils";
import type { CashlogSettings } from "./Settings";

// 缓存系统：索引 Vault 中所有记账条目
export class Cache {
  private entries: CashlogEntry[] = [];
  private vault: Vault;
  private metadataCache: MetadataCache;
  private events: Events;
  private settings: CashlogSettings;
  private initialized = false;

  constructor(vault: Vault, metadataCache: MetadataCache, events: Events, settings: CashlogSettings) {
    this.vault = vault;
    this.metadataCache = metadataCache;
    this.events = events;
    this.settings = settings;
  }

  // 更新设置引用（设置变更后调用）
  updateSettings(settings: CashlogSettings): void {
    this.settings = settings;
  }

  // 获取所有记账条目
  getEntries(): CashlogEntry[] {
    return this.entries;
  }

  // 初始化：索引整个 Vault
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.reindex();
    this.initialized = true;
  }

  // 重新索引整个 Vault
  async reindex(): Promise<void> {
    const files = this.vault.getMarkdownFiles();
    const allEntries: CashlogEntry[] = [];

    for (const file of files) {
      if (!isPathAllowed(file.path, this.settings.excludePaths, this.settings.includePaths)) {
        continue;
      }
      const entries = await this.parseFile(file);
      allEntries.push(...entries);
    }

    this.entries = allEntries;
    this.events.trigger("cashlog-cache-update");
  }

  // 解析单个文件
  private async parseFile(file: TFile): Promise<CashlogEntry[]> {
    let content: string;
    try {
      content = await this.vault.cachedRead(file);
    } catch {
      return [];
    }

    const lines = content.split("\n");
    const entries: CashlogEntry[] = [];

    const fileCache = this.metadataCache.getFileCache(file);
    const headings = fileCache?.headings;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const entry = parseCashlogLine(line, null, this.settings);
      if (entry) {
        // 只有解析成功才创建 EntryLocation
        const location = new EntryLocation(
          file.path,
          i,
          i,
          0,
          this.findPrecedingHeading(headings, i),
        );
        entries.push(entry.clone({ location }));
      }
    }

    return entries;
  }

  // 查找某行之前最近的标题
  private findPrecedingHeading(
    headings: { heading: string; position: { start: { line: number } } }[] | undefined,
    lineNumber: number,
  ): string | null {
    if (!headings) return null;

    let lastHeading: string | null = null;
    for (const h of headings) {
      if (h.position.start.line < lineNumber) {
        lastHeading = h.heading;
      } else {
        break;
      }
    }
    return lastHeading;
  }

  // 处理文件修改事件（增量更新）
  async onFileChanged(file: TFile): Promise<void> {
    if (!isPathAllowed(file.path, this.settings.excludePaths, this.settings.includePaths)) {
      return;
    }
    const newEntries = await this.parseFile(file);
    // 移除旧条目，加入新条目
    this.entries = this.entries.filter((e) => e.location?.path !== file.path);
    this.entries.push(...newEntries);
    this.events.trigger("cashlog-cache-update");
  }

  // 处理文件创建事件（增量更新）
  async onFileCreated(file: TFile): Promise<void> {
    if (!isPathAllowed(file.path, this.settings.excludePaths, this.settings.includePaths)) {
      return;
    }
    const newEntries = await this.parseFile(file);
    this.entries.push(...newEntries);
    this.events.trigger("cashlog-cache-update");
  }

  // 处理文件删除事件（增量更新）
  onFileDeleted(file: TFile): void {
    this.entries = this.entries.filter((e) => e.location?.path !== file.path);
    this.events.trigger("cashlog-cache-update");
  }

  // 处理文件重命名事件（重新解析后用新路径替换旧路径条目）
  async onFileRenamed(file: TFile, oldPath: string): Promise<void> {
    if (!isPathAllowed(file.path, this.settings.excludePaths, this.settings.includePaths)) {
      // 新路径不在允许范围内，移除所有旧路径条目
      this.entries = this.entries.filter((e) => e.location?.path !== oldPath);
    } else {
      const newEntries = await this.parseFile(file);
      this.entries = this.entries.filter((e) => e.location?.path !== oldPath);
      this.entries.push(...newEntries);
    }
    this.events.trigger("cashlog-cache-update");
  }
}
