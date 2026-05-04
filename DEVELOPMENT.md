# Cashlog 插件开发文档

> 仿照 obsidian-tasks 插件架构，开发一个 Obsidian 记账插件。

---

## 一、功能概述

### 核心功能

1. **记账条目（Cashlog Entry）**：在 Markdown 列表项中记录收支信息
2. **创建/编辑命令**：通过 Modal 对话框快速输入描述、金额、日期、时间
3. **查询语法**：在代码块中查询和汇总记账数据
4. **标签分类**：通过标签区分收入/支出类别，支持子标签

### 记账条目格式

```
- #支出/交通 坐高铁 💴-100 ➕2026-04-25 ⏰17:30
- #收入/工资 发工资 💴10000 ➕2026-04-25 ⏰17:30
```

**格式规范**：
- 以列表标记开头（`-`、`*`、`+` 或 `1.`）
- 紧跟标签（`#支出/xxx` 或 `#收入/xxx`）
- 描述文本
- 💴 金额（正数=收入，负数=支出）
- ➕ 日期（YYYY-MM-DD）
- ⏰ 时间（HH:mm）
- 各字段用空格分隔

### 标签约定

- 支出标签：默认 `#支出`，可在设置中修改
- 收入标签：默认 `#收入`，可在设置中修改
- 支持子标签：`#支出/交通`、`#支出/餐饮`、`#收入/工资`、`#收入/理财`

---

## 二、项目结构

```
cashlog/
├── src/
│   ├── main.ts                    # 插件入口，注册命令、设置、代码块处理器
│   ├── CashlogEntry.ts            # CashlogEntry 数据模型
│   ├── CashlogRegex.ts            # 正则表达式定义
│   ├── CashlogSerializer.ts       # 序列化/反序列化（Markdown ↔ Entry 对象）
│   ├── Commands/
│   │   ├── index.ts               # 命令注册
│   │   └── CreateOrEdit.ts        # 创建/编辑命令实现
│   ├── Modal/
│   │   ├── CashlogModal.ts        # 编辑 Modal（继承 Obsidian Modal）
│   │   └── EditCashlog.svelte     # Svelte 表单组件
│   ├── EditableEntry.ts           # 可编辑的中间对象（Entry 不可变设计）
│   ├── Query/
│   │   ├── Query.ts               # 查询解析入口
│   │   ├── FilterParser.ts        # 过滤器解析器
│   │   └── Filter/                # 各字段过滤器
│   │       ├── Field.ts           # Field 基类
│   │       ├── AmountField.ts     # 金额过滤
│   │       ├── DateField.ts       # 日期过滤
│   │       ├── TagField.ts        # 标签过滤
│   │       └── DescriptionField.ts # 描述过滤
│   ├── Renderer/
│   │   ├── QueryRenderer.ts       # 代码块渲染入口
│   │   └── EntryLineRenderer.ts   # 单条记账渲染
│   ├── Cache/
│   │   └── Cache.ts               # Vault 文件缓存，监听变更
│   ├── Config/
│   │   ├── Settings.ts            # 设置数据模型
│   │   └── SettingsTab.ts         # 设置页面 UI
│   └── Suggestor/
│       └── CashlogSuggest.ts      # 编辑器自动建议
├── styles/
│   └── styles.css                 # 样式
├── manifest.json                  # 插件清单
├── versions.json                  # 版本兼容信息
├── package.json                   # npm 配置
├── tsconfig.json                  # TypeScript 配置
├── esbuild.config.mjs             # 构建配置
└── DEVELOPMENT.md                 # 本文档
```

---

## 三、数据模型

### 3.1 CashlogEntry

