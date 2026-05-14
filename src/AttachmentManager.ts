/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Obsidian API 和 Chart.js 类型在 ESLint 类型检查中无法完全解析 */
import { type App, type Vault } from "obsidian";
import { moment } from "./types";
import type { CashlogSettings } from "./Settings";

export class AttachmentManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: CashlogSettings,
  ) {}

  // 生成唯一附件文件名
  generateFileName(): string {
    return `cashlog-${moment().format("YYYYMMDDHHmmssSSS")}`;
  }

  // 确保附件文件夹存在
  async ensureAttachmentFolder(): Promise<void> {
    const folder = this.settings.attachmentFolder;
    const exists = this.vault.getAbstractFileByPath(folder);
    if (!exists) {
      await this.vault.createFolder(folder);
    }
  }

  // 保存上传的图片文件到 vault，返回 wikilink 字符串
  async saveAttachment(file: File): Promise<string> {
    await this.ensureAttachmentFolder();

    const baseName = this.generateFileName();
    // 保留原始文件扩展名
    const ext = file.name.includes(".") ? file.name.split(".").pop() || "png" : "png";
    const fileName = `${baseName}.${ext}`;
    const filePath = `${this.settings.attachmentFolder}/${fileName}`;

    // 读取文件内容为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 写入 vault
    await this.vault.createBinary(filePath, arrayBuffer);

    // 返回 wikilink 字符串（用于嵌入到记账行）
    return `${fileName}|附件`;
  }

  // 删除附件文件
  async deleteAttachment(fileName: string): Promise<void> {
    const filePath = `${this.settings.attachmentFolder}/${fileName}`;
    const file = this.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.fileManager.trashFile(file);
    }
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
