# Cashlog User Manual

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Creating Cashlog Entries](#creating-cashlog-entries)
  - [Using Commands](#using-commands)
  - [Manual Entry](#manual-entry)
  - [Inserting Charts](#inserting-charts)
- [Entry Format Reference](#entry-format-reference)
  - [Basic Format](#basic-format)
  - [Format with Account](#format-with-account)
  - [Transfer Format](#transfer-format)
  - [Balance Adjustment Format](#balance-adjustment-format)
  - [Format with Attachments](#format-with-attachments)
- [Account Feature](#account-feature)
  - [Enabling Accounts](#enabling-accounts)
  - [Using Accounts for Tracking](#using-accounts-for-tracking)
  - [Transfers](#transfers)
  - [Balance Adjustments](#balance-adjustments)
  - [Account Balances](#account-balances)
- [Attachment Feature](#attachment-feature)
  - [Uploading Attachments](#uploading-attachments)
  - [Attachment Storage Format](#attachment-storage-format)
- [Plugin Settings](#plugin-settings)
- [Cashlog Panel](#cashlog-panel)
  - [Opening the Panel](#opening-the-panel)
  - [Dashboard](#dashboard)
  - [Panel Settings](#panel-settings)
- [Budgets and Goals](#budgets-and-goals)
  - [Setting a Budget](#setting-a-budget)
  - [Setting a Goal](#setting-a-goal)
- [Query Syntax](#query-syntax)
  - [Basic Structure](#basic-structure)
  - [Filter Directives](#filter-directives)
  - [Sort Directives](#sort-directives)
  - [Group Directives](#group-directives)
  - [Summary Directives](#summary-directives)
  - [Display Controls](#display-controls)
  - [Table Configuration](#table-configuration)
  - [Limiting Results](#limiting-results)
  - [Comments](#comments)
- [Complete Query Examples](#complete-query-examples)
- [Workflow Suggestions](#workflow-suggestions)
- [FAQ](#faq)

---

## Installation

1. Copy the `cashlog` folder to your Obsidian vault's `.obsidian/plugins/obsidian-cashlog/` directory
2. The folder should contain three files: `main.js`, `manifest.json`, and `styles.css`
3. Open Obsidian → Settings → Community Plugins → Refresh list
4. Find **Cashlog** and enable it

---

## Quick Start

**Step 1: Record an Entry**

Press `Ctrl+P` to open the command palette, search for `Create or edit cashlog`, and press Enter. In the dialog that appears, fill in:

1. Type: Select "Expense" or "Income"
2. Tag: Select a sub-tag (e.g., "Transport")
3. Description: Enter a description (e.g., "High-speed train")
4. Amount: Enter a positive number (e.g., `100`)
5. Date: Select a date
6. Time: Optional, enter in `HH:mm` format

After clicking confirm, the current cursor line will be replaced with a cashlog entry:

```
- #expense/transport high-speed train 💴-100 ➕2026-04-25 ⏰17:30
```

**Step 2: Query Cashlog Data**

Create a `cashlog` code block in any note:

````markdown
```cashlog
is expense
date this month
sort by date descending
show total
```
````

Switch to Reading Mode to see the query results.

**Step 3: Open the Cashlog Panel**

`Ctrl+P` → Search for "Open Cashlog Panel" → Press Enter to view the dashboard and statistics in a new tab on the right.

---

## Creating Cashlog Entries

### Using Commands

1. Place the cursor on any blank line in the editor
2. `Ctrl+P` → Type `Create or edit cashlog` → Press Enter
3. Fill in the information in the dialog and confirm

### Manual Entry

You can also write cashlog entries directly in the editor following the format, and the plugin will recognize them automatically.

### Inserting Charts

In addition to the `cashlog` query code block, the plugin also provides a `cashlog-chart` code block for inserting tables, bar charts, line charts, or pie charts into notes.

1. Place the cursor on any blank line in the editor
2. `Ctrl+P` → Type `Insert cashlog chart` → Press Enter
3. Configure in the dialog that appears:
   - **Filter conditions**: Type (multi-select), tags, description, amount range, date range, path
   - **Chart type**: Select "Table", "Bar Chart", "Line Chart", or "Pie Chart"
   - Additional options will appear based on the selected type (tables have column configuration, bar charts have X-axis and sub-group options, etc.)
4. Click "Insert"

**Table Example**:

````markdown
```cashlog-chart
is expense
date this month
sort by date descending
show summary
table columns 6
col1 date "Date" left
col2 amount "Amount" left
col3 account "Account" left
col4 description "Description" left
col5 attachment "Attachment" left
col6 link "Link" left
```
````

**Bar Chart Example**:

````markdown
```cashlog-chart
group by month
chart type bar
chart title "Monthly Income vs Expense"
chart bar split by valueType
chart legend true
chart labels true
```
````

`cashlog-chart` shares the exact same query syntax as `cashlog`, with additional support for the following directives.

#### Table-Specific Directives

| Directive | Description |
|------|------|
| `show summary` | Show summary of total income / total expense / net balance |
| `show group subtotal` | Show subtotals at the end of each group when grouped |
| `show tag in description` | Show tags in the description column |
| `table columns N` | Set the number of table columns (1-6) |
| `colN field ["header"] [alignment]` | Configure the content displayed in each column |

#### Pie Charts

Pie chart grouping is controlled by the `group by` directive in the query section. The value type adjusts based on the grouping method:

**By Tag / By Type**: Values are always absolute amounts; hovering shows the actual signed value. Transfer and balance adjustment entries are automatically excluded. No `chart value` directive is needed.

````markdown
```cashlog-chart
date this month
group by tag
chart type pie
chart title "Expense Category Breakdown This Month"
chart legend true
```
````

**By Date / Week / Month / Year**: Must specify a value type.

| `chart value` | Description |
|------|------|
| `income` | Income |
| `expense` | Expense |
| `balance` | Net balance (income + expense) |

All three exclude transfer and balance adjustment entries.

**By Account**: Supports six value types.

| `chart value` | Scope | Includes Transfers/Balance Adjustments |
|------|------|:---:|
| `income` | Income | No |
| `expense` | Expense | No |
| `balance` | Net balance | No |
| `inflow` | Inflow (all positive amounts for the account) | Yes |
| `outflow` | Outflow (all negative amounts for the account) | Yes |
| `netflow` | Inflow - Outflow | Yes |

#### Line Charts / Bar Charts

Line charts and bar charts share the same dual-dimension grouping syntax: the X-axis determines the primary grouping (controlled by the `group by` directive in the query section), and sub-grouping determines the multiple lines or bars within each group.

**X-axis grouping** is controlled by the `group by` directive. Bar charts support all grouping methods; line charts only support time dimensions (month/week/date/year):

| `group by` value | Bar Chart | Line Chart | Description |
|------|:---:|:---:|------|
| `month` | ✓ | ✓ | By month |
| `week` | ✓ | ✓ | By week |
| `date` | ✓ | ✓ | By date |
| `year` | ✓ | ✓ | By year |
| `tag` | ✓ | — | By tag |
| `account` | ✓ | — | By account |
| `type` | ✓ | — | By type |

**Sub-grouping** is controlled by `chart bar split by` or `chart line split by` directives:

| Directive | Description |
|------|------|
| `chart bar split by none` / `chart line split by none` | No grouping, show net balance (default) |
| `chart bar split by valueType` / `chart line split by valueType` | Split by value type (net balance / income / expense) |
| `chart bar split by tag` / `chart line split by tag` | Split by tag; requires `chart bar items` / `chart line items` |
| `chart bar split by account` / `chart line split by account` | Split by account; requires `chart bar items` / `chart line items` |
| `chart bar split by type` / `chart line split by type` | Split by type (income / expense) |
| `chart bar split by date` | Split by date (auto-collected), bar chart only |
| `chart bar split by week` | Split by week (auto-collected), bar chart only |
| `chart bar split by month` | Split by month (auto-collected), bar chart only |
| `chart bar split by year` | Split by year (auto-collected), bar chart only |
| `chart bar items` / `chart line items item1 item2 …` | Specify sub-group items (for tag / account splitting) |

**Chart Common Directives**:

| Directive | Description |
|------|------|
| `chart type bar` / `line` / `pie` | Set chart type |
| `chart title "title"` | Chart title |
| `chart width 800` | Chart width (px, default 600) |
| `chart height 400` | Chart height (px, default 400) |
| `chart legend true` / `false` | Whether to show legend (default true) |
| `chart labels true` / `false` | Whether to show data labels (default true) |

#### Enhanced Type Filtering

Filter conditions support multi-type OR queries using `type includes`:

```
type includes income OR expense
```

This directive is automatically generated when you select 2-3 types in the insert chart dialog.

---

## Entry Format Reference

### Basic Format

A cashlog entry is essentially a Markdown list item, with each part separated by spaces:

```
- #expense/transport high-speed train 💴-100 ➕2026-04-25 ⏰17:30
```

Explanation of each part:

| Part | Format | Required | Description |
|------|------|---------|------|
| `-` | `-`, `*`, `+`, or `1.` | Yes | Markdown list marker |
| `#expense/transport` | `#MainTag/SubTag` | Yes | Tag, distinguishing income/expense and specific category |
| `high-speed train` | Free text | No | Description text |
| `💴-100` | `💴` + signed number | Yes | Amount marker + amount value |
| `➕2026-04-25` | `➕` + YYYY-MM-DD | No | Date marker |
| `⏰17:30` | `⏰` + HH:mm | No | Time marker |

**More Examples**:

```
- #income/salary salary payment 💴10000 ➕2026-04-25 ⏰17:30
1. #expense/food lunch 💴-25 ➕2026-04-25
- #expense/shopping buy books 💴-89.5 ➕2026-04-24 ⏰10:00
- #income/investment fund returns 💴120 ➕2026-04-23
* #expense/entertainment movie 💴-60
```

**Amount Rules**:
- Positive number = Income (e.g., `💴10000`, `💴120`)
- Negative number = Expense (e.g., `💴-100`, `💴-25`)
- Decimals supported (up to two places, e.g., `💴-89.5`)

### Format with Account

When the account feature is enabled, entries will include the `💳` account marker:

```
- #expense buy clothes 💳WeChat💴-200 ➕2026-04-25
- #income reimbursement 💳Bank of China card💴200 ➕2026-04-25
```

| Part | Format | Description |
|------|------|------|
| `💳WeChat💴-200` | `💳` + Account name + `💴` + Amount | Marks the account and amount for this transaction |

### Transfer Format

A transfer is a special entry type that has two accounts and two amounts in one line:

```
- #transfer credit card repayment 💳Alipay💴-500 💳ICBC credit card💴500 ➕2026-04-25
```

| Part | Description |
|------|------|
| `#transfer` | Transfer-specific tag |
| `credit card repayment` | Description |
| `💳Alipay💴-500` | Source account + transfer-out amount (negative indicates funds leaving) |
| `💳ICBC credit card💴500` | Destination account + transfer-in amount (positive indicates funds arriving) |

### Balance Adjustment Format

Balance adjustments are used to record corrections to account balances (e.g., after reconciliation when the balance doesn't match). The format is similar to transfers but uses the `#balance-change` tag (customizable):

```
- #balance-change adjust balance 💳Alipay💴50 ➕2026-04-25
```

| Part | Description |
|------|------|
| `#balance-change` | Balance adjustment-specific tag (customizable in settings) |
| `adjust balance` | Description |
| `💳Alipay💴50` | Account + the difference between target balance and current balance |

Balance adjustment characteristics:
- Not counted in income or expense statistics
- Only affects account balance
- When created, the plugin automatically calculates the difference between current balance and target balance

### Format with Attachments

When the attachment feature is enabled, you can attach image files to cashlog entries:

```
- #expense buy clothes 💳WeChat💴-200 🧷[[cashlog-2026042517303050|receipt]] ➕2026-04-25
- #income reimbursement 💳Bank of China card💴200 🧷[[cashlog-2026042517311520|receipt 1]] 🧷[[cashlog-2026042517313001|receipt 2]] ➕2026-04-25
```

| Part | Format | Description |
|------|------|------|
| `🧷[[filename\|display name]]` | 🧷 + wikilink | Attachment link, supports multiple |

---

## Account Feature

The account feature helps you track which account each transaction belongs to (WeChat, Alipay, bank cards, etc.) and automatically calculates the balance for each account.

### Enabling Accounts

1. Open Cashlog Panel → Settings → Account Settings (or Settings → Community Plugins → Cashlog)
2. Toggle on the "Enable account feature" switch
3. Click the `+` button to add accounts one by one (e.g., WeChat, Alipay, Cash, Bank Card)
4. Set the initial balance for each account (click the balance button to edit)

After enabling, the following changes occur:
- The type dropdown in the create/edit dialog will include "Transfer" and "Balance Adjustment" options
- An "Account" dropdown selector will appear in the create/edit dialog
- Entries will contain the `💳AccountName💴Amount` marker

### Using Accounts for Tracking

In the create or edit entry dialog:

1. Select the type (Expense/Income)
2. Select an account from the "Account" dropdown
3. Fill in the remaining fields and confirm

Generated entry examples:

```
- #expense buy clothes 💳WeChat💴-200 🧷[[cashlog-2026042517303050|receipt]] ➕2026-04-25
- #income reimbursement 💳Bank of China card💴200 ➕2026-04-25
```

### Transfers

Transfers record the movement of funds between accounts without creating actual income or expense.

In the create entry dialog:

1. Select "Transfer" as the type
2. Select the "Source account" and "Destination account"
3. Enter the transfer amount

Generated transfer entry example:

```
- #transfer credit card repayment 💳Alipay💴-500 💳ICBC credit card💴500 ➕2026-04-25
```

### Balance Adjustments

Balance adjustments are used to correct account balances (e.g., after reconciliation when the balance doesn't match).

In the create entry dialog:

1. Select "Balance Adjustment" as the type
2. Select the account to adjust
3. Enter the **target balance** for that account
4. The plugin will display the current balance and calculate the difference

Generated balance adjustment entry example:

```
- #balance-change adjust balance 💳Alipay💴50 ➕2026-04-25
```

> Here `💳Alipay💴50` means the difference between the target balance and current balance is 50. The plugin automatically calculates this difference at creation time.

### Account Balances

Account balance = Initial balance + All income for the account - All expenses for the account + Transfer-in amounts - Transfer-out amounts.

- Initial balances are set individually for each account in **Cashlog Panel → Settings**
- Balance changes are reflected in real-time in the "Account Balances" section of **Cashlog Panel → Dashboard**

---

## Attachment Feature

### Enabling Attachments

1. Open Settings → Community Plugins → Cashlog
2. Find the "Attachment Settings" section
3. Toggle on the "Enable attachment feature" switch
4. Optionally customize the "Attachment storage directory" (default is `cashlog-attachments`)

### Uploading Attachments

In the create or edit entry dialog:

1. Click the "📎 Add Attachment" button
2. Select one or more images
3. Images will be automatically uploaded to the vault's attachment directory
4. You can continue adding or click ✕ to remove

### Attachment Storage Format

- Image files are saved in the attachment directory with the naming format `cashlog-YYYYMMDDHHmmssSSS.png`
- Entries store wikilink references: `🧷[[cashlog-2026042517303050|receipt]]`
- Clicking attachment links in query results opens the corresponding image file
- A single entry supports multiple image attachments (multiple `🧷[[...]]` markers)

---

## Plugin Settings

Open Settings → Community Plugins → Cashlog (gear icon):

### Tag Settings

Tag settings are located in **Cashlog Panel → Settings → Tag Settings** (also editable in the native Obsidian settings page).

Each tag name is displayed as a button; clicking the button opens an edit dialog:

| Setting | Default | Description |
|--------|--------|------|
| Income tag | `income` | Main tag name for income entries; modifying will auto-migrate all historical records |
| Expense tag | `expense` | Main tag name for expense entries; modifying will auto-migrate all historical records |
| Transfer tag | `transfer` | Dedicated tag for transfer entries (visible after enabling account feature) |
| Balance adjustment tag | `balance-change` | Dedicated tag for balance adjustment entries (visible after enabling account feature) |

> **Note**: Tag names are stored with a `#` prefix in entries, but the edit dialog displays and accepts names without the `#`.
>
> When modifying a tag name, the plugin automatically scans and replaces the old tag in all historical entries. For example, changing "income" to `earnings` will convert all `#income/salary` to `#earnings/salary`.

**Tag Name Rules**: Supports Chinese characters, English letters, numbers, underscores (`_`), and hyphens (`-`). Cannot contain spaces or be purely numeric (e.g., `#1984` is invalid, `#y1984` is valid).

### Sub-Tag Presets

Sub-tags are used for quick category selection when creating entries, displayed as a chip button list:

| Setting | Default | Description |
|--------|--------|------|
| Income sub-tags | `salary, investment, part-time, red envelope, other` | Category options for income entries |
| Expense sub-tags | `food, transport, shopping, entertainment, housing, medical, education, other` | Category options for expense entries |

**Operations**:

| Action | Method | Description |
|------|------|------|
| Add sub-tag | Click the `+` button | Enter a name and confirm; the new sub-tag will be saved to settings |
| Edit sub-tag | Right-click chip → "Edit sub-tag" | After editing, all related entries are auto-migrated. If the new name duplicates an existing sub-tag, you'll be prompted to merge; if empty, you'll be prompted to merge into the base tag (e.g., `#income`) |
| Delete sub-tag | Right-click chip → "Delete" | After confirmation, all entries under that sub-tag will be deleted; this action is irreversible |

> **Auto-discovery**: The plugin automatically scans cashlog entries in the vault and displays sub-tags found in the cache but not configured in settings (shown with a dashed border style) for easy management.
>
> **Default sub-tags**: The system's initial default sub-tags can be deleted or renamed; once modified, they will not automatically reappear.

### Account Settings

Account settings are located in **Cashlog Panel → Settings → Account Settings** (also editable in the native Obsidian settings page).

| Setting | Default | Description |
|--------|--------|------|
| Enable account feature | Off | When enabled, entries can be associated with accounts, supporting transfer and balance adjustment types |
| Account list | `WeChat, Alipay, Cash, Bank Card` | Displayed as a chip button list; right-click menu supports editing and deleting; click `+` to add |

**Account Name Operations**:

| Action | Method | Description |
|------|------|------|
| Add account | Click the `+` button | Enter a name and confirm; balance is automatically initialized to 0. Cannot contain emoji, max 25 characters |
| Rename account | Right-click chip → "Rename account" | After renaming, all historical entries are auto-migrated; balance is transferred |
| Delete account | Right-click chip → "Delete" | Select a target account; all entries under the deleted account will be transferred to the target account, and balances will be merged |

**Account Initial Balance**: Each account's initial balance is displayed as a button; clicking it opens an edit dialog. The dialog suggests not modifying the initial balance directly and recommends creating a "Balance Adjustment" entry instead.

> **Auto-discovery**: The plugin automatically scans cashlog entries in the vault and displays accounts found in the cache but not configured in settings (shown with a dashed border style) for easy management.

### Attachment Settings

| Setting | Default | Description |
|--------|--------|------|
| Enable attachment feature | Off | When enabled, entries can have image attachments uploaded |
| Attachment storage directory | `cashlog-attachments` | Folder path for storing attachment images; auto-fuzzy-matches existing vault folders as you type |

### Budget Settings

| Setting | Default | Description |
|--------|--------|------|
| Enable budget feature | Off | When enabled, you can set spending budgets and track progress in the panel |
| Budget list | (empty) | Add multiple budgets, each with: name, amount, period (weekly/monthly/yearly/custom), associated tag. Tags are selected from a dropdown (includes all expense sub-tags). Selecting "custom" period shows start/end date pickers |

### Goal Settings

| Setting | Default | Description |
|--------|--------|------|
| Enable goal feature | Off | When enabled, you can set income goals and track progress in the panel |
| Goal list | (empty) | Add multiple goals, each with: name, target amount, period, associated tag. Tags are selected from a dropdown (includes all income sub-tags). Selecting "custom" period shows start/end date pickers |

### Panel Statistics Settings

| Setting | Default | Description |
|--------|--------|------|
| Statistics mode | Monthly | Options: daily, weekly, monthly, yearly, all-time |
| Month start date | 1 | Only effective for monthly statistics; sets the start day of each statistical month (1-28) |
| Week start day | Monday | Only effective for weekly statistics |

### Advanced Settings

| Setting | Default | Description |
|--------|--------|------|
| Show edit button in query results | On | When enabled, each record in query results shows an edit button (✏️); click to edit that record |
| Show note link in query results | On | When enabled, each record in query results shows a source note link; click to navigate to the note containing that record |
| Global query | (empty) | Directives that are automatically appended to every query |

### Path Settings

| Setting | Default | Description |
|--------|--------|------|
| Exclude paths | (empty) | Exclude these paths from indexing. Comma-separated. Mutually exclusive with include paths. |
| Include paths | (empty) | Only index files in these paths. Comma-separated. Mutually exclusive with exclude paths. |

---

## Cashlog Panel

The Cashlog Panel is a standalone tab that provides a visual dashboard for your cashlog data and comprehensive settings management.

### Opening the Panel

There are three ways:

1. `Ctrl+P` → Search for "Open Cashlog Panel" → Press Enter
2. While viewing statistics data in plugin settings
3. Set a hotkey binding for the `open-cashlog-panel` command

The panel opens as a new tab on the right side, titled "Cashlog Panel" with a ¥ icon.

### Dashboard

The dashboard page displays the following content. **All data areas are clickable** to enter detailed views. Use the back button at the top to return to the dashboard main page.

**Statistics Time Range**: The blue gradient label at the top shows the current statistics mode and date range (e.g., "Monthly 2026-04-05 ~ 2026-05-01").

**Summary Cards** (four cards, all clickable):
- **Income**: Total income for the statistical period. Click to enter the income detail page listing all income entries
- **Expense**: Total expense for the statistical period. Click to enter the expense detail page listing all expense entries
- **Balance**: Income - Expense (negative values shown with `-` sign). Click to enter the income/expense detail page listing all entries
- **Count**: Total number of transactions in the statistical period (including transfers and balance adjustments). Click to enter the all-entries page listing all records

**Account Balances** (if account feature is enabled):
- Displays each account's name and current balance in a list
- Positive balances shown in green, negative in red
- **Click an account row** to enter that account's balance detail page, showing:
  - Balance detail card: Initial balance → Income subtotal → Expense subtotal → Transfers in → Transfers out → Balance adjustments → Current balance
  - Full list of entries for that account (with edit buttons and note links)
  - Current balance = Initial balance + Sum of each type

**Budget Progress** (if budget feature is enabled):
- Each budget shows a progress bar with used/total amounts and a period label
- Progress bar turns red when over budget
- **Click a budget item** to enter its expense detail page, filtered by the budget's own period and tag

**Goal Progress** (if goal feature is enabled):
- Each goal shows a progress bar with achieved/target amounts and a period label
- Progress bar turns bright green when goal is reached
- **Click a goal item** to enter its income detail page, filtered by the goal's own period and tag

**Recent Transactions**:
- The 10 most recent income/expense records, sorted by date descending
- Each shows: date, description, account, amount
- **Hover** over any row to see a popup with the full record details (date/time, tag, description, account amount details, type)

**Expense Category Ranking**:
- Amounts summarized by expense category, showing top 5 as progress bars
- Displays amount and percentage
- **Click the title** (with ▸ icon) to enter a pie chart page showing category breakdown
- **Click a specific category progress bar** to enter that category's expense detail page

### Panel Settings

Click the "Settings" tab at the bottom of the panel to manage all settings directly within the panel:

- **Tag Settings**: Income/expense/transfer/balance-change tag names (button style, click to edit in dialog, auto-migrates historical records on change)
- **Sub-Tag Presets**: Category options (chip button list, right-click menu supports edit/delete, click `+` to add)
- **Account Settings**: Enable/disable, account chip list (right-click to edit/delete, `+` to add), **Initial Balance** (button style, click to edit in dialog)
- **Attachment Settings**: Enable/disable, storage directory (supports folder fuzzy matching)
- **Budget Settings**: Enable/disable, add/delete budgets (name, amount, period, tag dropdown selection)
- **Goal Settings**: Enable/disable, add/delete goals (name, target amount, period, tag dropdown selection)
- **Statistics Settings**: Statistics mode (daily/weekly/monthly/yearly/all-time), month start day, week start day
- **Advanced Settings**: Edit button, note links, global query
- **Reset**: Restore all settings to default values

Panel settings are fully synchronized with the native Obsidian settings page; changes in either location are automatically synced.

---

## Budgets and Goals

### Setting a Budget

Budgets are used to control spending and track whether expenses in a category exceed the plan.

**Method 1: Via Panel Settings**

1. Open the Cashlog Panel → Switch to the "Settings" tab at the bottom
2. After enabling the budget feature, fill in the form:
   - Name: e.g., "Monthly Dining Budget"
   - Amount: e.g., 2000
   - Tag: Select from dropdown (includes the main expense tag and all sub-tags), e.g., `#expense/food`
   - Period: Select "Weekly", "Monthly", "Yearly", or "Custom"
3. Selecting "Custom" period will show start/end date pickers for specifying any date range
4. Click "Add"

**Method 2: Via Settings Page**

1. Open Settings → Cashlog → Enable "Budget Feature"
2. Fill in the new budget form and add

**Viewing Budget Progress**:

Open the Cashlog Panel → Dashboard, and check the "Budget Progress" section to see progress bars and used amounts for each budget.

Each budget calculates its progress independently based on its configured period. For example:
- A "monthly" dining budget only counts dining expenses for the current month to date
- A "yearly" shopping budget counts all shopping expenses for the current year
- A "custom" budget counts expenses within the specified start/end date range

### Setting a Goal

Goals are used to plan income and track whether an income source meets expectations.

The setup is similar to budgets. Fill in:
- Name: e.g., "Monthly Salary Goal"
- Target amount: e.g., 10000
- Tag: Select from dropdown (includes the main income tag and all sub-tags), e.g., `#income/salary`
- Period: Select a period; choosing "Custom" allows setting start/end dates

Each goal also calculates its progress independently based on its configured period. View progress the same way as budgets.

---

## Query Syntax

### Basic Structure

Use `cashlog` code blocks in Markdown notes to query your cashlog data:

````markdown
```cashlog
directive1
directive2
directive3
...
```
````

Write one directive per line. Directives are case-insensitive. Multiple filter directives are combined with AND logic (all must be satisfied). Multiple values within a filter directive can be joined with `OR` for OR logic.

A complete query typically includes:
1. **Filter**: Select entries matching conditions
2. **Sort**: Arrange by a specific field
3. **Group**: Display results in categories
4. **Summary**: Show statistics

### Filter Directives

#### Type Filter

| Directive | Description |
|------|------|
| `is income` | Show only income entries |
| `is expense` | Show only expense entries |
| `is transfer` | Show only transfer entries |
| `is balance change` | Show only balance adjustment entries |

Example:
```
is expense
```

```
is transfer
```

#### Tag Filter

| Directive | Description |
|------|------|
| `tag includes #expense` | Tag contains `#expense` (includes sub-tags like `#expense/transport`, `#expense/food`, etc.) |
| `tag includes #expense/transport` | Tag exactly contains `#expense/transport` |
| `tag includes #expense/transport OR #expense/food` | Tag contains `#expense/transport` or `#expense/food` |
| `tag does not include #expense/food` | Tag does not contain `#expense/food` |
| `tag does not include #expense/food OR #expense/shopping` | Tag does not contain `#expense/food` and does not contain `#expense/shopping` |

Example:
```
tag includes #expense/transport
```

```
tag includes #expense/transport OR #expense/food OR #expense/shopping
```

#### Description Filter

| Directive | Description |
|------|------|
| `description includes high-speed train` | Description contains "high-speed train" |
| `description includes high-speed train OR flight` | Description contains "high-speed train" or "flight" |
| `description does not include salary` | Description does not contain "salary" |
| `description does not include salary OR bonus` | Description does not contain "salary" and does not contain "bonus" |

Example:
```
description includes high-speed train
```

```
description includes high-speed train OR flight OR taxi
```

#### Amount Filter

| Directive | Description |
|------|------|
| `amount above 100` | Absolute amount is greater than 100 |
| `amount above or equal 100` | Absolute amount is greater than or equal to 100 |
| `amount above or equal 100 OR 200` | Absolute amount is greater than or equal to 100 or 200 |
| `amount below 50` | Absolute amount is less than 50 |
| `amount below or equal 50` | Absolute amount is less than or equal to 50 |
| `amount equals 100` | Absolute amount equals 100 |
| `amount equals 100 OR 200 OR 500` | Absolute amount equals 100, 200, or 500 |

**Note**: Amount filtering compares absolute values and does not distinguish between income and expense. To see only large expenses, use both `is expense` and `amount above`.

Example:
```
is expense
amount above 500
```

```
amount equals 100 OR 200 OR 500
```

#### Account Filter (requires account feature enabled)

| Directive | Description |
|------|------|
| `account is WeChat` | Account name contains "WeChat" |
| `account is WeChat OR Alipay` | Account name contains "WeChat" or "Alipay" |
| `account is not Cash` | Account name does not contain "Cash" |

Example:
```
account is WeChat
```

```
is expense
account is Alipay
```

#### Attachment Filter

| Directive | Description |
|------|------|
| `has attachment` or `has attachments` | Show only entries with attachments |

Example:
```
has attachment
sort by date descending
```

#### Date Filter

Date filtering supports a rich set of operators and date formats.

##### Operators

| Operator | Description |
|--------|------|
| `date on <date>` or `date <date>` | Match the specified date (`on` is optional) |
| `date before <date>` | Match all dates before the specified date (not inclusive) |
| `date after <date>` | Match all dates after the specified date (not inclusive) |
| `date on or before <date>` | Match the specified date and all dates before it |
| `date on or after <date>` | Match the specified date and all dates after it |

##### Absolute Dates

Format is `YYYY-MM-DD`:

```
date 2026-04-25
date before 2026-05-01
date on or after 2026-01-01
```

##### Natural Language Dates

Supports natural language date descriptions (powered by the chrono library):

```
date today
date yesterday
date tomorrow
date next monday
date last friday
date 14 days ago
date in two weeks
date 14 October
date May
```

##### Relative Date Ranges

Supports `last`, `this`, `next` with `week`, `month`, `quarter`, `year`:

```
date this week
date this month
date this quarter
date this year
date last week
date last month
date next month
date next year
```

##### Numbered Date Ranges

| Format | Example | Description |
|------|------|------|
| `YYYY` | `date 2026` | Match the entire year 2026 |
| `YYYY-mm` | `date 2026-04` | Match the entire month of April 2026 |
| `YYYY-Www` | `date 2026-W15` | Match ISO week 15 of 2026 (Monday to Sunday) |
| `YYYY-Qq` | `date 2026-Q2` | Match Q2 of 2026 |

##### Absolute Date Ranges

Use two `YYYY-MM-DD` dates to specify a closed interval:

```
date 2026-01-01 2026-03-31
```

#### Path Filter

| Directive | Description |
|------|------|
| `path includes journal/` | File path contains "journal/" |
| `path includes accounting` | File path contains "accounting" |
| `path includes accounting/2026 OR accounting/2025` | File path contains "accounting/2026" or "accounting/2025" |

Example:
```
path includes accounting/2026
```

### Sort Directives

| Directive | Description |
|------|------|
| `sort by date ascending` | Sort by date, earliest to latest |
| `sort by date descending` | Sort by date, latest to earliest |
| `sort by amount ascending` | Sort by amount, smallest to largest |
| `sort by amount descending` | Sort by amount, largest to smallest |
| `sort by description ascending` | Sort by description alphabetically |
| `sort by account ascending` | Sort by account name alphabetically |

Example:
```
sort by date descending
```

```
sort by account ascending
```

### Group Directives

| Directive | Description |
|------|------|
| `group by tag` | Group by tag |
| `group by date` | Group by date (same day = one group) |
| `group by week` | Group by week (same year and week = one group, ISO week, Monday to Sunday) |
| `group by month` | Group by month (same year and month = one group) |
| `group by year` | Group by year |
| `group by account` | Group by account |
| `group by type` | Group by type (income/expense/transfer/balance adjustment) |

After grouping, each group displays its entry list and group subtotal.

Example:
```
group by tag
```

```
group by month
```

```
# View transactions by account
group by account
sort by date ascending
```

### Summary Directives

| Directive | Description |
|------|------|
| `show total` | Show total income, total expense, balance, and entry count |
| `show total income` | Show only total income |
| `show total expense` | Show only total expense |
| `show balance` | Show only balance (income + expense) |
| `show count` | Show only entry count |

`show total` is equivalent to writing `show total income` + `show total expense` + `show balance` + `show count` together.

Example:
```
is expense
date this month
show total expense
```

### Display Controls

| Directive | Description |
|------|------|
| `hide date` | Hide the date for each record |
| `hide time` | Hide the time for each record |
| `hide tag` | Hide the tag for each record |
| `hide amount` | Hide the amount for each record |
| `hide account` | Hide the account for each record |
| `show account` | Force show the account column |
| `list style unordered` | Display as unordered list (default) |
| `list style ordered` | Display as ordered list |
| `list style none` | No list styling (plain text block) |

Example:
```
hide time
hide tag
```

```
list style ordered
```

```
# View all entries with accounts
show account
sort by date descending
```

### Table Configuration

Through the insert chart menu or manual code block editing, you can customize the number of columns and the content of each column.

#### Table Columns

| Directive | Description |
|------|------|
| `table columns 2` | Set table to 2 columns |
| `table columns 3` | Set table to 3 columns |

Default is 6 columns.

#### Column Configuration

The configuration format for each column is `colN field ["header name"] [alignment]`, where N is the column number (1-6).

| Parameter | Options | Description |
|------|--------|------|
| Field | `date`, `amount`, `account`, `description`, `attachment`, `link` | Data type displayed in this column |
| Header name | `"Custom Name"` | Optional; custom header text. Leave empty for default name |
| Alignment | `left`, `center`, `right` | Optional; text alignment for this column |

Example:
```
# 2-column table, time centered, amount right-aligned
table columns 2
col1 date "Date" center
col2 amount "Amount" right
```

```
# 3-column table with account column
table columns 3
col1 date "Date" left
col2 account "Account" center
col3 amount "Amount" right
```

```
# 3-column table, hidden headers
table columns 3
col1 date "" left
col2 amount "" left
col3 description "" left
```

### Limiting Results

| Directive | Description |
|------|------|
| `limit to 10` | Show at most 10 results |

Example:
```
limit to 20
```

### Comments

Lines starting with `#` are comments and will not be executed:

```
# This is a comment and will not affect the query
```

---

## Complete Query Examples

### Example 1: Expense Details This Month

View all expenses this month, sorted by date from newest to oldest, and show total expenses:

````markdown
```cashlog
# Expense details this month
is expense
date this month
sort by date descending
show total expense
```
````

### Example 2: Annual Income Summary

View all income this year, sorted by amount from highest to lowest:

````markdown
```cashlog
# Income overview this year
is income
date this year
sort by amount descending
show total income
```
````

### Example 3: Transportation Expenses

View all transportation-related expenses:

````markdown
```cashlog
# Transportation expenses
tag includes #expense/transport
sort by date descending
show total expense
```
````

### Example 4: Large Expense Statistics

View expenses over 200, sorted by amount from highest to lowest, showing only the first 20:

````markdown
```cashlog
# Large expenses (>200)
is expense
amount above 200
sort by amount descending
limit to 20
show total expense
show count
```
````

### Example 5: Income and Expenses Grouped by Month

View all records this year, grouped by month, showing monthly summaries:

````markdown
```cashlog
# Monthly income and expenses this year
date this year
group by month
sort by date ascending
show total
```
````

### Example 6: This Month's Expenses Grouped by Category

View this month's expenses, grouped by tag, showing subtotals for each category:

````markdown
```cashlog
# Expense category statistics this month
is expense
date this month
group by tag
show total expense
```
````

### Example 7: Data from Specific Files

Only view data from the "accounting" folder:

````markdown
```cashlog
# Accounting book data
path includes accounting/
show total
```
````

### Example 8: Compact Display

Only show description and amount, hide date, time, and tags:

````markdown
```cashlog
# Compact list
is expense
date this month
hide date
hide time
hide tag
show total expense
```
````

### Example 9: Custom Table Columns

Customize the table to 2 columns, with time centered and amount right-aligned:

````markdown
```cashlog
# Income and expense overview
is expense
date this month
sort by date descending
table columns 2
col1 date "Date" center
col2 amount "Amount" right
```
````

### Example 10: View Transactions by Account

View all transactions for a specific account:

````markdown
```cashlog
# WeChat account transactions
account is WeChat
sort by date descending
show total
```
````

### Example 11: View Transfer Records

View all transfer records:

````markdown
```cashlog
# Transfer records
is transfer
sort by date descending
```
````

### Example 12: View Entries with Attachments

````markdown
```cashlog
# Entries with attachments
has attachment
sort by date descending
```
````

### Example 13: Multi-Account Comparison

View income and expenses for each account, grouped by account:

````markdown
```cashlog
# Account income and expense comparison
date this month
group by account
show total
```
````

### Example 14: Cross-Group by Month and Account

Combine multiple conditions to view specific category expenses for a specific account:

````markdown
```cashlog
# WeChat dining expenses this month
is expense
date this month
account is WeChat
tag includes #expense/food
sort by date descending
show total expense
```
````

### Example 15: View Balance Change Records

````markdown
```cashlog
# Balance change records
is balance change
sort by date descending
```
````

### Example 16: This Month's Income and Expenses Grouped by Type

````markdown
```cashlog
# Summary by type this month
date this month
group by type
show total
```
````

### Example 17: Table Code Block

Insert a table view in a note:

````markdown
```cashlog-chart
# Expense detail table this month
is expense
date this month
sort by date descending
show summary
show tag in description
table columns 4
col1 date "Date" left
col2 amount "Amount" right
col3 description "Description" left
col4 link "Source" left
```
````

### Example 18: Bar Chart — Monthly Income vs. Expenses

View net balance, income, and expenses by month:

````markdown
```cashlog-chart
# Monthly income vs. expenses
group by month
chart type bar
chart title "Monthly Income vs. Expenses"
chart bar split by valueType
chart legend true
chart labels true
```
````

> The X-axis shows months, with three bars per month: net balance (first bar), income, and expenses.

### Example 19: Bar Chart — Monthly Expenses by Account

View the distribution of expenses by account for each month (one bar per account):

````markdown
```cashlog-chart
# Monthly expenses by account
group by month
chart type bar
chart title "Monthly Expenses by Account"
chart bar split by account
chart bar items WeChat Alipay BankCard
chart legend true
chart labels true
```
````

### Example 20: Bar Chart — Account Comparison by Type

View account distribution by type:

````markdown
```cashlog-chart
# Income and expenses by account type
group by type
chart type bar
chart title "Income and Expenses by Account Type"
chart bar split by account
chart bar items WeChat Alipay
chart legend true
chart labels true
```
````

### Example 21: Bar Chart — Tag Transactions by Account

View amounts by tag for each account:

````markdown
```cashlog-chart
# Tag income and expenses by account
group by account
chart type bar
chart title "Tag Income and Expenses by Account"
chart bar split by tag
chart bar items #expense #income #transfer #balance-change
chart legend true
chart labels true
```
````

### Example 22: Line Chart — Monthly Income and Expense Trends

View the trends of net balance, income, and expenses by month:

````markdown
```cashlog-chart
# Monthly income and expense trends
date this year
group by month
chart type line
chart title "Monthly Income and Expense Trends"
chart line split by valueType
chart legend true
chart labels true
```
````

> Three lines per month: net balance, income, and expenses. Line chart X-axis only supports time dimensions (month/week/day/year).

### Example 23: Line Chart — Monthly Expense Comparison by Tag

View monthly expense trends by tag with multi-line comparison:

````markdown
```cashlog-chart
# Monthly expenses by tag
is expense
date this year
group by month
chart type line
chart title "Monthly Expense Trends by Tag"
chart line split by tag
chart line items #expense/food #expense/transport #expense/entertainment
chart legend true
chart labels true
```
````

### Example 24: Line Chart — No Grouping, Net Balance Trend

View monthly net balance changes (single line):

````markdown
```cashlog-chart
# Monthly net balance
date this year
group by month
chart type line
chart title "Monthly Net Balance Trend"
chart line split by none
chart legend true
chart labels true
```
````

### Example 25: Bar Chart — View Expenses by Week

View expense distribution by week:

````markdown
```cashlog-chart
# Weekly expenses
is expense
date this month
group by week
chart type bar
chart title "Weekly Expenses"
chart bar split by type
chart legend true
chart labels true
```
````

### Example 26: Pie Chart — Expense Category Breakdown This Month

````markdown
```cashlog-chart
# Expense categories this month
is expense
date this month
group by tag
chart type pie
chart title "Expense Category Breakdown This Month"
chart legend true
```
````

> When grouped by tag/type, values are fixed to absolute amounts, so `chart value` is not needed.

### Example 27: Pie Chart — Monthly Net Balance Composition

````markdown
```cashlog-chart
# Monthly net balance
date this year
group by month
chart type pie
chart title "Monthly Net Balance Composition"
chart value balance
chart legend true
```
````

### Example 28: Pie Chart — Account Inflow Composition

````markdown
```cashlog-chart
# Inflow by account
date this year
group by account
chart type pie
chart title "Account Inflow Composition"
chart value inflow
chart legend true
```
````

> When grouped by account, `inflow` calculates all positive amounts for that account (income + transfer in + balance increase).

---

## Workflow Suggestions

### Recommended File Organization

**Method 1: Record in Daily Notes**

Record daily income and expenses in your daily notes:

```markdown
# 2026-04-25

## Today's Income and Expenses
- #expense/transport high-speed train 💴-100 ➕2026-04-25 ⏰17:30
- #expense/food lunch 💴-25 ➕2026-04-25 ⏰12:00
- #income/investment fund returns 💴120 ➕2026-04-25
```

Combined with template plugins like Templater, you can automatically insert a `## Today's Income and Expenses` heading in each daily note.

**Method 2: Dedicated Accounting File**

Create an `accounting.md` file with all records in it:

```markdown
# Accounting

## 2026-04
- #expense/transport high-speed train 💳WeChat💴-100 ➕2026-04-25 ⏰17:30
- #income/salary salary payment 💳BankCard💴10000 ➕2026-04-25 ⏰09:00
- #transfer credit card repayment 💳BankCard💴-500 💳CreditCard💴500 ➕2026-04-25
- #balance-change balance adjustment 💳Alipay💴50 ➕2026-04-25
- #expense/food lunch 💳Alipay💴-25 ➕2026-04-24 ⏰12:00
```

**Method 3: Separate Files per Month**

One file per month, such as `accounting/2026-04.md`:

```markdown
# April 2026

- #expense/transport high-speed train 💳WeChat💴-100 ➕2026-04-25 ⏰17:30
- #income/salary salary payment 💳BankCard💴10000 ➕2026-04-05 ⏰09:00
```

Regardless of which method you use, the query syntax automatically indexes all cashlog entries across the entire Vault.

### Recommended Monthly Summary Note

Create a "Monthly Summary" note with query blocks for automatic statistics:

````markdown
# Monthly Financial Summary

## Expense Details This Month
```cashlog
is expense
date this month
sort by date descending
group by tag
show total expense
```

## Income Details This Month
```cashlog
is income
date this month
sort by date descending
show total income
```

## Transfer Records This Month
```cashlog
is transfer
date this month
sort by date descending
```

## Income and Expense Overview This Month
```cashlog
date this month
show total
```
````

### Using with the Panel

1. Set a hotkey for the `open-cashlog-panel` command (e.g., `Ctrl+Shift+J`)
2. Use the `Create or edit cashlog` command daily to record entries
3. Press the hotkey to open the panel and view daily/weekly/monthly statistics
4. Set budgets and goals; the panel automatically tracks progress

---

## FAQ

**Q: Do cashlog entries need to be written in specific files?**

No. The plugin automatically scans all Markdown files in the Vault. Cashlog entries in any file will be indexed.

**Q: Can I write cashlog entries manually without using commands?**

Yes. As long as the format is correct, the plugin will recognize it. The basic format is: `- #tag description 💴amount ➕date ⏰time`

**Q: Does the account feature require each account to be set up in advance?**

It is recommended to add account names in settings beforehand so you can select them from the dropdown during editing. If you use an account name in manual format that hasn't been set up, the plugin will still recognize it automatically and display it in the settings page (identified by a dashed border). However, the initial balance can only be set through settings.

**Q: How do I modify or delete an account?**

In the panel settings → Account settings, right-click an account chip to rename or delete it. Renaming an account automatically migrates all historical entries. When deleting an account, you need to select a target account — all entries under the original account will be transferred to the target account, and balances will be merged.

**Q: Do transfers affect income and expense statistics?**

No. Transfer entries have both `isIncome` and `isExpense` set to false, so they are not included in income or expense summaries. Transfers only affect the balances of the two accounts involved.

**Q: Do balance changes affect income and expense statistics?**

No. Balance change entries are similar to transfers — they are not included in income or expense statistics and only affect the balance of the corresponding account. They are primarily used for adjusting account balances during reconciliation.

**Q: Can transfer tags and balance change tags be customized?**

Yes. You can modify them in the Cashlog panel → Settings → Tag settings (only visible when the account feature is enabled). Click the tag button to edit; changes automatically migrate all historical transfer/balance change records.

**Q: Where are attachments stored?**

Attachment images are stored in the directory specified in plugin settings (default: `cashlog-attachments/`), with filenames in the format `cashlog-YYYYMMDDHHmmssSSS.png`.

**Q: Do sub-tags need to be configured in settings in advance?**

No. Sub-tags in settings are just shortcuts in the edit dialog. The plugin automatically scans all sub-tags found in the vault and displays them on the settings page (identified by a dashed border). You can also see them in the dropdown menu when editing entries. You can manually enter any sub-tag, such as `#expense/pets`, `#income/side-job`, etc.

**Q: What happens to historical data when tags/sub-tags are modified or deleted?**

When renaming a tag, the plugin automatically migrates tags in all historical records (preserving sub-tag mappings). When deleting a sub-tag, the plugin simultaneously deletes all entries under that sub-tag and provides a prompt. These operations are irreversible, so it is recommended to back up your vault before proceeding.

**Q: What should I do if the query code block shows "Query Error"?**

Check that the directive spelling is correct. The error message will tell you which specific line has the problem. Common errors include:
- Incorrect date format
- Misspelled directive names
- The path specified in `path includes` is in the exclude paths or not in the include paths

**Q: What date formats does the date filter support?**

The date filter supports multiple formats:
- Absolute date: `date 2026-04-25`
- Natural language: `date today`, `date yesterday`, `date next monday`, `date 14 days ago`
- Relative ranges: `date this week`, `date last month`, `date next year`
- Numbered ranges: `date 2026` (full year), `date 2026-04` (full month), `date 2026-W15` (full week), `date 2026-Q2` (quarter)
- Absolute ranges: `date 2026-01-01 2026-03-31`

**Q: Query results not updating after modifying files?**

The plugin monitors file changes and automatically updates the cache. If results don't update, try closing and reopening the note containing the query code block.

**Q: Exclude/include path settings not taking effect?**

After modifying paths, you need to click the "Apply" button next to the input field for changes to take effect. Once applied, the plugin will re-index files.

**Q: How do I switch the statistics mode in the panel?**

In the Cashlog panel → Settings → Statistics mode. Supports daily, weekly (with configurable start day), monthly (with configurable start day), yearly, or all-time statistics. The dashboard data refreshes immediately after switching.

**Q: What is the difference between budgets and goals?**

- **Budgets** are for controlling expenses, monitoring whether spending in a category exceeds the plan
- **Goals** are for planning income, tracking whether an income source meets expectations
- Both are displayed as progress bars in the panel dashboard