```typescript
// src/CashlogEntry.ts

export class CashlogEntry {
  // 基础字段
  readonly description: string;       // 描述文本（如 "坐高铁"）
  readonly amount: number;            // 金额（正=收入，负=支出）
  readonly date: moment.Moment | null;    // 日期
  readonly time: string | null;       // 时间 "HH:mm"
  readonly tags: string[];            // 标签列表

  // 结构字段
  readonly indentation: string;       // 缩进
  readonly listMarker: string;        // 列表标记（"-", "1." 等）
  readonly location: EntryLocation;   // 文件位置信息
  readonly originalMarkdown: string;  // 原始 Markdown 行

  // 派生属性（getter）
  get isIncome(): boolean;            // amount > 0
  get isExpense(): boolean;           // amount < 0
  get category(): string | null;      // 子标签（如 "交通"）
  get incomeTag(): string;            // 收入主标签
  get expenseTag(): string;           // 支出主标签
}
```

### 3.2 EntryLocation

```typescript
// src/EntryLocation.ts

export class EntryLocation {
  readonly path: string;              // 文件路径
  readonly lineNumber: number;        // 行号（1-based）
  readonly sectionStart: number;      // section 起始行
  readonly sectionIndex: number;      // section 内的索引
  readonly precedingHeader: string | null; // 上一个标题
}
```

### 3.3 设计原则

- **不可变性**：CashlogEntry 的所有字段为 `readonly`。修改时创建新实例。
- **从 Markdown 解析**：`CashlogEntry.fromLine(line, location)` 静态方法。
- **序列化回 Markdown**：`entry.toFileLineString()` 方法。

---

## 四、解析与序列化

### 4.1 正则表达式

```typescript
// src/CashlogRegex.ts

// 匹配列表行：缩进 + 列表标记 + 正文
export const listItemRegex = /^([\s\t>]*)([-*+]|[0-9]+[.)]) +(.*)/u;
// $1=缩进  $2=列表标记  $3=正文

// 金额：💴 后跟可选负号和数字（支持小数）
export const amountRegex = /\u{1F4B4}(-?\d+(?:\.\d{1,2})?)/u;
// 💴100  💴-100  💴12.50

// 日期：➕ 后跟 YYYY-MM-DD
export const dateRegex = /➕(\d{4}-\d{2}-\d{2})/u;
// ➕2026-04-25

// 时间：⏰ 后跟 HH:mm
export const timeRegex = /⏰(\d{2}:\d{2})/u;
// ⏰17:30

// 标签：#xxx 或 #xxx/yyy
export const tagRegex = /#([^\s#]+)/gu;
// #支出/交通  #收入/工资
```

### 4.2 解析流程（反序列化）

```
Markdown 行
  │
  ├─ 1. listItemRegex 提取 indentation, listMarker, body
  │
  ├─ 2. 从 body 末尾解析各 emoji 标记（从右向左剥离）
  │     ├─ timeRegex  提取 ⏰17:30 → time
  │     ├─ dateRegex  提取 ➕2026-04-25 → date
  │     └─ amountRegex 提取 💴-100 → amount
  │
  ├─ 3. tagRegex 从剩余文本提取所有标签 → tags[]
  │
  └─ 4. 剩余文本去掉标签部分 → description
```

**解析顺序**：从右向左（和 tasks 插件一致），因为 emoji 标记总在行尾。

### 4.3 序列化流程

```
CashlogEntry 对象
  │
  └─ 拼接字符串：
     indentation + listMarker + " " + tags.join(" ") + " " + description
     + " 💴" + amount + " ➕" + date + " ⏰" + time
```

**示例输出**：
```
- #支出/交通 坐高铁 💴-100 ➕2026-04-25 ⏰17:30
```

---

## 五、命令系统

### 5.1 注册命令

```typescript
// src/Commands/index.ts

export function addCommands(plugin: CashlogPlugin): void {
  plugin.addCommand({
    id: 'create-or-edit-cashlog',
    name: 'Create or edit cashlog',
    icon: 'yen-sign',
    editorCheckCallback: (checking, editor, view) => {
      return createOrEdit(checking, editor, view, plugin.app);
    },
  });
}
```

### 5.2 创建/编辑命令逻辑

```typescript
// src/Commands/CreateOrEdit.ts

export function createOrEdit(
  checking: boolean,
  editor: Editor,
  view: MarkdownView,
  app: App,
): boolean {
  // 1. 获取光标所在行
  const cursor = editor.getCursor();
  const lineNumber = cursor.line;
  const line = editor.getLine(lineNumber);

  // 2. 尝试解析为 CashlogEntry
  const entry = CashlogEntry.fromLine(line, ...);

  if (checking) {
    // 只检查是否可用（任何列表行或空行都可用）
    return true;
  }

  // 3. 打开编辑 Modal
  const onSubmit = (newEntry: CashlogEntry) => {
    const newLine = newEntry.toFileLineString();
    editor.setLine(lineNumber, newLine);
  };

  const modal = new CashlogModal(app, entry, onSubmit);
  modal.open();

  return true;
}
```

---

## 六、Modal 实现

### 6.1 Modal 类

```typescript
// src/Modal/CashlogModal.ts

import { Modal, App } from 'obsidian';
import CashlogEntry from '../CashlogEntry';

export class CashlogModal extends Modal {
  private entry: CashlogEntry | null;
  private onSubmit: (entry: CashlogEntry) => void;

  constructor(
    app: App,
    entry: CashlogEntry | null,
    onSubmit: (entry: CashlogEntry) => void,
  ) {
    super(app);
    this.entry = entry;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    this.titleEl.setText('创建或编辑记账');

    // 创建表单（可用 Svelte 或原生 HTML）
    const container = this.contentEl;

    // --- 标签选择 ---
    // 根据金额正负自动切换收入/支出标签
    // 支持选择子标签

    // --- 描述输入 ---

    // --- 金额输入 ---

    // --- 日期选择 ---

    // --- 时间输入 ---

    // --- 确认/取消按钮 ---
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

### 6.2 表单字段设计

| 字段 | 控件类型 | 说明 |
|------|---------|------|
| 标签 | 下拉选择 + 自定义输入 | 先选收入/支出主标签，再选或输入子标签 |
| 描述 | 文本输入 | 自由文本 |
| 金额 | 数字输入 | 正数=收入，负数=支出；切换收入/支出标签时自动调整正负号 |
| 日期 | 日期选择器 | 默认今天，弹出日历选择 |
| 时间 | 时间输入 | 格式 HH:mm |

### 6.3 表单交互逻辑

```
用户操作流程：
1. 选择标签（收入/支出 + 子标签）
   → 切换收入时，金额自动变正
   → 切换支出时，金额自动变负
2. 输入描述
3. 输入金额（输入正数，插件根据标签自动添加正负号）
4. 选择日期（默认今天）
5. 输入时间（可选）
6. 点击确认 → 序列化写入编辑器
```

---

## 七、查询语法

### 7.1 查询代码块

使用 `` ```cashlog ``` `` 代码块：

````markdown
```cashlog
# 本月支出汇总
tag includes #支出
date after 2026-04-01
sort by date descending
```
````

### 7.2 支持的查询指令

#### 过滤指令

| 指令 | 示例 | 说明 |
|------|------|------|
| `tag includes <标签>` | `tag includes #支出/交通` | 标签包含（支持子标签匹配） |
| `tag does not include <标签>` | `tag does not include #支出/餐饮` | 标签不包含 |
| `description includes <文本>` | `description includes 高铁` | 描述包含文本 |
| `description does not include <文本>` | `description does not include 工资` | 描述不包含文本 |
| `amount above <数值>` | `amount above 100` | 金额大于（绝对值） |
| `amount below <数值>` | `amount below 50` | 金额小于（绝对值） |
| `amount equals <数值>` | `amount equals 100` | 金额等于 |
| `date before <日期>` | `date before 2026-05-01` | 日期在...之前 |
| `date after <日期>` | `date after 2026-04-01` | 日期在...之后 |
| `date on <日期>` | `date on 2026-04-25` | 日期为某天 |
| `date this week` | `date this week` | 本周 |
| `date this month` | `date this month` | 本月 |
| `date this year` | `date this year` | 本年 |
| `is income` | `is income` | 仅收入 |
| `is expense` | `is expense` | 仅支出 |
| `path includes <路径>` | `path includes 日记/` | 文件路径包含 |
| `limit to <数量>` | `limit to 20` | 限制结果数量 |

#### 排序指令

| 指令 | 说明 |
|------|------|
| `sort by date ascending` | 按日期升序 |
| `sort by date descending` | 按日期降序 |
| `sort by amount ascending` | 按金额升序 |
| `sort by amount descending` | 按金额降序 |
| `sort by description ascending` | 按描述排序 |

#### 汇总指令

| 指令 | 说明 |
|------|------|
| `show total` | 显示总金额 |
| `show total income` | 显示总收入 |
| `show total expense` | 显示总支出 |
| `show balance` | 显示余额（收入-支出） |
| `show count` | 显示条目数量 |
| `group by tag` | 按标签分组 |
| `group by date` | 按日期分组 |
| `group by month` | 按月份分组 |
| `group by year` | 按年份分组 |

#### 显示控制

| 指令 | 说明 |
|------|------|
| `hide date` | 隐藏日期列 |
| `hide time` | 隐藏时间列 |
| `hide tag` | 隐藏标签列 |
| `hide amount` | 隐藏金额列 |

### 7.3 查询解析实现

```typescript
// src/Query/Query.ts

export class Query {
  private filters: Filter[] = [];
  private sorters: Sorter[] = [];
  private groupers: Grouper[] = [];
  private limit: number = Infinity;
  private displayOptions: DisplayOptions = {};
  private summaryOptions: SummaryOptions = {};

  constructor(source: string) {
    const lines = source.split('\n');
    for (const line of lines) {
      this.parseLine(line.trim());
    }
  }

  private parseLine(line: string): void {
    if (line === '' || line.startsWith('#')) return; // 空行或注释

    // 按优先级匹配
    if (this.parseSort(line)) return;
    if (this.parseGroup(line)) return;
    if (this.parseLimit(line)) return;
    if (this.parseDisplay(line)) return;
    if (this.parseSummary(line)) return;
    if (this.parseFilter(line)) return;

    // 未知指令报错
    this.error = `未知指令: ${line}`;
  }

  apply(entries: CashlogEntry[]): QueryResult {
    // 1. 过滤
    let filtered = entries.filter(e => this.filters.every(f => f.filter(e)));
    // 2. 排序
    filtered = this.sort(filtered);
    // 3. 限制
    filtered = filtered.slice(0, this.limit);
    // 4. 分组
    const groups = this.group(filtered);
    // 5. 汇总
    const summary = this.summarize(filtered);
    return { groups, summary };
  }
}
```

### 7.4 Field 基类模式（仿 tasks）

```typescript
// src/Query/Filter/Field.ts

export abstract class Field {
  // 该字段是否能解析此行
  abstract canCreateFilterForLine(line: string): boolean;

  // 从行创建过滤器
  abstract createFilterOrErrorMessage(line: string): FilterOrErrorMessage;

  // 辅助：正则匹配
  protected match(line: string, regex: RegExp): RegExpMatchArray | null {
    return line.match(regex);
  }
}

// src/Query/Filter/AmountField.ts
export class AmountField extends Field {
  canCreateFilterForLine(line: string): boolean {
    return /amount\s+(above|below|equals)\s/.test(line);
  }

  createFilterOrErrorMessage(line: string): FilterOrErrorMessage {
    const match = line.match(/amount\s+(above|below|equals)\s+(-?\d+(?:\.\d+)?)/);
    if (!match) return { error: '无法解析金额过滤: ' + line };

    const [, operator, valueStr] = match;
    const value = parseFloat(valueStr);

    return {
      filter: (entry: CashlogEntry) => {
        switch (operator) {
          case 'above': return Math.abs(entry.amount) > value;
          case 'below': return Math.abs(entry.amount) < value;
          case 'equals': return Math.abs(entry.amount) === value;
        }
      },
    };
  }
}
```

---

## 八、设置系统

### 8.1 设置数据结构

```typescript
// src/Config/Settings.ts

export interface CashlogSettings {
  // 标签配置
  incomeTag: string;              // 收入标签，默认 "#收入"
  expenseTag: string;             // 支出标签，默认 "#支出"

  // 子标签预设（用于 Modal 中的下拉选择）
  incomeSubTags: string[];        // 如 ["工资", "理财", "兼职", "红包", "其他"]
  expenseSubTags: string[];       // 如 ["餐饮", "交通", "购物", "娱乐", "住房", "医疗", "教育", "其他"]

  // 显示配置
  defaultShowDate: boolean;       // 默认显示日期
  defaultShowTime: boolean;       // 默认显示时间
  currencySymbol: string;         // 货币符号，默认 "💴"

  // 全局过滤器（类似 tasks 的 globalFilter）
  globalFilter: string;           // 为空表示所有列表项都可解析

  // 全局查询（每次查询前自动追加的指令）
  globalQuery: string;            // 默认为空
}

export const DEFAULT_SETTINGS: CashlogSettings = {
  incomeTag: '#收入',
  expenseTag: '#支出',
  incomeSubTags: ['工资', '理财', '兼职', '红包', '其他'],
  expenseSubTags: ['餐饮', '交通', '购物', '娱乐', '住房', '医疗', '教育', '其他'],
  defaultShowDate: true,
  defaultShowTime: false,
  currencySymbol: '💴',
  globalFilter: '',
  globalQuery: '',
};
```

### 8.2 设置页面

```typescript
// src/Config/SettingsTab.ts

export class CashlogSettingsTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- 标签设置 ---
    containerEl.createEl('h2', { text: '标签设置' });

    new Setting(containerEl)
      .setName('收入标签')
      .setDesc('收入条目的主标签名')
      .addText(text => text
        .setValue(settings.incomeTag)
        .onChange(async (value) => {
          updateSettings({ incomeTag: value });
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('支出标签')
      .setDesc('支出条目的主标签名')
      .addText(text => text
        .setValue(settings.expenseTag)
        .onChange(async (value) => {
          updateSettings({ expenseTag: value });
          await this.plugin.saveSettings();
        }));

    // --- 子标签预设 ---
    containerEl.createEl('h2', { text: '子标签预设' });

    new Setting(containerEl)
      .setName('收入子标签')
      .setDesc('用逗号分隔，如：工资,理财,兼职')
      .addText(text => text
        .setValue(settings.incomeSubTags.join(','))
        .onChange(async (value) => {
          updateSettings({ incomeSubTags: value.split(',').map(s => s.trim()).filter(Boolean) });
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('支出子标签')
      .setDesc('用逗号分隔，如：餐饮,交通,购物')
      .addText(text => text
        .setValue(settings.expenseSubTags.join(','))
        .onChange(async (value) => {
          updateSettings({ expenseSubTags: value.split(',').map(s => s.trim()).filter(Boolean) });
          await this.plugin.saveSettings();
        }));
  }
}
```

---

## 九、缓存系统

### 9.1 设计思路

仿照 tasks 的 Cache，监听 Vault 变更，维护一个所有 CashlogEntry 的内存索引。

```typescript
// src/Cache/Cache.ts

export class Cache {
  private tasks: CashlogEntry[] = [];
  private mutex: Mutex;  // 使用 async-mutex 保证线程安全

  constructor(private plugin: CashlogPlugin) {
    // 监听文件变更
    plugin.registerEvent(
      plugin.app.metadataCache.on('resolved', () => this.reindex())
    );
    plugin.registerEvent(
      plugin.app.metadataCache.on('changed', (file) => this.onFileChanged(file))
    );
    plugin.registerEvent(
      plugin.app.vault.on('create', (file) => this.onFileCreated(file))
    );
    plugin.registerEvent(
      plugin.app.vault.on('delete', (file) => this.onFileDeleted(file))
    );
    plugin.registerEvent(
      plugin.app.vault.on('rename', (file, oldPath) => this.onFileRenamed(file, oldPath))
    );
  }

  // 获取所有记账条目
  getEntries(): CashlogEntry[] {
    return this.tasks;
  }

  // 重新索引整个 Vault
  private async reindex(): Promise<void> { ... }

  // 解析单个文件
  private parseFile(file: TFile): CashlogEntry[] { ... }
}
```

### 9.2 文件解析

```typescript
private parseFile(file: TFile): CashlogEntry[] {
  const content = await this.plugin.app.vault.read(file);
  const lines = content.split('\n');
  const entries: CashlogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const entry = CashlogEntry.fromLine(line, new EntryLocation(file.path, i + 1));
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}
```

---

## 十、渲染系统

### 10.1 代码块注册

```typescript
// src/main.ts

export class CashlogPlugin extends Plugin {
  async onload() {
    // 注册代码块处理器
    this.registerMarkdownCodeBlockProcessor('cashlog', (source, el, ctx) => {
      this.app.workspace.onLayoutReady(() => {
        this.renderQuery(source, el, ctx);
      });
    });
  }

  private renderQuery(source: string, el: HTMLElement, ctx: MarkdownRenderChild) {
    const query = new Query(source);
    const entries = this.cache.getEntries();
    const result = query.apply(entries);
    // 渲染结果到 el
    new QueryRenderer(el, result, query).render();
  }
}
```

### 10.2 结果渲染

```
┌──────────────────────────────────────────┐
│  本月支出汇总                              │
│                                          │
│  📅 2026-04-25  ⏰17:30                  │
│  #支出/交通  坐高铁  💴-100               │
│                                          │
│  📅 2026-04-24  ⏰12:00                  │
│  #支出/餐饮  午饭  💴-25                  │
│                                          │
│  ─────────────────────                   │
│  合计：支出 💴-125                        │
│  共 2 条记录                              │
└──────────────────────────────────────────┘
```

### 10.3 EntryLineRenderer

```typescript
// src/Renderer/EntryLineRenderer.ts

export class EntryLineRenderer {
  render(entry: CashlogEntry, containerEl: HTMLElement): void {
    const li = containerEl.createEl('li', { cls: 'cashlog-entry' });

    // 标签
    const tagSpan = li.createEl('span', {
      cls: 'cashlog-tag',
      text: entry.tags.join(' '),
    });

    // 描述
    const descSpan = li.createEl('span', {
      cls: 'cashlog-description',
      text: entry.description,
    });

    // 金额
    const amountSpan = li.createEl('span', {
      cls: entry.isExpense ? 'cashlog-amount-expense' : 'cashlog-amount-income',
      text: `💴${entry.amount}`,
    });

    // 日期
    if (entry.date) {
      li.createEl('span', {
        cls: 'cashlog-date',
        text: `➕${entry.date.format('YYYY-MM-DD')}`,
      });
    }

    // 时间
    if (entry.time) {
      li.createEl('span', {
        cls: 'cashlog-time',
        text: `⏰${entry.time}`,
      });
    }
  }
}
```

---

## 十一、自动建议（Suggestor）

### 11.1 编辑器内自动补全

当用户在编辑器中输入列表项并开始输入 `#支出` 或 `#收入` 时，弹出子标签建议。

```typescript
// src/Suggestor/CashlogSuggest.ts

export class CashlogSuggest extends EditorSuggest<string> {
  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
    // 检查当前行是否为列表项，且光标后是否刚输入了 #支出 或 #收入
    const line = editor.getLine(cursor.line);
    const subStr = line.substring(0, cursor.ch);

    if (/#(支出|收入)\/?$/.test(subStr)) {
      return { start: ..., end: cursor, query: ... };
    }
    return null;
  }

  getSuggestions(context: EditorSuggestContext): string[] {
    // 返回匹配的子标签列表
  }
}
```

---

## 十二、构建配置

### 12.1 package.json

```json
{
  "name": "obsidian-cashlog",
  "version": "0.1.0",
  "description": "在 Obsidian 中记录和查询收支流水",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^16.11.6",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.17.19",
    "obsidian": "latest",
    "tslib": "2.4.0",
    "typescript": "4.7.4"
  }
}
```

### 12.2 manifest.json

```json
{
  "id": "obsidian-cashlog",
  "name": "Cashlog",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "在 Obsidian 中记录和查询收支流水，支持标签分类和查询语法",
  "author": "YourName",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

### 12.3 tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES5", "ES6", "ES7"]
  },
  "include": ["**/*.ts"]
}
```

### 12.4 esbuild.config.mjs

```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
}).catch(() => process.exit(1));
```

---

## 十三、开发路线图

### 阶段一：基础功能（MVP）

1. 初始化项目结构（package.json, tsconfig, esbuild, manifest）
2. 实现 `CashlogEntry` 数据模型
3. 实现解析和序列化（Markdown ↔ Entry）
4. 实现 `create-or-edit-cashlog` 命令
5. 实现 Modal 编辑对话框（原生 HTML 先实现，后续可迁移到 Svelte）
6. 实现基础设置页面（标签配置）

### 阶段二：查询功能

7. 实现 Cache 系统（Vault 文件索引）
8. 实现查询解析器（Query 类）
9. 实现过滤器（AmountField, DateField, TagField, DescriptionField）
10. 实现排序和分组
11. 实现代码块渲染器（`cashlog` 代码块）
12. 实现汇总统计（total, balance, count）

### 阶段三：增强功能

13. 实现自动建议（Suggestor）
14. 实现编辑器内快速输入（如输入 `##` 触发记账）
15. 支持多币种
16. 支持图表展示（用 Canvas API 或 Chart.js）
17. 导出为 CSV/Excel

---

## 十四、样式参考

```css
/* styles/styles.css */

/* 记账条目 */
.cashlog-entry {
  list-style: none;
  padding: 4px 0;
}

/* 金额 */
.cashlog-amount-expense {
  color: #e74c3c;
  font-weight: bold;
}

.cashlog-amount-income {
  color: #27ae60;
  font-weight: bold;
}

/* 标签 */
.cashlog-tag {
  background: var(--tag-background);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.9em;
}

/* 日期时间 */
.cashlog-date,
.cashlog-time {
  color: var(--text-muted);
  font-size: 0.85em;
}

/* 汇总 */
.cashlog-summary {
  border-top: 1px solid var(--background-modifier-border);
  padding-top: 8px;
  margin-top: 8px;
  font-weight: bold;
}

.cashlog-summary-expense {
  color: #e74c3c;
}

.cashlog-summary-income {
  color: #27ae60;
}

.cashlog-summary-balance {
  color: var(--text-normal);
}
```

---

## 十五、与 tasks 插件的架构对照

| tasks 概念 | cashlog 对应 | 说明 |
|-----------|-------------|------|
| `Task` | `CashlogEntry` | 核心数据模型 |
| `TaskSerializer` | `CashlogSerializer` | 解析/序列化 |
| `TaskModal` | `CashlogModal` | 编辑对话框 |
| `EditTask.svelte` | `EditCashlog.svelte` | 表单 UI |
| `EditableTask` | `EditableEntry` | 可编辑中间对象 |
| `Status` | 标签（收入/支出） | 分类方式 |
| `Priority` | 金额（正/负） | 核心数值字段 |
| `dueDateSymbol 📅` | `dateSymbol ➕` | 日期标记 |
| 无对应 | `timeSymbol ⏰` | 时间标记 |
| `amountSymbol 无` | `amountSymbol 💴` | 金额标记 |
| `Query` | `Query` | 查询解析（几乎一致） |
| `FilterParser` | `FilterParser` | 过滤器解析（几乎一致） |
| `Cache` | `Cache` | 文件缓存（几乎一致） |
| `QueryRenderer` | `QueryRenderer` | 代码块渲染（几乎一致） |
